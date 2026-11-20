export const SPIN = Object.freeze({ x: 480, y: 520, radius: 78, grabRadius: 172, centerDeadZone: 13 });
export const PAPER = Object.freeze({ left: 230, top: 461, right: 730, bottom: 637 });
export const NOTE = Object.freeze({ x: 471, y: 522, halfWidth: 87, halfHeight: 36, writeDistance: 23, passDistance: 75 });
export const SNACK = Object.freeze({ x: 480, y: 531, sealY: 486, tearDistance: 65, biteDistance: 76, bites: 4 });
export const PLANE_FOLDS = Object.freeze([1, -1, 1]);
export const PLANE_FLIGHT = Object.freeze({
  short: Object.freeze({ seconds: 0.65, exposure: 0.32, score: 80, suspicion: 6 }),
  far: Object.freeze({ seconds: 1.25, exposure: 1, score: 260, suspicion: 26 }),
});
export const HANDHELD = Object.freeze({
  laneCount: 3, goal: 6, interval: 1.06, x: 480, y: 518, halfWidth: 115, halfHeight: 70, screenHalfWidth: 73,
});

export function canStartSpin(point) {
  return Math.hypot(point.x - SPIN.x, point.y - SPIN.y) <= SPIN.grabRadius;
}

export function spinDelta(previous, point) {
  const ax = previous.x - SPIN.x;
  const ay = previous.y - SPIN.y;
  const bx = point.x - SPIN.x;
  const by = point.y - SPIN.y;
  const deadZone = SPIN.centerDeadZone;
  if (Math.hypot(ax, ay) < deadZone || Math.hypot(bx, by) < deadZone) return 0;

  const cross = ax * by - ay * bx;
  const dot = ax * bx + ay * by;
  // A straight stroke through the pivot may have no sample inside the dead zone.
  if (dot < 0 && Math.abs(cross) < deadZone * Math.hypot(bx - ax, by - ay)) return 0;
  return Math.atan2(cross, dot);
}

export function createHandheld() {
  return { active: false, lane: 1, obstacle: 1, progress: 0, dodged: 0, hit: 0, confiscated: false, packing: 0 };
}

export function moveHandheld(game, direction) {
  if (game.confiscated || (direction !== -1 && direction !== 1)) return false;
  if (game.dodged === HANDHELD.goal) Object.assign(game, createHandheld());
  game.active = true;
  game.lane = Math.max(0, Math.min(HANDHELD.laneCount - 1, game.lane + direction));
  return true;
}

export function advanceHandheld(game, seconds) {
  game.hit = Math.max(0, game.hit - seconds);
  if (!game.active) return null;
  game.progress += seconds / HANDHELD.interval;
  if (game.progress < 1) return null;

  const hit = game.lane === game.obstacle;
  game.progress -= 1;
  // Each new block targets the current lane, leaving both timing and direction to the player.
  game.obstacle = game.lane;
  if (hit) {
    game.hit = 0.24;
    return 'handheld-hit';
  }
  game.dodged += 1;
  if (game.dodged === HANDHELD.goal) {
    game.active = false;
    return 'console-clear';
  }
  return 'handheld-dodge';
}
