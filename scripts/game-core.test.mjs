import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../web/src/core/config.js';
import { mulberry32, shuffle } from '../web/src/core/rng.js';
import { generateBoard, revealChain, neighbors } from '../web/src/core/board.js';
import { createRun, applyAction } from '../web/src/core/rules.js';
import { completion, discountedPrice, surplusCoins, settleRecipe } from '../web/src/core/recipe.js';
import { serialize, deserialize, validate, migrate, SAVE_VERSION } from '../web/src/core/save.js';

const SEED = 20261118;
const FIRST = 27;

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

function scan(state, index) {
  return applyAction(state, { type: 'scan', index });
}

function openedRun(seed = SEED, first = FIRST) {
  const run = createRun({ wish: 'relief', seed });
  return scan(run, first).state;
}

test('① rng：同 seed 序列一致，rngState 可序列化续接，shuffle 确定', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const head = Array.from({ length: 5 }, () => a());
  assert.deepEqual(head, Array.from({ length: 5 }, () => b()));
  const resumed = mulberry32(a.getState());
  const tailA = Array.from({ length: 5 }, () => a());
  const tailB = Array.from({ length: 5 }, () => resumed());
  assert.deepEqual(tailA, tailB);
  const s1 = shuffle([0, 1, 2, 3, 4, 5, 6, 7], mulberry32(7));
  const s2 = shuffle([0, 1, 2, 3, 4, 5, 6, 7], mulberry32(7));
  assert.deepEqual(s1, s2);
});

test('② board：雷数精确、首击安全、数字暴力重算、内容互斥、出口非雷、同 seed 逐格一致', () => {
  const cfg = CONFIG.floors[1];
  const { cells, exit } = generateBoard(cfg, SEED, FIRST);
  assert.equal(cells.filter((c) => c.mine).length, cfg.mines);
  const zone = [FIRST, ...neighbors(FIRST, cfg.width, cfg.height)];
  for (const i of zone) assert.equal(cells[i].mine, false);
  assert.equal(cells[FIRST].adj, 0);
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].mine) continue;
    const x = i % cfg.width;
    const y = Math.floor(i / cfg.width);
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (dx === 0 && dy === 0) continue;
        if (nx < 0 || nx >= cfg.width || ny < 0 || ny >= cfg.height) continue;
        if (cells[ny * cfg.width + nx].mine) count++;
      }
    }
    assert.equal(cells[i].adj, count);
  }
  assert.equal(cells[exit].mine, false);
  assert.equal(cells[exit].content, null);
  for (const c of cells) if (c.mine) assert.equal(c.content, null);
  const waterCells = cells.filter((c) => c.content?.type === 'water');
  assert.equal(waterCells.length, cfg.water.length);
  assert.equal(waterCells.reduce((s, c) => s + c.content.amount, 0), 80);
  const again = generateBoard(cfg, SEED, FIRST);
  assert.deepEqual(again.cells, cells);
  assert.equal(again.exit, exit);
  const l2 = generateBoard(CONFIG.floors[2], SEED, 55);
  const dust = l2.cells.filter((c) => c.content?.type === 'stardust');
  assert.equal(dust.length, 3);
  assert.equal(dust.reduce((s, c) => s + c.content.amount, 0), 10);
  assert.equal(l2.cells.filter((c) => c.mine).length, 16);
});

test('③ BFS：只揭可达 0 连通域+边界数字格，绝不揭雷，序稳定，连锁不耗额外体力', () => {
  const cfg = CONFIG.floors[1];
  const { cells, exit } = generateBoard(cfg, SEED, FIRST);
  const chain = revealChain(cells, cfg.width, cfg.height, FIRST);
  assert.equal(chain[0], FIRST);
  assert.ok(chain.length > 1);
  const set = new Set(chain);
  assert.equal(set.size, chain.length);
  for (const i of chain) {
    assert.equal(cells[i].mine, false);
    if (cells[i].adj === 0) {
      for (const n of neighbors(i, cfg.width, cfg.height)) {
        if (!cells[n].mine) assert.ok(set.has(n), `0 格 ${i} 的邻居 ${n} 应在连锁内`);
      }
    }
  }
  assert.ok(chain.some((i) => cells[i].adj > 0), '应包含边界数字格');
  const depth = new Map([[FIRST, 0]]);
  let prevDepth = 0;
  for (const i of chain) {
    if (i !== FIRST) {
      const parents = neighbors(i, cfg.width, cfg.height)
        .filter((n) => cells[n].adj === 0 && depth.has(n));
      assert.ok(parents.length > 0, '每格都应由更早的 0 格扩展而来');
      depth.set(i, Math.min(...parents.map((n) => depth.get(n))) + 1);
    }
    assert.ok(depth.get(i) >= prevDepth, 'BFS 序应由近及远');
    prevDepth = depth.get(i);
  }
  assert.deepEqual(revealChain(cells, cfg.width, cfg.height, FIRST), chain);
  const mineIndex = cells.findIndex((c) => c.mine);
  assert.deepEqual(revealChain(cells, cfg.width, cfg.height, mineIndex), []);
  const numberIndex = chain.find((i) => cells[i].adj > 0);
  assert.deepEqual(revealChain(cells, cfg.width, cfg.height, numberIndex), [numberIndex]);

  const run = createRun({ wish: 'fun', seed: SEED });
  const { state, effects } = scan(run, FIRST);
  assert.equal(state.stamina, run.stamina - 1);
  const reveals = effects.find((e) => e.type === 'reveals');
  assert.deepEqual(reveals.indices, chain);
  assert.ok(!chain.includes(exit) || state.status === 'extract-ready');
});

test('④ scan：扣 1 体力、已开格/体力 0 拒绝、耗尽紧急撤离 carried→stored', () => {
  const run = createRun({ wish: 'relief', seed: SEED });
  const first = scan(run, FIRST);
  assert.equal(first.state.stamina, CONFIG.floors[1].stamina - 1);
  const repeat = scan(first.state, FIRST);
  assert.equal(repeat.state, first.state);
  assert.equal(repeat.effects[0].type, 'rejected');
  const exhausted = { ...first.state, stamina: 0 };
  const denied = scan(exhausted, 0);
  assert.equal(denied.effects[0].type, 'rejected');
  assert.equal(denied.state.stamina, 0);

  const { cells, exit } = first.state.board;
  const safe = cells.findIndex((c, i) => !c.mine && !c.revealed && i !== exit
    && !revealChain(cells, 8, 8, i).includes(exit));
  assert.ok(safe >= 0);
  const loaded = { ...first.state, stamina: 1, carried: { water: 10, stardust: 1 } };
  const { state, effects } = scan(loaded, safe);
  assert.equal(state.status, 'emergency');
  assert.equal(state.stamina, 0);
  assert.deepEqual(state.carried, { water: 0, stardust: 0 });
  assert.ok(state.stored.water >= loaded.stored.water + 10);
  assert.ok(state.stored.stardust >= loaded.stored.stardust + 1);
  assert.ok(effects.some((e) => e.type === 'emergency'));
  assert.ok(effects.some((e) => e.type === 'deposit'));
  const extracted = applyAction(state, { type: 'extract' }).state;
  assert.equal(extracted.status, 'extracted');
  assert.equal(applyAction(extracted, { type: 'settle' }).state.status, 'settled');
});

test('⑤ 雷：护盾−1 永久明雷、known 雷再点不触发、归零死亡 carried=0 stored 不变仍进结算', () => {
  const run = openedRun();
  const mineIndex = run.board.cells.findIndex((c) => c.mine);
  const hit = scan(run, mineIndex);
  assert.equal(hit.state.shield, run.shield - 1);
  assert.equal(hit.state.board.cells[mineIndex].known, true);
  assert.equal(hit.state.board.cells[mineIndex].revealed, true);
  assert.ok(hit.effects.some((e) => e.type === 'mine'));
  const again = scan(hit.state, mineIndex);
  assert.equal(again.state, hit.state);
  assert.equal(again.effects[0].type, 'rejected');

  const otherMine = hit.state.board.cells.findIndex((c, i) => c.mine && i !== mineIndex);
  const doomed = {
    ...hit.state,
    shield: 1,
    carried: { water: 30, stardust: 2 },
    stored: { water: 40, stardust: 0 },
  };
  const dead = scan(doomed, otherMine);
  assert.equal(dead.state.status, 'dead');
  assert.equal(dead.state.shield, 0);
  assert.deepEqual(dead.state.carried, { water: 0, stardust: 0 });
  assert.deepEqual(dead.state.stored, { water: 40, stardust: 0 });
  assert.ok(dead.effects.some((e) => e.type === 'death'));
  const settled = applyAction(dead.state, { type: 'settle' });
  assert.equal(settled.state.status, 'settled');
  assert.equal(settled.state.settlement.completion, 0.5 * (40 / 60));
});

test('⑥ 出口：carried→stored 转账；descend 体力回满、护盾保留、carried 清空', () => {
  const run = openedRun();
  const before = { stored: { ...run.stored }, carried: { ...run.carried }, shield: run.shield };
  const atExit = scan(run, run.board.exit);
  assert.equal(atExit.state.status, 'extract-ready');
  assert.equal(atExit.state.stored.water, before.stored.water + before.carried.water);
  assert.equal(atExit.state.stored.stardust, before.stored.stardust + before.carried.stardust);
  assert.deepEqual(atExit.state.carried, { water: 0, stardust: 0 });
  assert.ok(atExit.effects.some((e) => e.type === 'exit'));
  assert.ok(atExit.effects.some((e) => e.type === 'deposit'));

  const down = applyAction(atExit.state, { type: 'descend' });
  assert.equal(down.state.floor, 2);
  assert.equal(down.state.stamina, CONFIG.floors[2].stamina);
  assert.equal(down.state.shield, before.shield);
  assert.deepEqual(down.state.carried, { water: 0, stardust: 0 });
  assert.equal(down.state.board.cells, null);
  assert.equal(down.state.status, 'diving');
  assert.equal(down.state.board.width, 10);
  const tooDeep = applyAction({ ...atExit.state, floor: 2 }, { type: 'descend' });
  assert.equal(tooDeep.effects[0].type, 'rejected');
  const leave = applyAction(atExit.state, { type: 'extract' });
  assert.equal(leave.state.status, 'extracted');
});

test('⑦ recipe：完成度分段 0/50%/100%、折扣取整、余料折钱', () => {
  assert.equal(completion({ water: 0, stardust: 0 }), 0);
  assert.equal(completion({ water: 60, stardust: 0 }), 0.5);
  assert.equal(completion({ water: 0, stardust: 6 }), 0.5);
  assert.equal(completion({ water: 60, stardust: 6 }), 1);
  assert.equal(completion({ water: 999, stardust: 999 }), 1);
  assert.equal(completion({ water: 30, stardust: 3 }), 0.5);
  assert.equal(discountedPrice(0), 100);
  assert.equal(discountedPrice(0.5), 50);
  assert.equal(discountedPrice(1), 0);
  assert.equal(discountedPrice(completion({ water: 20, stardust: 2 })), 67);
  assert.equal(surplusCoins({ water: 30, stardust: 3 }), 0);
  assert.equal(surplusCoins({ water: 80, stardust: 10 }), 20 * 1 + 4 * 5);
  const full = settleRecipe({ water: 60, stardust: 6 });
  assert.equal(full.fulfilled, true);
  assert.equal(full.price, 0);
  assert.equal(settleRecipe({ water: 60, stardust: 0 }).fulfilled, false);
});

test('⑧ reducer：Object.freeze 输入不抛错且原状态不变', () => {
  const run = deepFreeze(createRun({ wish: 'fun', seed: SEED }));
  const snapshot = JSON.stringify(run);
  const first = scan(run, FIRST);
  assert.equal(JSON.stringify(run), snapshot);
  const frozen = deepFreeze(first.state);
  const mineIndex = frozen.board.cells.findIndex((c) => c.mine);
  const hit = scan(frozen, mineIndex);
  assert.equal(hit.state.shield, frozen.shield - 1);
  const atExit = scan(deepFreeze(frozen), frozen.board.exit);
  const down = applyAction(deepFreeze(atExit.state), { type: 'descend' });
  assert.equal(down.state.floor, 2);
  const extracted = applyAction(deepFreeze(atExit.state), { type: 'extract' }).state;
  const settled = applyAction(deepFreeze(extracted), { type: 'settle' });
  assert.equal(settled.state.status, 'settled');
  assert.equal(JSON.stringify(run), snapshot);
});

test('save 骨架：roundtrip 可校验，坏档/版本不符拒绝', () => {
  const run = openedRun();
  const data = deserialize(serialize({ scene: 'dive', run }));
  assert.equal(data.version, SAVE_VERSION);
  assert.equal(validate(data), true);
  assert.deepEqual(data.run, JSON.parse(JSON.stringify(run)));
  assert.equal(deserialize('not json'), null);
  assert.equal(deserialize('null'), null);
  assert.equal(validate({ ...data, version: 99 }), false);
  assert.equal(validate({ ...data, run: { ...run, shield: 9 } }), false);
  assert.equal(validate(null), false);
});

function settledRun() {
  let run = openedRun();
  run = scan(run, run.board.exit).state;
  run = applyAction(run, { type: 'extract' }).state;
  run = applyAction(run, { type: 'settle' }).state;
  return run;
}

test('⑨ save roundtrip：serialize→deserialize 深相等（board.cells/carried/stored/rngState/settlement）', () => {
  const run = settledRun();
  assert.equal(run.status, 'settled');
  assert.ok(run.settlement && Number.isFinite(run.settlement.completion));
  const obj = serialize({ scene: 'result', run });
  assert.equal(obj.version, SAVE_VERSION);
  assert.equal(obj.scene, 'result');
  assert.ok(Number.isFinite(obj.savedAt));
  const fromObj = deserialize(obj);
  assert.equal(validate(fromObj), true);
  assert.deepEqual(fromObj.run, JSON.parse(JSON.stringify(run)));
  assert.deepEqual(fromObj.run.board.cells, run.board.cells);
  assert.deepEqual(fromObj.run.carried, run.carried);
  assert.deepEqual(fromObj.run.stored, run.stored);
  assert.equal(fromObj.run.rngState, run.rngState);
  assert.deepEqual(fromObj.run.settlement, run.settlement);
  const fromStr = deserialize(JSON.stringify(obj));
  assert.deepEqual(fromStr.run, JSON.parse(JSON.stringify(run)));
  const midDive = openedRun();
  const back = deserialize(serialize({ scene: 'dive', run: midDive }));
  assert.deepEqual(back.run, JSON.parse(JSON.stringify(midDive)));
  const tavernSave = deserialize(serialize({ scene: 'tavern', run: null }));
  assert.equal(validate(tavernSave), true);
  assert.equal(tavernSave.run, null);
});

test('⑩ save 坏档：坏 JSON/缺 version/version=999/缺 run/缺 scene → null，migrate 钩子拒旧版', () => {
  const run = openedRun();
  const good = serialize({ scene: 'dive', run });
  assert.equal(deserialize('not json'), null);
  assert.equal(deserialize('{"version":1,'), null);
  assert.equal(deserialize('null'), null);
  assert.equal(deserialize('[]'), null);
  assert.equal(deserialize('42'), null);
  assert.equal(deserialize(null), null);
  assert.equal(deserialize(undefined), null);
  const { version, ...noVersion } = good;
  assert.equal(deserialize(noVersion), null);
  assert.equal(deserialize({ ...good, version: 999 }), null);
  assert.equal(deserialize({ ...good, version: 0 }), null);
  const { run: _r, ...noRun } = good;
  assert.equal(deserialize(noRun), null);
  const { scene, ...noScene } = good;
  assert.equal(deserialize(noScene), null);
  assert.equal(migrate({ version: 0, scene: 'dive', run }), null);
  assert.equal(migrate(null), null);
});

test('⑪ save 纯净：序列化结果不含 effects/anim/particles 等演出字段，污染字段被剥离', () => {
  const run = openedRun();
  const polluted = { ...run, effects: [{ type: 'reveals' }], anim: { t: 0.5 }, particles: [1, 2], shake: 9 };
  const obj = serialize({ scene: 'dive', run: polluted });
  const json = JSON.stringify(obj);
  assert.ok(!json.includes('effects'));
  assert.ok(!json.includes('anim'));
  assert.ok(!json.includes('particles'));
  assert.ok(!json.includes('shake'));
  const back = deserialize(obj);
  assert.deepEqual(back.run, JSON.parse(JSON.stringify(run)));
  const rawPolluted = { version: SAVE_VERSION, scene: 'dive', savedAt: 1, run: polluted };
  assert.deepEqual(deserialize(rawPolluted).run, JSON.parse(JSON.stringify(run)));
});

test('⑫ save clamp：shield 99→3、stamina -5→0、carried 负→0；非法 status/scene/floor 拒绝', () => {
  const run = openedRun();
  const base = { version: SAVE_VERSION, scene: 'dive', savedAt: 1 };
  const clamped = deserialize({ ...base, run: { ...run, shield: 99, stamina: -5, carried: { water: -10, stardust: 2 } } });
  assert.ok(clamped);
  assert.equal(clamped.run.shield, CONFIG.shield.max);
  assert.equal(clamped.run.stamina, 0);
  assert.deepEqual(clamped.run.carried, { water: 0, stardust: 2 });
  assert.equal(validate(clamped), true);
  assert.equal(deserialize({ ...base, run: { ...run, status: 'hacked' } }), null);
  assert.equal(deserialize({ ...base, scene: 'nowhere', run }), null);
  assert.equal(deserialize({ ...base, run: { ...run, floor: 99 } }), null);
  assert.equal(deserialize({ ...base, run: { ...run, board: { ...run.board, width: 3 } } }), null);
});

test('⑬ save 真实续玩：createRun+多次 applyAction 后 roundtrip，恢复后可继续 scan 且结果一致', () => {
  const run = openedRun();
  const safe = run.board.cells.findIndex((c, i) => !c.mine && !c.revealed && i !== run.board.exit
    && !revealChain(run.board.cells, 8, 8, i).includes(run.board.exit));
  assert.ok(safe >= 0);
  const restored = deserialize(serialize({ scene: 'dive', run })).run;
  assert.equal(restored.rngState, run.rngState);
  const a = scan(run, safe);
  const b = scan(restored, safe);
  assert.deepEqual(b.state, a.state);
  assert.deepEqual(b.effects, a.effects);
  const settled = settledRun();
  const back = deserialize(serialize({ scene: 'result', run: settled })).run;
  assert.deepEqual(back.settlement, settled.settlement);
  assert.equal(applyAction(back, { type: 'settle' }).effects[0].type, 'rejected');
});