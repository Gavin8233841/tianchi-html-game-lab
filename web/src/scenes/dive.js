import { applyAction } from '../core/rules.js';
import { pointToCell } from '../engine/input.js';
import { bake, get, spr } from '../engine/sprites.js';

const CELL = 16;

let lastRevealedIndex = null;
let minerFrame = 'minerIdle';
let swingTimer = null;
let resizeHandler = null;

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

function drawCell(g, cell, index, exit, layout) {
  const x = (index % layout.width) * CELL;
  const y = Math.floor(index / layout.width) * CELL;
  if (cell.known) {
    spr(g, get('mine'), x, y);
    return;
  }
  if (!cell.revealed) {
    spr(g, get('hidden'), x, y);
    return;
  }
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
}

export const dive = {
  enter(ctx) {
    bake();
    lastRevealedIndex = null;
    minerFrame = 'minerIdle';
    ctx.canvas.style.display = 'block';
    fitCanvas(ctx);
    resizeHandler = () => fitCanvas(ctx);
    window.addEventListener('resize', resizeHandler);
    ctx.hud.update(ctx.run);
    const tip = document.createElement('p');
    tip.className = 'hint';
    tip.textContent = '点任意格开始探索（首击必安全）。每次扫描消耗 1 体力，找到出口即可存料并选择撤离或下潜。';
    ctx.panel.append(tip);
  },
  exit(ctx) {
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    if (swingTimer !== null) {
      ctx.scheduler.cancel(swingTimer);
      swingTimer = null;
    }
    lastRevealedIndex = null;
    minerFrame = 'minerIdle';
  },
  render(ctx) {
    const run = ctx.run;
    if (!run) return;
    const g = ctx.g;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#16121f';
    g.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
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
    const reveals = effects.find((e) => e.type === 'reveals');
    const mine = effects.find((e) => e.type === 'mine');
    if (reveals) lastRevealedIndex = reveals.indices[reveals.indices.length - 1];
    else if (mine) lastRevealedIndex = mine.index;
    if (reveals || mine) {
      minerFrame = 'minerSwing';
      if (swingTimer !== null) ctx.scheduler.cancel(swingTimer);
      swingTimer = ctx.scheduler.after(0.2, () => {
        minerFrame = 'minerIdle';
        swingTimer = null;
      });
    }
    if (state.status === 'extract-ready') {
      ctx.goto('extract');
    } else if (state.status === 'dead' || state.status === 'emergency') {
      ctx.goto('mix');
    }
  },
};