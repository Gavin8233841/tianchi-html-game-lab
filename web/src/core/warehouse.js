// 酒馆仓库：跨局持久库存。结算余料自动入库；本期只存不用（后续酒馆扩展再开放用途）。
export const EMPTY_WAREHOUSE = () => ({ water: 0, stardust: 0 });

export function depositWarehouse(warehouse, settlement) {
  return {
    water: warehouse.water + settlement.surplusWater,
    stardust: warehouse.stardust + settlement.surplusStardust,
  };
}

export function sanitizeWarehouse(raw) {
  if (!raw || typeof raw !== 'object') return EMPTY_WAREHOUSE();
  const pick = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(999999, Math.floor(v))) : 0);
  return { water: pick(raw.water), stardust: pick(raw.stardust) };
}