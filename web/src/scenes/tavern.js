import { createRun } from '../core/rules.js';
import { CHARADE_WISHES } from '../core/charades.js';
import { bake, get, spr, neon, fitCanvas, pourGlass } from '../engine/sprites.js';
import { sanitizeWarehouse } from '../core/warehouse.js';

const LOGICAL_W = 160;
const LOGICAL_H = 128;

const STARS = Array.from({ length: 24 }, (_, i) => ({
  x: (i * 67 + 13) % LOGICAL_W,
  y: (i * 41 + 7) % 60,
  phase: i * 1.7,
}));

let elapsed = 0;
let used = false;
let phase = 'door';
let resizeHandler = null;
let buttons = [];

function glassButton(ctx, label, sub, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'glass-btn';
  const lab = document.createElement('span');
  lab.className = 'glass-label';
  lab.textContent = label;
  button.append(lab);
  if (sub) {
    const s = document.createElement('span');
    s.className = 'glass-sub';
    s.textContent = sub;
    button.append(s);
  }
  button.addEventListener('click', onClick);
  button.addEventListener('pointerenter', () => {
    if (!used) ctx.audio.play('uiClick');
  });
  buttons.push(button);
  return button;
}

function buildPanel(ctx) {
  ctx.panel.replaceChildren();
  buttons = [];
  const warehouse = sanitizeWarehouse(ctx.storage.loadWarehouse());
  if (warehouse.water + warehouse.stardust > 0) {
    const stock = document.createElement('p');
    stock.className = 'hint warehouse-line';
    stock.textContent = `酒馆仓库：水 ${warehouse.water}ml · 星尘 ${warehouse.stardust}g（攒够料，调酒师能给你调更纯的一杯）`;
    ctx.panel.append(stock);
  }

  if (phase === 'door') {
    const intro = document.createElement('p');
    intro.textContent = '旅人，夜深了。推开这扇门，选一张愿望卡——先去矿区挖原料，再回吧台比划给调酒师看。不计时，慢慢来。';
    ctx.panel.append(intro);
    const wrap = document.createElement('div');
    wrap.className = 'wish-wrap';
    wrap.append(glassButton(ctx, '买醉解忧', '推门而入', () => enterWishPhase(ctx)));
    ctx.panel.append(wrap);
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = '玩法：扫雷挖水与星尘 → 撤离回吧 → 用符号牌向调酒师比划你的愿望。它猜得越准、料越足，愿望实现得越完整。右上角「背包」随时看原料和用途。';
    ctx.panel.append(hint);
    return;
  }

  const intro = document.createElement('p');
  intro.textContent = '选一张愿望卡。它会被扣在吧台上——调酒师看不见，只能靠你比划。不计时，慢慢选。';
  ctx.panel.append(intro);
  const wrap = document.createElement('div');
  wrap.className = 'wish-wrap';
  for (const wish of CHARADE_WISHES) {
    wrap.append(glassButton(ctx, wish.label, wish.desc, () => choose(ctx, wish)));
  }
  ctx.panel.append(wrap);
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = '水在浅层就有，星尘只在更深处——星尘还能在吧台显影暗牌。';
  ctx.panel.append(hint);
}

function enterWishPhase(ctx) {
  if (used || phase !== 'door') return;
  phase = 'wish';
  ctx.audio.play('uiClick');
  buildPanel(ctx);
}

function choose(ctx, wish) {
  if (used) return;
  used = true;
  for (const b of buttons) b.disabled = true;
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
    phase = 'door';
    buttons = [];
    ctx.canvas.style.display = 'block';
    fitCanvas(ctx, LOGICAL_W, LOGICAL_H);
    resizeHandler = () => fitCanvas(ctx, LOGICAL_W, LOGICAL_H);
    window.addEventListener('resize', resizeHandler);
    buildPanel(ctx);
  },
  exit(ctx) {
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
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
  },
};