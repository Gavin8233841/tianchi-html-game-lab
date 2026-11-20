import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LESSONS,
  MAX_STRIKES,
  TOOLS,
  createGameState,
  isExposed,
  scoreRank,
  setActiveTool,
  setInputActive,
  applyGesture,
  startNextLesson,
  updateGame,
} from '../web/classroom-slacking/core.js';

const fixedRandom = () => 0.5;

function step(state, seconds, random = fixedRandom) {
  const events = [];
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) events.push(...updateGame(state, 0.05, random));
  return events;
}

test('V2 课堂：默认带两件装备，第三件可在课间替换', () => {
  const state = createGameState(fixedRandom);
  assert.deepEqual(state.selectedTools, ['spin', 'doodle']);
  assert.equal(state.watchers.find((watcher) => watcher.key === 'corridor').mode, 'off');
  state.lessonTime = LESSONS[0].duration - 0.01;
  const events = updateGame(state, 0.05, fixedRandom);
  assert.ok(events.some((event) => event.type === 'prep'));
  assert.equal(state.phase, 'between');
  const nextEvents = startNextLesson(state, ['comic', 'spin'], fixedRandom);
  assert.equal(state.lessonIndex, 1);
  assert.deepEqual(state.selectedTools, ['comic', 'spin']);
  assert.equal(state.watchers.find((watcher) => watcher.key === 'corridor').mode, 'away');
  assert.ok(nextEvents.some((event) => event.type === 'lesson-start'));
});

test('V2 课堂：转笔需要画圈，只有手势会产生分数和笔仙回忆', () => {
  const state = createGameState(() => 0);
  setActiveTool(state, 'spin');
  setInputActive(state, true);
  const events = applyGesture(state, 'spin', 4.2);
  assert.equal(isExposed(state), true);
  assert.ok(events.some((event) => event.type === 'memory'));
  const before = state.score;
  step(state, 0.15, () => 0);
  assert.ok(state.score > before);
  setInputActive(state, false);
  assert.ok(state.stowTimer > 0);
});

test('V2 课堂：涂鸦完成轨迹会解锁回忆，漫画上下拖动可以藏回桌洞', () => {
  const state = createGameState(() => 0);
  setActiveTool(state, 'doodle');
  setInputActive(state, true);
  const doodleEvents = applyGesture(state, 'doodle', 20);
  assert.equal(state.doodleProgress, 1);
  assert.ok(doodleEvents.some((event) => event.type === 'doodle-complete'));
  setInputActive(state, false);
  step(state, 0.3, () => 0);
  state.selectedTools = ['doodle', 'comic'];
  setActiveTool(state, 'comic');
  const openEvents = applyGesture(state, 'comic', 0.9);
  assert.ok(openEvents.some((event) => event.type === 'comic-open'));
  assert.equal(isExposed(state), true);
  const before = state.score;
  step(state, 0.4, () => 0);
  assert.ok(state.score > before);
  const closeEvents = applyGesture(state, 'comic', -0.9);
  assert.ok(closeEvents.some((event) => event.type === 'focused'));
  assert.equal(isExposed(state), false);
});

test('V2 课堂：预警后及时收手会获得惊险分，持续暴露会被抓', () => {
  const state = createGameState(() => 0.9);
  const teacher = state.watchers.find((watcher) => watcher.key === 'teacher');
  state.sinceFocused = 0.1;
  teacher.mode = 'warn';
  teacher.timer = 0;
  const before = state.score;
  const nearEvents = updateGame(state, 0.05, () => 0.9);
  assert.ok(nearEvents.some((event) => event.type === 'near-miss'));
  assert.ok(state.score > before);
  setActiveTool(state, 'spin');
  setInputActive(state, true);
  applyGesture(state, 'spin', 1);
  teacher.mode = 'look';
  teacher.timer = 1;
  const caught = updateGame(state, 0.05, () => 0.9);
  assert.ok(caught.some((event) => event.type === 'caught'));
  assert.equal(state.strikes, 1);
  state.strikes = MAX_STRIKES - 1;
  state.focusLock = 0;
  setInputActive(state, true);
  applyGesture(state, 'spin', 1);
  teacher.mode = 'look';
  teacher.timer = 1;
  const lost = updateGame(state, 0.05, () => 0.9);
  assert.ok(lost.some((event) => event.type === 'lost'));
  assert.equal(state.phase, 'lost');
});

test('V2 课堂：课堂随机事件会改变怀疑或分数，三节课完成后结算', () => {
  const state = createGameState(() => 0);
  state.nextEventTimer = 0;
  const events = updateGame(state, 0.05, () => 0);
  assert.ok(events.some((event) => event.type === 'class-event'));
  const scoreAfterEvent = state.score;
  assert.ok(scoreAfterEvent >= 0);
  for (let lesson = 0; lesson < LESSONS.length; lesson += 1) {
    state.lessonTime = LESSONS[state.lessonIndex].duration - 0.01;
    updateGame(state, 0.05, fixedRandom);
    if (lesson < LESSONS.length - 1) startNextLesson(state, state.selectedTools, fixedRandom);
  }
  assert.equal(state.phase, 'won');
});

test('V2 课堂：称号边界稳定', () => {
  assert.equal(scoreRank(1199), '偶尔发呆的同学');
  assert.equal(scoreRank(1200), '窗外观察员');
  assert.equal(scoreRank(2400), '走神课代表');
  assert.equal(scoreRank(3600), '课桌下的宇宙学家');
  assert.equal(TOOLS.length, 3);
});
