export const CONFIG = {
  maxFloor: 2,
  shield: { initial: 2, max: 3 },
  exitFarRatio: 0.3,
  recipe: { water: 60, stardust: 6, basePrice: 100 },
  surplus: { water: 1, stardust: 5 },
  floors: {
    1: {
      width: 8, height: 8, mines: 6, stamina: 20,
      water: [16, 16, 16, 16, 16],
      stardust: [],
      eventCount: 3,
    },
    2: {
      width: 10, height: 10, mines: 16, stamina: 24,
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
    drink: { choices: 4 },
    radar: { radius: 1 },
    corrosion: { shield: -1, minShield: 1, floor: 2 },
  },
};