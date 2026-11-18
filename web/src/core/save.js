import { CONFIG } from './config.js';
import { EVENTS } from './events.js';
import { SYMBOL_IDS, WISH_IDS, BAR_ROUNDS, HAND_SIZE, PLACE_PER_ROUND, TABLEAU_MAX, MATCH_CAP } from './charades.js';

export const SAVE_VERSION = 1;
const SCENES = ['loading', 'tavern', 'dive', 'extract', 'bar', 'result'];
const STATUSES = ['diving', 'extract-ready', 'emergency', 'extracted', 'dead', 'settled'];
const TIERS = ['fulfilled', 'warm', 'discount', 'weird'];
const MOODS = ['confused', 'thinking', 'excited'];
const STAMINA_MAX = 99;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pickResource(r) {
  if (!r || typeof r !== 'object') return null;
  if (!Number.isFinite(r.water) || !Number.isFinite(r.stardust)) return null;
  return { water: Math.max(0, r.water), stardust: Math.max(0, r.stardust) };
}

function pickCell(c) {
  if (!c || typeof c !== 'object') return null;
  const content = c.content === null || c.content === undefined ? null
    : (typeof c.content === 'object' && (c.content.type === 'water' || c.content.type === 'stardust')
      && Number.isFinite(c.content.amount) && c.content.amount > 0
      ? { type: c.content.type, amount: c.content.amount } : null);
  return {
    mine: c.mine === true,
    adj: Number.isInteger(c.adj) ? c.adj : 0,
    revealed: c.revealed === true,
    known: c.known === true,
    probed: c.probed === true,
    picked: c.picked === true,
    flagged: c.flagged === true,
    content,
    event: typeof c.event === 'string' && EVENTS[c.event] ? c.event : null,
  };
}

function pickInterference(v) {
  if (v === null || v === undefined || typeof v !== 'object') return null;
  const extra = Number.isFinite(v.extra) ? clamp(Math.round(v.extra), 0, CONFIG.events.interference.extraCost) : 0;
  const remaining = Number.isFinite(v.remaining) ? clamp(Math.round(v.remaining), 0, CONFIG.events.interference.scans) : 0;
  return extra > 0 && remaining > 0 ? { extra, remaining } : null;
}

function pickSettlement(s) {
  if (s === null || s === undefined) return null;
  if (typeof s !== 'object') return null;
  const out = {};
  for (const key of ['match', 'direction', 'purity', 'completion', 'price']) {
    if (!Number.isFinite(s[key])) return null;
    out[key] = s[key];
  }
  if (typeof s.drink !== 'string' || typeof s.drinkText !== 'string' || !TIERS.includes(s.tier)) return null;
  out.drink = s.drink;
  out.drinkText = s.drinkText;
  out.tier = s.tier;
  out.fulfilled = s.fulfilled === true;
  out.banked = s.banked === true;
  const used = pickResource(s.used);
  const warehouseAfter = pickResource(s.warehouseAfter);
  if (!used || !warehouseAfter) return null;
  out.used = used;
  out.warehouseAfter = warehouseAfter;
  if (!s.gaps || typeof s.gaps !== 'object' || !Array.isArray(s.gaps.symbols)
    || s.gaps.symbols.some((x) => !SYMBOL_IDS.includes(x))
    || !Number.isFinite(s.gaps.water) || !Number.isFinite(s.gaps.stardust)) return null;
  out.gaps = { symbols: s.gaps.symbols.slice(), water: s.gaps.water, stardust: s.gaps.stardust };
  return out;
}

function pickBar(b) {
  if (b === null || b === undefined) return null;
  if (typeof b !== 'object') return undefined;
  if (!['place', 'react', 'done'].includes(b.phase)) return undefined;
  if (!Number.isInteger(b.round) || b.round < 1 || b.round > BAR_ROUNDS) return undefined;
  if (!Number.isInteger(b.patience) || b.patience < 1 || b.patience > BAR_ROUNDS) return undefined;
  if (!Number.isInteger(b.placed) || b.placed < 0 || b.placed > PLACE_PER_ROUND) return undefined;
  if (!Array.isArray(b.tableau) || b.tableau.length > TABLEAU_MAX
    || b.tableau.some((s) => !SYMBOL_IDS.includes(s))) return undefined;
  if (!Array.isArray(b.hand) || b.hand.length > HAND_SIZE) return undefined;
  const hand = [];
  for (const c of b.hand) {
    if (!c || typeof c !== 'object' || !SYMBOL_IDS.includes(c.sym) || typeof c.hidden !== 'boolean') return undefined;
    hand.push({ sym: c.sym, hidden: c.hidden });
  }
  const spent = pickResource(b.spent);
  if (!spent) return undefined;
  let interpretation = null;
  if (b.interpretation !== null && b.interpretation !== undefined) {
    const it = b.interpretation;
    if (!it || typeof it !== 'object' || typeof it.text !== 'string'
      || typeof it.drink !== 'string' || !MOODS.includes(it.mood)) return undefined;
    interpretation = { text: it.text, drink: it.drink, mood: it.mood };
  }
  return {
    phase: b.phase, round: b.round, patience: b.patience, placed: b.placed,
    tableau: b.tableau.slice(), hand, spent, interpretation,
  };
}

function pickProvenance(p) {
  if (p === null || p === undefined) return { 1: { water: 0, stardust: 0 }, 2: { water: 0, stardust: 0 } };
  if (typeof p !== 'object') return undefined;
  const out = {};
  for (const floor of [1, 2]) {
    const r = pickResource(p[floor]);
    if (!r) return undefined;
    out[floor] = r;
  }
  return out;
}

function pickRun(run) {
  if (run === null || run === undefined) return null;
  if (typeof run !== 'object') return undefined;
  const b = run.board;
  if (!b || typeof b !== 'object') return undefined;
  const cells = b.cells === null || b.cells === undefined ? null
    : (Array.isArray(b.cells) ? b.cells.map(pickCell) : undefined);
  if (cells === undefined || (cells !== null && cells.some((c) => c === null))) return undefined;
  const carried = pickResource(run.carried);
  const stored = pickResource(run.stored);
  if (!carried || !stored) return undefined;
  const settlement = pickSettlement(run.settlement);
  if (settlement === null && run.settlement !== null && run.settlement !== undefined) return undefined;
  const bar = pickBar(run.bar);
  if (bar === undefined) return undefined;
  const provenance = pickProvenance(run.provenance);
  if (provenance === undefined) return undefined;
  if (typeof run.wish !== 'string' || !WISH_IDS.includes(run.wish)) return undefined;
  return {
    wish: run.wish,
    floor: run.floor,
    rngState: run.rngState,
    stamina: Number.isFinite(run.stamina) ? clamp(Math.round(run.stamina), 0, STAMINA_MAX) : run.stamina,
    shield: Number.isFinite(run.shield) ? clamp(Math.round(run.shield), 0, CONFIG.shield.max) : run.shield,
    carried,
    stored,
    provenance,
    interference: pickInterference(run.interference),
    board: { width: b.width, height: b.height, cells, exit: b.exit },
    status: run.status,
    bar,
    settlement,
  };
}

export function serialize({ scene, run }) {
  return {
    version: SAVE_VERSION,
    scene,
    run: run === null || run === undefined ? null : pickRun(run),
    savedAt: Date.now(),
  };
}

export function migrate(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return null;
}

export function deserialize(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;
  if (data.version !== SAVE_VERSION) {
    data = migrate(data);
    if (!data) return null;
  }
  const run = pickRun(data.run);
  if (run === undefined) return null;
  const out = { version: SAVE_VERSION, scene: data.scene, run, savedAt: Number.isFinite(data.savedAt) ? data.savedAt : 0 };
  return validate(out) ? out : null;
}

function validResource(r) {
  return r && Number.isFinite(r.water) && r.water >= 0
    && Number.isFinite(r.stardust) && r.stardust >= 0;
}

export function validate(data) {
  if (!data || data.version !== SAVE_VERSION) return false;
  if (!SCENES.includes(data.scene)) return false;
  const run = data.run;
  if (data.scene === 'tavern' || data.scene === 'loading') return run === null || validRun(run);
  if (data.scene === 'result' && (!run || run.settlement === null)) return false;
  if (data.scene === 'bar' && (!run || run.bar === null)) return false;
  return validRun(run);
}

function validRun(run) {
  if (!run || typeof run !== 'object') return false;
  if (!WISH_IDS.includes(run.wish)) return false;
  if (!Number.isInteger(run.floor) || run.floor < 1 || run.floor > CONFIG.maxFloor) return false;
  if (!Number.isInteger(run.stamina) || run.stamina < 0 || run.stamina > STAMINA_MAX) return false;
  if (!Number.isInteger(run.shield) || run.shield < 0 || run.shield > CONFIG.shield.max) return false;
  if (!Number.isInteger(run.rngState)) return false;
  if (!validResource(run.carried) || !validResource(run.stored)) return false;
  if (!run.provenance || !validResource(run.provenance[1]) || !validResource(run.provenance[2])) return false;
  if (!STATUSES.includes(run.status)) return false;
  if (run.interference !== null) {
    const f = run.interference;
    if (!f || typeof f !== 'object') return false;
    if (!Number.isInteger(f.extra) || f.extra < 1 || f.extra > CONFIG.events.interference.extraCost) return false;
    if (!Number.isInteger(f.remaining) || f.remaining < 1 || f.remaining > CONFIG.events.interference.scans) return false;
  }
  const cfg = CONFIG.floors[run.floor];
  const b = run.board;
  if (!b || b.width !== cfg.width || b.height !== cfg.height) return false;
  const total = cfg.width * cfg.height;
  if (!Number.isInteger(b.exit) || b.exit < -1 || b.exit >= total) return false;
  if (b.cells === null) {
    if (b.exit !== -1) return false;
  } else {
    if (!Array.isArray(b.cells) || b.cells.length !== total) return false;
    for (const c of b.cells) {
      if (!c || typeof c !== 'object') return false;
      if (typeof c.mine !== 'boolean' || typeof c.revealed !== 'boolean'
        || typeof c.known !== 'boolean' || typeof c.picked !== 'boolean'
        || typeof c.probed !== 'boolean' || typeof c.flagged !== 'boolean') return false;
      if (!Number.isInteger(c.adj) || c.adj < 0 || c.adj > 8) return false;
      if (c.content !== null && (!c.content || typeof c.content !== 'object'
        || !Number.isFinite(c.content.amount) || c.content.amount <= 0)) return false;
      if (c.event !== null && (typeof c.event !== 'string' || !EVENTS[c.event])) return false;
    }
  }
  if (run.settlement !== null) {
    const s = run.settlement;
    if (!s || typeof s !== 'object') return false;
    if (!Number.isFinite(s.completion) || s.completion < 0 || s.completion > 1) return false;
    if (!Number.isFinite(s.price) || s.price < 0) return false;
    if (!Number.isInteger(s.match) || s.match < 0 || s.match > MATCH_CAP) return false;
  }
  if (run.status === 'settled' && (!run.bar || run.bar.phase !== 'done' || run.settlement === null)) return false;
  if (run.bar && run.bar.phase === 'done' && run.settlement === null) return false;
  return true;
}