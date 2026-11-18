// 酒馆仓库：跨局持久库存。酒吧台结算时算好消耗，warehouseAfter 直接成为仓库新值。
export const EMPTY_WAREHOUSE = () => ({ water: 0, stardust: 0 });

export function sanitizeWarehouse(raw) {
  if (!raw || typeof raw !== 'object') return EMPTY_WAREHOUSE();
  const pick = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(999999, Math.floor(v))) : 0);
  return { water: pick(raw.water), stardust: pick(raw.stardust) };
}