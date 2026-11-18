import { CONFIG } from './config.js';
import { EVENTS } from './events.js';

export const SAVE_VERSION = 1;
const SCENES = ['loading', 'tavern', 'dive', 'extract', 'mix', 'result'];
const STATUSES = ['diving', 'extract-ready', 'emergency', 'extracted', 'dead', 'settled'];
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
  for (const key of ['completion', 'price', 'surplusWater', 'surplusStardust', 'coins']) {
    if (!Number.isFinite(s[key])) return null;
    out[key] = s[key];
  }
  out.fulfilled = s.fulfilled === true;
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
  return {
    wish: run.wish,
    floor: run.floor,
    rngState: run.rngState,
    stamina: Number.isFinite(run.stamina) ? clamp(Math.round(run.stamina), 0, STAMINA_MAX) : run.stamina,
    shield: Number.isFinite(run.shield) ? clamp(Math.round(run.shield), 0, CONFIG.shield.max) : run.shield,
    carried,
    stored,
    interference: pickInterference(run.interference),
    board: { width: b.width, height: b.height, cells, exit: b.exit },
    status: run.status,
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
  return validRun(run);
}

function validRun(run) {
  if (!run || typeof run !== 'object') return false;
  if (!Number.isInteger(run.floor) || run.floor < 1 || run.floor > CONFIG.maxFloor) return false;
  if (!Number.isInteger(run.stamina) || run.stamina < 0 || run.stamina > STAMINA_MAX) return false;
  if (!Number.isInteger(run.shield) || run.shield < 0 || run.shield > CONFIG.shield.max) return false;
  if (!Number.isInteger(run.rngState)) return false;
  if (!validResource(run.carried) || !validResource(run.stored)) return false;
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
  if (b.cells === null) return b.exit === -1;
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
  if (run.settlement !== null) {
    const s = run.settlement;
    if (!s || typeof s !== 'object') return false;
    if (!Number.isFinite(s.completion) || s.completion < 0 || s.completion > 1) return false;
    if (!Number.isFinite(s.price) || s.price < 0) return false;
  }
  return true;
}