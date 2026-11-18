// 数值张力校准工具（V2-A）：无头 bot 模拟，非 CI 测试，不进 npm run check。
// 用法：node scripts/balance-sim.mjs [--runs 1000] [--seed-base 1000] [--scan-conf 0.3] [--probe-reserve 8] [--no-far-bias]
// 两种 bot（deduction 推理+探测 / random 随机对照）× 两种决策（L1 出口撤离 / 贪 L2）。
// v2 语义：数字=邻格「雷 OR 事件」总数。deduction bot 用约束传播定位特殊格，
// 对特殊格先 probe 认出（雷→避开；好事件→scan 挖；坏事件→避开），安全格 scan（0 连锁）。
// bot 只使用玩家可见信息：已揭示格数字、known/probed 标记；绝不读取未揭示格的 mine/event/content。
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CONFIG } from '../web/src/core/config.js';
import { createRun, applyAction } from '../web/src/core/rules.js';
import { neighbors } from '../web/src/core/board.js';
import { mulberry32 } from '../web/src/core/rng.js';
import { completion } from '../web/src/core/recipe.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- 命令行 ----------
const argv = process.argv.slice(2);
function argNum(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? Number(argv[i + 1]) : fallback;
}
const RUNS = argNum('runs', 1000);
const SEED_BASE = argNum('seed-base', 1000);

// 猜测策略：特殊格概率 ≤ SCAN_CONF 直接 scan；更高概率且体力充裕时先 probe 认格；
// 体力吃紧时不再 probe（省体力找出口），直接 scan 最优猜测。可用 --scan-conf/--probe-reserve 调参。
// 校准值 0.30：更低（0.15）bot 过度 probe → 死亡率仅 2.5% 不达标；0.25–0.35 死亡率 20–24% 达标。
const SCAN_CONF = argNum('scan-conf', 0.30);
const PROBE_RESERVE = argNum('probe-reserve', 8);
const GOOD_EVENTS = new Set(['supply', 'repair', 'cache', 'radar', 'drink']);

// ---------- 推理引擎（只用可见信息） ----------
function chebyshev(a, b, width) {
  return Math.max(Math.abs((a % width) - (b % width)), Math.abs(Math.floor(a / width) - Math.floor(b / width)));
}

// 约束传播（v2：特殊格=雷∪事件）：
// 已确认特殊格 = known 雷 或 probed 事件；数字格剩余特殊数==0 → 其余邻居安全；
// 剩余特殊数==未开邻居数 → 全为特殊格嫌疑（待 probe 认出）。
function analyze(state) {
  const { width, height, cells } = state.board;
  const identified = new Set();
  cells.forEach((c, i) => { if (c.known || (c.probed && c.event)) identified.add(i); });
  const special = new Set(identified);
  const safe = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (!c.revealed || c.adj === 0) continue;
      const ns = neighbors(i, width, height);
      const hidden = ns.filter((n) => !cells[n].revealed && !special.has(n));
      if (hidden.length === 0) continue;
      const rem = c.adj - ns.filter((n) => special.has(n)).length;
      if (rem === 0) {
        for (const n of hidden) if (!safe.has(n)) { safe.add(n); changed = true; }
      } else if (rem === hidden.length) {
        for (const n of hidden) if (!special.has(n)) { special.add(n); changed = true; }
      }
    }
  }
  const constraints = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c.revealed || c.adj === 0) continue;
    const ns = neighbors(i, width, height);
    const hidden = ns.filter((n) => !cells[n].revealed && !special.has(n));
    if (hidden.length === 0) continue;
    const rem = c.adj - ns.filter((n) => special.has(n)).length;
    if (rem > 0) constraints.push({ hidden, p: rem / hidden.length });
  }
  const candidates = [];
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i].revealed && !identified.has(i)) candidates.push(i);
  }
  const cfg = CONFIG.floors[state.floor];
  const remainingSpecials = cfg.mines + cfg.eventCount - identified.size;
  const globalP = candidates.length > 0 ? Math.max(0, remainingSpecials) / candidates.length : 0;
  const suspects = candidates.filter((i) => special.has(i));
  return { identified, special, safe, suspects, constraints, candidates, globalP };
}

function farCutoff(width, height, firstIndex) {
  const dists = [];
  for (let i = 0; i < width * height; i++) dists.push(chebyshev(i, firstIndex, width));
  dists.sort((a, b) => b - a);
  return dists[Math.max(0, Math.ceil(dists.length * CONFIG.exitFarRatio) - 1)];
}

function pickRandom(pool, rng) {
  return pool[Math.floor(rng() * pool.length)];
}

// 体力吃紧时偏向远端找出口（玩家可学会「出口在远处」）；--no-far-bias 可关闭做对照
const LOW_STAMINA = 6;
const FAR_BIAS = !argv.includes('--no-far-bias');

function chooseDeduction(state, rng, firstIndex) {
  const { width, height, cells } = state.board;
  const { safe, suspects, constraints, candidates, globalP } = analyze(state);
  const low = state.stamina <= LOW_STAMINA;
  const cut = farCutoff(width, height, firstIndex);
  const isFar = (i) => chebyshev(i, firstIndex, width) >= cut;
  const preferFar = (pool) => {
    if (!low || !FAR_BIAS) return pool;
    const far = pool.filter(isFar);
    return far.length > 0 ? far : pool;
  };
  // ① 可证安全格 → scan（0 连锁铺信息）
  const safePool = candidates.filter((i) => safe.has(i));
  if (safePool.length > 0) {
    const pool = preferFar(safePool);
    let best = -1; let bestPool = [];
    for (const i of pool) {
      const hiddenN = neighbors(i, width, height).filter((n) => !cells[n].revealed).length;
      if (hiddenN > best) { best = hiddenN; bestPool = [i]; }
      else if (hiddenN === best) bestPool.push(i);
    }
    return { action: 'scan', index: pickRandom(bestPool, rng), guess: false };
  }
  // ② 推定的特殊格（未认出）→ probe 认出种类，不触发不扣盾
  if (suspects.length > 0) {
    return { action: 'probe', index: pickRandom(suspects, rng), guess: false };
  }
  // ③ 已认出的好事件 → scan 挖取收益（坏事件 interference/corrode 避开）
  const goodPool = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c.probed && c.event && !c.revealed && GOOD_EVENTS.has(c.event)) goodPool.push(i);
  }
  if (goodPool.length > 0) {
    return { action: 'scan', index: pickRandom(goodPool, rng), guess: false };
  }
  // ④ 无可证安全格：选特殊格概率最小者；低概率直接 scan，高概率体力够则先 probe
  let minP = Infinity;
  const probs = candidates.map((i) => {
    let p = globalP;
    for (const c of constraints) if (c.hidden.includes(i)) p = Math.max(p, c.p);
    if (p < minP) minP = p;
    return p;
  });
  const pool = preferFar(candidates.filter((_, k) => probs[k] <= minP + 1e-9));
  const index = pickRandom(pool, rng);
  const action = minP > SCAN_CONF && state.stamina > PROBE_RESERVE ? 'probe' : 'scan';
  return { action, index, guess: true };
}

function chooseRandom(state, rng) {
  const pool = [];
  state.board.cells.forEach((c, i) => { if (!c.revealed && !c.known) pool.push(i); });
  return pickRandom(pool, rng);
}

// ---------- 单局 ----------
function playRun(seed, strategy, decision) {
  let state = createRun({ wish: 'calibration', seed });
  // 首击格与 bot 随机流分离：同 seed 下两种 bot 首击一致 → 棋盘一致，可对照
  const firstRng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const botRng = mulberry32((seed ^ (strategy === 'deduction' ? 0x51ed270b : 0x2545f491)) >>> 0);
  const rec = {
    scans: { 1: 0, 2: 0 },
    probes: { 1: 0, 2: 0 },
    guesses: { 1: 0, 2: 0 },
    mineHits: { 1: 0, 2: 0 },
    died: false,
    emergency: false,
    reachedL2: false,
    l1Completion: null,
    shieldEnd: 0,
    completion: 0,
  };
  let firstIndex = 0;
  let guard = 0;
  while (guard++ < 1000) {
    if (state.status === 'diving') {
      let action = 'scan'; let index; let guess = false;
      if (state.board.cells === null) {
        firstIndex = Math.floor(firstRng() * state.board.width * state.board.height);
        index = firstIndex; // 首击格本身必安全（非雷非事件），无需推理
      } else if (strategy === 'deduction') {
        ({ action, index, guess } = chooseDeduction(state, botRng, firstIndex));
      } else {
        index = chooseRandom(state, botRng);
      }
      const res = applyAction(state, { type: action, index });
      if (res.effects.some((e) => e.type === 'rejected')) throw new Error(`rejected ${action}: ${JSON.stringify(res.effects)}`);
      state = res.state;
      if (action === 'probe') rec.probes[state.floor]++;
      else rec.scans[state.floor]++;
      if (guess) rec.guesses[state.floor]++;
      if (res.effects.some((e) => e.type === 'mine')) rec.mineHits[state.floor]++;
    } else if (state.status === 'extract-ready') {
      if (state.floor === 1) rec.l1Completion = completion(state.stored);
      if (state.floor === 1 && decision === 'greedy') {
        state = applyAction(state, { type: 'descend' }).state;
        rec.reachedL2 = true;
      } else {
        state = applyAction(state, { type: 'extract' }).state;
      }
    } else if (state.status === 'emergency') {
      if (state.floor === 1) rec.l1Completion = completion(state.stored);
      rec.emergency = true;
      state = applyAction(state, { type: 'extract' }).state;
    } else if (state.status === 'dead') {
      rec.died = true;
      state = applyAction(state, { type: 'settle' }).state;
      break;
    } else if (state.status === 'extracted') {
      state = applyAction(state, { type: 'settle' }).state;
      break;
    } else {
      break;
    }
  }
  rec.completion = state.settlement ? state.settlement.completion : completion(state.stored);
  rec.shieldEnd = state.shield;
  return rec;
}

// ---------- 聚合 ----------
function aggregate(records) {
  const n = records.length;
  const mean = (f) => records.reduce((s, r) => s + f(r), 0) / n;
  const survivors = records.filter((r) => !r.died);
  const l1 = records.filter((r) => r.l1Completion !== null).map((r) => r.l1Completion);
  const bucket = (lo, hi) => l1.filter((v) => v >= lo && v < hi).length / (l1.length || 1);
  return {
    runs: n,
    avgCompletion: mean((r) => r.completion),
    fullRate: records.filter((r) => r.completion >= 1).length / n,
    deathRate: records.filter((r) => r.died).length / n,
    emergencyRate: records.filter((r) => r.emergency).length / n,
    avgScansL1: mean((r) => r.scans[1]),
    avgProbesL1: mean((r) => r.probes[1]),
    avgOpsL1: mean((r) => r.scans[1] + r.probes[1]),
    avgScansL2: mean((r) => r.scans[2]),
    avgProbesL2: mean((r) => r.probes[2]),
    avgOpsL2: mean((r) => r.scans[2] + r.probes[2]),
    avgGuessesL2: mean((r) => r.guesses[2]),
    avgMineHitsL2: mean((r) => r.mineHits[2]),
    avgShieldSurvivors: survivors.length ? survivors.reduce((s, r) => s + r.shieldEnd, 0) / survivors.length : 0,
    l1ExitCompletion: {
      mean: l1.length ? l1.reduce((s, v) => s + v, 0) / l1.length : null,
      dist: {
        lt25: bucket(0, 0.25),
        b25to49: bucket(0.25, 0.5),
        eq50: l1.filter((v) => v === 0.5).length / (l1.length || 1),
        b51to99: bucket(0.500001, 1),
        eq100: l1.filter((v) => v >= 1).length / (l1.length || 1),
      },
    },
  };
}

// ---------- 主流程 ----------
const combos = [
  ['deduction', 'extract'],
  ['deduction', 'greedy'],
  ['random', 'extract'],
  ['random', 'greedy'],
];
const results = {};
for (const [strategy, decision] of combos) {
  const records = [];
  for (let i = 0; i < RUNS; i++) records.push(playRun((SEED_BASE + i) >>> 0, strategy, decision));
  results[`${strategy}/${decision}`] = aggregate(records);
}

const pct = (v) => `${(v * 100).toFixed(1)}%`;
const f2 = (v) => (v === null ? '-' : v.toFixed(2));
console.log(`\n=== V2 张力校准模拟（每组合 ${RUNS} 局，seed ${SEED_BASE}..${SEED_BASE + RUNS - 1}）===\n`);
console.log('组合                完成度  全齐率  死亡率  紧急率  挖L1  探L1  操作L1  挖L2  探L2  操作L2  存活护盾');
for (const key of Object.keys(results)) {
  const r = results[key];
  console.log(
    `${key.padEnd(20)}${f2(r.avgCompletion).padStart(6)}${pct(r.fullRate).padStart(8)}${pct(r.deathRate).padStart(8)}${pct(r.emergencyRate).padStart(8)}${f2(r.avgScansL1).padStart(6)}${f2(r.avgProbesL1).padStart(6)}${f2(r.avgOpsL1).padStart(8)}${f2(r.avgScansL2).padStart(6)}${f2(r.avgProbesL2).padStart(6)}${f2(r.avgOpsL2).padStart(8)}${f2(r.avgShieldSurvivors).padStart(10)}`,
  );
}
console.log('\nL1 出口时完成度分布（撤离决策组）:');
for (const key of ['deduction/extract', 'random/extract']) {
  const d = results[key].l1ExitCompletion;
  console.log(`  ${key.padEnd(20)} mean=${f2(d.mean)}  <25%:${pct(d.dist.lt25)}  25-49%:${pct(d.dist.b25to49)}  =50%:${pct(d.dist.eq50)}  51-99%:${pct(d.dist.b51to99)}  =100%:${pct(d.dist.eq100)}`);
}
const g = results['deduction/greedy'];
console.log(`\n诊断（deduction/greedy）: L2 平均猜格 ${f2(g.avgGuessesL2)} 次，平均踩雷 ${f2(g.avgMineHitsL2)} 次`);
console.log(`节奏对照: v1 L1 平均扫描 3.7 次 → v2 L1 平均操作 ${f2(results['deduction/extract'].avgOpsL1)} 次（挖 ${f2(results['deduction/extract'].avgScansL1)} + 探 ${f2(results['deduction/extract'].avgProbesL1)}），目标 ~10–20 次/层`);
const targets = {
  l1ExtractCompletion: { target: 0.5, actual: results['deduction/extract'].l1ExitCompletion.mean },
  greedyFullRate: { target: [0.45, 0.6], actual: g.fullRate },
  greedyDeathRate: { target: [0.2, 0.35], actual: g.deathRate },
  opsPerFloor: { target: [10, 20], actualL1: results['deduction/extract'].avgOpsL1, actualL2: g.avgOpsL2 },
};
console.log('\n目标对照（deduction bot）:');
console.log(`  L1 撤离完成度 ≈0.50 → 实际 ${f2(targets.l1ExtractCompletion.actual)}`);
console.log(`  贪L2 全齐率 45–60% → 实际 ${pct(targets.greedyFullRate.actual)}`);
console.log(`  贪L2 死亡率 20–35% → 实际 ${pct(targets.greedyDeathRate.actual)}`);

const report = {
  generatedAt: new Date().toISOString(),
  runsPerCombo: RUNS,
  seedBase: SEED_BASE,
  config: CONFIG,
  botParams: { SCAN_CONF, PROBE_RESERVE, LOW_STAMINA, FAR_BIAS },
  targets,
  results,
};
const outDir = path.join(ROOT, '.local');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'balance-report.json'), JSON.stringify(report, null, 2));
console.log(`\n报告已写入 .local/balance-report.json`);