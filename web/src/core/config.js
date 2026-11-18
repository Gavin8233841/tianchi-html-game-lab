const L1_POOL = ['supply', 'repair', 'cache', 'interference', 'drink', 'radar'];

// V4 数值（scripts/balance-sim.mjs deduction bot 各 1000 局校准，seed 1000..1999）：
// 目标 L1 撤离完成度≈50% / 贪L2 全齐 45–60% / 死亡 20–35%；节奏 ~10–20 次操作/层。
// v3：体力收紧 L1 26 / L2 38（探索成本真实）。
// v4 玩家反馈「水/星尘要像雷和事件一样靠探索，不能点一下半管」→ 原料改小量多格：
//   L1 water 10×9（单格+10ml=1/6 管，原 30×4 单格半管）；L2 water 10×6、stardust [1,1,1,1,2,2,2,2]（单格+1/2g）。
//   积累 gradual，需多次发现才凑满配方，原料成为探索目标而非一次性赠送。
// 实测：L1 撤离 mean 0.45、贪L2 全齐 51.2%、死亡 21.2%、紧急 23.3%；L2 操作 20.2 次/层。
// v2 语义：adj = 邻格「雷 OR 事件」总数；probe 无伤认雷/认事件，shield 2 容错。
// 棋盘：L1 9×9 mines7；L2 12×10 mines18。
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
      width: 9, height: 9, mines: 7, stamina: 26,
      water: [10, 10, 10, 10, 10, 10, 10, 10, 10],
      stardust: [],
      eventCount: 4,
    },
    2: {
      id: 2,
      width: 12, height: 10, mines: 18, stamina: 38,
      water: [10, 10, 10, 10, 10, 10],
      stardust: [1, 1, 1, 1, 2, 2, 2, 2],
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