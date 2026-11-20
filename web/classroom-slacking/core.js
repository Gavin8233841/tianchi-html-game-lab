export const LESSONS = Object.freeze([
  Object.freeze({ id: 'math', title: '数学课', topic: '函数与几何', duration: 34, scoreScale: 1, alertScale: 1, light: 'morning' }),
  Object.freeze({ id: 'chinese', title: '语文课', topic: '背诵全文', duration: 36, scoreScale: 1.16, alertScale: 0.86, light: 'noon' }),
  Object.freeze({ id: 'study', title: '自习课', topic: '全班安静', duration: 38, scoreScale: 1.34, alertScale: 0.72, light: 'dusk' }),
]);

export const TOOLS = Object.freeze([
  Object.freeze({ id: 'spin', name: '转笔', mark: '↻', scoreRate: 34, suspicionRate: 3.2, hide: 0.12 }),
  Object.freeze({ id: 'doodle', name: '涂鸦', mark: '✎', scoreRate: 42, suspicionRate: 4.8, hide: 0.18 }),
  Object.freeze({ id: 'comic', name: '漫画', mark: '▤', scoreRate: 55, suspicionRate: 8.4, hide: 0.48 }),
]);

export const MEMORIES = Object.freeze([
  Object.freeze({ id: 'pen-master', name: '笔仙附体', mark: '↻' }),
  Object.freeze({ id: 'new-hero', name: '课本新角色', mark: '✎' }),
  Object.freeze({ id: 'desk-diver', name: '桌洞探险家', mark: '▤' }),
  Object.freeze({ id: 'close-call', name: '眼皮底下', mark: '!' }),
]);

export const WATCHER_TYPES = Object.freeze([
  Object.freeze({ key: 'teacher', name: '老师', fromLesson: 0, away: [3.2, 6.1], warn: 1.05, look: [1.1, 1.8], fakeChance: 0.12 }),
  Object.freeze({ key: 'corridor', name: '巡课老师', fromLesson: 1, away: [6.2, 9.6], warn: 1.15, look: [1.15, 1.7], fakeChance: 0 }),
  Object.freeze({ key: 'monitor', name: '班长', fromLesson: 2, away: [5.1, 8.2], warn: 0.88, look: [1, 1.45], fakeChance: 0.05 }),
]);

export const MAX_STRIKES = 3;
export const NEAR_MISS_WINDOW = 0.42;

const CLASS_EVENTS = Object.freeze([
  Object.freeze({ id: 'question', label: '突然提问' }),
  Object.freeze({ id: 'laugh', label: '全班笑场' }),
  Object.freeze({ id: 'chalk', label: '粉笔头！' }),
  Object.freeze({ id: 'fake-bell', label: '谁按了铃？' }),
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const between = (random, min, max) => min + (max - min) * random();
const toolById = (id) => TOOLS.find((tool) => tool.id === id) || TOOLS[0];
const watcherType = (key) => WATCHER_TYPES.find((watcher) => watcher.key === key);

function normalizeLoadout(loadout) {
  const valid = [...new Set((loadout || []).filter((id) => TOOLS.some((tool) => tool.id === id)))];
  for (const tool of TOOLS) {
    if (valid.length >= 2) break;
    if (!valid.includes(tool.id)) valid.push(tool.id);
  }
  return valid.slice(0, 2);
}

function unlockMemory(state, id, events) {
  if (state.memories.includes(id)) return;
  state.memories.push(id);
  events.push({ type: 'memory', memory: MEMORIES.find((memory) => memory.id === id) });
}

function resetWatcher(watcher, lessonIndex, suspicion, random, first = false) {
  const type = watcherType(watcher.key);
  if (lessonIndex < type.fromLesson) {
    watcher.mode = 'off';
    watcher.timer = 0;
    watcher.fake = false;
    return;
  }
  const pressure = clamp(1 - suspicion / 180, 0.5, 1);
  watcher.mode = 'away';
  watcher.timer = between(random, type.away[0], type.away[1]) * pressure + (first ? 1.2 : 0);
  watcher.fake = false;
}

function enterLesson(state, lessonIndex, random) {
  state.phase = 'playing';
  state.lessonIndex = lessonIndex;
  state.lessonTime = 0;
  state.inputActive = false;
  state.performing = false;
  state.actionIntensity = 0;
  state.actionFresh = 0;
  state.stowTimer = 0;
  state.sinceFocused = 99;
  state.focusLock = 0;
  state.combo = 1;
  state.classEvent = null;
  state.classEventTimer = 0;
  state.nextEventTimer = between(random, 7, 10);
  for (const watcher of state.watchers) resetWatcher(watcher, lessonIndex, state.suspicion, random, true);
}

export function createGameState(options = {}, maybeRandom = Math.random) {
  const random = typeof options === 'function' ? options : maybeRandom;
  const config = typeof options === 'function' ? {} : options;
  const selectedTools = normalizeLoadout(config.selectedTools);
  const state = {
    phase: 'playing', lessonIndex: 0, lessonTime: 0, score: 0, strikes: 0,
    selectedTools, activeTool: selectedTools[0], inputActive: false, performing: false,
    actionIntensity: 0, actionFresh: 0, stowTimer: 0, combo: 1,
    suspicion: 0, focusLock: 0, sinceFocused: 99, comicOpen: 0,
    doodleProgress: 0, spinTurns: 0, spinTurnBuffer: 0,
    lastCaughtBy: null, classEvent: null, classEventTimer: 0, nextEventTimer: 8,
    memories: [],
    stats: { nearMisses: 0, inputs: 0, maxSuspicion: 0, comicSeconds: 0, doodleDistance: 0, spinTurns: 0 },
    watchers: WATCHER_TYPES.map((watcher) => ({ key: watcher.key, mode: 'off', timer: 0, fake: false })),
  };
  enterLesson(state, 0, random);
  return state;
}

export function setLoadout(state, loadout) {
  const selectedTools = normalizeLoadout(loadout);
  state.selectedTools = selectedTools;
  if (!selectedTools.includes(state.activeTool)) state.activeTool = selectedTools[0];
  return selectedTools;
}

export function startNextLesson(state, loadout = state.selectedTools, random = Math.random) {
  if (state.phase !== 'between' || state.lessonIndex >= LESSONS.length - 1) return [];
  setLoadout(state, loadout);
  enterLesson(state, state.lessonIndex + 1, random);
  return [{ type: 'lesson-start', lessonIndex: state.lessonIndex }];
}

export function setActiveTool(state, toolId) {
  if (state.phase !== 'playing' || !state.selectedTools.includes(toolId) || isExposed(state)) return false;
  state.activeTool = toolId;
  state.actionIntensity = 0;
  return true;
}

export function setInputActive(state, active) {
  const events = [];
  if (state.phase !== 'playing' || state.focusLock > 0) return events;
  state.inputActive = Boolean(active);
  if (active) {
    state.stats.inputs += 1;
    if (state.activeTool !== 'comic') state.performing = true;
  } else if (state.activeTool !== 'comic' && state.performing) {
    state.performing = false;
    state.stowTimer = toolById(state.activeTool).hide;
    events.push({ type: 'packing', duration: state.stowTimer });
  }
  return events;
}

export function applyGesture(state, kind, amount) {
  const events = [];
  if (state.phase !== 'playing' || state.focusLock > 0 || kind !== state.activeTool) return events;
  const value = Number(amount) || 0;
  if (kind === 'spin') {
    const turns = Math.max(0, value);
    state.performing = state.inputActive || turns > 0;
    state.actionFresh = 0.24;
    state.actionIntensity = clamp(state.actionIntensity + turns * 2.5, 0, 1.25);
    state.spinTurns += turns;
    state.spinTurnBuffer += turns;
    state.stats.spinTurns += turns;
    while (state.spinTurnBuffer >= 1) {
      state.spinTurnBuffer -= 1;
      events.push({ type: 'spin-turn' });
    }
    if (state.stats.spinTurns >= 4) unlockMemory(state, 'pen-master', events);
  } else if (kind === 'doodle') {
    const distance = Math.max(0, value);
    state.performing = state.inputActive || distance > 0;
    state.actionFresh = 0.2;
    state.actionIntensity = clamp(state.actionIntensity + distance * 1.7, 0, 1.15);
    state.stats.doodleDistance += distance;
    const before = state.doodleProgress;
    state.doodleProgress = clamp(state.doodleProgress + distance * 0.055, 0, 1);
    if (before < 1 && state.doodleProgress >= 1) {
      events.push({ type: 'doodle-complete' });
      unlockMemory(state, 'new-hero', events);
    }
  } else if (kind === 'comic') {
    const before = state.comicOpen;
    state.comicOpen = clamp(state.comicOpen + value, 0, 1);
    state.performing = state.comicOpen > 0.06;
    state.actionIntensity = state.comicOpen;
    if (before < 0.72 && state.comicOpen >= 0.72) {
      events.push({ type: 'comic-open' });
      unlockMemory(state, 'desk-diver', events);
    }
    if (before > 0.06 && state.comicOpen <= 0.06) {
      state.comicOpen = 0;
      state.performing = false;
      state.sinceFocused = 0;
      events.push({ type: 'focused' });
    }
  }
  return events;
}

export function isExposed(state) {
  if (!state || state.phase !== 'playing') return false;
  if (state.activeTool === 'comic') return state.comicOpen > 0.06;
  return state.inputActive || state.performing || state.stowTimer > 0;
}

function catchPlayer(state, watcher, events) {
  state.strikes += 1;
  state.lastCaughtBy = watcher.key;
  state.inputActive = false;
  state.performing = false;
  state.actionIntensity = 0;
  state.actionFresh = 0;
  state.stowTimer = 0;
  state.comicOpen = 0;
  state.combo = 1;
  state.focusLock = 1.45;
  state.sinceFocused = 0;
  state.suspicion = 32;
  for (const other of state.watchers) {
    if (other.mode !== 'off') {
      other.mode = 'look';
      other.timer = Math.max(other.timer, 1.05);
      other.fake = false;
    }
  }
  events.push({ type: 'caught', watcher: watcher.key, strikes: state.strikes });
  if (state.strikes >= MAX_STRIKES) {
    state.phase = 'lost';
    events.push({ type: 'lost' });
  }
}

function updateWatcher(state, watcher, dt, random, events) {
  if (watcher.mode === 'off') return;
  const type = watcherType(watcher.key);
  const lesson = LESSONS[state.lessonIndex];
  watcher.timer -= dt;
  if (watcher.timer <= 0) {
    if (watcher.mode === 'away') {
      watcher.mode = 'warn';
      watcher.timer = Math.max(0.38, type.warn * lesson.alertScale);
      watcher.fake = type.fakeChance > 0 && random() < type.fakeChance + state.lessonIndex * 0.035;
      events.push({ type: 'warning', watcher: watcher.key });
    } else if (watcher.mode === 'warn') {
      if (watcher.fake) {
        resetWatcher(watcher, state.lessonIndex, state.suspicion, random);
        events.push({ type: 'fake', watcher: watcher.key });
      } else {
        watcher.mode = 'look';
        watcher.timer = between(random, type.look[0], type.look[1]);
        events.push({ type: 'look', watcher: watcher.key });
        if (!isExposed(state) && state.sinceFocused <= NEAR_MISS_WINDOW) {
          const bonus = 55 * (state.lessonIndex + 1);
          state.score += bonus;
          state.stats.nearMisses += 1;
          events.push({ type: 'near-miss', watcher: watcher.key, bonus });
          if (state.suspicion >= 72) unlockMemory(state, 'close-call', events);
        }
      }
    } else {
      resetWatcher(watcher, state.lessonIndex, state.suspicion, random);
    }
  }
  if (watcher.mode === 'look' && isExposed(state) && state.focusLock <= 0) catchPlayer(state, watcher, events);
}

function triggerClassEvent(state, random, events) {
  const event = CLASS_EVENTS[Math.floor(random() * CLASS_EVENTS.length)] || CLASS_EVENTS[0];
  state.classEvent = event.id;
  state.classEventTimer = 1.8;
  events.push({ type: 'class-event', event });
  if (event.id === 'question') {
    if (isExposed(state)) state.suspicion += 20;
    else state.score += 45;
  } else if (event.id === 'laugh') {
    state.suspicion = Math.max(0, state.suspicion - 18);
    for (const watcher of state.watchers) if (watcher.mode === 'away') watcher.timer += 1.3;
  } else if (event.id === 'chalk' && isExposed(state)) {
    state.suspicion += 13;
  } else if (event.id === 'fake-bell') {
    state.score += isExposed(state) ? 20 : 0;
  }
  state.nextEventTimer = between(random, 8, 13);
}

export function updateGame(state, dt, random = Math.random) {
  const events = [];
  const step = clamp(Number(dt) || 0, 0, 0.08);
  if (state.phase !== 'playing') return events;

  state.focusLock = Math.max(0, state.focusLock - step);
  state.actionFresh = Math.max(0, state.actionFresh - step);
  if (!state.inputActive && state.activeTool !== 'comic') state.performing = false;
  if (state.stowTimer > 0) {
    state.stowTimer = Math.max(0, state.stowTimer - step);
    if (state.stowTimer === 0) {
      state.sinceFocused = 0;
      events.push({ type: 'focused' });
    }
  }

  let effort = 0;
  if (state.activeTool === 'comic') {
    effort = state.comicOpen;
    if (effort > 0.06) state.stats.comicSeconds += step;
  } else if (state.inputActive && state.actionFresh > 0) {
    effort = clamp(state.actionIntensity, 0, 1);
  }
  state.actionIntensity = Math.max(state.activeTool === 'comic' ? state.comicOpen : 0, state.actionIntensity - step * 2.25);

  if (effort > 0.04 && state.focusLock <= 0) {
    const tool = toolById(state.activeTool);
    state.combo = clamp(state.combo + step * 0.32, 1, 3.5);
    state.score += tool.scoreRate * effort * state.combo * LESSONS[state.lessonIndex].scoreScale * step;
    state.suspicion += tool.suspicionRate * (0.45 + effort) * step;
  } else if (!isExposed(state)) {
    state.combo = Math.max(1, state.combo - step * 2.8);
    state.suspicion = Math.max(0, state.suspicion - step * 7.2);
    state.sinceFocused += step;
  }

  state.suspicion = clamp(state.suspicion, 0, 100);
  state.stats.maxSuspicion = Math.max(state.stats.maxSuspicion, state.suspicion);
  if (state.suspicion >= 100 && state.focusLock <= 0) {
    catchPlayer(state, state.watchers.find((watcher) => watcher.key === 'teacher'), events);
    if (state.phase === 'lost') return events;
  }

  state.nextEventTimer -= step;
  if (state.nextEventTimer <= 0) triggerClassEvent(state, random, events);
  if (state.classEventTimer > 0) {
    state.classEventTimer = Math.max(0, state.classEventTimer - step);
    if (state.classEventTimer === 0) state.classEvent = null;
  }

  for (const watcher of state.watchers) {
    updateWatcher(state, watcher, step, random, events);
    if (state.phase === 'lost') return events;
  }

  state.lessonTime += step;
  const lesson = LESSONS[state.lessonIndex];
  if (state.lessonTime >= lesson.duration) {
    state.lessonTime = lesson.duration;
    state.inputActive = false;
    state.performing = false;
    state.comicOpen = 0;
    state.combo = 1;
    for (const watcher of state.watchers) watcher.mode = 'off';
    events.push({ type: 'lesson-end', lessonIndex: state.lessonIndex });
    if (state.lessonIndex >= LESSONS.length - 1) {
      state.phase = 'won';
      events.push({ type: 'won' });
    } else {
      state.phase = 'between';
      events.push({ type: 'prep', nextLessonIndex: state.lessonIndex + 1 });
    }
  }
  return events;
}

export function remainingSeconds(state) {
  if (!state || state.phase === 'lost' || state.phase === 'won') return 0;
  return Math.max(0, LESSONS[state.lessonIndex].duration - state.lessonTime);
}

export function scoreRank(score) {
  if (score >= 3600) return '课桌下的宇宙学家';
  if (score >= 2400) return '走神课代表';
  if (score >= 1200) return '窗外观察员';
  return '偶尔发呆的同学';
}
