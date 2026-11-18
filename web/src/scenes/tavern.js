import { createRun } from '../core/rules.js';
import { bake, get, spr, neon, fitCanvas, pourGlass } from '../engine/sprites.js';
import { sanitizeWarehouse } from '../core/warehouse.js';

const WISHES = [
  { id: 'relief', label: '买醉解忧', desc: '忘掉烦恼的一杯' },
  { id: 'fun', label: '喝酒找乐', desc: '来点刺激的一杯' },
];

const LOGICAL_W = 160;
const LOGICAL_H = 128;
const COUNTDOWN = 10;

const STARS = Array.from({ length: 24 }, (_, i) => ({
  x: (i * 67 + 13) % LOGICAL_W,
  y: (i * 41 + 7) % 60,
  phase: i * 1.7,
}));

let elapsed = 0;
let used = false;
let timeoutTimer = null;
let resizeHandler = null;
let buttons = [];

function choose(ctx, wish) {
  if (used) return;
  used = true;
  for (const b of buttons) b.disabled = true;
  if (timeoutTimer !== null) {
    ctx.scheduler.cancel(timeoutTimer);
    timeoutTimer = null;
  }
  ctx.audio.play('uiClick');
  const seed = ctx.debugSeed ?? (Date.now() >>> 0);
  ctx.commitRun(createRun({ wish: wish.id, seed }));
  ctx.goto('dive');
}

export const tavern = {
  enter(ctx) {
    bake();
    elapsed = 0;
    used = false;
    timeoutTimer = null;
    buttons = [];
    ctx.canvas.style.display = 'block';
    fitCanvas(ctx, LOGICAL_W, LOGICAL_H);
    resizeHandler = () => fitCanvas(ctx, LOGICAL_W, LOGICAL_H);
    window.addEventListener('resize', resizeHandler);

    const intro = document.createElement('p');
    intro.textContent = '旅人，想喝点什么？10 秒内选好愿望，去矿区挖原料。水在浅层就有，星尘只在更深处。';
    ctx.panel.append(intro);

    const warehouse = sanitizeWarehouse(ctx.storage.loadWarehouse());
    if (warehouse.water + warehouse.stardust > 0) {
      const stock = document.createElement('p');
      stock.className = 'hint warehouse-line';
      stock.textContent = `酒馆仓库：水 ${warehouse.water}ml · 星尘 ${warehouse.stardust}g（挖多的原料自动入库，老板先帮你存着）`;
      ctx.panel.append(stock);
    }

    const wrap = document.createElement('div');
    wrap.className = 'wish-wrap';
    for (const wish of WISHES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'glass-btn';
      const label = document.createElement('span');
      label.className = 'glass-label';
      label.textContent = wish.label;
      const sub = document.createElement('span');
      sub.className = 'glass-sub';
      sub.textContent = wish.desc;
      button.append(label, sub);
      button.addEventListener('click', () => choose(ctx, wish));
      button.addEventListener('pointerenter', () => {
        if (!used) ctx.audio.play('uiClick');
      });
      buttons.push(button);
      wrap.append(button);
    }
    ctx.panel.append(wrap);

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = '玩法：点格扫描，首击必安全；挖到原料先背在身上，找到出口才算存好。雷会消耗护盾，护盾归零人财两空（已存的保留）。超时默认「买醉解忧」。';
    ctx.panel.append(hint);

    timeoutTimer = ctx.scheduler.after(COUNTDOWN, () => {
      timeoutTimer = null;
      choose(ctx, WISHES[0]);
    });
  },
  exit(ctx) {
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    if (timeoutTimer !== null) {
      ctx.scheduler.cancel(timeoutTimer);
      timeoutTimer = null;
    }
    buttons = [];
    used = false;
    elapsed = 0;
  },
  update(ctx, dt) {
    elapsed += dt;
  },
  render(ctx) {
    const g = ctx.g;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#16121f';
    g.fillRect(-8, -8, LOGICAL_W + 16, LOGICAL_H + 16);
    for (const star of STARS) {
      g.globalAlpha = 0.25 + 0.25 * Math.sin(elapsed * 2 + star.phase);
      g.fillStyle = '#b8aed4';
      g.fillRect(star.x, star.y, 1, 1);
    }
    g.globalAlpha = 1;

    const sign = neon('★ 星际酒馆 ★', '#57e6d9', 12);
    let glow = 0.8 + 0.2 * Math.sin(elapsed * 7);
    if (Math.sin(elapsed * 13.7) > 0.97) glow = 0.35;
    g.globalAlpha = glow;
    g.drawImage(sign, Math.floor((LOGICAL_W - sign.width) / 2), 0);
    g.globalAlpha = 1;

    const bob = Math.round(Math.sin(elapsed * 2.2));
    spr(g, get('bartender'), 56, 30 + bob, 4);
    spr(g, get('barCounter'), 0, 72, 5);
    spr(g, get('shaker'), 24, 48, 2);
    pourGlass(g, 112, 46, 2, 0.6);

    const remaining = Math.max(0, COUNTDOWN - elapsed);
    const urgent = remaining <= 3;
    const cx = 148;
    const cy = 15;
    g.lineWidth = 3;
    g.strokeStyle = '#2c2444';
    g.beginPath();
    g.arc(cx, cy, 9, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = urgent ? '#ff6b6b' : '#57e6d9';
    g.beginPath();
    g.arc(cx, cy, 9, -Math.PI / 2, -Math.PI / 2 + (remaining / COUNTDOWN) * Math.PI * 2);
    g.stroke();
    const jx = urgent ? Math.round(Math.random() * 2 - 1) : 0;
    const jy = urgent ? Math.round(Math.random() * 2 - 1) : 0;
    g.font = 'bold 9px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#120e1a';
    g.fillText(String(Math.ceil(remaining)), cx + jx + 1, cy + jy + 1);
    g.fillStyle = urgent ? '#ff6b6b' : '#d8d2e8';
    g.fillText(String(Math.ceil(remaining)), cx + jx, cy + jy);
  },
};