import { createRun } from '../core/rules.js';

const WISHES = [
  { id: 'relief', label: '买醉解忧', desc: '忘掉烦恼的一杯' },
  { id: 'fun', label: '喝酒找乐', desc: '来点刺激的一杯' },
];

export const tavern = {
  enter(ctx) {
    const title = document.createElement('h2');
    title.textContent = '星际酒馆';
    const intro = document.createElement('p');
    intro.textContent = '旅人，想喝点什么？选好愿望，去矿区挖原料吧。水在浅层就有，星尘只在更深处。';
    ctx.panel.append(title, intro);
    for (const wish of WISHES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${wish.label}（${wish.desc}）`;
      button.addEventListener('click', () => {
        button.disabled = true;
        const seed = ctx.debugSeed ?? (Date.now() >>> 0);
        ctx.run = createRun({ wish: wish.id, seed });
        ctx.goto('dive');
      });
      ctx.panel.append(button);
    }
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = '玩法：点格扫描，首击必安全；挖到原料先背在身上，找到出口才算存好。雷会消耗护盾，护盾归零人财两空（已存的保留）。';
    ctx.panel.append(hint);
  },
};