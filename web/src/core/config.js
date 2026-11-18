const L1_POOL = ['supply', 'repair', 'cache', 'interference', 'drink', 'radar'];

// V3 数值（scripts/balance-sim.mjs deduction bot 各 1000 局校准，seed 1000..1999）：
// 目标 L1 撤离完成度≈50% / 贪L2 全齐 45–60% / 死亡 20–35%；节奏 ~10–20 次操作/层。
// v3 玩家反馈「体力太多探索成本低」→ L1 stamina 34→26、L2 42→38。
// 实测：L1 撤离 mean 0.47、贪L2 全齐 46.1%、死亡 22.0%、紧急 24.5%（体力压力成为真实威胁）。
// 再收紧 L1 会推高紧急撤离→少存水→拖累 L2 全齐率，26 是保张力的下限附近。
// v2 语义：adj = 邻格「雷 OR 事件」总数；probe 无伤认雷/认事件，shield 2 容错。
// 棋盘/资源布局沿用 v2：L1 9×9 mines7 water30×4；L2 12×10 mines18 stardust[2,2,3,5]。
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
      water: [30, 30, 30, 30],
      stardust: [],
      eventCount: 4,
    },
    2: {
      id: 2,
      width: 12, height: 10, mines: 18, stamina: 38,
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