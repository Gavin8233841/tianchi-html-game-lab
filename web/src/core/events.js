import { CONFIG } from './config.js';
import { neighbors } from './board.js';

export const EVENTS = {
  supply: { id: 'supply', name: '能量补给站', icon: 'eventSupply', kind: 'buff', desc: '体力 +8' },
  repair: { id: 'repair', name: '纳米修复舱', icon: 'eventRepair', kind: 'buff', desc: '护盾 +1（上限 3）' },
  cache: { id: 'cache', name: '原料缓存', icon: 'eventCache', kind: 'buff', desc: '水 +20ml（未存）' },
  interference: { id: 'interference', name: '静电干扰', icon: 'eventInterference', kind: 'debuff', desc: '接下来 3 次扫描各多耗 1 体力' },
  drink: { id: 'drink', name: '神秘饮品', icon: 'eventDrink', kind: 'random', desc: '随机：+5体力 / +1护盾 / +10水 / −3体力' },
  radar: { id: 'radar', name: '原料雷达', icon: 'eventRadar', kind: 'buff', desc: '3×3 安全揭示，雷格免费标记' },
  corrode: { id: 'corrode', name: '护盾腐蚀', icon: 'eventCorrode', kind: 'debuff', desc: '护盾 −1（保底 1，不致死）' },
};

function applyRadar(run, rng, at) {
  const { width, height } = run.board;
  let cells = run.board.cells.map((c) => ({ ...c }));
  let next = { ...run, carried: { ...run.carried }, board: { ...run.board, cells } };
  const delta = { id: 'radar', reveals: [], pickups: [], marks: [], events: [] };
  const seen = new Set();
  const queue = [];
  for (const i of [at, ...neighbors(at, width, height)]) {
    if (i >= 0 && i < cells.length && !seen.has(i)) {
      seen.add(i);
      queue.push(i);
    }
  }
  while (queue.length > 0) {
    const i = queue.shift();
    const c = cells[i];
    if (c.mine) {
      if (!c.known) {
        c.known = true;
        delta.marks.push(i);
      }
      continue;
    }
    if (c.revealed) continue;
    c.revealed = true;
    delta.reveals.push(i);
    if (c.content && !c.picked) {
      c.picked = true;
      next.carried = { ...next.carried, [c.content.type]: next.carried[c.content.type] + c.content.amount };
      delta.pickups.push({ index: i, resource: c.content.type, amount: c.content.amount });
    }
    if (c.event) {
      const sub = applyEvent(next, c.event, rng, i);
      next = sub.run;
      cells = next.board.cells;
      delta.events.push({ id: c.event, index: i, delta: sub.delta });
    }
  }
  return { run: next, delta };
}

// 不变式：只动 stamina/shield/carried/interference 与揭示状态，绝不改 adj/mine
export function applyEvent(run, eventId, rng, at = -1) {
  const cfg = CONFIG.events[eventId];
  if (!cfg || !EVENTS[eventId]) return { run, delta: null };
  const delta = { id: eventId };
  let next = { ...run };
  switch (eventId) {
    case 'supply': {
      next.stamina = run.stamina + cfg.stamina;
      delta.stamina = cfg.stamina;
      break;
    }
    case 'repair': {
      next.shield = Math.min(CONFIG.shield.max, run.shield + cfg.shield);
      delta.shield = next.shield - run.shield;
      break;
    }
    case 'cache': {
      next.carried = { ...run.carried, water: run.carried.water + cfg.water };
      delta.water = cfg.water;
      break;
    }
    case 'interference': {
      next.interference = { extra: cfg.extraCost, remaining: cfg.scans };
      delta.interference = { ...next.interference };
      break;
    }
    case 'drink': {
      const choice = Math.floor(rng() * cfg.choices.length);
      const pick = cfg.choices[choice];
      delta.choice = choice;
      if (pick.stamina !== undefined) {
        next.stamina = Math.max(0, run.stamina + pick.stamina);
        delta.stamina = next.stamina - run.stamina;
      } else if (pick.shield !== undefined) {
        next.shield = Math.min(CONFIG.shield.max, run.shield + pick.shield);
        delta.shield = next.shield - run.shield;
      } else if (pick.water !== undefined) {
        next.carried = { ...run.carried, water: run.carried.water + pick.water };
        delta.water = pick.water;
      }
      break;
    }
    case 'radar': {
      return applyRadar(run, rng, at);
    }
    case 'corrode': {
      next.shield = Math.max(cfg.minShield, run.shield + cfg.shield);
      delta.shield = next.shield - run.shield;
      break;
    }
    default:
      return { run, delta: null };
  }
  return { run: next, delta };
}