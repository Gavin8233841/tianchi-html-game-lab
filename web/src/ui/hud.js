import { CONFIG } from '../core/config.js';

export function createHud(root) {
  return {
    update(run) {
      const { water, stardust } = CONFIG.recipe;
      const totalWater = run.stored.water + run.carried.water;
      const totalStardust = run.stored.stardust + run.carried.stardust;
      root.replaceChildren();
      const line1 = document.createElement('div');
      line1.className = 'hud-line';
      line1.textContent = `层数 L${run.floor} ｜ 体力 ${run.stamina} ｜ 护盾 ${run.shield}`;
      const line2 = document.createElement('div');
      line2.className = 'hud-line';
      line2.textContent = `配方：水 ${Math.min(totalWater, water)}/${water}ml ｜ 星尘 ${Math.min(totalStardust, stardust)}/${stardust}g`;
      const line3 = document.createElement('div');
      line3.className = 'hud-line';
      line3.textContent = `已存 水${run.stored.water}ml·星尘${run.stored.stardust}g ｜ 未存 水${run.carried.water}ml·星尘${run.carried.stardust}g`;
      root.append(line1, line2, line3);
    },
    clear() { root.replaceChildren(); },
  };
}