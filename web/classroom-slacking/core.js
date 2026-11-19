export const LESSONS = Object.freeze([
  Object.freeze({ id: 'math', title: '数学课', topic: '函数与几何', duration: 27, scoreScale: 1, alertScale: 1 }),
  Object.freeze({ id: 'chinese', title: '语文课', topic: '背诵全文', duration: 29, scoreScale: 1.22, alertScale: 0.84 }),
  Object.freeze({ id: 'study', title: '自习课', topic: '全班安静', duration: 31, scoreScale: 1.5, alertScale: 0.68 }),
]);

export const DISTRACTIONS = Object.freeze([
  Object.freeze({ id: 'spin', name: '转笔', rate: 7, hide: 0.05, risk: '低', weight: 11 }),
  Object.freeze({ id: 'doodle', name: '课本画小人', rate: 8.5, hide: 0.08, risk: '低', weight: 10 }),
  Object.freeze({ id: 'note', name: '传纸条', rate: 10, hide: 0.12, risk: '中', weight: 9 }),
  Object.freeze({ id: 'snack', name: '偷吃零食', rate: 12, hide: 0.17, risk: '中', weight: 7 }),
  Object.freeze({ id: 'comic', name: '桌洞看漫画', rate: 14.5, hide: 0.23, risk: '高', weight: 6 }),
  Object.freeze({ id: 'plane', name: '折纸飞机', rate: 17, hide: 0.29, risk: '高', weight: 4 }),
  Object.freeze({ id: 'console', name: '掌机闯关', rate: 20, hide: 0.36, risk: '极高', weight: 3 }),
]);

export const WATCHER_TYPES = Object.freeze([
  Object.freeze({ key: 'teacher', name: '老师', fromLesson: 0, away: [2.4, 5.2], warn: 0.92, look: [1.15, 2], fakeChance: 0.14 }),
  Object.freeze({ key: 'corridor', name: '巡课老师', fromLesson: 1, away: [5.2, 8.8], warn: 1.08, look: [1.2, 1.7], fakeChance: 0 }),
  Object.freeze({ key: 'monitor', name: '班长', fromLesson: 2, away: [4.2, 7.2], warn: 0.78, look: [1, 1.5], fakeChance: 0.05 }),
]);

export const MAX_STRIKES = 3;
export const NEAR_MISS_WINDOW = 0.28;

const ACTIVITY_BAG = DISTRACTIONS.flatMap((activity) => Array(activity.weight).fill(activity));

function between(random, min, max) {
  return min + (max - min) * random();
}

function watcherType(key) {
  return WATCHER_TYPES.find((watcher) => watcher.key === key);
}

function resetWatcher(watcher, lessonIndex, random, first = false) {
  const type = watcherType(watcher.key);
  if (lessonIndex < type.fromLesson) {
    watcher.mode = 'off';
    watcher.timer = 0;
    watcher.fake = false;
    return;
  }
  watcher.mode = 'away';
  watcher.timer = between(random, type.away[0], type.away[1]) + (first ? 1.1 : 0);
  watcher.fake = false;
}

function chooseActivity(previous, random) {
  let next = ACTIVITY_BAG[Math.floor(random() * ACTIVITY_BAG.length)] || DISTRACTIONS[0];
  for (let attempt = 0; attempt < 5 && next.id === previous?.id; attempt += 1) {
    next = ACTIVITY_BAG[Math.floor(random() * ACTIVITY_BAG.length)] || DISTRACTIONS[0];
  }
  return next;
}

function beginDaydream(state, random, events) {
  state.daydreaming = true;
  state.holdTime = 0;
  state.settleTimer = 0;
  state.activity = chooseActivity(state.activity, random);
  state.activityTimer = between(random, 2.5, 4.1);
  events.push({ type: 'activity', activity: state.activity });
}

function enterLesson(state, lessonIndex, random) {
  state.phase = 'playing';
  state.lessonIndex = lessonIndex;
  state.lessonTime = 0;
  state.betweenTimer = 0;
  state.holding = false;
  state.daydreaming = false;
  state.holdTime = 0;
  state.combo = 1;
  state.settleTimer = 0;
  state.sinceFocused = 99;
  for (const watcher of state.watchers) resetWatcher(watcher, lessonIndex, random, true);
}

export function createGameState(random = Math.random) {
  const state = {
    phase: 'playing', lessonIndex: 0, lessonTime: 0, score: 0, strikes: 0,
    holding: false, daydreaming: false, holdTime: 0, combo: 1, settleTimer: 0,
    focusLock: 0, sinceFocused: 99, activity: DISTRACTIONS[0], activityTimer: 0,
    betweenTimer: 0, lastCaughtBy: null,
    watchers: WATCHER_TYPES.map((watcher) => ({ key: watcher.key, mode: 'off', timer: 0, fake: false })),
  };
  enterLesson(state, 0, random);
  return state;
}

export function setHolding(state, holding, random = Math.random) {
  const events = [];
  if (state.phase !== 'playing') return events;
  state.holding = Boolean(holding);
  if (state.holding && !state.daydreaming && state.focusLock <= 0) {
    beginDaydream(state, random, events);
  } else if (!state.holding && state.daydreaming && state.settleTimer <= 0) {
    state.settleTimer = state.activity.hide;
    events.push({ type: 'packing', duration: state.settleTimer });
  }
  return events;
}

function catchPlayer(state, watcher, events) {
  state.strikes += 1;
  state.lastCaughtBy = watcher.key;
  state.holding = false;
  state.daydreaming = false;
  state.holdTime = 0;
  state.combo = 1;
  state.settleTimer = 0;
  state.focusLock = 1.35;
  state.sinceFocused = 0;
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
      watcher.timer = Math.max(0.32, type.warn * lesson.alertScale);
      watcher.fake = type.fakeChance > 0 && random() < type.fakeChance + state.lessonIndex * 0.04;
      events.push({ type: 'warning', watcher: watcher.key });
    } else if (watcher.mode === 'warn') {
      if (watcher.fake) {
        resetWatcher(watcher, state.lessonIndex, random);
        events.push({ type: 'fake', watcher: watcher.key });
      } else {
        watcher.mode = 'look';
        watcher.timer = between(random, type.look[0], type.look[1]);
        events.push({ type: 'look', watcher: watcher.key });
        if (!state.daydreaming && state.sinceFocused <= NEAR_MISS_WINDOW) {
          const bonus = 45 * (state.lessonIndex + 1);
          state.score += bonus;
          events.push({ type: 'near-miss', watcher: watcher.key, bonus });
        }
      }
    } else {
      resetWatcher(watcher, state.lessonIndex, random);
    }
  }
  if (watcher.mode === 'look' && state.daydreaming && state.focusLock <= 0) {
    catchPlayer(state, watcher, events);
  }
}

export function updateGame(state, dt, random = Math.random) {
  const events = [];
  const step = Math.max(0, Math.min(0.08, Number(dt) || 0));
  if (state.phase === 'between') {
    state.betweenTimer -= step;
    if (state.betweenTimer <= 0) {
      enterLesson(state, state.lessonIndex + 1, random);
      events.push({ type: 'lesson-start', lessonIndex: state.lessonIndex });
    }
    return events;
  }
  if (state.phase !== 'playing') return events;

  state.focusLock = Math.max(0, state.focusLock - step);
  if (state.holding && !state.daydreaming && state.focusLock <= 0) beginDaydream(state, random, events);

  if (state.daydreaming && state.holding) {
    state.holdTime += step;
    state.combo = Math.min(5, 1 + state.holdTime * 0.46);
    state.activityTimer -= step;
    state.score += state.activity.rate * state.combo * LESSONS[state.lessonIndex].scoreScale * step;
    if (state.activityTimer <= 0) {
      state.activity = chooseActivity(state.activity, random);
      state.activityTimer = between(random, 2.5, 4.1);
      events.push({ type: 'activity', activity: state.activity });
    }
  } else if (state.daydreaming) {
    state.settleTimer -= step;
    if (state.settleTimer <= 0) {
      state.daydreaming = false;
      state.holdTime = 0;
      state.combo = 1;
      state.settleTimer = 0;
      state.sinceFocused = 0;
      events.push({ type: 'focused' });
    }
  } else {
    state.combo = Math.max(1, state.combo - step * 7);
    state.sinceFocused += step;
  }

  for (const watcher of state.watchers) {
    updateWatcher(state, watcher, step, random, events);
    if (state.phase === 'lost') return events;
  }

  state.lessonTime += step;
  const lesson = LESSONS[state.lessonIndex];
  if (state.lessonTime >= lesson.duration) {
    state.lessonTime = lesson.duration;
    state.holding = false;
    state.daydreaming = false;
    state.combo = 1;
    for (const watcher of state.watchers) watcher.mode = 'off';
    events.push({ type: 'lesson-end', lessonIndex: state.lessonIndex });
    if (state.lessonIndex >= LESSONS.length - 1) {
      state.phase = 'won';
      events.push({ type: 'won' });
    } else {
      state.phase = 'between';
      state.betweenTimer = 2.8;
    }
  }
  return events;
}

export function remainingSeconds(state) {
  if (!state || state.phase === 'lost' || state.phase === 'won') return 0;
  return Math.max(0, LESSONS[state.lessonIndex].duration - state.lessonTime);
}

export function scoreRank(score) {
  if (score >= 2300) return '课桌下的宇宙学家';
  if (score >= 1550) return '开小差优等生';
  if (score >= 850) return '窗外观察员';
  return '偶尔走神的普通同学';
}
