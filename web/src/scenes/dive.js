import { applyAction } from '../core/rules.js';
import { EVENTS } from '../core/events.js';
import { pointToCell } from '../engine/input.js';
import { bake, get, spr } from '../engine/sprites.js';
import { easeOutBack } from '../engine/fx.js';

const CELL = 16;
const FLIP_TIME = 0.12;
const POP_TIME = 0.9;
const TOAST_TIME = 1.5;
const RESOURCE_LABEL = { water: '水', stardust: '星尘' };
const RESOURCE_UNIT = { water: 'ml', stardust: 'g' };
const RESOURCE_COLOR = { water: '#6cb8ff', stardust: '#f2c14e' };

let shownRevealed = new Set();
let flipAnims = new Map();
let queueTimers = [];
let transitionTimer = null;
let swingTimer = null;
let resizeHandler = null;
let lastRevealedIndex = null;
let minerFrame = 'minerIdle';
let vignette = 0;
let desat = 0;
let desatTarget = 0;
let exitRing = null;
let eventPops = [];
let toastTimer = null;
let toastEl = null;

function layoutFor(ctx) {
  const { width, height } = ctx.run.board;
  return { width, height, cellSize: CELL, originX: 0, originY: 0 };
}

function fitCanvas(ctx) {
  const { width, height } = ctx.run.board;
  const logicalW = width * CELL;
  const logicalH = height * CELL;
  if (ctx.canvas.width !== logicalW) ctx.canvas.width = logicalW;
  if (ctx.canvas.height !== logicalH) ctx.canvas.height = logicalH;
  const parent = ctx.canvas.parentElement;
  const style = getComputedStyle(parent);
  const avail = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const scale = Math.max(1, Math.floor(avail / logicalW));
  ctx.canvas.style.width = `${logicalW * scale}px`;
  ctx.canvas.style.height = 'auto';
}

function cellCenter(index, width) {
  return {
    x: (index % width) * CELL + CELL / 2,
    y: Math.floor(index / width) * CELL + CELL / 2,
  };
}

function drawOpen(g, cell, index, exit, x, y) {
  spr(g, get('revealed'), x, y);
  if (index === exit) {
    spr(g, get('exit'), x, y);
    return;
  }
  if (cell.content && !cell.picked) {
    spr(g, get(cell.content.type), x, y);
    return;
  }
  if (cell.adj > 0) {
    spr(g, get(`digit${cell.adj}`), x + 3, y + 1, 2);
  }
  if (cell.event) {
    const kind = EVENTS[cell.event].kind;
    g.fillStyle = kind === 'debuff' ? '#ff6b6b' : kind === 'random' ? '#f2c14e' : '#7ee787';
    g.fillRect(x + 12, y + 1, 3, 3);
  }
}

function drawCell(g, cell, index, exit, layout) {
  const x = (index % layout.width) * CELL;
  const y = Math.floor(index / layout.width) * CELL;
  if (cell.known) {
    spr(g, get('mine'), x, y);
    return;
  }
  // 逻辑已 revealed 但演出未播到 → 仍画未开，这是连锁错峰的视觉覆盖层
  if (!cell.revealed || !shownRevealed.has(index)) {
    spr(g, get('hidden'), x, y);
    return;
  }
  const age = flipAnims.get(index);
  if (age === undefined) {
    drawOpen(g, cell, index, exit, x, y);
    return;
  }
  const p = Math.min(1, age / FLIP_TIME);
  const cx = x + CELL / 2;
  const cy = y + CELL / 2;
  g.save();
  g.translate(cx, cy);
  if (p < 0.5) {
    g.scale(Math.max(0.05, 1 - p * 2), 1);
    g.translate(-cx, -cy);
    spr(g, get('hidden'), x, y);
  } else {
    g.scale(Math.max(0.05, easeOutBack((p - 0.5) * 2)), 1);
    g.translate(-cx, -cy);
    drawOpen(g, cell, index, exit, x, y);
  }
  g.restore();
  if (p < 0.4) {
    g.globalAlpha = (0.4 - p) * 1.5;
    g.fillStyle = '#ffffff';
    g.fillRect(x, y, CELL, CELL);
    g.globalAlpha = 1;
  }
}

function swing(ctx) {
  minerFrame = 'minerSwing';
  if (swingTimer !== null) ctx.scheduler.cancel(swingTimer);
  swingTimer = ctx.scheduler.after(0.2, () => {
    minerFrame = 'minerIdle';
    swingTimer = null;
  });
}

function revealStep(ctx, index, combo, chainLength) {
  shownRevealed.add(index);
  flipAnims.set(index, 0);
  ctx.audio.playChain(combo - 1);
  lastRevealedIndex = index;
  swing(ctx);
  const { x, y } = cellCenter(index, ctx.run.board.width);
  ctx.particles.dust(x, y + 6);
  if (chainLength > 1) {
    ctx.fx.spawnFloatText(x, y - 2, `×${combo}`, '#57e6d9', {
      size: Math.min(10, 5 + Math.floor(combo / 5)),
      life: 0.55,
      rise: 10,
    });
  }
}

function hudTarget(ctx, resource) {
  const track = document.querySelector(`#hud .bar-wrap.${resource} .bar-track`);
  const rect = ctx.canvas.getBoundingClientRect();
  if (!track || rect.width === 0) return { x: ctx.canvas.width / 2, y: 2 };
  const r = track.getBoundingClientRect();
  const x = (r.left + r.width / 2 - rect.left) * (ctx.canvas.width / rect.width);
  return { x: Math.max(8, Math.min(ctx.canvas.width - 8, x)), y: 2 };
}

function pulseBar(ctx, resource) {
  const wrap = document.querySelector(`#hud .bar-wrap.${resource}`);
  if (!wrap) return;
  wrap.classList.add('pulse');
  queueTimers.push(ctx.scheduler.after(0.45, () => wrap.classList.remove('pulse')));
}

function pickupFx(ctx, pickup) {
  ctx.audio.play(pickup.resource === 'water' ? 'pickupWater' : 'pickupStardust');
  const from = cellCenter(pickup.index, ctx.run.board.width);
  const to = hudTarget(ctx, pickup.resource);
  const unit = RESOURCE_UNIT[pickup.resource];
  ctx.fx.spawnFloatText(from.x, from.y - 4, `+${pickup.amount}${unit}`, RESOURCE_COLOR[pickup.resource], { size: 6 });
  if (pickup.resource === 'stardust') ctx.particles.stardust(from.x, from.y);
  ctx.fx.spawnFly(from.x, from.y, to.x, to.y, get(pickup.resource), () => pulseBar(ctx, pickup.resource));
}

function showToast(ctx, text, kind) {
  if (toastEl) toastEl.remove();
  if (toastTimer !== null) ctx.scheduler.cancel(toastTimer);
  toastEl = document.createElement('div');
  toastEl.className = `event-toast ${kind}`;
  toastEl.textContent = text;
  ctx.panel.append(toastEl);
  toastTimer = ctx.scheduler.after(TOAST_TIME, () => {
    toastTimer = null;
    if (toastEl) toastEl.remove();
    toastEl = null;
  });
}

function eventFx(ctx, ev) {
  const def = EVENTS[ev.id];
  if (!def) return;
  const delta = ev.delta || {};
  const down = def.kind === 'debuff'
    || (delta.stamina !== undefined && delta.stamina < 0)
    || (delta.shield !== undefined && delta.shield < 0);
  ctx.audio.play(down ? 'eventDown' : 'eventUp');
  eventPops.push({ index: ev.index, sprite: get(def.icon), age: 0 });
  showToast(ctx, `${def.name} · ${def.desc}`, down ? 'debuff' : 'buff');
  const c = cellCenter(ev.index, ctx.run.board.width);
  const lines = [];
  if (delta.stamina) lines.push([`${delta.stamina > 0 ? '+' : ''}${delta.stamina} 体力`, delta.stamina > 0 ? '#7ee787' : '#ff6b6b']);
  if (delta.shield) lines.push([`${delta.shield > 0 ? '+' : ''}${delta.shield} 护盾`, delta.shield > 0 ? '#57e6d9' : '#ff6b6b']);
  if (delta.water) lines.push([`+${delta.water}ml 水`, '#6cb8ff']);
  if (delta.interference) lines.push([`干扰 ×${delta.interference.remaining}`, '#ef5da8']);
  if (ev.id === 'radar') lines.push(['雷达扫描', '#57e6d9']);
  if (ev.id === 'corrode' && !delta.shield) lines.push(['护盾已最低', '#8b81a8']);
  lines.forEach(([text, color], k) => {
    ctx.fx.spawnFloatText(c.x, c.y - 4 - k * 7, text, color, { size: 6, life: 0.9 });
  });
  if (delta.water) pulseBar(ctx, 'water');
}

function markFx(ctx, indices) {
  for (const i of indices) {
    shownRevealed.add(i);
    const c = cellCenter(i, ctx.run.board.width);
    ctx.particles.dust(c.x, c.y + 6);
    ctx.fx.spawnFloatText(c.x, c.y - 2, '免费标记', '#57e6d9', { size: 5, life: 0.6 });
  }
  ctx.audio.playChain(0);
}

export const dive = {
  enter(ctx) {
    bake();
    shownRevealed = new Set();
    flipAnims = new Map();
    queueTimers = [];
    transitionTimer = null;
    lastRevealedIndex = null;
    minerFrame = 'minerIdle';
    vignette = 0;
    desat = 0;
    desatTarget = 0;
    exitRing = null;
    eventPops = [];
    toastTimer = null;
    toastEl = null;
    const cells = ctx.run.board.cells;
    if (cells) {
      // 恢复/进场直接渲染逻辑终态，不重放连锁（刷新安全）
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].revealed || cells[i].known) shownRevealed.add(i);
      }
    }
    ctx.canvas.style.display = 'block';
    fitCanvas(ctx);
    resizeHandler = () => fitCanvas(ctx);
    window.addEventListener('resize', resizeHandler);
    ctx.hud.update(ctx.run);
    const tip = document.createElement('p');
    tip.className = 'hint';
    tip.textContent = '点任意格开始探索（首击必安全）。每次扫描消耗 1 体力，找到出口即可存料并选择撤离或下潜。格上彩色小标是随机事件，只给资源或信息，绝不改数字与雷位。';
    ctx.panel.append(tip);
  },
  exit(ctx) {
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    for (const id of queueTimers) ctx.scheduler.cancel(id);
    queueTimers = [];
    if (transitionTimer !== null) {
      ctx.scheduler.cancel(transitionTimer);
      transitionTimer = null;
    }
    if (swingTimer !== null) {
      ctx.scheduler.cancel(swingTimer);
      swingTimer = null;
    }
    if (toastTimer !== null) {
      ctx.scheduler.cancel(toastTimer);
      toastTimer = null;
    }
    if (toastEl) {
      toastEl.remove();
      toastEl = null;
    }
    eventPops = [];
    shownRevealed.clear();
    flipAnims.clear();
    vignette = 0;
    desat = 0;
    desatTarget = 0;
    exitRing = null;
    lastRevealedIndex = null;
    minerFrame = 'minerIdle';
    ctx.input.unlock();
  },
  update(ctx, dt) {
    for (const [index, age] of flipAnims) {
      if (age + dt >= FLIP_TIME) flipAnims.delete(index);
      else flipAnims.set(index, age + dt);
    }
    if (vignette > 0) vignette = Math.max(0, vignette - dt);
    desat += (desatTarget - desat) * Math.min(1, dt * 3);
    if (exitRing) {
      exitRing.age += dt;
      if (exitRing.age >= 0.7) exitRing = null;
    }
    for (const pop of eventPops) pop.age += dt;
    eventPops = eventPops.filter((pop) => pop.age < POP_TIME);
  },
  render(ctx) {
    const run = ctx.run;
    if (!run) return;
    const g = ctx.g;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#16121f';
    g.fillRect(-8, -8, ctx.canvas.width + 16, ctx.canvas.height + 16);
    const layout = layoutFor(ctx);
    const cells = run.board.cells;
    for (let i = 0; i < layout.width * layout.height; i++) {
      drawCell(g, cells ? cells[i] : { revealed: false }, i, run.board.exit, layout);
    }
    if (cells && lastRevealedIndex !== null) {
      const x = (lastRevealedIndex % layout.width) * CELL;
      const y = Math.floor(lastRevealedIndex / layout.width) * CELL;
      spr(g, get(minerFrame), x + 2, y + 2);
    }
    for (const pop of eventPops) {
      const p = Math.min(1, pop.age / POP_TIME);
      const { x, y } = cellCenter(pop.index, layout.width);
      const scale = 1 + 2 * easeOutBack(Math.min(1, p * 2.5));
      const size = CELL * scale;
      g.globalAlpha = p < 0.65 ? 1 : (1 - p) / 0.35;
      g.imageSmoothingEnabled = false;
      g.drawImage(pop.sprite, Math.round(x - size / 2), Math.round(y - size / 2 - p * 6), Math.round(size), Math.round(size));
      g.globalAlpha = 1;
    }
    if (exitRing) {
      const { x, y } = cellCenter(exitRing.index, layout.width);
      const p = exitRing.age / 0.7;
      g.globalAlpha = 1 - p;
      g.strokeStyle = '#f2c14e';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, 4 + p * 22, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
    const danger = vignette > 0 ? vignette * 0.9 : (run.shield === 1 ? 0.12 : 0);
    if (danger > 0) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const grad = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      grad.addColorStop(0, 'rgba(255,60,60,0)');
      grad.addColorStop(1, `rgba(255,60,60,${Math.min(0.55, danger)})`);
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    }
    if (desat > 0.01) {
      g.save();
      g.globalAlpha = desat;
      g.globalCompositeOperation = 'saturation';
      g.fillStyle = '#808080';
      g.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      g.restore();
    }
  },
  onPointer(ctx, point) {
    const run = ctx.run;
    if (!run || run.status !== 'diving') return;
    const index = pointToCell(point, layoutFor(ctx));
    if (index < 0) return;
    const { state, effects } = applyAction(run, { type: 'scan', index });
    if (effects.some((e) => e.type === 'rejected')) return;
    ctx.commitRun(state);
    ctx.hud.update(state);
    ctx.audio.play('dig');
    const width = state.board.width;
    const clicked = cellCenter(index, width);
    const jam = run.interference && run.interference.remaining > 0 ? run.interference.extra : 0;
    ctx.fx.spawnFloatText(clicked.x, clicked.y + 6, `体力−${1 + jam}`, '#8b81a8', { size: 5, life: 0.5, rise: 8 });

    const revealGroups = effects.filter((e) => e.type === 'reveals');
    const mine = effects.find((e) => e.type === 'mine');
    const death = effects.find((e) => e.type === 'death');
    const exitEffect = effects.find((e) => e.type === 'exit');
    const pickups = effects.filter((e) => e.type === 'pickup');
    const markGroups = effects.filter((e) => e.type === 'mine-mark');
    const eventEffects = effects.filter((e) => e.type === 'event');
    let delay = 0;
    let locked = false;
    const waves = [];

    for (const group of revealGroups) {
      const n = group.indices.length;
      let interval = Math.min(0.04, Math.max(0.02, 1.2 / n));
      // 超大连锁（>61 格）放宽 20ms 下限，保住总时长 ~1.2s 封顶（输入锁时长）
      if ((n - 1) * interval > 1.2) interval = 1.2 / (n - 1);
      ctx.input.lock();
      locked = true;
      const start = delay;
      group.indices.forEach((idx, k) => {
        queueTimers.push(ctx.scheduler.after(start + k * interval, () => revealStep(ctx, idx, k + 1, n)));
      });
      waves.push({ indices: group.indices, start, interval });
      delay = start + (n - 1) * interval + 0.15;
    }
    for (const pickup of pickups) {
      const wave = waves.find((w) => w.indices.includes(pickup.index));
      if (!wave) continue;
      const at = wave.start + wave.indices.indexOf(pickup.index) * wave.interval + 0.12;
      queueTimers.push(ctx.scheduler.after(at, () => pickupFx(ctx, pickup)));
      delay = Math.max(delay, at + 0.4);
    }
    for (const marks of markGroups) {
      queueTimers.push(ctx.scheduler.after(delay, () => markFx(ctx, marks.indices)));
      delay += 0.25;
    }
    if (eventEffects.length > 0) {
      ctx.input.lock();
      locked = true;
      eventEffects.forEach((ev, k) => {
        queueTimers.push(ctx.scheduler.after(delay + k * 0.35, () => eventFx(ctx, ev)));
      });
      delay += eventEffects.length * 0.35 + 0.5;
    }

    if (mine) {
      ctx.audio.play('mine');
      shownRevealed.add(mine.index);
      lastRevealedIndex = mine.index;
      swing(ctx);
      ctx.fx.hitStop(3);
      ctx.fx.addTrauma(0.6);
      vignette = 0.35;
      const c = cellCenter(mine.index, width);
      ctx.particles.debris(c.x, c.y);
      ctx.fx.spawnFloatText(c.x, c.y - 4, '−1 护盾', '#ff6b6b', { size: 7 });
      delay = Math.max(delay, 0.5);
    }

    if (death) {
      ctx.audio.play('death');
      ctx.fx.addTrauma(0.9);
      desatTarget = 1;
      vignette = 0.6;
      const c = cellCenter(mine.index, width);
      let at = 0.3;
      for (const [resource, amount] of Object.entries(death.lost)) {
        if (amount <= 0) continue;
        const text = `${RESOURCE_LABEL[resource]} −${amount}${RESOURCE_UNIT[resource]}`;
        queueTimers.push(ctx.scheduler.after(at, () => {
          ctx.fx.spawnFloatText(c.x, c.y, text, '#ef5da8', { size: 6, life: 1, fall: true });
        }));
        at += 0.25;
      }
      delay = Math.max(delay, at + 0.6);
    }

    if (exitEffect) {
      const c = cellCenter(exitEffect.index, width);
      queueTimers.push(ctx.scheduler.after(delay, () => {
        ctx.audio.play('exit');
        exitRing = { index: exitEffect.index, age: 0 };
        ctx.fx.spawnFloatText(c.x, c.y - 4, '已存好', '#f2c14e', { size: 7, life: 0.9 });
        ctx.particles.confetti(c.x, c.y);
      }));
      delay += 0.6;
    }

    if (effects.some((e) => e.type === 'emergency')) {
      ctx.fx.spawnFloatText(clicked.x, clicked.y - 4, '体力耗尽·紧急传送', '#f2c14e', { size: 6, life: 0.9 });
      delay = Math.max(delay, 0.6);
    }

    let target = null;
    if (state.status === 'extract-ready') target = 'extract';
    else if (state.status === 'dead' || state.status === 'emergency') target = 'mix';
    if (target) {
      ctx.input.lock();
      transitionTimer = ctx.scheduler.after(delay + 0.05, () => {
        transitionTimer = null;
        ctx.goto(target);
      });
    } else if (locked) {
      queueTimers.push(ctx.scheduler.after(delay, () => ctx.input.unlock()));
    }
  },
};