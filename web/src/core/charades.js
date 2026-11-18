import { CONFIG } from './config.js';
import { completion, discountedPrice } from './recipe.js';
import { mulberry32, shuffle } from './rng.js';

// 宇宙比划点单：第一幕扫雷挖料，第二幕吧台用符号向调酒师表达愿望。
// 匹配度 = 方向分(符号) × 材料纯度(扫雷+仓库)，封顶 99——没有一杯酒能百分之百解决愿望。

export const SYMBOLS = [
  { id: 'star', label: '星', mean: '恒星 / 点燃 / 许愿' },
  { id: 'house', label: '家', mean: '房屋 / 建筑 / 旧回忆' },
  { id: 'heart', label: '心', mean: '心脏 / 爱情 / 执念' },
  { id: 'road', label: '路', mean: '道路 / 旅程 / 归途' },
  { id: 'fire', label: '火', mean: '火焰 / 热情 / 勇气' },
  { id: 'water', label: '水', mean: '水 / 洗涤 / 眼泪' },
  { id: 'moon', label: '月', mean: '月亮 / 夜晚 / 思念' },
  { id: 'door', label: '门', mean: '门 / 送别 / 新开始' },
];
export const SYMBOL_IDS = SYMBOLS.map((s) => s.id);
export const SYMBOL_LABEL = Object.fromEntries(SYMBOLS.map((s) => [s.id, s.label]));

export const CHARADE_WISHES = [
  {
    id: 'home', label: '想家', desc: '想念一个叫家的地方',
    hint: '路的尽头，有一间房子。',
    core: ['house', 'road'], bonus: ['moon', 'star'], trap: ['heart', 'water'],
    done: '酒液里浮着一栋小房子，门前星路蜿蜒。你听见了开门声。',
    half: '房子有点模糊，但那条路你认得。',
  },
  {
    id: 'brave', label: '想勇敢', desc: '明天那件事，想敢去做',
    hint: '把心点燃。',
    core: ['fire', 'heart'], bonus: ['star'], trap: ['water', 'moon'],
    done: '一口下去，胸口像点起了一堆火。明天你敢了。',
    half: '火苗有了，还差一阵风。',
  },
  {
    id: 'forget', label: '想忘掉一个人', desc: '把那个名字冲淡一点',
    hint: '洗干净，然后送出门。',
    core: ['water', 'door'], bonus: ['moon'], trap: ['heart', 'house'],
    done: '那扇门关上了，水声把名字冲得很淡很淡。',
    half: '名字还在，只是笔画淡了。',
  },
  {
    id: 'dream', label: '想做个好梦', desc: '今晚想去软绵绵的地方',
    hint: '月光和星光，软软的夜。',
    core: ['moon', 'star'], bonus: ['water'], trap: ['fire', 'house'],
    done: '今晚的梦里会有星星，软的，能踩上去。',
    half: '梦有了，星星还在路上。',
  },
  {
    id: 'restart', label: '想重新开始', desc: '想走一条没走过的路',
    hint: '推开新门，走没走过的路。',
    core: ['door', 'road'], bonus: ['star'], trap: ['house', 'heart'],
    done: '门后是一条没走过的路。这次往哪走，你说了算。',
    half: '门开了条缝，路还看不全。',
  },
];
export const WISH_IDS = CHARADE_WISHES.map((w) => w.id);
export const WISH_BY_ID = Object.fromEntries(CHARADE_WISHES.map((w) => [w.id, w]));

export const BAR_ROUNDS = 3;
export const HAND_SIZE = 4;
export const PLACE_PER_ROUND = 3;
export const TABLEAU_MAX = 6;
export const REVEAL_COST = 1;
export const MATCH_CAP = 99;
export const FULFILL_AT = 90;

// 调酒师的直译：它不知道你的愿望，只按外星脑回路读符号组合。
const COMBOS = {
  'house': { text: '建筑！你要买房子？我这有星尘味的砖。', drink: '星尘砖块' },
  'heart': { text: '器官？……你们地球人真客气。', drink: '搏动特饮' },
  'fire': { text: '氧化反应！要加热什么？', drink: '烈焰一口' },
  'water': { text: '溶剂。最普通的那杯？', drink: '纯溶剂' },
  'moon': { text: '卫星。你想上去走走？', drink: '环形山气泡' },
  'star': { text: '恒星！小心烫嘴。', drink: '恒星浆' },
  'road': { text: '路径。你要去哪？', drink: '里程计' },
  'door': { text: '通道。门后是什么？', drink: '门槛之上' },
  'heart+house': { text: '心形的小屋！你要结婚？', drink: '爱巢' },
  'house+road': { text: '带路的房子……搬家酒？', drink: '搬迁特调' },
  'house+moon': { text: '月亮上的房子？租金很贵吧。', drink: '广寒宫租约' },
  'house+star': { text: '星星下的房子。视野不错。', drink: '星穹小筑' },
  'house+water': { text: '泡在水里的房子……水乡？', drink: '水乡' },
  'house+fire': { text: '壁炉！温暖的家！', drink: '壁炉暖饮' },
  'house+road+moon': { text: '月光下、一条路通向房子……有人在等你回家。', drink: '银河巷一号' },
  'fire+heart': { text: '燃烧的器官！……我是说，热情！', drink: '烈焰真心' },
  'fire+water': { text: '温泉！懂了！', drink: '岩浆浴' },
  'fire+star': { text: '点火升空！你要上天？', drink: '推进剂' },
  'fire+door': { text: '防火门？安全第一。', drink: '消防通道' },
  'fire+moon': { text: '夜晚的火。露营？', drink: '篝火' },
  'fire+heart+star': { text: '燃烧的雄心！我懂了！', drink: '超新星之心' },
  'door+water': { text: '把什么冲出门外……送别？', drink: '忘川特调' },
  'moon+water': { text: '月亮掉进水里了。捞起来喝一杯？', drink: '捞月' },
  'heart+water': { text: '眼泪。你在难过？', drink: '咸泪苏打' },
  'moon+star': { text: '夜空。你在看天？', drink: '天文台' },
  'moon+door': { text: '月门？传送装置？', drink: '月门通行液' },
  'road+star': { text: '星路。要走很远？', drink: '光年漫步' },
  'door+road': { text: '出门上路。干杯，为了出发。', drink: '启程' },
  'door+heart': { text: '把心关在门外？还是开门谈心？', drink: '心门' },
  'heart+star': { text: '心形的星星。许愿用？', drink: '星愿' },
  'heart+moon': { text: '月下之心。浪漫。', drink: '月下恋' },
  'door+star': { text: '星门。跳跃要排队。', drink: '星门跳跃' },
  'road+water': { text: '河流。逝者如斯。', drink: '长河' },
  'door+moon+water': { text: '月下送别……把回忆冲走吧。', drink: '忘川月下' },
  'door+road+star': { text: '新的门、新的路，通向星星。重新开始？', drink: '新纪元' },
  'heart+road': { text: '心路历程。这杯有深度。', drink: '心路' },
  'star+water': { text: '星尘雨。张开嘴接。', drink: '星雨' },
};

const FALLBACK_DRINK = '未知混合物';

// 组合键统一按字母序归一，避免手写键序与 lookup 不一致
const COMBO_TABLE = Object.fromEntries(
  Object.entries(COMBOS).map(([k, v]) => [k.split('+').sort().join('+'), v]),
);

function comboKey(tableau) {
  return [...new Set(tableau)].sort().join('+');
}

export function directionScore(wishId, tableau) {
  const wish = WISH_BY_ID[wishId];
  if (!wish) return 0;
  const set = new Set(tableau);
  let score = 0;
  for (const s of wish.core) if (set.has(s)) score += 50;
  for (const s of wish.bonus) if (set.has(s)) score += 10;
  for (const s of wish.trap) if (set.has(s)) score -= 15;
  return Math.max(0, Math.min(100, score));
}

export function moodFor(direction) {
  if (direction >= FULFILL_AT) return 'excited';
  if (direction >= 50) return 'thinking';
  return 'confused';
}

// 反应诊断：把「差在哪」说成可操作的人话（陷阱点名警告 / 缺核心明说），不报数字。
export function reactionNotes(wishId, tableau) {
  const wish = WISH_BY_ID[wishId];
  if (!wish) return { trapLabels: [], missingCore: false };
  const set = new Set(tableau);
  const trapLabels = wish.trap.filter((s) => set.has(s)).map((s) => SYMBOL_LABEL[s]);
  const missingCore = wish.core.some((s) => !set.has(s));
  return { trapLabels, missingCore };
}

export function reactionLines(wishId, tableau) {
  const { trapLabels, missingCore } = reactionNotes(wishId, tableau);
  const lines = [];
  if (trapLabels.length > 0) {
    lines.push(`它指着「${trapLabels.join('、')}」犹豫了一下："这个让我想到别的东西……你确定要放？"`);
  }
  if (missingCore) {
    lines.push('它歪着头："好像还缺了点什么……最重要的东西，还没摆上来。"');
  }
  return lines;
}

export function interpret(wishId, tableau) {
  const key = comboKey(tableau);
  const hit = COMBO_TABLE[key];
  const direction = directionScore(wishId, tableau);
  if (hit) return { text: hit.text, drink: hit.drink, mood: moodFor(direction) };
  const labels = [...new Set(tableau)].map((s) => SYMBOL_LABEL[s]).join('、');
  const text = labels
    ? `它盯着你摆的「${labels}」，触手挠了挠头：「……这是艺术？」`
    : '它看着空荡荡的吧台，三只眼一起眨：「……行为艺术？」';
  return { text, drink: FALLBACK_DRINK, mood: moodFor(direction) };
}

export function availableMaterials(run, warehouse) {
  const spent = run.bar ? run.bar.spent : { water: 0, stardust: 0 };
  return {
    water: Math.max(0, run.stored.water + warehouse.water - spent.water),
    stardust: Math.max(0, run.stored.stardust + warehouse.stardust - spent.stardust),
  };
}

function drawHand(run) {
  const rng = mulberry32(run.rngState);
  const picked = shuffle(SYMBOL_IDS.slice(), rng).slice(0, HAND_SIZE);
  const hand = picked.map((sym, i) => ({ sym, hidden: i === HAND_SIZE - 1 }));
  return { hand, rngState: rng.getState() };
}

export function startBar(run) {
  const { hand, rngState } = drawHand(run);
  return {
    ...run,
    rngState,
    bar: {
      phase: 'place',
      round: 1,
      patience: BAR_ROUNDS,
      tableau: [],
      hand,
      placed: 0,
      spent: { water: 0, stardust: 0 },
      interpretation: null,
    },
  };
}

function rejected(state, reason) {
  return { state, effects: [{ type: 'rejected', reason }] };
}

function applyPlace(state, index) {
  const bar = state.bar;
  if (!bar || bar.phase !== 'place') return rejected(state, 'not-placing');
  if (!Number.isInteger(index) || index < 0 || index >= bar.hand.length) return rejected(state, 'bad-card');
  if (bar.placed >= PLACE_PER_ROUND) return rejected(state, 'round-full');
  if (bar.tableau.length >= TABLEAU_MAX) return rejected(state, 'tableau-full');
  const card = bar.hand[index];
  if (card.hidden) return rejected(state, 'card-hidden');
  const hand = bar.hand.filter((_, i) => i !== index);
  const next = {
    ...state,
    bar: { ...bar, hand, tableau: [...bar.tableau, card.sym], placed: bar.placed + 1 },
  };
  return { state: next, effects: [{ type: 'place', sym: card.sym }] };
}

function applyUnplace(state, index) {
  const bar = state.bar;
  if (!bar || bar.phase !== 'place') return rejected(state, 'not-placing');
  if (!Number.isInteger(index) || index < 0 || index >= bar.tableau.length) return rejected(state, 'bad-card');
  // 只能收回本回合摆的牌（往轮的已经"给调酒师看过了"）
  const from = bar.tableau.length - bar.placed;
  if (index < from) return rejected(state, 'old-card');
  const sym = bar.tableau[index];
  const tableau = bar.tableau.filter((_, i) => i !== index);
  const next = {
    ...state,
    bar: { ...bar, tableau, hand: [...bar.hand, { sym, hidden: false }], placed: bar.placed - 1 },
  };
  return { state: next, effects: [{ type: 'unplace', sym }] };
}

function applyReveal(state, warehouse) {
  const bar = state.bar;
  if (!bar || bar.phase !== 'place') return rejected(state, 'not-placing');
  const idx = bar.hand.findIndex((c) => c.hidden);
  if (idx < 0) return rejected(state, 'no-hidden');
  if (availableMaterials(state, warehouse).stardust < REVEAL_COST) return rejected(state, 'no-stardust');
  const hand = bar.hand.map((c, i) => (i === idx ? { ...c, hidden: false } : c));
  const next = {
    ...state,
    bar: { ...bar, hand, spent: { ...bar.spent, stardust: bar.spent.stardust + REVEAL_COST } },
  };
  return { state: next, effects: [{ type: 'reveal', sym: hand[idx].sym, cost: REVEAL_COST }] };
}

function applyConfirm(state) {
  const bar = state.bar;
  if (!bar || bar.phase !== 'place') return rejected(state, 'not-placing');
  const interpretation = interpret(state.wish, bar.tableau);
  const next = { ...state, bar: { ...bar, phase: 'react', interpretation } };
  return { state: next, effects: [{ type: 'interpret', interpretation }] };
}

function applyContinue(state) {
  const bar = state.bar;
  if (!bar || bar.phase !== 'react') return rejected(state, 'not-reacting');
  if (bar.patience <= 1) return rejected(state, 'no-patience');
  const { hand, rngState } = drawHand(state);
  const next = {
    ...state,
    rngState,
    bar: {
      ...bar,
      phase: 'place',
      round: bar.round + 1,
      patience: bar.patience - 1,
      hand,
      placed: 0,
      interpretation: null,
    },
  };
  return { state: next, effects: [{ type: 'continue', round: next.bar.round }] };
}

function provenanceLine(run, used) {
  const parts = [];
  let fromRun = { water: 0, stardust: 0 };
  for (const floor of [1, 2]) {
    const p = run.provenance ? run.provenance[floor] : null;
    if (!p) continue;
    fromRun = { water: fromRun.water + p.water, stardust: fromRun.stardust + p.stardust };
    const bits = [];
    if (p.water > 0) bits.push(`水${p.water}ml`);
    if (p.stardust > 0) bits.push(`星尘${p.stardust}g`);
    if (bits.length > 0) parts.push(`${floor === 1 ? '浅层' : '二层'}的${bits.join('、')}`);
  }
  const bankWater = Math.max(0, used.water - fromRun.water);
  const bankDust = Math.max(0, used.stardust - fromRun.stardust);
  const bankBits = [];
  if (bankWater > 0) bankBits.push(`水${bankWater}ml`);
  if (bankDust > 0) bankBits.push(`星尘${bankDust}g`);
  if (bankBits.length > 0) parts.push(`仓库攒的${bankBits.join('、')}`);
  return parts.length > 0 ? parts.join('，') : '一点点库存';
}

function applyDrink(state, warehouse) {
  const bar = state.bar;
  if (!bar || bar.phase !== 'react') return rejected(state, 'not-reacting');
  const wish = WISH_BY_ID[state.wish];
  const avail = availableMaterials(state, warehouse);
  const used = {
    water: Math.min(CONFIG.recipe.water, avail.water),
    stardust: Math.min(CONFIG.recipe.stardust, avail.stardust),
  };
  const purity = completion(used);
  const direction = directionScore(state.wish, bar.tableau);
  const match = Math.min(MATCH_CAP, Math.round(direction * purity));
  const tier = match >= FULFILL_AT ? 'fulfilled' : match >= 60 ? 'warm' : match >= 30 ? 'discount' : 'weird';
  const interpretation = bar.interpretation || interpret(state.wish, bar.tableau);
  const set = new Set(bar.tableau);
  const settlement = {
    match,
    direction,
    purity,
    completion: match / 100,
    fulfilled: match >= FULFILL_AT,
    tier,
    price: match >= FULFILL_AT ? 0 : discountedPrice(match / 100),
    drink: interpretation.drink,
    drinkText: `这杯用了${provenanceLine(state, used)}。`,
    used,
    warehouseAfter: { water: avail.water - used.water, stardust: avail.stardust - used.stardust },
    gaps: {
      symbols: wish ? wish.core.filter((s) => !set.has(s)) : [],
      water: Math.max(0, CONFIG.recipe.water - (avail.water - used.water)),
      stardust: Math.max(0, CONFIG.recipe.stardust - (avail.stardust - used.stardust)),
    },
    banked: false,
  };
  const next = { ...state, status: 'settled', bar: { ...bar, phase: 'done' }, settlement };
  return { state: next, effects: [{ type: 'settle', settlement }] };
}

export function applyBarAction(state, action) {
  switch (action.type) {
    case 'place': return applyPlace(state, action.index);
    case 'unplace': return applyUnplace(state, action.index);
    case 'reveal': return applyReveal(state, action.warehouse);
    case 'confirm': return applyConfirm(state);
    case 'continue': return applyContinue(state);
    case 'drink': return applyDrink(state, action.warehouse);
    default: return rejected(state, 'unknown-action');
  }
}