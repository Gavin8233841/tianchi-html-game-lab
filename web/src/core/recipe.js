import { CONFIG } from './config.js';

export function completion(stored) {
  const { water, stardust } = CONFIG.recipe;
  return 0.5 * Math.min(stored.water / water, 1) + 0.5 * Math.min(stored.stardust / stardust, 1);
}

export function discountedPrice(ratio) {
  return Math.round(CONFIG.recipe.basePrice * (1 - ratio));
}