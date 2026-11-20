import { PLANE_FLIGHT, PLANE_FOLDS, advanceHandheld, createHandheld, moveHandheld } from './desk-actions.js';

export const LESSONS = Object.freeze([
  Object.freeze({
    id: 'math', title: '数学课', topic: '函数与几何', duration: 58, scoreScale: 1, alertScale: 1,
    light: 'morning', noiseScale: 0.88, events: ['chalk', 'question', 'fake-bell', 'laugh'],
    teacherLines: Object.freeze(['后排同学别只盯着桌面。', '看黑板，不要看别的。', '最后一排，手别乱动。']),
  }),
  Object.freeze({
    id: 'chinese', title: '语文课', topic: '背诵全文', duration: 62, scoreScale: 1.16, alertScale: 0.86,
    light: 'noon', noiseScale: 1, events: ['roll-call', 'question', 'laugh', 'chalk'],
    teacherLines: Object.freeze(['这句背完我就抽人。', '后排同学，跟着读。', '别以为我没看见。']),
  }),
  Object.freeze({
    id: 'study', title: '自习课', topic: '全班安静', duration: 66, scoreScale: 1.34, alertScale: 0.72,
    light: 'dusk', noiseScale: 1.34, events: ['quiet', 'monitor', 'fake-bell', 'question'],
    teacherLines: Object.freeze(['自习课要安静。', '班长，记一下声音大的。', '谁在桌洞里忙呢？']),
  }),
]);

export const TOOLS = Object.freeze([
  Object.freeze({ id: 'spin', name: '转笔', mark: '↻', scoreRate: 28, suspicionRate: 3.9, hide: 0.12, noise: 0.05 }),
  Object.freeze({ id: 'doodle', name: '涂鸦', mark: '✎', scoreRate: 34, suspicionRate: 4, hide: 0.18, noise: 0.1 }),
  Object.freeze({ id: 'note', name: '传纸条', mark: '▱', scoreRate: 38, suspicionRate: 5.5, hide: 0.25, noise: 0.18 }),
  Object.freeze({ id: 'snack', name: '偷吃零食', mark: '◒', scoreRate: 52, suspicionRate: 7.2, hide: 0.35, noise: 0.7 }),
  Object.freeze({ id: 'comic', name: '桌洞漫画', mark: '▤', scoreRate: 62, suspicionRate: 8.5, hide: 0.48, noise: 0.22 }),
  Object.freeze({ id: 'plane', name: '折纸飞机', mark: '➤', scoreRate: 75, suspicionRate: 12, hide: 0.42, noise: 0.6 }),
  Object.freeze({ id: 'console', name: '玩掌机', mark: '▣', scoreRate: 68, suspicionRate: 10, hide: 0.3, noise: 0.48 }),
]);

export const MEMORIES = Object.freeze([
  Object.freeze({ id: 'pen-master', name: '笔仙附体', mark: '↻' }),
  Object.freeze({ id: 'new-hero', name: '课本新角色', mark: '✎' }),
  Object.freeze({ id: 'desk-diver', name: '桌洞探险家', mark: '▤' }),
  Object.freeze({ id: 'paper-route', name: '纸条穿越全班', mark: '▱' }),
  Object.freeze({ id: 'snack-time', name: '零食只剩包装', mark: '◒' }),
  Object.freeze({ id: 'paper-legend', name: '纸飞机传说', mark: '➤' }),
  Object.freeze({ id: 'last-level', name: '差一点通关', mark: '▣' }),
  Object.freeze({ id: 'close-call', name: '眼皮底下', mark: '!' }),
  Object.freeze({ id: 'roll-call', name: '点名时的沉默', mark: '？' }),
  Object.freeze({ id: 'chalk-dodge', name: '粉笔擦肩而过', mark: '✦' }),
]);

export const WATCHER_TYPES = Object.freeze([
  Object.freeze({ key: 'teacher', name: '老师', fromLesson: 0, away: [4.4, 7.2], warn: 1.05, look: [1.1, 1.8], fakeChance: 0.12 }),
  Object.freeze({ key: 'corridor', name: '巡课老师', fromLesson: 1, away: [7.2, 11], warn: 1.15, look: [1.15, 1.7], fakeChance: 0 }),
  Object.freeze({ key: 'monitor', name: '班长', fromLesson: 2, away: [5.5, 9], warn: 0.88, look: [1, 1.45], fakeChance: 0.05 }),
]);

export const MAX_STRIKES = 3;
export const NEAR_MISS_WINDOW = 0.42;

const CLASS_EVENTS = Object.freeze({
  chalk: Object.freeze({ id: 'chalk', label: '粉笔头！' }),
  question: Object.freeze({ id: 'question', label: '突然提问' }),
  'fake-bell': Object.freeze({ id: 'fake-bell', label: '谁按了铃？' }),
  laugh: Object.freeze({ id: 'laugh', label: '全班笑场' }),
  'roll-call': Object.freeze({ id: 'roll-call', label: '随机点名' }),
  quiet: Object.freeze({ id: 'quiet', label: '教室突然安静' }),
  monitor: Object.freeze({ id: 'monitor', label: '班长起身了' }),
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const between = (random, min, max) => min + (max - min) * random();
const toolById = (id) => TOOLS.find((tool) => tool.id === id) || TOOLS[0];
const watcherType = (key) => WATCHER_TYPES.find((watcher) => watcher.key === key);

function normalizeMemories(memories) {
  return [...new Set((memories || []).filter((id) => MEMORIES.some((memory) => memory.id === id)))];
}

function unlockMemory(state, id, events) {
  if (state.memories.includes(id)) return;
  state.memories.push(id);
  const memory = MEMORIES.find((item) => item.id === id);
  events.push({ type: 'memory', memory });
}

function resetWatcher(watcher, lessonIndex, suspicion, random, first = false) {
  const type = watcherType(watcher.key);
  if (lessonIndex < type.fromLesson) {
    watcher.mode = 'off';
    watcher.timer = 0;
    watcher.fake = false;
    return;
  }
  const pressure = clamp(1 - suspicion / 220, 0.48, 1);
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
  state.speechText = '';
  state.speechTimer = 0;
  state.nextEventTimer = between(random, 8, 12);
  state.nextSpeechTimer = between(random, 6, 9);
  state.lastSpeechBand = 0;
  for (const watcher of state.watchers) resetWatcher(watcher, lessonIndex, state.suspicion, random, true);
}

export function createGameState(options = {}, maybeRandom = Math.random) {
  const random = typeof options === 'function' ? options : maybeRandom;
  const config = typeof options === 'function' ? {} : options;
  const state = {
    phase: 'playing', lessonIndex: 0, lessonTime: 0, score: 0, strikes: 0,
    activeTool: TOOLS[0].id, inputActive: false, performing: false,
    actionIntensity: 0, actionFresh: 0, stowTimer: 0, combo: 1,
    suspicion: 0, focusLock: 0, sinceFocused: 99, comicOpen: 0,
    noteProgress: 0, noteTarget: 0, snackBites: 0,
    planeFolds: 0, planeFlight: null, farThrowUsed: false, handheld: createHandheld(),
    doodleProgress: 0, spinTurnBuffer: 0, lastSpinTurnAt: -Infinity,
    lastCaughtBy: null, classEvent: null, classEventTimer: 0, nextEventTimer: 8,
    speechText: '', speechTimer: 0, speechFake: false, nextSpeechTimer: 7, lastSpeechBand: 0,
    memories: normalizeMemories(config.memories),
    stats: { nearMisses: 0, inputs: 0, maxSuspicion: 0, comicSeconds: 0, doodleDistance: 0, spinTurns: 0 },
    watchers: WATCHER_TYPES.map((watcher) => ({ key: watcher.key, mode: 'off', timer: 0, fake: false })),
  };
  enterLesson(state, 0, random);
  return state;
}

export function startNextLesson(state, random = Math.random) {
  if (state.phase !== 'between' || state.lessonIndex >= LESSONS.length - 1) return [];
  enterLesson(state, state.lessonIndex + 1, random);
  return [{ type: 'lesson-start', lessonIndex: state.lessonIndex }];
}

function clearAction(state) {
  state.inputActive = false;
  state.performing = false;
  state.actionIntensity = 0;
  state.actionFresh = 0;
  state.comicOpen = 0;
  state.planeFolds = 0;
  state.handheld.active = false;
  state.spinTurnBuffer = 0;
  state.lastSpinTurnAt = -Infinity;
}

export function setActiveTool(state, toolId) {
  if (state.phase !== 'playing' || !TOOLS.some((tool) => tool.id === toolId) || state.activeTool === toolId) return false;
  const oldTool = toolById(state.activeTool);
  if (isExposed(state)) state.stowTimer = Math.max(state.stowTimer, oldTool.hide * 0.62);
  clearAction(state);
  state.activeTool = toolId;
  return true;
}

export function setInputActive(state, active) {
  const events = [];
  if (state.phase !== 'playing' || state.focusLock > 0) return events;
  state.inputActive = Boolean(active);
  if (active) {
    state.stats.inputs += 1;
    state.performing = state.activeTool !== 'comic';
  } else if (state.activeTool !== 'comic' && state.performing) {
    state.performing = false;
    state.stowTimer = Math.max(state.stowTimer, toolById(state.activeTool).hide);
    events.push({ type: 'packing', duration: state.stowTimer });
  }
  if (!active && state.activeTool === 'spin') {
    state.spinTurnBuffer = 0;
    state.lastSpinTurnAt = -Infinity;
  }
  return events;
}

export function focusNow(state) {
  const events = [];
  if (state.phase !== 'playing' || state.focusLock > 0) return events;
  const wasExposed = isExposed(state);
  clearAction(state);
  if (wasExposed) {
    state.stowTimer = Math.max(state.stowTimer, toolById(state.activeTool).hide * 0.72);
    events.push({ type: 'packing', duration: state.stowTimer });
  }
  return events;
}

export function throwPlane(state, mode) {
  const flight = PLANE_FLIGHT[mode];
  if (!flight || state.phase !== 'playing' || state.activeTool !== 'plane' || state.focusLock > 0 ||
      state.planeFolds !== PLANE_FOLDS.length || state.planeFlight || (mode === 'far' && state.farThrowUsed)) return [];

  clearAction(state);
  state.planeFlight = { mode, remaining: flight.seconds };
  state.farThrowUsed ||= mode === 'far';
  state.stowTimer = Math.max(state.stowTimer, flight.exposure);
  state.suspicion = clamp(state.suspicion + flight.suspicion, 0, 100);
  state.score += flight.score;
  const events = [{ type: 'plane-thrown', mode, score: flight.score }];
  unlockMemory(state, 'paper-legend', events);
  return events;
}

export function applyGesture(state, kind, amount) {
  const events = [];
  if (state.phase !== 'playing' || state.focusLock > 0 || kind !== state.activeTool) return events;
  const value = Number(amount) || 0;
  if (kind === 'spin') {
    if (!state.inputActive || value === 0) return events;
    state.performing = true;
    state.actionFresh = 0.24;
    state.actionIntensity = clamp(state.actionIntensity + Math.abs(value) * 2.5, 0, 1.25);
    state.spinTurnBuffer += value;
    while (Math.abs(state.spinTurnBuffer) >= 0.9999) {
      const remainder = Math.max(0, Math.abs(state.spinTurnBuffer) - 1);
      state.spinTurnBuffer = Math.sign(state.spinTurnBuffer) * remainder;
      const fast = state.lessonTime - state.lastSpinTurnAt <= 0.85;
      const suspicion = fast ? 4 : 2;
      state.suspicion = clamp(state.suspicion + suspicion, 0, 100);
      state.score += fast ? 22 : 12;
      state.lastSpinTurnAt = state.lessonTime;
      state.stats.spinTurns += 1;
      events.push({ type: 'spin-turn', fast, suspicion });
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
  } else if (kind === 'note') {
    const distance = Math.max(0, value);
    state.performing = state.inputActive || distance > 0;
    state.actionFresh = 0.22;
    state.actionIntensity = clamp(state.actionIntensity + distance * 1.25, 0, 1.15);
    state.noteProgress = clamp(state.noteProgress + distance * 0.045, 0, 1);
    if (state.noteProgress >= 1) {
      state.noteProgress = 0;
      state.noteTarget = (state.noteTarget + 1) % 4;
      state.score += 90;
      events.push({ type: 'note-sent', target: state.noteTarget });
      unlockMemory(state, 'paper-route', events);
    }
  } else if (kind === 'snack') {
    state.performing = true;
    state.actionFresh = 0.2;
    state.actionIntensity = 1;
    state.snackBites += 1;
    events.push({ type: 'snack-crunch', bite: state.snackBites });
    if (state.snackBites >= 4) {
      state.snackBites = 0;
      state.score += 120;
      events.push({ type: 'snack-finished' });
      unlockMemory(state, 'snack-time', events);
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
  } else if (kind === 'plane') {
    if (state.planeFlight || value !== PLANE_FOLDS[state.planeFolds]) return events;
    state.planeFolds += 1;
    state.suspicion = clamp(state.suspicion + 2, 0, 100);
    events.push({ type: state.planeFolds === PLANE_FOLDS.length ? 'plane-folded' : 'plane-fold' });
  } else if (kind === 'console') {
    moveHandheld(state.handheld, value);
  }
  return events;
}

export function isExposed(state) {
  if (!state || state.phase !== 'playing') return false;
  return state.stowTimer > 0 || state.inputActive || state.performing || state.comicOpen > 0.06 || state.handheld.active;
}

function catchPlayer(state, watcher, events) {
  state.strikes += 1;
  state.lastCaughtBy = watcher?.key || 'teacher';
  clearAction(state);
  state.stowTimer = 0;
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
  events.push({ type: 'caught', watcher: state.lastCaughtBy, strikes: state.strikes });
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
    } else resetWatcher(watcher, state.lessonIndex, state.suspicion, random);
  }
  if (watcher.mode === 'look' && isExposed(state) && state.focusLock <= 0) catchPlayer(state, watcher, events);
}

function triggerClassEvent(state, random, events) {
  const lesson = LESSONS[state.lessonIndex];
  const event = CLASS_EVENTS[lesson.events[Math.floor(random() * lesson.events.length)]] || CLASS_EVENTS.chalk;
  state.classEvent = event.id;
  state.classEventTimer = 1.8;
  events.push({ type: 'class-event', event });
  if (event.id === 'chalk') {
    if (isExposed(state)) state.suspicion += 13;
    else state.score += 25;
    if (random() > 0.45) events.push({ type: 'chalk-near' });
  } else if (event.id === 'question' || event.id === 'roll-call') {
    if (isExposed(state)) state.suspicion += event.id === 'question' ? 22 : 17;
    else state.score += event.id === 'question' ? 45 : 32;
    if (event.id === 'roll-call') unlockMemory(state, 'roll-call', events);
  } else if (event.id === 'quiet') {
    if (isExposed(state)) state.suspicion += 15;
    for (const watcher of state.watchers) if (watcher.mode === 'away') watcher.timer = Math.max(0.8, watcher.timer - 1.2);
  } else if (event.id === 'monitor') {
    const monitor = state.watchers.find((watcher) => watcher.key === 'monitor');
    if (monitor && monitor.mode !== 'off') { monitor.mode = 'warn'; monitor.timer = 0.78; }
    if (isExposed(state)) state.suspicion += 12;
  } else if (event.id === 'laugh') {
    state.suspicion = Math.max(0, state.suspicion - 18);
    for (const watcher of state.watchers) if (watcher.mode === 'away') watcher.timer += 1.3;
  } else if (event.id === 'fake-bell' && isExposed(state)) state.score += 20;
  state.nextEventTimer = between(random, 10, 16);
}

function triggerTeacherLine(state, random, events) {
  const lesson = LESSONS[state.lessonIndex];
  const band = state.suspicion >= 82 ? 3 : state.suspicion >= 60 ? 2 : state.suspicion >= 34 ? 1 : 0;
  if (band === 0) return;
  const line = lesson.teacherLines[Math.floor(random() * lesson.teacherLines.length)];
  const fake = random() < 0.3 + state.lessonIndex * 0.04;
  state.speechText = line;
  state.speechTimer = 2.4;
  state.speechFake = fake;
  state.lastSpeechBand = band;
  state.nextSpeechTimer = between(random, 5, 8);
  events.push({ type: 'teacher-line', line, fake, band });
  if (!fake) {
    const teacher = state.watchers.find((watcher) => watcher.key === 'teacher');
    if (teacher?.mode === 'away') { teacher.mode = 'warn'; teacher.timer = Math.max(0.42, 0.8 * lesson.alertScale); }
  }
}

export function updateGame(state, dt, random = Math.random) {
  const events = [];
  const step = clamp(Number(dt) || 0, 0, 0.08);
  if (state.phase !== 'playing') return events;

  state.focusLock = Math.max(0, state.focusLock - step);
  state.actionFresh = Math.max(0, state.actionFresh - step);
  if (state.speechTimer > 0) state.speechTimer = Math.max(0, state.speechTimer - step);
  if (!state.inputActive && state.activeTool !== 'comic') state.performing = false;
  if (state.stowTimer > 0) {
    state.stowTimer = Math.max(0, state.stowTimer - step);
    if (state.stowTimer === 0) { state.sinceFocused = 0; events.push({ type: 'focused' }); }
  }

  let effort = 0;
  if (state.activeTool === 'comic') {
    effort = state.comicOpen;
    if (effort > 0.06) state.stats.comicSeconds += step;
  } else if (state.handheld.active) {
    effort = 0.45;
  } else if (state.actionFresh > 0 && (state.inputActive || state.performing)) {
    effort = clamp(state.actionIntensity, 0, 1);
  }
  state.actionIntensity = Math.max(state.activeTool === 'comic' ? state.comicOpen : 0, state.actionIntensity - step * 2.25);

  if (effort > 0.04 && state.focusLock <= 0) {
    const tool = toolById(state.activeTool);
    const lesson = LESSONS[state.lessonIndex];
    state.combo = clamp(state.combo + step * 0.32, 1, 3.5);
    state.score += tool.scoreRate * effort * state.combo * lesson.scoreScale * step;
    state.suspicion += tool.suspicionRate * (0.45 + effort) * lesson.noiseScale * step;
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
  state.nextSpeechTimer -= step;
  if (state.nextSpeechTimer <= 0 && state.suspicion >= 34) triggerTeacherLine(state, random, events);
  if (state.classEventTimer > 0) {
    state.classEventTimer = Math.max(0, state.classEventTimer - step);
    if (state.classEventTimer === 0) state.classEvent = null;
  }

  for (const watcher of state.watchers) {
    updateWatcher(state, watcher, step, random, events);
    if (state.phase === 'lost') return events;
  }

  const handheldEvent = advanceHandheld(state.handheld, step);
  if (handheldEvent) {
    events.push({ type: handheldEvent });
    if (handheldEvent === 'handheld-hit') state.suspicion = clamp(state.suspicion + 7, 0, 100);
    if (handheldEvent === 'handheld-dodge') state.score += 10;
    if (handheldEvent === 'console-clear') {
      state.score += 120;
      state.stowTimer = Math.max(state.stowTimer, toolById('console').hide);
      unlockMemory(state, 'last-level', events);
    }
  }
  if (state.planeFlight) {
    state.planeFlight.remaining -= step;
    if (state.planeFlight.remaining <= 0) state.planeFlight = null;
  }

  state.lessonTime += step;
  const lesson = LESSONS[state.lessonIndex];
  if (state.lessonTime >= lesson.duration) {
    state.lessonTime = lesson.duration;
    clearAction(state);
    state.planeFlight = null;
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
  if (score >= 7600) return '课桌下的宇宙学家';
  if (score >= 5100) return '走神课代表';
  if (score >= 2600) return '窗外观察员';
  return '偶尔发呆的同学';
}
