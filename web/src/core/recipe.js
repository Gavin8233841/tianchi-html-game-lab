import { CONFIG } from './config.js';

export function completion(stored) {
  const { water, stardust } = CONFIG.recipe;
  return 0.5 * Math.min(stored.water / water, 1) + 0.5 * Math.min(stored.stardust / stardust, 1);
}

export function discountedPrice(ratio) {
  return Math.round(CONFIG.recipe.basePrice * (1 - ratio));
}

export function surplusCoins(stored) {
  const extraWater = Math.max(0, stored.water - CONFIG.recipe.water);
  const extraStardust = Math.max(0, stored.stardust - CONFIG.recipe.stardust);
  return extraWater * CONFIG.surplus.water + extraStardust * CONFIG.surplus.stardust;
}

export function settleRecipe(stored) {
  const ratio = completion(stored);
  return {
    completion: ratio,
    fulfilled: ratio >= 1,
    price: discountedPrice(ratio),
    surplusWater: Math.max(0, stored.water - CONFIG.recipe.water),
    surplusStardust: Math.max(0, stored.stardust - CONFIG.recipe.stardust),
    coins: surplusCoins(stored),
    banked: false,
  };
}