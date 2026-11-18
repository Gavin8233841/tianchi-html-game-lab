const L1_POOL = ['supply', 'repair', 'cache', 'interference', 'drink', 'radar'];

// T8 数值张力校准（scripts/balance-sim.mjs，deduction bot 各 1000 局）：
// 目标 L1 撤离完成度≈50% / 贪L2 全齐 45–60% / 死亡 20–35%。
// 实测 L1≈0.49、全齐≈46%、死亡≈27%（多 seed 段稳健）。
// 雷数 16 与宽 10 被单测锁定，密度只能靠高度调：L2 10×8=20%（经典专家密度）。
// shield 初始 1（零容错，修复舱/饮品可补）使踩雷即死，张力成立；shield 2 时死亡仅≈16% 不达标。
export const CONFIG = {
  maxFloor: 2,
  shield: { initial: 1, max: 3 },
  exitFarRatio: 0.3,
  recipe: { water: 60, stardust: 6, basePrice: 100 },
  surplus: { water: 1, stardust: 5 },
  floors: {
    1: {
      id: 1,
      width: 8, height: 8, mines: 6, stamina: 20,
      water: [16, 16, 16, 16, 16],
      stardust: [],
      eventCount: 3,
    },
    2: {
      id: 2,
      width: 10, height: 8, mines: 16, stamina: 28,
      water: [15, 15, 15, 15],
      stardust: [2, 3, 5],
      eventCount: 4,
    },
  },
  events: {
    supply: { stamina: 8 },
    repair: { shield: 1 },
    cache: { water: 20 },
    interference: { scans: 3, extraCost: 1 },
    drink: { choices: [{ stamina: 5 }, { shield: 1 }, { water: 10 }, { stamina: -3 }] },
    radar: { radius: 1 },
    corrode: { shield: -1, minShield: 1 },
    pools: {
      1: L1_POOL,
      2: [...L1_POOL, 'corrode'],
    },
  },
};