import { CONFIG } from './config.js';
import { generateBoard, revealChain } from './board.js';
import { mulberry32 } from './rng.js';
import { applyEvent } from './events.js';
import { settleRecipe } from './recipe.js';

const EMPTY = () => ({ water: 0, stardust: 0 });

export function createRun({ wish, seed }) {
  const floor = CONFIG.floors[1];
  return {
    wish,
    floor: 1,
    rngState: seed >>> 0,
    stamina: floor.stamina,
    shield: CONFIG.shield.initial,
    carried: EMPTY(),
    stored: EMPTY(),
    interference: null,
    board: { width: floor.width, height: floor.height, cells: null, exit: -1 },
    status: 'diving',
    settlement: null,
  };
}

function rejected(state, reason) {
  return { state, effects: [{ type: 'rejected', reason }] };
}

function deposit(state) {
  // v5：离层时自动收走「已揭示但未拾取」的原料（看见的都能带走，不浪费）
  let carried = { ...state.carried };
  let cells = state.board.cells;
  if (cells) {
    cells = cells.map((c) => {
      if (c.revealed && c.content && !c.picked) {
        carried[c.content.type] += c.content.amount;
        return { ...c, picked: true };
      }
      return c;
    });
  }
  const stored = {
    water: state.stored.water + carried.water,
    stardust: state.stored.stardust + carried.stardust,
  };
  const moved = { ...carried };
  return {
    next: { ...state, board: { ...state.board, cells }, stored, carried: EMPTY() },
    effect: { type: 'deposit', moved, stored },
  };
}

function pushEventEffects(effects, id, index, delta, allRevealed) {
  if (!delta) return;
  effects.push({ type: 'event', id, index, delta });
  if (delta.reveals && delta.reveals.length > 0) {
    effects.push({ type: 'reveals', indices: delta.reveals });
    allRevealed.push(...delta.reveals);
  }
  for (const p of delta.pickups || []) effects.push({ type: 'pickup', index: p.index, resource: p.resource, amount: p.amount });
  if (delta.marks && delta.marks.length > 0) effects.push({ type: 'mine-mark', indices: delta.marks });
  for (const sub of delta.events || []) pushEventEffects(effects, sub.id, sub.index, sub.delta, allRevealed);
}

function applyScan(state, index) {
  if (state.status !== 'diving') return rejected(state, 'not-diving');
  if (state.stamina <= 0) return rejected(state, 'no-stamina');
  const { width, height } = state.board;
  if (!Number.isInteger(index) || index < 0 || index >= width * height) return rejected(state, 'out-of-board');

  let board = state.board;
  let rngState = state.rngState;
  if (board.cells === null) {
    const generated = generateBoard(CONFIG.floors[state.floor], rngState, index);
    board = { ...board, cells: generated.cells, exit: generated.exit };
    rngState = generated.rngState;
  }
  const cell = board.cells[index];
  // v5：已揭示但未收集的原料 → 点击免费拾取（连锁只揭示不赠送，逐格收集）
  if (cell.revealed && cell.content && !cell.picked) {
    const cells = board.cells.slice();
    cells[index] = { ...cell, picked: true };
    const carried = { ...state.carried, [cell.content.type]: state.carried[cell.content.type] + cell.content.amount };
    const next = { ...state, board: { ...board, cells }, carried };
    return { state: next, effects: [{ type: 'pickup', index, resource: cell.content.type, amount: cell.content.amount }] };
  }
  if (cell.revealed || cell.known) return rejected(state, 'already-open');

  const active = state.interference && state.interference.remaining > 0 ? state.interference : null;
  const cost = 1 + (active ? active.extra : 0);
  let interference = null;
  if (active && active.remaining - 1 > 0) interference = { extra: active.extra, remaining: active.remaining - 1 };
  let next = { ...state, board, rngState, stamina: Math.max(0, state.stamina - cost), interference };
  const effects = [];
  let cells = board.cells.slice();

  if (cell.mine) {
    cells[index] = { ...cell, revealed: true, known: true };
    next = { ...next, board: { ...board, cells }, shield: next.shield - 1 };
    effects.push({ type: 'mine', index, shield: next.shield });
    if (next.shield <= 0) {
      const lost = { ...next.carried };
      next = { ...next, status: 'dead', carried: EMPTY() };
      effects.push({ type: 'death', lost });
      return { state: next, effects };
    }
  } else {
    const chain = revealChain(cells, width, height, index);
    for (const i of chain) cells[i] = { ...cells[i], revealed: true };
    effects.push({ type: 'reveals', indices: chain });
    for (const i of chain) {
      const c = cells[i];
      // v5：连锁只自动收集「被点击格」，其余原料揭示后留在原地待逐格拾取
      if (c.content && !c.picked && i === index) {
        cells[i] = { ...c, picked: true };
        const carried = { ...next.carried, [c.content.type]: next.carried[c.content.type] + c.content.amount };
        next = { ...next, carried };
        effects.push({ type: 'pickup', index: i, resource: c.content.type, amount: c.content.amount });
      }
    }
    next = { ...next, board: { ...board, cells } };
    const allRevealed = [...chain];
    for (const i of chain) {
      const c = next.board.cells[i];
      if (!c.event) continue;
      const rng = mulberry32(rngState);
      const result = applyEvent(next, c.event, rng, i);
      next = result.run;
      rngState = rng.getState();
      cells = next.board.cells;
      pushEventEffects(effects, c.event, i, result.delta, allRevealed);
    }
    next = { ...next, board: { ...next.board, cells }, rngState };
    if (allRevealed.includes(board.exit)) {
      const { next: deposited, effect } = deposit(next);
      next = { ...deposited, status: 'extract-ready' };
      effects.push({ type: 'exit', index: board.exit }, effect);
      return { state: next, effects };
    }
  }

  if (next.stamina <= 0) {
    const { next: deposited, effect } = deposit(next);
    next = { ...deposited, status: 'emergency' };
    effects.push({ type: 'emergency' }, effect);
  }
  return { state: next, effects };
}

function applyProbe(state, index) {
  if (state.status !== 'diving') return rejected(state, 'not-diving');
  if (state.stamina <= 0) return rejected(state, 'no-stamina');
  const { width, height } = state.board;
  if (!Number.isInteger(index) || index < 0 || index >= width * height) return rejected(state, 'out-of-board');

  let board = state.board;
  let rngState = state.rngState;
  if (board.cells === null) {
    const generated = generateBoard(CONFIG.floors[state.floor], rngState, index);
    board = { ...board, cells: generated.cells, exit: generated.exit };
    rngState = generated.rngState;
  }
  const cell = board.cells[index];
  if (cell.revealed) return rejected(state, 'already-open');

  // probe 固定耗 probeCost，不享受 interference 加费，也不消耗干扰次数
  const cost = CONFIG.probeCost;
  let next = { ...state, board, rngState, stamina: Math.max(0, state.stamina - cost) };
  const effects = [];
  const cells = board.cells.slice();

  if (cell.mine) {
    // 安全认雷：known+probed，不扣护盾，不揭示
    cells[index] = { ...cell, known: true, probed: true };
    next = { ...next, board: { ...board, cells } };
    effects.push({ type: 'probe', index, kind: 'mine' });
  } else if (cell.event) {
    // 认出事件种类但不触发：probed，revealed 仍 false
    cells[index] = { ...cell, probed: true };
    next = { ...next, board: { ...board, cells } };
    effects.push({ type: 'probe', index, kind: 'event', event: cell.event });
  } else {
    // 安全格/原料/出口：单格翻开（不连锁）+拾取+出口判定
    cells[index] = { ...cell, revealed: true, probed: true };
    effects.push({ type: 'probe', index, kind: 'safe' });
    if (cell.content && !cell.picked) {
      cells[index] = { ...cells[index], picked: true };
      const carried = { ...next.carried, [cell.content.type]: next.carried[cell.content.type] + cell.content.amount };
      next = { ...next, carried };
      effects.push({ type: 'pickup', index, resource: cell.content.type, amount: cell.content.amount });
    }
    next = { ...next, board: { ...board, cells } };
    if (index === board.exit) {
      const { next: deposited, effect } = deposit(next);
      next = { ...deposited, status: 'extract-ready' };
      effects.push({ type: 'exit', index: board.exit }, effect);
      return { state: next, effects };
    }
  }

  if (next.stamina <= 0) {
    const { next: deposited, effect } = deposit(next);
    next = { ...deposited, status: 'emergency' };
    effects.push({ type: 'emergency' }, effect);
  }
  return { state: next, effects };
}

function applyFlag(state, index) {
  if (state.status !== 'diving') return rejected(state, 'not-diving');
  const { width, height } = state.board;
  if (!Number.isInteger(index) || index < 0 || index >= width * height) return rejected(state, 'out-of-board');
  if (state.board.cells === null) return rejected(state, 'no-board');
  const cell = state.board.cells[index];
  if (cell.revealed) return rejected(state, 'already-open');
  // 纯标记：不耗体力、不改任何逻辑字段，可切换
  const cells = state.board.cells.slice();
  const on = !cell.flagged;
  cells[index] = { ...cell, flagged: on };
  const next = { ...state, board: { ...state.board, cells } };
  return { state: next, effects: [{ type: 'flag', index, on }] };
}

function applyDescend(state) {
  if (state.status !== 'extract-ready') return rejected(state, 'not-at-exit');
  if (state.floor >= CONFIG.maxFloor) return rejected(state, 'no-deeper-floor');
  const floor = state.floor + 1;
  const cfg = CONFIG.floors[floor];
  const next = {
    ...state,
    floor,
    stamina: cfg.stamina,
    carried: EMPTY(),
    board: { width: cfg.width, height: cfg.height, cells: null, exit: -1 },
    status: 'diving',
  };
  return { state: next, effects: [{ type: 'descend', floor }] };
}

function applyExtract(state) {
  if (state.status !== 'extract-ready' && state.status !== 'emergency') return rejected(state, 'cannot-extract');
  return { state: { ...state, status: 'extracted' }, effects: [{ type: 'extract', emergency: state.status === 'emergency' }] };
}

function applySettle(state) {
  if (state.status !== 'extracted' && state.status !== 'dead') return rejected(state, 'cannot-settle');
  const settlement = settleRecipe(state.stored);
  const next = { ...state, status: 'settled', settlement };
  return { state: next, effects: [{ type: 'settle', settlement, died: state.status === 'dead' }] };
}

export function applyAction(state, action) {
  switch (action.type) {
    case 'scan': return applyScan(state, action.index);
    case 'probe': return applyProbe(state, action.index);
    case 'flag': return applyFlag(state, action.index);
    case 'descend': return applyDescend(state);
    case 'extract': return applyExtract(state);
    case 'settle': return applySettle(state);
    default: return rejected(state, 'unknown-action');
  }
}