const L1_POOL = ['supply', 'repair', 'cache', 'interference', 'drink', 'radar'];

// V7 数值（scripts/balance-sim.mjs bot 各 1000 局，seed 1000..1999）：
// v6 语义：水/星尘/事件/雷同等特殊格——藏着、靠推理定位、probe 认出、dig 生效；adj=四者总数（出口不计）。
//   原料占特殊格多数（L1 水10/雷4/事件3），挖特殊格多数有回报=「明知有雷忍不住挖」爽点。
// v7 玩家：①每层生成后即标出出口（隐藏格画出口信标），玩法聚焦朝出口推进路上的推理/抉择，不盲目找出口；
//   ②配方恢复 水60+星6 不变——原料不只靠本局（仓库/后续来源），玩家重过程轻完成，完成度只是软反馈。
// 小量多格：水 10ml/格、星尘 1-2g/格。体力 L1 36 / L2 48；shield 3 容错。
// 推理版重过程：不强求全齐率（配方60 下单局全齐较低属预期），死亡/紧急保持张力即可，待真人试玩再调。
// 棋盘：L1 9×9 mines4；L2 12×10 mines6。
export const CONFIG = {
  maxFloor: 2,
  shield: { initial: 3, max: 3 },
  probeCost: 1,
  exitFarRatio: 0.3,
  recipe: { water: 60, stardust: 6, basePrice: 100 },
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