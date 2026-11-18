import { applyAction } from '../core/rules.js';
import {
  applyBarAction, startBar, availableMaterials, SYMBOL_LABEL, WISH_BY_ID,
  PLACE_PER_ROUND, REVEAL_COST,
} from '../core/charades.js';
import { CONFIG } from '../core/config.js';
import { sanitizeWarehouse } from '../core/warehouse.js';
import { bake, get, spr, neon, fitCanvasHD, pourGlass } from '../engine/sprites.js';
import { easeOutCubic, easeOutBack } from '../engine/fx.js';

// 320×240 逻辑空间，backing 按显示倍率放大：文字/卡牌/动画全分辨率光栅化，像素 sprite 整数倍保留像素味。
const LOGICAL_W = 320;
const LOGICAL_H = 240;
const PLACE_TIME = 20;
const MIX_TIME = 1.6;
const SHAKE_TIME = 0.55;
const CARD_W = 40;
const CARD_H = 52;
const TAB_Y = 102;
const TAB_X0 = 20;
const TAB_STEP = 48;
const HAND_Y = 178;
const HAND_X0 = 56;
const HAND_STEP = 56;
const POP_TIME = 0.2;

const STARS = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 67 + 13) % LOGICAL_W,
  y: (i * 41 + 7) % 96,
  phase: i * 1.7,
}));

let elapsed = 0;
let placeElapsed = 0;
let mixT = 0;
let viewScale = 1;
let warehouse = null;
let resizeHandler = null;
let moveHandler = null;
let leaveHandler = null;
let placeTimer = null;
let mixTimer = null;
let phaseWrap = null;
let toastTimer = null;
let hover = null;
let tabAges = [];
let handAges = [];

function symSprite(id) {
  return get(`sym${id[0].toUpperCase()}${id.slice(1)}`);
}

function handRect(i) {
  return { x: HAND_X0 + i * HAND_STEP, y: HAND_Y, w: CARD_W, h: CARD_H };
}
function tabRect(i) {
  return { x: TAB_X0 + i * TAB_STEP, y: TAB_Y, w: CARD_W, h: CARD_H };
}
function inRect(p, r) {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}

function clearTimers(ctx) {
  if (placeTimer !== null) { ctx.scheduler.cancel(placeTimer); placeTimer = null; }
  if (mixTimer !== null) { ctx.scheduler.cancel(mixTimer); mixTimer = null; }
  if (toastTimer !== null) { ctx.scheduler.cancel(toastTimer); toastTimer = null; }
}

function toast(ctx, text) {
  if (!phaseWrap) return;
  const old = phaseWrap.querySelector('.bar-toast');
  if (old) old.remove();
  const el = document.createElement('p');
  el.className = 'hint bar-toast';
  el.textContent = text;
  phaseWrap.append(el);
  if (toastTimer !== null) ctx.scheduler.cancel(toastTimer);
  toastTimer = ctx.scheduler.after(1.8, () => { el.remove(); toastTimer = null; });
}

function provenanceParts(run) {
  const parts = [];
  for (const floor of [1, 2]) {
    const p = run.provenance[floor];
    const bits = [];
    if (p.water > 0) bits.push(`水${p.water}ml`);
    if (p.stardust > 0) bits.push(`星尘${p.stardust}g`);
    if (bits.length > 0) parts.push(`${floor === 1 ? '浅层' : '二层'}挖的${bits.join('、')}`);
  }
  return parts;
}

function button(label, glass, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  if (glass) b.className = 'glass-btn';
  const span = document.createElement('span');
  span.className = glass ? 'glass-label' : '';
  span.textContent = label;
  b.append(span);
  b.addEventListener('click', onClick);
  return b;
}

function syncAges(state, effects, action) {
  for (const e of effects) {
    if (e.type === 'place') {
      tabAges.push(0);
      handAges.splice(action.index, 1);
    }
    if (e.type === 'unplace') {
      tabAges.splice(action.index, 1);
      handAges.push(0);
    }
    if (e.type === 'continue') {
      tabAges = state.bar.tableau.map(() => POP_TIME);
      handAges = state.bar.hand.map(() => 0);
    }
  }
  while (tabAges.length < state.bar.tableau.length) tabAges.push(POP_TIME);
  while (tabAges.length > state.bar.tableau.length) tabAges.pop();
  while (handAges.length < state.bar.hand.length) handAges.push(POP_TIME);
  while (handAges.length > state.bar.hand.length) handAges.pop();
}

function act(ctx, action) {
  const { state, effects } = applyBarAction(ctx.run, { ...action, warehouse });
  const rej = effects.find((e) => e.type === 'rejected');
  if (rej) {
    const why = {
      'card-hidden': '这是暗牌，先花星尘显影',
      'no-stardust': '星尘不够，显影要 1g',
      'round-full': `每回合最多摆 ${PLACE_PER_ROUND} 张`,
      'tableau-full': '吧台摆满了',
      'old-card': '往轮摆的牌收不回来了',
      'no-patience': '调酒师没耐心了，就这杯吧',
      'no-hidden': '这轮没有暗牌了',
    }[rej.reason];
    if (why) toast(ctx, why);
    return;
  }
  ctx.audio.play('uiClick');
  syncAges(state, effects, action);
  ctx.commitRun(state);
  if (state.bar.phase === 'done') {
    startMixing(ctx);
  } else {
    renderPhase(ctx);
    if (effects.some((e) => e.type === 'continue')) startPlaceTimer(ctx);
  }
}

function startPlaceTimer(ctx) {
  placeElapsed = 0;
  if (placeTimer !== null) ctx.scheduler.cancel(placeTimer);
  placeTimer = ctx.scheduler.after(PLACE_TIME, () => {
    placeTimer = null;
    if (ctx.run.bar && ctx.run.bar.phase === 'place') act(ctx, { type: 'confirm' });
  });
}

function startMixing(ctx) {
  clearTimers(ctx);
  mixT = 0;
  ctx.audio.startShake();
  renderPhase(ctx);
  mixTimer = ctx.scheduler.after(MIX_TIME, () => {
    mixTimer = null;
    ctx.audio.stopShake();
    ctx.goto('result');
  });
}

function renderPhase(ctx) {
  if (!phaseWrap) return;
  phaseWrap.replaceChildren();
  const bar = ctx.run.bar;
  const avail = availableMaterials(ctx.run, warehouse);

  const stock = document.createElement('p');
  stock.className = 'hint';
  stock.textContent = `吧台上：水 ${avail.water}ml · 星尘 ${avail.stardust}g（配方需 水${CONFIG.recipe.water} · 星尘${CONFIG.recipe.stardust}）`;
  phaseWrap.append(stock);

  if (bar.phase === 'place') {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = `点手牌摆上吧台（每回合至多 ${PLACE_PER_ROUND} 张），点吧台上的牌收回。暗牌花 ${REVEAL_COST}g 星尘显影。${PLACE_TIME} 秒后自动摆好。`;
    phaseWrap.append(hint);
    const hiddenIdx = bar.hand.findIndex((c) => c.hidden);
    const reveal = button(`显影暗牌（${REVEAL_COST}g 星尘）`, false, () => act(ctx, { type: 'reveal' }));
    reveal.disabled = hiddenIdx < 0 || avail.stardust < REVEAL_COST;
    const confirm = button('摆好了，让它看', true, () => act(ctx, { type: 'confirm' }));
    phaseWrap.append(reveal, confirm);
    return;
  }

  if (bar.phase === 'react') {
    if (placeTimer !== null) { ctx.scheduler.cancel(placeTimer); placeTimer = null; }
    const it = bar.interpretation;
    const card = document.createElement('div');
    card.className = 'event-card buff';
    const body = document.createElement('div');
    body.className = 'event-card-body';
    const name = document.createElement('div');
    name.className = 'event-card-name';
    name.textContent = '调酒师的理解';
    const desc = document.createElement('div');
    desc.className = 'event-card-desc';
    desc.textContent = it.text;
    const mood = document.createElement('div');
    mood.className = 'event-card-deltas';
    mood.textContent = it.mood === 'excited' ? '它三只眼一起亮了！' : it.mood === 'thinking' ? '它歪着头，好像在想……' : '它看起来一脸困惑……';
    body.append(name, desc, mood);
    card.append(body);
    phaseWrap.append(card);
    const drink = button('就这杯，我喝了', true, () => act(ctx, { type: 'drink' }));
    phaseWrap.append(drink);
    if (bar.patience > 1) {
      const more = button(`再比划一轮（还能摆 ${bar.patience - 1} 轮）`, false, () => act(ctx, { type: 'continue' }));
      phaseWrap.append(more);
    } else {
      const last = document.createElement('p');
      last.className = 'hint';
      last.textContent = '调酒师的耐心用完了——就这杯了。';
      phaseWrap.append(last);
    }
    return;
  }

  const mixing = document.createElement('p');
  mixing.textContent = `它摇起了壶……这一杯叫《${ctx.run.settlement.drink}》。`;
  phaseWrap.append(mixing);
}

function drawCard(g, x, y, sym, hidden, border, revealable, pop) {
  const k = pop < POP_TIME ? 0.7 + 0.3 * easeOutBack(Math.max(0, pop) / POP_TIME) : 1;
  g.save();
  g.translate(x + CARD_W / 2, y + CARD_H / 2);
  g.scale(k, k);
  g.translate(-CARD_W / 2, -CARD_H / 2);
  g.fillStyle = '#241d38';
  g.fillRect(0, 0, CARD_W, CARD_H);
  g.fillStyle = 'rgba(255,255,255,0.06)';
  g.fillRect(2, 2, CARD_W - 4, 2);
  g.strokeStyle = border;
  g.lineWidth = 2;
  g.strokeRect(1, 1, CARD_W - 2, CARD_H - 2);
  if (hidden) {
    spr(g, get('cardBack'), 10, 6, 2);
    g.font = 'bold 12px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = revealable ? '#f2c14e' : '#8b81a8';
    g.fillText('?', CARD_W / 2, 42);
  } else {
    spr(g, symSprite(sym), 10, 6, 2);
    g.font = 'bold 11px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#d8d2e8';
    g.fillText(SYMBOL_LABEL[sym], CARD_W / 2, 42);
  }
  g.restore();
}

function logicalPoint(ctx, event) {
  const rect = ctx.canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (ctx.canvas.width / rect.width) / viewScale,
    y: (event.clientY - rect.top) * (ctx.canvas.height / rect.height) / viewScale,
  };
}

export const bar = {
  enter(ctx) {
    bake();
    let run = ctx.run;
    if (run.status === 'emergency') {
      run = applyAction(run, { type: 'extract' }).state;
      ctx.commitRun(run);
    }
    if (run.bar === null) {
      run = startBar(run);
      ctx.commitRun(run);
    }
    if (run.bar.phase === 'done') {
      ctx.goto('result');
      return;
    }
    warehouse = sanitizeWarehouse(ctx.storage.loadWarehouse());
    elapsed = 0;
    placeElapsed = 0;
    mixT = 0;
    hover = null;
    tabAges = run.bar.tableau.map(() => POP_TIME);
    handAges = run.bar.hand.map(() => POP_TIME);

    ctx.canvas.style.display = 'block';
    viewScale = fitCanvasHD(ctx, LOGICAL_W, LOGICAL_H);
    resizeHandler = () => { viewScale = fitCanvasHD(ctx, LOGICAL_W, LOGICAL_H); };
    window.addEventListener('resize', resizeHandler);
    moveHandler = (event) => {
      const barState = ctx.run.bar;
      if (!barState || barState.phase !== 'place') { hover = null; ctx.canvas.style.cursor = 'default'; return; }
      const p = logicalPoint(ctx, event);
      let next = null;
      for (let i = 0; i < barState.hand.length; i++) if (inRect(p, handRect(i))) next = { zone: 'hand', idx: i };
      if (!next) {
        const from = barState.tableau.length - barState.placed;
        for (let i = from; i < barState.tableau.length; i++) if (inRect(p, tabRect(i))) next = { zone: 'tab', idx: i };
      }
      hover = next;
      ctx.canvas.style.cursor = next ? 'pointer' : 'default';
    };
    leaveHandler = () => { hover = null; ctx.canvas.style.cursor = 'default'; };
    ctx.canvas.addEventListener('pointermove', moveHandler);
    ctx.canvas.addEventListener('pointerleave', leaveHandler);

    const title = document.createElement('h2');
    title.textContent = '回到吧台';
    const story = document.createElement('p');
    if (run.status === 'dead') {
      story.textContent = '你贴着创可贴回到吧台。调酒师叹了口气："又下去了？……坐。"就用仓库的存货，照样给你调。';
    } else {
      const parts = provenanceParts(run);
      story.textContent = parts.length > 0
        ? `你把背包倒在吧台上——${parts.join('，')}。调酒师拨弄着看了看："成色不错。现在，告诉我你想要什么。"`
        : '你两手空空地回到吧台。调酒师耸耸肩："仓库里还有点存货。说吧，想要什么？"';
    }
    const wishLine = document.createElement('p');
    wishLine.className = 'hint';
    const wish = WISH_BY_ID[run.wish];
    wishLine.textContent = `你的愿望卡：「${wish.label}」——${wish.desc}。它看不见，只能靠你比划。`;
    phaseWrap = document.createElement('div');
    ctx.panel.append(title, story, wishLine, phaseWrap);
    renderPhase(ctx);
    if (run.bar.phase === 'place') startPlaceTimer(ctx);
  },
  exit(ctx) {
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    if (moveHandler) {
      ctx.canvas.removeEventListener('pointermove', moveHandler);
      moveHandler = null;
    }
    if (leaveHandler) {
      ctx.canvas.removeEventListener('pointerleave', leaveHandler);
      leaveHandler = null;
    }
    ctx.canvas.style.cursor = 'default';
    clearTimers(ctx);
    ctx.audio.stopShake();
    phaseWrap = null;
    warehouse = null;
    hover = null;
    elapsed = 0;
    mixT = 0;
  },
  update(ctx, dt) {
    elapsed += dt;
    if (ctx.run.bar && ctx.run.bar.phase === 'place') placeElapsed += dt;
    if (ctx.run.bar && ctx.run.bar.phase === 'done') mixT += dt;
    tabAges = tabAges.map((a) => a + dt);
    handAges = handAges.map((a) => a + dt);
  },
  onPointer(ctx, p) {
    const run = ctx.run;
    if (!run.bar || run.bar.phase !== 'place' || p.type !== 'pointerdown') return;
    const q = { x: p.x / viewScale, y: p.y / viewScale };
    for (let i = 0; i < run.bar.hand.length; i++) {
      if (inRect(q, handRect(i))) {
        act(ctx, { type: 'place', index: i });
        return;
      }
    }
    for (let i = 0; i < run.bar.tableau.length; i++) {
      if (inRect(q, tabRect(i))) {
        act(ctx, { type: 'unplace', index: i });
        return;
      }
    }
  },
  render(ctx) {
    const g = ctx.g;
    g.setTransform(viewScale, 0, 0, viewScale, 0, 0);
    g.imageSmoothingEnabled = false;
    const run = ctx.run;
    const barState = run.bar;
    g.fillStyle = '#16121f';
    g.fillRect(-8, -8, LOGICAL_W + 16, LOGICAL_H + 16);
    for (const star of STARS) {
      g.globalAlpha = 0.2 + 0.2 * Math.sin(elapsed * 2 + star.phase);
      g.fillStyle = '#b8aed4';
      g.fillRect(star.x, star.y, 1, 1);
    }
    g.globalAlpha = 1;

    const mixing = barState.phase === 'done';
    const bob = Math.round(Math.sin(elapsed * 2.2));
    spr(g, get('bartender'), 124, 26 + bob, 6);
    spr(g, get('barCounter'), 0, 156, 10);

    if (!mixing) {
      const wish = WISH_BY_ID[run.wish];
      g.font = 'bold 11px monospace';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillStyle = '#f2c14e';
      g.fillText(`愿望:${wish.label}`, 8, 12);
      for (let i = 0; i < 3; i++) {
        const on = i < barState.patience;
        g.fillStyle = on ? '#57e6d9' : '#2c2444';
        g.fillRect(8 + i * 12, 20, 8, 10);
        g.fillStyle = on ? '#fff3c4' : '#453a6b';
        g.fillRect(8 + i * 12, 20, 8, 3);
      }
      g.font = '10px monospace';
      g.fillStyle = '#8b81a8';
      g.fillText(`第${barState.round}轮`, 48, 25);

      if (barState.phase === 'place') {
        const remaining = Math.max(0, PLACE_TIME - placeElapsed);
        const urgent = remaining <= 5;
        g.lineWidth = 3;
        g.strokeStyle = '#2c2444';
        g.beginPath();
        g.arc(302, 16, 10, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = urgent ? '#ff6b6b' : '#57e6d9';
        g.beginPath();
        g.arc(302, 16, 10, -Math.PI / 2, -Math.PI / 2 + (remaining / PLACE_TIME) * Math.PI * 2);
        g.stroke();
        g.font = 'bold 10px monospace';
        g.textAlign = 'center';
        g.fillStyle = urgent ? '#ff6b6b' : '#d8d2e8';
        g.fillText(String(Math.ceil(remaining)), 302, 16);
      }

      if (barState.phase === 'react' && barState.interpretation) {
        const mood = barState.interpretation.mood;
        const mark = mood === 'excited' ? '！' : mood === 'thinking' ? '……' : '？';
        const color = mood === 'excited' ? '#f2c14e' : mood === 'thinking' ? '#57e6d9' : '#8b81a8';
        const bubble = neon(mark, color, 20, viewScale);
        g.drawImage(bubble, 206, 28 + bob, bubble.width / viewScale, bubble.height / viewScale);
      }

      const from = barState.tableau.length - barState.placed;
      if (barState.phase === 'place') {
        g.strokeStyle = '#2c2444';
        g.lineWidth = 2;
        g.setLineDash([4, 4]);
        for (let i = barState.tableau.length; i < 6; i++) {
          const r = tabRect(i);
          g.strokeRect(r.x + 1, r.y + 1, CARD_W - 2, CARD_H - 2);
        }
        g.setLineDash([]);
      }
      for (let i = 0; i < barState.tableau.length; i++) {
        const r = tabRect(i);
        const hovered = hover && hover.zone === 'tab' && hover.idx === i;
        const border = i >= from ? (hovered ? '#8ff2e8' : '#57e6d9') : '#453a6b';
        drawCard(g, r.x, r.y - (hovered ? 2 : 0), barState.tableau[i], false, border, false, tabAges[i] ?? POP_TIME);
      }
      const avail = availableMaterials(run, warehouse);
      for (let i = 0; i < barState.hand.length; i++) {
        const c = barState.hand[i];
        const r = handRect(i);
        const hovered = hover && hover.zone === 'hand' && hover.idx === i;
        const border = c.hidden ? '#f2c14e' : hovered ? '#8ff2e8' : '#453a6b';
        drawCard(g, r.x, r.y - (hovered ? 2 : 0), c.sym, c.hidden, border, avail.stardust >= REVEAL_COST, handAges[i] ?? POP_TIME);
      }
      g.font = '10px monospace';
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      g.fillStyle = '#b8aed4';
      g.fillText(`水 ${avail.water}ml · 星尘 ${avail.stardust}g`, 312, 36);
    } else {
      const s = run.settlement;
      const title = neon(`《${s.drink}》`, '#ef5da8', 18, viewScale);
      g.drawImage(title, (LOGICAL_W - title.width / viewScale) / 2, 2, title.width / viewScale, title.height / viewScale);
      const p = Math.min(1, Math.max(0, (mixT - SHAKE_TIME) / (MIX_TIME - SHAKE_TIME)));
      const eased = easeOutCubic(p);
      pourGlass(g, 180, 64, 6, eased * s.completion);
      let cx = 104;
      let cy = 116;
      let angle = 0;
      if (mixT < SHAKE_TIME) {
        cx += Math.sin(mixT * 22) * 8;
        cy += Math.cos(mixT * 22) * 3;
        angle = Math.sin(mixT * 22) * 0.3;
      } else {
        const q = easeOutCubic(Math.min(1, p * 1.8));
        cx = 104 + (250 - 104) * q;
        cy = 116 + (36 - 116) * q;
        angle = -2.3 * q;
      }
      g.save();
      g.translate(Math.round(cx), Math.round(cy));
      g.rotate(angle);
      spr(g, get('shaker'), -30, -39, 6);
      g.restore();
    }
  },
};