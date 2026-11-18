import { bake, neon, fitCanvasHD, pourGlass } from '../engine/sprites.js';
import { easeOutBack } from '../engine/fx.js';
import { sanitizeWarehouse } from '../core/warehouse.js';
import { WISH_BY_ID, SYMBOL_LABEL } from '../core/charades.js';

const LOGICAL_W = 320;
const LOGICAL_H = 240;
const STAMP_AT = 0.35;
const STAMP_TIME = 0.3;
const LINE_AT = 0.6;
const LINE_STEP = 0.28;
const CONFETTI_BURSTS = 8;

const TIER_STAMP = { fulfilled: '免单！', warm: '微醺', discount: '打折', weird: '怪酒' };
const TIER_TITLE = { fulfilled: '愿望达成', warm: '微醺一杯', discount: '愿望打折', weird: '一杯怪酒' };
const WEIRD_LINE = '它调出了一杯……难以名状的东西。你们面面相觑，都笑了。';

let t = 0;
let stampAge = null;
let fulfilled = false;
let completion = 0;
let tier = 'discount';
let viewScale = 1;
let resizeHandler = null;
let used = false;

function drawStamp(g, text, color) {
  const p = Math.min(1, stampAge / STAMP_TIME);
  const k = 3 - 2 * easeOutBack(p);
  g.save();
  g.translate(160, 132);
  g.rotate(-0.18);
  g.scale(k, k);
  g.globalAlpha = Math.min(1, p * 2.5);
  g.fillStyle = 'rgba(22,18,31,0.88)';
  g.fillRect(-68, -28, 136, 56);
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.strokeRect(-68, -28, 136, 56);
  g.lineWidth = 2;
  g.strokeRect(-60, -20, 120, 40);
  g.font = 'bold 26px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(text, 0, 2);
  g.restore();
  g.globalAlpha = 1;
}

function gapLine(gaps, warehouse) {
  const bits = [];
  if (gaps.symbols.length > 0) bits.push(`符号「${gaps.symbols.map((s) => SYMBOL_LABEL[s]).join('、')}」`);
  if (gaps.water > 0) bits.push(`水 ${gaps.water}ml`);
  if (gaps.stardust > 0) bits.push(`星尘 ${gaps.stardust}g`);
  if (bits.length === 0) return '仓库已经攒够下一杯的料了——下次去吧台直接比划。';
  return `下一杯还差：${bits.join(' · ')}（仓库现有 水${warehouse.water}ml · 星尘${warehouse.stardust}g）`;
}

export const result = {
  enter(ctx) {
    bake();
    const run = ctx.run;
    const s = run.settlement;
    const wish = WISH_BY_ID[run.wish];
    t = 0;
    stampAge = null;
    used = false;
    fulfilled = s.fulfilled;
    completion = s.completion;
    tier = s.tier;

    ctx.canvas.style.display = 'block';
    viewScale = fitCanvasHD(ctx, LOGICAL_W, LOGICAL_H);
    resizeHandler = () => { viewScale = fitCanvasHD(ctx, LOGICAL_W, LOGICAL_H); };
    window.addEventListener('resize', resizeHandler);

    // 余料酒直接成为仓库新值（酒吧台已算好消耗）；banked 防刷新重复入库
    let warehouse = sanitizeWarehouse(ctx.storage.loadWarehouse());
    if (!s.banked) {
      warehouse = sanitizeWarehouse(s.warehouseAfter);
      ctx.storage.saveWarehouse(warehouse);
      ctx.commitRun({ ...run, settlement: { ...s, banked: true } });
    }

    const lines = [];
    lines.push([`《${s.drink}》——${s.drinkText}`, '']);
    if (s.tier === 'weird') {
      lines.push([WEIRD_LINE, '']);
    } else {
      lines.push([fulfilled ? wish.done : wish.half, '']);
    }
    lines.push([`匹配度 ${s.match}% = 方向 ${s.direction} × 纯度 ${Math.round(s.purity * 100)}%`, 'price']);
    if (fulfilled) {
      lines.push(['调酒师擦着杯子："这杯实现了99%。剩下那1%……得你自己走。"', '']);
      lines.push(['原价 100 币 → 免单！', 'price']);
    } else {
      lines.push([`原价 100 币 → 折后 ${s.price} 币`, 'price']);
    }
    lines.push([gapLine(s.gaps, warehouse), 'coin']);
    if (run.shield <= 0) {
      lines.push(['（这次是扶着墙回来的……身上带的原料丢了，仓库的还在。）', 'hint']);
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
      ctx.audio.play(fulfilled ? 'fulfill' : 'discount');
      if (fulfilled) {
        ctx.fx.addTrauma(0.3);
        for (let k = 0; k < CONFETTI_BURSTS; k++) {
          ctx.scheduler.after(k * 0.12, () => {
            ctx.particles.confetti(40 + Math.random() * 240, 16 + Math.random() * 48);
          });
        }
        for (let k = 0; k < 5; k++) {
          ctx.scheduler.after(0.2 + k * 0.25, () => ctx.particles.stardust(160, 92));
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
    g.setTransform(viewScale, 0, 0, viewScale, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#16121f';
    g.fillRect(-8, -8, LOGICAL_W + 16, LOGICAL_H + 16);

    const color = fulfilled ? '#f2c14e' : tier === 'weird' ? '#8b81a8' : '#ef5da8';
    const title = neon(TIER_TITLE[tier], color, 28, viewScale);
    let glow = fulfilled ? 0.7 + 0.3 * Math.sin(t * 9) : 0.9;
    if (fulfilled && Math.sin(t * 17) > 0.96) glow = 0.3;
    g.globalAlpha = glow;
    g.drawImage(title, (LOGICAL_W - title.width / viewScale) / 2, 4, title.width / viewScale, title.height / viewScale);
    g.globalAlpha = 1;

    pourGlass(g, 112, 88, 6, completion);

    if (stampAge !== null) {
      drawStamp(g, TIER_STAMP[tier], color);
    }
  },
};