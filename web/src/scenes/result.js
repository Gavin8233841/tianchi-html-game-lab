import { bake, get, spr, neon, fitCanvas, pourGlass } from '../engine/sprites.js';
import { easeOutBack } from '../engine/fx.js';

const WISH_DONE = {
  relief: '烦恼溶进酒里，今晚好眠。',
  fun: '这一口下去，星星都在舌尖炸开！',
};
const WISH_HALF = {
  relief: '酒是淡了点，但烦恼也淡了点。',
  fun: '乐子找着一半，下次挖深点。',
};

const LOGICAL_W = 160;
const LOGICAL_H = 128;
const STAMP_AT = 0.35;
const STAMP_TIME = 0.3;
const LINE_AT = 0.6;
const LINE_STEP = 0.28;
const CONFETTI_BURSTS = 8;

let t = 0;
let stampAge = null;
let fulfilled = false;
let completion = 0;
let resizeHandler = null;
let used = false;

function drawStamp(g, text, color) {
  const p = Math.min(1, stampAge / STAMP_TIME);
  const k = 3 - 2 * easeOutBack(p);
  g.save();
  g.translate(80, 66);
  g.rotate(-0.18);
  g.scale(k, k);
  g.globalAlpha = Math.min(1, p * 2.5);
  g.fillStyle = 'rgba(22,18,31,0.88)';
  g.fillRect(-34, -14, 68, 28);
  g.strokeStyle = color;
  g.lineWidth = 2;
  g.strokeRect(-34, -14, 68, 28);
  g.lineWidth = 1;
  g.strokeRect(-30, -10, 60, 20);
  g.font = 'bold 13px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(text, 0, 1);
  g.restore();
  g.globalAlpha = 1;
}

export const result = {
  enter(ctx) {
    bake();
    const run = ctx.run;
    const s = run.settlement;
    t = 0;
    stampAge = null;
    used = false;
    fulfilled = s.fulfilled;
    completion = s.completion;

    ctx.canvas.style.display = 'block';
    fitCanvas(ctx, LOGICAL_W, LOGICAL_H);
    resizeHandler = () => fitCanvas(ctx, LOGICAL_W, LOGICAL_H);
    window.addEventListener('resize', resizeHandler);

    const percent = Math.round(s.completion * 100);
    const surplusLine = s.coins > 0
      ? `余料入账 +${s.coins} 币（水 ${s.surplusWater}ml×1 + 星尘 ${s.surplusStardust}g×5，钱包只显示）`
      : '没有余料可卖，钱包不动。';
    const lines = s.fulfilled
      ? [
        [WISH_DONE[run.wish], ''],
        [`完成度 ${percent}% · 原价 100 币 → 免单！`, 'price'],
        [surplusLine, 'coin'],
      ]
      : [
        [WISH_HALF[run.wish], ''],
        [`完成度 ${percent}%`, ''],
        ['原价 100 币', ''],
        [`折后 ${s.price} 币`, 'price'],
        [surplusLine, 'coin'],
      ];
    if (run.status === 'settled' && run.shield <= 0) {
      lines.push(['（这次是扶着墙回来的……已存原料保住了，身上带的全丢了。）', 'hint']);
    }
    lines.forEach(([text, cls], i) => {
      ctx.scheduler.after(LINE_AT + i * LINE_STEP, () => {
        const line = document.createElement('p');
        line.className = `result-line${cls ? ` ${cls}` : ''}`;
        line.textContent = text;
        ctx.panel.append(line);
      });
    });
    ctx.scheduler.after(LINE_AT + lines.length * LINE_STEP + 0.1, () => {
      const again = document.createElement('button');
      again.type = 'button';
      again.textContent = '再来一局';
      again.addEventListener('click', () => {
        if (used) return;
        used = true;
        again.disabled = true;
        ctx.audio.play('uiClick');
        ctx.goto('tavern', { keepRun: false });
      });
      ctx.panel.append(again);
    });

    ctx.scheduler.after(STAMP_AT, () => {
      stampAge = 0;
      ctx.audio.play(s.fulfilled ? 'fulfill' : 'discount');
      if (s.fulfilled) {
        ctx.fx.addTrauma(0.3);
        for (let k = 0; k < CONFETTI_BURSTS; k++) {
          ctx.scheduler.after(k * 0.12, () => {
            ctx.particles.confetti(20 + Math.random() * 120, 8 + Math.random() * 24);
          });
        }
        for (let k = 0; k < 5; k++) {
          ctx.scheduler.after(0.2 + k * 0.25, () => ctx.particles.stardust(80, 46));
        }
      }
    });
  },
  exit(ctx) {
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    t = 0;
    stampAge = null;
    used = false;
  },
  update(ctx, dt) {
    t += dt;
    if (stampAge !== null) stampAge += dt;
  },
  render(ctx) {
    const g = ctx.g;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#16121f';
    g.fillRect(-8, -8, LOGICAL_W + 16, LOGICAL_H + 16);

    const title = fulfilled ? neon('愿望达成', '#f2c14e', 14) : neon('愿望打折', '#ef5da8', 14);
    let glow = fulfilled ? 0.7 + 0.3 * Math.sin(t * 9) : 0.9;
    if (fulfilled && Math.sin(t * 17) > 0.96) glow = 0.3;
    g.globalAlpha = glow;
    g.drawImage(title, Math.floor((LOGICAL_W - title.width) / 2), 2);
    g.globalAlpha = 1;

    pourGlass(g, 56, 44, 3, completion);

    if (stampAge !== null) {
      drawStamp(g, fulfilled ? '免单！' : '打折', fulfilled ? '#f2c14e' : '#ef5da8');
    }
  },
};