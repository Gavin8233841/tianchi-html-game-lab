import { applyAction } from '../core/rules.js';
import { settleRecipe } from '../core/recipe.js';
import { bake, get, spr, fitCanvas, pourGlass } from '../engine/sprites.js';
import { easeOutCubic } from '../engine/fx.js';

const WISH_TEXT = {
  relief: '买醉解忧',
  fun: '喝酒找乐',
};

const LOGICAL_W = 160;
const LOGICAL_H = 128;
const SHAKE_TIME = 0.55;
const POUR_TIME = 0.6;
const GLASS_X = 100;
const GLASS_Y = 45;
const GLASS_S = 3;

let t = 0;
let target = 0;
let resizeHandler = null;

function pourProgress() {
  return Math.min(1, Math.max(0, (t - SHAKE_TIME) / POUR_TIME));
}

export const mix = {
  enter(ctx) {
    bake();
    let run = ctx.run;
    if (run.status === 'emergency') {
      run = applyAction(run, { type: 'extract' }).state;
      ctx.commitRun(run);
    }
    t = 0;
    target = settleRecipe(run.stored).completion;

    const title = document.createElement('h2');
    title.textContent = '回到酒馆';
    const story = document.createElement('p');
    if (run.status === 'dead') {
      story.textContent = '你在矿区倒下了……背上的原料散了一地。好在酒馆老板认账：已存好的原料还在，照样给你调这一杯。';
    } else if (run.settlement === null && run.stored.water + run.stored.stardust === 0) {
      story.textContent = '你两手空空地回来了。老板耸耸肩，还是摇起了壶。';
    } else {
      story.textContent = `老板接过你存好的原料——水 ${run.stored.water}ml、星尘 ${run.stored.stardust}g，开始为你调「${WISH_TEXT[run.wish]}」。`;
    }
    ctx.panel.append(title, story);

    ctx.canvas.style.display = 'block';
    fitCanvas(ctx, LOGICAL_W, LOGICAL_H);
    resizeHandler = () => fitCanvas(ctx, LOGICAL_W, LOGICAL_H);
    window.addEventListener('resize', resizeHandler);

    ctx.audio.startShake();
    ctx.scheduler.after(SHAKE_TIME, () => ctx.audio.stopShake());
    ctx.scheduler.after(1.2, () => {
      ctx.audio.stopShake();
      const { state, effects } = applyAction(ctx.run, { type: 'settle' });
      if (effects.some((e) => e.type === 'rejected')) return;
      ctx.commitRun(state);
      ctx.goto('result');
    });
  },
  exit(ctx) {
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    ctx.audio.stopShake();
    t = 0;
    target = 0;
  },
  update(ctx, dt) {
    t += dt;
  },
  render(ctx) {
    const g = ctx.g;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#16121f';
    g.fillRect(-8, -8, LOGICAL_W + 16, LOGICAL_H + 16);
    spr(g, get('barCounter'), 0, 84, 5);

    const p = pourProgress();
    const eased = easeOutCubic(p);
    const fill = eased * target;
    pourGlass(g, GLASS_X, GLASS_Y, GLASS_S, fill);

    let cx = 52;
    let cy = 58;
    let angle = 0;
    if (t < SHAKE_TIME) {
      cx += Math.sin(t * 22) * 5;
      cy += Math.cos(t * 22) * 2;
      angle = Math.sin(t * 22) * 0.3;
    } else {
      const q = easeOutCubic(Math.min(1, p * 1.8));
      cx = 52 + (108 - 52) * q;
      cy = 58 + (28 - 58) * q;
      angle = -2.3 * q;
    }
    g.save();
    g.translate(Math.round(cx), Math.round(cy));
    g.rotate(angle);
    spr(g, get('shaker'), -15, -19, 3);
    g.restore();

    if (p > 0.1 && p < 1 && target > 0) {
      const surfaceY = GLASS_Y + (1 + (1 - fill) * 6.6) * GLASS_S;
      g.globalAlpha = 0.85;
      g.fillStyle = '#ef5da8';
      g.fillRect(GLASS_X + 8 * GLASS_S - 1, 38, 2, Math.max(0, surfaceY - 38));
      g.globalAlpha = 1;
    }

    const percent = Math.round(eased * target * 100);
    g.font = 'bold 10px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#120e1a';
    g.fillText(`完成度 ${percent}%`, 81, 15);
    g.fillStyle = percent >= 100 ? '#f2c14e' : '#57e6d9';
    g.fillText(`完成度 ${percent}%`, 80, 14);
  },
};