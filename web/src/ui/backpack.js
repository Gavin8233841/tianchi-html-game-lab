import { CONFIG } from '../core/config.js';
import { sanitizeWarehouse } from '../core/warehouse.js';

// 全局背包：任何场景随时打开，打开即暂停（fx.setPaused），慢慢看不计时。
export function createBackpack(ctx) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'backpack-btn';
  btn.textContent = '背包';
  btn.setAttribute('aria-label', '打开背包（暂停游戏）');

  const overlay = document.createElement('div');
  overlay.className = 'backpack-overlay';
  overlay.hidden = true;
  const box = document.createElement('div');
  box.className = 'backpack-box';
  overlay.append(box);
  document.body.append(btn, overlay);

  function section(title, water, dust, note) {
    const wrap = document.createElement('div');
    wrap.className = 'backpack-section';
    const h = document.createElement('div');
    h.className = 'backpack-title';
    h.textContent = title;
    const nums = document.createElement('div');
    nums.className = 'backpack-nums';
    nums.textContent = `水 ${water}ml · 星尘 ${dust}g`;
    const n = document.createElement('p');
    n.className = 'hint';
    n.textContent = note;
    wrap.append(h, nums, n);
    return wrap;
  }

  function render() {
    box.replaceChildren();
    const head = document.createElement('div');
    head.className = 'backpack-head';
    const title = document.createElement('strong');
    title.textContent = '背包';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '关闭（继续游戏）';
    close.addEventListener('click', closeBag);
    head.append(title, close);
    box.append(head);

    const run = ctx.run;
    const carried = run ? run.carried : { water: 0, stardust: 0 };
    const stored = run ? run.stored : { water: 0, stardust: 0 };
    const warehouse = sanitizeWarehouse(ctx.storage.loadWarehouse());
    box.append(section('身上（本局挖到、还没存）', carried.water, carried.stardust,
      '踩雷护盾归零会全丢；找到出口或紧急传送才算存好。'));
    box.append(section('已存（本局存好）', stored.water, stored.stardust,
      '回吧台后倒给调酒师，和本局仓库一起算这杯的纯度。'));
    box.append(section('仓库（跨局永久）', warehouse.water, warehouse.stardust,
      '每局调酒用剩的料自动入库，下一局接着用。攒够料才能调出纯的酒。'));

    const use = document.createElement('div');
    use.className = 'backpack-section';
    const uh = document.createElement('div');
    uh.className = 'backpack-title';
    uh.textContent = '用途';
    use.append(uh);
    const lines = [
      `水 —— 调酒基液，每杯需 ${CONFIG.recipe.water}ml。`,
      `星尘 —— 每杯需 ${CONFIG.recipe.stardust}g；另可在吧台花 1g 显影一张暗牌。`,
      '匹配度 = 比划方向 × 材料纯度；料越够配方，酒越纯。',
    ];
    for (const text of lines) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = text;
      use.append(p);
    }
    box.append(use);
  }

  function openBag() {
    render();
    overlay.hidden = false;
    ctx.fx.setPaused(true);
    ctx.audio.play('uiClick');
    close_focus();
  }
  function close_focus() {
    const c = box.querySelector('button');
    if (c) c.focus();
  }
  function closeBag() {
    overlay.hidden = true;
    ctx.fx.setPaused(false);
    ctx.audio.play('uiClick');
    btn.focus();
  }

  btn.addEventListener('click', () => (overlay.hidden ? openBag() : closeBag()));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeBag();
  });
  const onKey = (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeBag();
  };
  window.addEventListener('keydown', onKey);

  return {
    isOpen: () => !overlay.hidden,
    destroy() {
      window.removeEventListener('keydown', onKey);
      ctx.fx.setPaused(false);
      btn.remove();
      overlay.remove();
    },
  };
}