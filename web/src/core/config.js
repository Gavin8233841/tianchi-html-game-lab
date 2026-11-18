const L1_POOL = ['supply', 'repair', 'cache', 'interference', 'drink', 'radar'];

// V6 数值（scripts/balance-sim.mjs bot 各 1000 局校准，seed 1000..1999）：
// v6 玩家明确：水/星尘/事件/雷同等——都藏着、靠推理定位、探测认出、自己挖。
//   adj = 邻格「雷 OR 事件 OR 原料」总数（出口不计）；连锁不揭示特殊格；probe 认出原料种类；dig 才收集/触发。
//   原料占特殊格多数（L1 水10/雷4/事件3），让「挖特殊格」多数有回报=「明知有雷忍不住挖」的爽点。
// 小量多格：水 10ml/格、星尘 1-2g/格；配方 水20+星2（推理版收集成本高，配方下调保可赢）。
// 体力 L1 36 / L2 48（探索=推理，需支撑 probe+dig）；shield 3 容错（挖特殊格有雷风险）。
// 实测（water-seeking bot）：贪L2 全齐 33.2% / 死亡 23.9% / 紧急 24.5%；L1 操作 20 / L2 17 次/层；
//   推理 bot 全齐 ≈2× 随机 bot（技巧有用）。推理版难度高于旧版，全齐目标放宽到 ~30–40%，待真人试玩再调。
// 棋盘：L1 9×9 mines4；L2 12×10 mines6。
export const CONFIG = {
  maxFloor: 2,
  shield: { initial: 3, max: 3 },
  probeCost: 1,
  exitFarRatio: 0.3,
  recipe: { water: 20, stardust: 2, basePrice: 100 },
  surplus: { water: 1, stardust: 5 },
  floors: {
    1: {
      id: 1,
      width: 9, height: 9, mines: 4, stamina: 36,
      water: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      stardust: [],
      eventCount: 3,
    },
    2: {
      id: 2,
      width: 12, height: 10, mines: 6, stamina: 48,
      water: [10, 10, 10, 10, 10],
      stardust: [1, 1, 1, 1, 2, 2, 2, 2],
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