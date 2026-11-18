import { applyAction } from '../core/rules.js';
import { CONFIG } from '../core/config.js';

export const extract = {
  enter(ctx) {
    ctx.hud.update(ctx.run);
    const title = document.createElement('h2');
    title.textContent = '找到出口！';
    const info = document.createElement('p');
    info.textContent = `背上的原料已存好：水 ${ctx.run.stored.water}ml ｜ 星尘 ${ctx.run.stored.stardust}g。见好就收，还是再贪一层？`;
    ctx.panel.append(title, info);

    let used = false;
    const act = (action, target) => {
      if (used) return;
      used = true;
      for (const b of ctx.panel.querySelectorAll('button')) b.disabled = true;
      const { state, effects } = applyAction(ctx.run, action);
      if (effects.some((e) => e.type === 'rejected')) { used = false; return; }
      ctx.audio.play('uiClick');
      ctx.commitRun(state);
      ctx.goto(target);
    };

    const leave = document.createElement('button');
    leave.type = 'button';
    leave.textContent = '撤离回吧';
    leave.addEventListener('click', () => act({ type: 'extract' }, 'bar'));
    ctx.panel.append(leave);

    if (ctx.run.floor < CONFIG.maxFloor) {
      const deeper = document.createElement('button');
      deeper.type = 'button';
      deeper.textContent = '继续下一层（星尘在 L2，体力回满，护盾沿用）';
      deeper.addEventListener('click', () => act({ type: 'descend' }, 'dive'));
      ctx.panel.append(deeper);
    }
  },
};