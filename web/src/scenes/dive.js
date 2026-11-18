import { applyAction } from '../core/rules.js';
import { pointToCell } from '../engine/input.js';

const NUMBER_COLORS = ['#9aa4b2', '#6fc3ff', '#7ee081', '#ffd166', '#ff9f6e', '#ff6e6e', '#e07eff', '#ffffff', '#cccccc'];

function layoutFor(ctx) {
  const { width, height } = ctx.run.board;
  const cellSize = Math.floor(Math.min(ctx.canvas.width / width, ctx.canvas.height / height));
  return {
    width, height, cellSize,
    originX: Math.floor((ctx.canvas.width - cellSize * width) / 2),
    originY: Math.floor((ctx.canvas.height - cellSize * height) / 2),
  };
}

function drawCell(g, cell, index, exit, layout) {
  const x = layout.originX + (index % layout.width) * layout.cellSize;
  const y = layout.originY + Math.floor(index / layout.width) * layout.cellSize;
  const s = layout.cellSize;
  const pad = 1;
  if (!cell.revealed) {
    g.fillStyle = '#3a4256';
    g.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2);
    return;
  }
  g.fillStyle = cell.known ? '#4a1f24' : '#20263a';
  g.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const cx = x + s / 2;
  const cy = y + s / 2;
  if (cell.known) {
    g.fillStyle = '#ff5c5c';
    g.font = `bold ${Math.floor(s * 0.4)}px sans-serif`;
    g.fillText('雷', cx, cy);
    return;
  }
  if (index === exit) {
    g.fillStyle = '#ffd75e';
    g.font = `bold ${Math.floor(s * 0.32)}px sans-serif`;
    g.fillText('出口', cx, cy);
    return;
  }
  if (cell.content && !cell.picked) {
    g.fillStyle = cell.content.type === 'water' ? '#5ec8ff' : '#c99bff';
    g.font = `${Math.floor(s * 0.28)}px sans-serif`;
    g.fillText(cell.content.type === 'water' ? `水${cell.content.amount}` : `星${cell.content.amount}`, cx, cy);
    return;
  }
  if (cell.adj > 0) {
    g.fillStyle = NUMBER_COLORS[cell.adj];
    g.font = `bold ${Math.floor(s * 0.45)}px sans-serif`;
    g.fillText(String(cell.adj), cx, cy);
  }
}

export const dive = {
  enter(ctx) {
    ctx.canvas.style.display = 'block';
    ctx.hud.update(ctx.run);
    const tip = document.createElement('p');
    tip.className = 'hint';
    tip.textContent = '点击格子扫描（每次消耗 1 体力）。找到出口即可安全存料并选择撤离或下潜。';
    ctx.panel.append(tip);
  },
  render(ctx) {
    const g = ctx.g;
    g.fillStyle = '#12151f';
    g.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const run = ctx.run;
    if (!run || !run.board.cells) {
      const layout = layoutFor(ctx);
      for (let i = 0; i < layout.width * layout.height; i++) {
        drawCell(g, { revealed: false }, i, -1, layout);
      }
      g.fillStyle = '#9aa4b2';
      g.font = '16px sans-serif';
      g.textAlign = 'center';
      g.fillText('点任意格开始探索（首击必安全）', ctx.canvas.width / 2, ctx.canvas.height - 12);
      return;
    }
    const layout = layoutFor(ctx);
    for (let i = 0; i < run.board.cells.length; i++) {
      drawCell(g, run.board.cells[i], i, run.board.exit, layout);
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
    if (state.status === 'extract-ready') {
      ctx.goto('extract');
    } else if (state.status === 'dead' || state.status === 'emergency') {
      ctx.goto('mix');
    }
  },
};