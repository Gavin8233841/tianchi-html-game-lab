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
  const stored = {
    water: state.stored.water + state.carried.water,
    stardust: state.stored.stardust + state.carried.stardust,
  };
  const moved = { ...state.carried };
  return {
    next: { ...state, stored, carried: EMPTY() },
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
      if (c.content && !c.picked) {
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
    case 'descend': return applyDescend(state);
    case 'extract': return applyExtract(state);
    case 'settle': return applySettle(state);
    default: return rejected(state, 'unknown-action');
  }
}