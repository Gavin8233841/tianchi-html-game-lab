import { CONFIG } from './config.js';

export const SAVE_VERSION = 1;
const SCENES = ['loading', 'tavern', 'dive', 'extract', 'mix', 'result'];

export function serialize({ scene, run }) {
  return JSON.stringify({ version: SAVE_VERSION, scene, run });
}

export function deserialize(json) {
  try {
    const data = JSON.parse(json);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
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
  if (!Number.isInteger(run.stamina) || run.stamina < 0) return false;
  if (!Number.isInteger(run.shield) || run.shield < 0 || run.shield > CONFIG.shield.max) return false;
  if (!Number.isInteger(run.rngState)) return false;
  if (!validResource(run.carried) || !validResource(run.stored)) return false;
  const cfg = CONFIG.floors[run.floor];
  const b = run.board;
  if (!b || b.width !== cfg.width || b.height !== cfg.height) return false;
  if (b.cells !== null && (!Array.isArray(b.cells) || b.cells.length !== cfg.width * cfg.height)) return false;
  return typeof run.status === 'string';
}