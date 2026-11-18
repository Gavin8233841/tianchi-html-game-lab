const L1_POOL = ['supply', 'repair', 'cache', 'interference', 'drink', 'radar'];

// V2-A 数值（scripts/balance-sim.mjs deduction bot 各 1000 局校准，seed 1000..1999）：
// 目标 L1 撤离完成度≈50% / 贪L2 全齐 45–60% / 死亡 20–35%；节奏 ~10–20 次操作/层。
// 实测：L1 撤离 mean 0.46（88.7% 局恰达 50%，早期遇出口的小尾巴拉低均值）、
// 贪L2 全齐 48.2%、死亡 23.5%；L1 操作 10.6 次/层（v1 为 3.7）、L2 21.9 次/层。
// v2 语义：adj = 邻格「雷 OR 事件」总数；probe 无伤认雷/认事件，shield 2 容错。
// 相对设计占位值的校准改动：L1 mines 8→7、stamina 26→34、water 16×5→30×4（总量 120，
// 少格高量让 2 格即达 60 配方线）；L2 stamina 34→42、stardust [2,3,5]→[2,2,3,5]（4 格提高全齐率）。
export const CONFIG = {
  maxFloor: 2,
  shield: { initial: 2, max: 3 },
  probeCost: 1,
  exitFarRatio: 0.3,
  recipe: { water: 60, stardust: 6, basePrice: 100 },
  surplus: { water: 1, stardust: 5 },
  floors: {
    1: {
      id: 1,
      width: 9, height: 9, mines: 7, stamina: 34,
      water: [30, 30, 30, 30],
      stardust: [],
      eventCount: 4,
    },
    2: {
      id: 2,
      width: 12, height: 10, mines: 18, stamina: 42,
      water: [15, 15, 15, 15],
      stardust: [2, 2, 3, 5],
      eventCount: 6,
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