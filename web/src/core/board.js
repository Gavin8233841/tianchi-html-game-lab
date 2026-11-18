import { CONFIG } from './config.js';
import { mulberry32, shuffle } from './rng.js';

export function neighbors(index, width, height) {
  const x = index % width;
  const y = Math.floor(index / width);
  const out = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) out.push(ny * width + nx);
    }
  }
  return out;
}

function chebyshev(a, b, width) {
  return Math.max(
    Math.abs((a % width) - (b % width)),
    Math.abs(Math.floor(a / width) - Math.floor(b / width)),
  );
}

export function generateBoard(floorConfig, rngState, firstIndex) {
  const { width, height, mines } = floorConfig;
  const total = width * height;
  const rng = mulberry32(rngState);
  const cells = Array.from({ length: total }, () => ({
    mine: false, adj: 0, revealed: false, known: false, probed: false, picked: false, flagged: false, content: null, event: null,
  }));

  // v2 首击安全：首击格本身排除 mine+event（保证是安全格）；
  // 9 邻域只排除 mine，允许 event → 首击 adj=邻格事件数，常>0 需思考，不再必 0 大连锁。
  const mineZone = new Set([firstIndex, ...neighbors(firstIndex, width, height)]);
  const mineCandidates = [];
  for (let i = 0; i < total; i++) if (!mineZone.has(i)) mineCandidates.push(i);
  shuffle(mineCandidates, rng);
  for (let i = 0; i < mines; i++) cells[mineCandidates[i]].mine = true;

  // 出口放在距首击最远的 exitFarRatio 比例候选里，找出口本身是一段探索
  const exitCandidates = [];
  for (let i = 0; i < total; i++) if (!cells[i].mine && !mineZone.has(i)) exitCandidates.push(i);
  exitCandidates.sort((a, b) => chebyshev(b, firstIndex, width) - chebyshev(a, firstIndex, width) || a - b);
  const farCount = Math.max(1, Math.ceil(exitCandidates.length * CONFIG.exitFarRatio));
  const exit = exitCandidates[Math.floor(rng() * farCount)];

  const resourceCells = [];
  for (let i = 0; i < total; i++) {
    if (!cells[i].mine && i !== exit) resourceCells.push(i);
  }
  shuffle(resourceCells, rng);
  let cursor = 0;
  for (const amount of floorConfig.water) {
    cells[resourceCells[cursor++]].content = { type: 'water', amount };
  }
  for (const amount of floorConfig.stardust) {
    cells[resourceCells[cursor++]].content = { type: 'stardust', amount };
  }

  // 事件布置互斥：雷→出口→原料→事件；首击格本身也排除事件（邻域允许）
  const eventCandidates = [];
  for (let i = 0; i < total; i++) {
    if (!cells[i].mine && i !== exit && i !== firstIndex && !cells[i].content) eventCandidates.push(i);
  }
  shuffle(eventCandidates, rng);
  const pool = CONFIG.events.pools[floorConfig.id].slice();
  shuffle(pool, rng);
  const eventCount = Math.min(floorConfig.eventCount, pool.length, eventCandidates.length);
  for (let i = 0; i < eventCount; i++) cells[eventCandidates[i]].event = pool[i];

  // v2 数字语义：adj = 邻格「雷 OR 事件」总数（原料格与出口不计入）
  for (let i = 0; i < total; i++) {
    if (cells[i].mine) continue;
    cells[i].adj = neighbors(i, width, height).filter((n) => cells[n].mine || cells[n].event).length;
  }
  return { cells, exit, rngState: rng.getState() };
}

export function revealChain(cells, width, height, startIndex) {
  if (cells[startIndex].mine) return [];
  const seen = new Set([startIndex]);
  const queue = [startIndex];
  const order = [];
  while (queue.length > 0) {
    const index = queue.shift();
    order.push(index);
    if (cells[index].adj !== 0) continue;
    for (const n of neighbors(index, width, height)) {
      if (seen.has(n) || cells[n].mine) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return order;
}