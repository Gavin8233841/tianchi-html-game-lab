import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../web/src/core/config.js';
import { mulberry32, shuffle } from '../web/src/core/rng.js';
import { generateBoard, revealChain, neighbors } from '../web/src/core/board.js';
import { createRun, applyAction } from '../web/src/core/rules.js';
import { EVENTS, applyEvent } from '../web/src/core/events.js';
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

test('② board：雷数精确、首击格非雷非事件、邻域无雷可含事件、adj=雷+事件暴力重算、内容互斥、出口非雷、同 seed 逐格一致', () => {
  const cfg = CONFIG.floors[1];
  const { cells, exit } = generateBoard(cfg, SEED, FIRST);
  assert.equal(cells.filter((c) => c.mine).length, cfg.mines);
  const zone = [FIRST, ...neighbors(FIRST, cfg.width, cfg.height)];
  for (const i of zone) assert.equal(cells[i].mine, false);
  // v2 首击：格子本身保证安全（非雷非事件），邻域允许事件 → adj=邻格事件数
  assert.equal(cells[FIRST].mine, false);
  assert.equal(cells[FIRST].event, null);
  assert.equal(cells[FIRST].adj, neighbors(FIRST, cfg.width, cfg.height).filter((n) => cells[n].event).length);
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
        const n = cells[ny * cfg.width + nx];
        if (n.mine || n.event) count++;
      }
    }
    assert.equal(cells[i].adj, count);
  }
  assert.equal(cells[exit].mine, false);
  assert.equal(cells[exit].event, null);
  assert.equal(cells[exit].content, null);
  for (const c of cells) if (c.mine) assert.equal(c.content, null);
  const waterCells = cells.filter((c) => c.content?.type === 'water');
  assert.equal(waterCells.length, cfg.water.length);
  assert.equal(waterCells.reduce((s, c) => s + c.content.amount, 0), cfg.water.reduce((s, v) => s + v, 0));
  const again = generateBoard(cfg, SEED, FIRST);
  assert.deepEqual(again.cells, cells);
  assert.equal(again.exit, exit);
  const l2 = generateBoard(CONFIG.floors[2], SEED, 55);
  const dust = l2.cells.filter((c) => c.content?.type === 'stardust');
  assert.equal(dust.length, CONFIG.floors[2].stardust.length);
  assert.equal(dust.reduce((s, c) => s + c.content.amount, 0), CONFIG.floors[2].stardust.reduce((s, v) => s + v, 0));
  assert.equal(l2.cells.filter((c) => c.mine).length, 18);
});

test('②b v2 数字语义：原料格/出口不计入 adj；事件计入 adj；首击格多 seed 恒非特殊', () => {
  let eventOnlyNumber = 0;
  let firstNeighborEvent = 0;
  for (let seed = 1; seed <= 40; seed++) {
    for (const floor of [1, 2]) {
      const cfg = CONFIG.floors[floor];
      const first = floor === 1 ? FIRST : 55;
      const { cells, exit } = generateBoard(cfg, seed, first);
      assert.equal(cells[first].mine, false);
      assert.equal(cells[first].event, null);
      const ns = neighbors(first, cfg.width, cfg.height);
      for (const n of ns) assert.equal(cells[n].mine, false);
      if (ns.some((n) => cells[n].event)) firstNeighborEvent++;
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (c.mine) continue;
        const around = neighbors(i, cfg.width, cfg.height);
        const specials = around.filter((n) => cells[n].mine || cells[n].event).length;
        assert.equal(c.adj, specials, `格 ${i} adj 应=邻格雷+事件数`);
        // 原料与出口不是特殊格：它们存在不影响邻居数字（暴力重算已覆盖），
        // 且它们自身的 adj 也按同一规则计算
        if (around.some((n) => cells[n].event) && !around.some((n) => cells[n].mine) && c.adj > 0) eventOnlyNumber++;
      }
      assert.equal(cells[exit].event, null);
    }
  }
  assert.ok(eventOnlyNumber > 0, '应存在仅由事件贡献的数字格');
  assert.ok(firstNeighborEvent > 0, '首击邻域应允许出现事件（不再必 0）');
});

test('③ BFS：只揭可达 0 连通域+边界数字格，绝不揭雷，序稳定，连锁不耗额外体力；v2 首击 adj>0 时单格', () => {
  const cfg = CONFIG.floors[1];
  // v2 首击 adj=邻格事件数，常>0 → 连锁机制改用首击恰为 0 的 seed 验证
  let zeroSeed = -1;
  for (let seed = 1; seed <= 300; seed++) {
    if (generateBoard(cfg, seed, FIRST).cells[FIRST].adj === 0) { zeroSeed = seed; break; }
  }
  assert.ok(zeroSeed > 0, '应找到首击 adj=0 的 seed');
  const { cells, exit } = generateBoard(cfg, zeroSeed, FIRST);
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

  const run = createRun({ wish: 'fun', seed: zeroSeed });
  const { state, effects } = scan(run, FIRST);
  const eventStamina = effects.filter((e) => e.type === 'event').reduce((s, e) => s + (e.delta.stamina || 0), 0);
  assert.equal(state.stamina, run.stamina - 1 + eventStamina);
  const reveals = effects.find((e) => e.type === 'reveals');
  assert.deepEqual(reveals.indices, chain);
  assert.ok(!chain.includes(exit) || state.status === 'extract-ready');

  // 首击 adj>0（邻域有事件）时：只揭首击格本身，不连锁
  const board2 = generateBoard(cfg, SEED, FIRST);
  if (board2.cells[FIRST].adj > 0) {
    const run2 = createRun({ wish: 'fun', seed: SEED });
    const r2 = scan(run2, FIRST);
    const reveals2 = r2.effects.find((e) => e.type === 'reveals');
    assert.deepEqual(reveals2.indices, [FIRST]);
    assert.equal(r2.state.stamina, run2.stamina - 1);
  }
});

test('④ scan：扣 1 体力、已开格/体力 0 拒绝、耗尽紧急撤离 carried→stored', () => {
  const run = createRun({ wish: 'relief', seed: SEED });
  const first = scan(run, FIRST);
  const firstEventStamina = first.effects.filter((e) => e.type === 'event').reduce((s, e) => s + (e.delta.stamina || 0), 0);
  assert.equal(first.state.stamina, CONFIG.floors[1].stamina - 1 + firstEventStamina);
  const repeat = scan(first.state, FIRST);
  assert.equal(repeat.state, first.state);
  assert.equal(repeat.effects[0].type, 'rejected');
  const exhausted = { ...first.state, stamina: 0 };
  const denied = scan(exhausted, 0);
  assert.equal(denied.effects[0].type, 'rejected');
  assert.equal(denied.state.stamina, 0);

  const { cells, exit } = first.state.board;
  const safe = cells.findIndex((c, i) => {
    if (c.mine || c.revealed || i === exit) return false;
    const chain = revealChain(cells, CONFIG.floors[1].width, CONFIG.floors[1].height, i);
    return !chain.includes(exit) && !chain.some((j) => cells[j].event);
  });
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
  assert.equal(down.state.board.width, CONFIG.floors[2].width);
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
    && !revealChain(run.board.cells, CONFIG.floors[1].width, CONFIG.floors[1].height, i).includes(run.board.exit));
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

function singleScanTargets(state, n) {
  const { cells, exit } = state.board;
  const out = [];
  for (let i = 0; i < cells.length && out.length < n; i++) {
    const c = cells[i];
    if (!c.mine && !c.revealed && !c.known && !c.event && i !== exit && c.adj > 0) out.push(i);
  }
  return out;
}

function withEvent(state, index, eventId) {
  const cells = state.board.cells.slice();
  cells[index] = { ...cells[index], event: eventId };
  return { ...state, board: { ...state.board, cells } };
}

function terrain(cells) {
  return cells.map((c) => [c.mine, c.adj]);
}

test('⑭ 事件数值：supply+8 / repair 上限3 / cache+20 入 carried / interference 3次 / corrode 保底1', () => {
  const run = openedRun();
  const rng = mulberry32(1);
  const supply = applyEvent(run, 'supply', rng);
  assert.equal(supply.run.stamina, run.stamina + 8);
  assert.equal(supply.delta.stamina, 8);
  const repair = applyEvent({ ...run, shield: 2 }, 'repair', rng);
  assert.equal(repair.run.shield, 3);
  const capped = applyEvent({ ...run, shield: 3 }, 'repair', rng);
  assert.equal(capped.run.shield, 3);
  assert.equal(capped.delta.shield, 0);
  const cache = applyEvent(run, 'cache', rng);
  assert.equal(cache.run.carried.water, run.carried.water + 20);
  assert.deepEqual(cache.run.stored, run.stored);
  const jam = applyEvent(run, 'interference', rng);
  assert.deepEqual(jam.run.interference, { extra: 1, remaining: 3 });
  const corrode = applyEvent({ ...run, shield: 2 }, 'corrode', rng);
  assert.equal(corrode.run.shield, 1);
  const floor = applyEvent({ ...run, shield: 1 }, 'corrode', rng);
  assert.equal(floor.run.shield, 1);
  assert.equal(floor.delta.shield, 0);
  assert.equal(floor.run.status, 'diving');
  assert.equal(EVENTS.corrode.kind, 'debuff');
  assert.equal(Object.keys(EVENTS).length, 7);
});

test('⑮ drink 四选一各 25%：+5体力/+1护盾/+10水/−3体力，体力不为负', () => {
  const run = openedRun();
  const at = (v) => { const r = () => v; r.getState = () => 0; return r; };
  const a = applyEvent(run, 'drink', at(0));
  assert.equal(a.run.stamina, run.stamina + 5);
  assert.equal(a.delta.choice, 0);
  const b = applyEvent({ ...run, shield: 2 }, 'drink', at(0.25));
  assert.equal(b.run.shield, 3);
  const c = applyEvent(run, 'drink', at(0.5));
  assert.equal(c.run.carried.water, run.carried.water + 10);
  const d = applyEvent(run, 'drink', at(0.75));
  assert.equal(d.run.stamina, run.stamina - 3);
  const low = applyEvent({ ...run, stamina: 1 }, 'drink', at(0.75));
  assert.equal(low.run.stamina, 0);
  assert.equal(low.delta.stamina, -1);
  const rng = mulberry32(99);
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < 4000; i++) counts[Math.floor(rng() * 4)]++;
  for (const n of counts) assert.ok(Math.abs(n / 4000 - 0.25) < 0.04, `分布偏差过大: ${counts}`);
});

test('⑯ interference buff-aware：恰好 3 次扫描各 +1，第 4 次扣 1，拒绝的扫描不消耗次数', () => {
  let state = openedRun();
  const targets = singleScanTargets(state, 4);
  assert.equal(targets.length, 4);
  state = { ...state, stamina: 20, interference: { extra: 1, remaining: 3 } };
  state = scan(state, targets[0]).state;
  assert.equal(state.stamina, 18);
  assert.deepEqual(state.interference, { extra: 1, remaining: 2 });
  const denied = scan(state, targets[0]);
  assert.equal(denied.effects[0].type, 'rejected');
  assert.deepEqual(denied.state.interference, { extra: 1, remaining: 2 });
  state = scan(state, targets[1]).state;
  assert.equal(state.stamina, 16);
  assert.deepEqual(state.interference, { extra: 1, remaining: 1 });
  state = scan(state, targets[2]).state;
  assert.equal(state.stamina, 14);
  assert.equal(state.interference, null);
  state = scan(state, targets[3]).state;
  assert.equal(state.stamina, 13);
});

test('⑰ 揭示 interference 事件当帧挂 buff：当次扫描不加费，下一次起 +1', () => {
  const run = openedRun();
  const [t] = singleScanTargets(run, 1);
  const forced = withEvent(run, t, 'interference');
  const first = scan(forced, t);
  assert.equal(first.state.stamina, run.stamina - 1);
  assert.deepEqual(first.state.interference, { extra: 1, remaining: 3 });
  assert.ok(first.effects.some((e) => e.type === 'event' && e.id === 'interference'));
  const [u] = singleScanTargets(first.state, 1);
  const second = scan(first.state, u);
  assert.equal(second.state.stamina, first.state.stamina - 2);
  assert.deepEqual(second.state.interference, { extra: 1, remaining: 2 });
});

function radarSetup() {
  for (let seed = 1; seed <= 60; seed++) {
    const run = openedRun(seed);
    if (run.status !== 'diving') continue;
    const { cells, exit, width, height } = run.board;
    for (let t = 0; t < cells.length; t++) {
      const c = cells[t];
      if (c.mine || c.revealed || c.event || t === exit || c.adj === 0) continue;
      const area = [t, ...neighbors(t, width, height)];
      if (area.includes(exit)) continue;
      if (area.some((i) => i !== t && cells[i].event !== null)) continue;
      const hasMine = area.some((i) => cells[i].mine && !cells[i].known);
      const hasHiddenSafe = area.some((i) => i !== t && !cells[i].mine && !cells[i].revealed && i !== exit);
      if (hasMine && hasHiddenSafe) return { run, t, area };
    }
  }
  throw new Error('找不到雷达测试布局');
}

test('⑱ radar：3×3 平铺揭示不递归、雷格免费标 known 不扣护盾、非雷格揭示并拾取', () => {
  const { run, t, area } = radarSetup();
  const before = run.board.cells;
  const forced = withEvent({ ...run, shield: 1 }, t, 'radar');
  const { state, effects } = scan(forced, t);
  assert.equal(state.shield, 1);
  assert.equal(state.status, 'diving');
  const areaSet = new Set(area);
  const expectedReveals = area.filter((i) => !before[i].mine && !before[i].revealed).sort((a, b) => a - b);
  const actualReveals = state.board.cells.map((c, i) => (c.revealed && !before[i].revealed ? i : -1)).filter((i) => i >= 0).sort((a, b) => a - b);
  assert.deepEqual(actualReveals, expectedReveals);
  for (const i of area) {
    if (before[i].mine) {
      assert.equal(state.board.cells[i].known, true);
      assert.equal(state.board.cells[i].revealed, false);
    }
  }
  const marks = effects.find((e) => e.type === 'mine-mark');
  assert.ok(marks);
  assert.deepEqual(marks.indices.slice().sort((a, b) => a - b), area.filter((i) => before[i].mine).sort((a, b) => a - b));
  let water = 0;
  let dust = 0;
  for (const i of expectedReveals) {
    const c = before[i];
    if (c.content && !c.picked) {
      assert.equal(state.board.cells[i].picked, true);
      if (c.content.type === 'water') water += c.content.amount;
      else dust += c.content.amount;
    }
  }
  assert.equal(state.carried.water, run.carried.water + water);
  assert.equal(state.carried.stardust, run.carried.stardust + dust);
  const pickups = effects.filter((e) => e.type === 'pickup');
  assert.equal(pickups.length, expectedReveals.filter((i) => before[i].content && !before[i].picked).length);
  assert.ok(effects.some((e) => e.type === 'event' && e.id === 'radar'));
  for (let i = 0; i < state.board.cells.length; i++) {
    if (!areaSet.has(i)) assert.equal(state.board.cells[i].revealed, before[i].revealed, `3×3 之外 ${i} 不应被连锁揭示`);
  }
});

test('㉓ 嵌套 radar：雷达揭示到的事件格同帧触发，子雷达平铺并入且不重复触发', () => {
  let setup = null;
  for (let seed = 1; seed <= 120 && !setup; seed++) {
    const run = openedRun(seed);
    if (run.status !== 'diving') continue;
    const { cells, exit, width, height } = run.board;
    for (let t = 0; t < cells.length && !setup; t++) {
      const c = cells[t];
      if (c.mine || c.revealed || c.event || t === exit || c.adj === 0) continue;
      for (const u of neighbors(t, width, height)) {
        const d = cells[u];
        if (d.mine || d.revealed || d.event || u === exit || d.adj === 0) continue;
        const union = new Set([t, u, ...neighbors(t, width, height), ...neighbors(u, width, height)]);
        if (union.has(exit)) continue;
        if ([...union].some((i) => cells[i].event !== null)) continue;
        setup = { run, t, u, union: [...union] };
        break;
      }
    }
  }
  assert.ok(setup, '应找到双雷达布局');
  const { run, t, u, union } = setup;
  const before = run.board.cells;
  let forced = withEvent(run, t, 'radar');
  forced = withEvent(forced, u, 'radar');
  const { state, effects } = scan(forced, t);
  const radarEvents = effects.filter((e) => e.type === 'event' && e.id === 'radar');
  assert.equal(radarEvents.length, 2);
  assert.deepEqual(radarEvents.map((e) => e.index).sort((a, b) => a - b), [t, u].sort((a, b) => a - b));
  const expected = union.filter((i) => !before[i].mine && !before[i].revealed).sort((a, b) => a - b);
  const actual = state.board.cells.map((c, i) => (c.revealed && !before[i].revealed ? i : -1)).filter((i) => i >= 0).sort((a, b) => a - b);
  assert.deepEqual(actual, expected);
  for (const i of union) {
    if (before[i].mine) assert.equal(state.board.cells[i].known, true);
  }
  assert.deepEqual(terrain(state.board.cells), terrain(before));
  assert.equal(state.shield, run.shield);
});

test('⑲ 不变式：任意事件 applyEvent/scan 前后所有格 adj 与 mine 逐一相等', () => {
  const ids = Object.keys(EVENTS);
  for (const seed of [SEED, 1, 7, 42]) {
    const run = openedRun(seed);
    const [t] = singleScanTargets(run, 1);
    for (const id of ids) {
      const before = terrain(run.board.cells);
      const direct = applyEvent(run, id, mulberry32(seed), t);
      assert.deepEqual(terrain(direct.run.board.cells), before, `applyEvent ${id} 改了地形`);
      const forced = withEvent(run, t, id);
      const { state } = scan(forced, t);
      assert.deepEqual(terrain(state.board.cells), before, `scan 事件 ${id} 改了地形`);
      assert.equal(state.board.cells.filter((c) => c.mine).length, CONFIG.floors[1].mines);
    }
  }
  let l2 = openedRun();
  l2 = scan(l2, l2.board.exit).state;
  l2 = applyAction(l2, { type: 'descend' }).state;
  l2 = scan(l2, 55).state;
  const [t2] = singleScanTargets(l2, 1);
  for (const id of ids) {
    const before = terrain(l2.board.cells);
    const { state } = scan(withEvent(l2, t2, id), t2);
    assert.deepEqual(terrain(state.board.cells), before, `L2 scan 事件 ${id} 改了地形`);
  }
});

test('⑳ 事件布置：互斥占格、数量符合 config、随机不重复、L1 无 corrode、L2 池含 corrode', () => {
  let l2Corrode = 0;
  for (let seed = 1; seed <= 30; seed++) {
    for (const floor of [1, 2]) {
      const cfg = CONFIG.floors[floor];
      const first = floor === 1 ? FIRST : 55;
      const { cells, exit } = generateBoard(cfg, seed, first);
      assert.equal(cells[first].event, null, '首击格本身不布置事件');
      const eventCells = cells.map((c, i) => ({ c, i })).filter(({ c }) => c.event !== null);
      assert.equal(eventCells.length, cfg.eventCount);
      const ids = eventCells.map(({ c }) => c.event);
      assert.equal(new Set(ids).size, ids.length);
      const pool = CONFIG.events.pools[floor];
      for (const { c, i } of eventCells) {
        assert.ok(pool.includes(c.event));
        assert.equal(c.mine, false);
        assert.equal(c.content, null);
        assert.notEqual(i, exit);
      }
      if (floor === 1) assert.ok(!ids.includes('corrode'));
      if (floor === 2 && ids.includes('corrode')) l2Corrode++;
    }
  }
  assert.ok(l2Corrode > 0, 'L2 池应能掷出 corrode');
  assert.deepEqual(CONFIG.events.pools[1], ['supply', 'repair', 'cache', 'interference', 'drink', 'radar']);
  assert.ok(CONFIG.events.pools[2].includes('corrode'));
});

test('㉑ save：interference 与 cell.event roundtrip，clamp 兼容，非法值拒绝/剥离', () => {
  const run = { ...openedRun(), interference: { extra: 1, remaining: 2 } };
  assert.ok(run.board.cells.some((c) => c.event !== null));
  const back = deserialize(serialize({ scene: 'dive', run }));
  assert.equal(validate(back), true);
  assert.deepEqual(back.run, JSON.parse(JSON.stringify(run)));
  assert.deepEqual(back.run.interference, { extra: 1, remaining: 2 });
  const base = { version: SAVE_VERSION, scene: 'dive', savedAt: 1 };
  const clamped = deserialize({ ...base, run: { ...run, interference: { extra: 9, remaining: 99 } } });
  assert.deepEqual(clamped.run.interference, { extra: 1, remaining: 3 });
  const expired = deserialize({ ...base, run: { ...run, interference: { extra: 1, remaining: 0 } } });
  assert.equal(expired.run.interference, null);
  const junk = deserialize({ ...base, run: { ...run, interference: 'hacked' } });
  assert.equal(junk.run.interference, null);
  const badEvent = deserialize({
    ...base,
    run: { ...run, board: { ...run.board, cells: run.board.cells.map((c, i) => (i === 0 ? { ...c, event: 'hacked' } : c)) } },
  });
  assert.equal(badEvent.run.board.cells[0].event, null);
  assert.equal(deserialize({ ...base, run: { ...run, interference: { extra: 1, remaining: 4 } } }).run.interference.remaining, 3);
});

test('㉒ drink −3 体力可致耗尽紧急传送（仍存料进结算）', () => {
  let found = null;
  for (let seed = 1; seed <= 200 && !found; seed++) {
    const opened = openedRun(seed);
    if (opened.status === 'diving' && mulberry32(opened.rngState)() >= 0.75) found = opened;
  }
  assert.ok(found, '应找到饮品掷出 −3 的 seed');
  const [t] = singleScanTargets(found, 1);
  const loaded = { ...withEvent(found, t, 'drink'), stamina: 2, carried: { water: 12, stardust: 1 } };
  const { state, effects } = scan(loaded, t);
  assert.equal(state.stamina, 0);
  assert.equal(state.status, 'emergency');
  assert.ok(state.stored.water >= 12);
  assert.ok(effects.some((e) => e.type === 'emergency'));
  const ev = effects.find((e) => e.type === 'event' && e.id === 'drink');
  assert.equal(ev.delta.choice, 3);
});

// ---------- V2-A：probe / flag / 新数字语义 ----------

function probe(state, index) {
  return applyAction(state, { type: 'probe', index });
}

function flag(state, index) {
  return applyAction(state, { type: 'flag', index });
}

test('㉔ probe 雷：耗 1 体力、known+probed、不扣护盾不致死、revealed=false、known 雷 scan 拒绝', () => {
  const run = openedRun();
  const mineIndex = run.board.cells.findIndex((c) => c.mine);
  const lowShield = { ...run, shield: 1 };
  const { state, effects } = probe(lowShield, mineIndex);
  assert.equal(state.stamina, run.stamina - CONFIG.probeCost);
  assert.equal(state.shield, 1, 'probe 雷不扣护盾');
  assert.equal(state.status, 'diving', 'probe 雷不致死');
  const c = state.board.cells[mineIndex];
  assert.equal(c.known, true);
  assert.equal(c.probed, true);
  assert.equal(c.revealed, false);
  const pe = effects.find((e) => e.type === 'probe');
  assert.deepEqual(pe, { type: 'probe', index: mineIndex, kind: 'mine' });
  assert.ok(!effects.some((e) => e.type === 'mine' || e.type === 'death'));
  const denied = scan(state, mineIndex);
  assert.equal(denied.state, state);
  assert.equal(denied.effects[0].type, 'rejected');
  assert.equal(denied.effects[0].reason, 'already-open');
});

test('㉕ probe 事件：probed 认出种类但未触发（stamina/shield/carried 不变）revealed=false；之后 scan 才触发', () => {
  const run = openedRun();
  const { cells } = run.board;
  let t = cells.findIndex((c, i) => c.event && !c.revealed && c.adj > 0);
  if (t < 0) t = cells.findIndex((c) => c.event && !c.revealed);
  assert.ok(t >= 0, '应存在未揭示事件格');
  const eventId = cells[t].event;
  const { state, effects } = probe(run, t);
  assert.equal(state.stamina, run.stamina - CONFIG.probeCost);
  assert.equal(state.shield, run.shield);
  assert.deepEqual(state.carried, run.carried);
  assert.deepEqual(state.stored, run.stored);
  assert.equal(state.interference, run.interference);
  assert.equal(state.status, 'diving');
  const c = state.board.cells[t];
  assert.equal(c.probed, true);
  assert.equal(c.revealed, false, 'probe 事件不翻开');
  assert.equal(c.event, eventId);
  const pe = effects.find((e) => e.type === 'probe');
  assert.equal(pe.kind, 'event');
  assert.equal(pe.event, eventId);
  assert.ok(!effects.some((e) => e.type === 'event'), 'probe 不触发事件效果');
  assert.deepEqual(terrain(state.board.cells), terrain(cells));
  // 已 probed 的事件再 scan → 正常触发
  const after = scan(state, t);
  assert.ok(after.effects.some((e) => e.type === 'event' && e.id === eventId && e.index === t));
  assert.equal(after.state.board.cells[t].revealed, true);
  assert.equal(after.state.stamina, state.stamina - 1 + (after.effects.filter((e) => e.type === 'event').reduce((s, e) => s + (e.delta.stamina || 0), 0)));
});

test('㉖ probe 安全格：单格翻开不连锁；原料格拾取；出口格直接 extract-ready+转账', () => {
  const run = openedRun();
  const { cells, exit, width, height } = run.board;
  const t = cells.findIndex((c, i) => !c.mine && !c.event && !c.revealed && i !== exit && !c.content);
  assert.ok(t >= 0);
  const beforeRevealed = cells.map((c) => c.revealed);
  const { state, effects } = probe(run, t);
  assert.equal(state.board.cells[t].revealed, true);
  assert.equal(state.board.cells[t].probed, true);
  for (let i = 0; i < cells.length; i++) {
    if (i !== t) assert.equal(state.board.cells[i].revealed, beforeRevealed[i], `probe 不应连锁揭示 ${i}`);
  }
  assert.ok(!effects.some((e) => e.type === 'reveals'), 'probe 无连锁 reveals 演出');
  assert.equal(effects.find((e) => e.type === 'probe').kind, 'safe');
  assert.equal(state.stamina, run.stamina - 1);

  const res = state.board.cells.findIndex((c, i) => c.content && !c.revealed && !c.picked);
  assert.ok(res >= 0, '应存在未拾取原料格');
  const content = state.board.cells[res].content;
  const got = probe(state, res);
  assert.equal(got.state.board.cells[res].picked, true);
  assert.equal(got.state.board.cells[res].revealed, true);
  assert.equal(got.state.carried[content.type], state.carried[content.type] + content.amount);
  assert.ok(got.effects.some((e) => e.type === 'pickup' && e.index === res && e.amount === content.amount));

  const atExit = probe(got.state, exit);
  assert.equal(atExit.state.status, 'extract-ready');
  assert.equal(atExit.state.board.cells[exit].revealed, true);
  assert.equal(atExit.state.board.cells[exit].probed, true);
  assert.deepEqual(atExit.state.carried, { water: 0, stardust: 0 });
  assert.equal(atExit.state.stored.water, got.state.stored.water + got.state.carried.water);
  assert.ok(atExit.effects.some((e) => e.type === 'exit'));
  assert.ok(atExit.effects.some((e) => e.type === 'deposit'));
  // 已 revealed 格再 probe 拒绝
  assert.equal(probe(atExit.state, t).effects[0].type, 'rejected');
  assert.equal(probe({ ...run, stamina: 0 }, t).effects[0].reason, 'no-stamina');
});

test('㉗ probe 耗 1 不受 interference 加费也不耗干扰次数；probe 耗到 0 同样紧急撤离', () => {
  const run = openedRun();
  const [t] = singleScanTargets(run, 1);
  const jammed = { ...run, stamina: 20, interference: { extra: 1, remaining: 3 } };
  const p = probe(jammed, t);
  assert.equal(p.state.stamina, 19, 'probe 固定耗 1');
  assert.deepEqual(p.state.interference, { extra: 1, remaining: 3 }, 'probe 不消耗干扰次数');
  const s = scan(p.state, singleScanTargets(p.state, 1)[0]);
  assert.equal(s.state.stamina, 17, 'scan 仍加费');
  assert.deepEqual(s.state.interference, { extra: 1, remaining: 2 });

  const loaded = { ...run, stamina: 1, carried: { water: 12, stardust: 1 } };
  const safe = run.board.cells.findIndex((c, i) => !c.mine && !c.event && !c.revealed && i !== run.board.exit);
  const em = probe(loaded, safe);
  assert.equal(em.state.stamina, 0);
  assert.equal(em.state.status, 'emergency');
  assert.deepEqual(em.state.carried, { water: 0, stardust: 0 });
  assert.ok(em.state.stored.water >= run.stored.water + 12);
  assert.ok(em.effects.some((e) => e.type === 'emergency'));
  assert.ok(em.effects.some((e) => e.type === 'deposit'));
});

test('㉘ flag：切换 flagged、不耗体力、不改逻辑字段、已开格拒绝、标记不影响 scan', () => {
  const run = openedRun();
  const t = run.board.cells.findIndex((c, i) => !c.revealed && i !== run.board.exit);
  const on = flag(run, t);
  assert.equal(on.state.board.cells[t].flagged, true);
  assert.equal(on.state.stamina, run.stamina, 'flag 不耗体力');
  assert.deepEqual(on.effects, [{ type: 'flag', index: t, on: true }]);
  for (let i = 0; i < run.board.cells.length; i++) {
    const a = on.state.board.cells[i];
    const b = run.board.cells[i];
    assert.deepEqual([a.mine, a.adj, a.revealed, a.known, a.probed, a.picked, a.event, a.content],
      [b.mine, b.adj, b.revealed, b.known, b.probed, b.picked, b.event, b.content]);
  }
  const off = flag(on.state, t);
  assert.equal(off.state.board.cells[t].flagged, false);
  assert.deepEqual(off.effects, [{ type: 'flag', index: t, on: false }]);
  const revealedIndex = run.board.cells.findIndex((c) => c.revealed);
  assert.equal(flag(run, revealedIndex).effects[0].type, 'rejected');
  assert.equal(flag(createRun({ wish: 'fun', seed: SEED }), 0).effects[0].reason, 'no-board');
  // 标记过的安全格仍可正常 scan（flag 无逻辑效果）
  const safe = run.board.cells.findIndex((c, i) => !c.mine && !c.event && !c.revealed && i !== run.board.exit && c.adj > 0);
  const flagged = flag(run, safe).state;
  const scanned = scan(flagged, safe);
  assert.equal(scanned.effects[0].type, 'reveals');
  assert.equal(scanned.state.board.cells[safe].revealed, true);
});

test('㉙ save v2：probed/flagged/known roundtrip；旧档缺字段默认 false 向后兼容', () => {
  let run = openedRun();
  const mineIndex = run.board.cells.findIndex((c) => c.mine);
  run = probe(run, mineIndex).state;
  const hidden = run.board.cells.findIndex((c, i) => !c.revealed && i !== mineIndex);
  run = flag(run, hidden).state;
  assert.ok(run.board.cells.some((c) => c.probed));
  assert.ok(run.board.cells.some((c) => c.flagged));
  const back = deserialize(serialize({ scene: 'dive', run }));
  assert.equal(validate(back), true);
  assert.deepEqual(back.run, JSON.parse(JSON.stringify(run)));
  assert.equal(back.run.board.cells[mineIndex].known, true);
  assert.equal(back.run.board.cells[mineIndex].probed, true);
  assert.equal(back.run.board.cells[hidden].flagged, true);
  // 旧版存档（无 probed/flagged 字段）→ 缺省 false，仍可校验续玩
  const legacy = {
    version: SAVE_VERSION,
    scene: 'dive',
    savedAt: 1,
    run: {
      ...run,
      board: {
        ...run.board,
        cells: run.board.cells.map((c) => {
          const { probed: _p, flagged: _f, ...rest } = c;
          return rest;
        }),
      },
    },
  };
  const restored = deserialize(legacy);
  assert.ok(restored, '旧档应可恢复');
  assert.equal(validate(restored), true);
  for (const c of restored.run.board.cells) {
    assert.equal(c.probed, false);
    assert.equal(c.flagged, false);
  }
});