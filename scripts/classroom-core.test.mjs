import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LESSONS,
  MAX_STRIKES,
  MEMORIES,
  TOOLS,
  createGameState,
  focusNow,
  isExposed,
  scoreRank,
  setActiveTool,
  setInputActive,
  applyGesture,
  startNextLesson,
  updateGame,
} from '../web/classroom-slacking/core.js';

const fixedRandom = () => 0.5;

function finishLesson(state) {
  state.lessonTime = LESSONS[state.lessonIndex].duration - 0.05;
  return updateGame(state, 0.05, fixedRandom);
}

test('V3 课堂：第一局直接拥有七种道具，并可在动作中途切换', () => {
  const state = createGameState(fixedRandom);

  assert.equal(state.selectedTools, undefined);
  assert.equal(state.activeTool, 'spin');
  assert.deepEqual(TOOLS.map((tool) => tool.id), ['spin', 'doodle', 'note', 'snack', 'comic', 'plane', 'console']);

  setInputActive(state, true);
  applyGesture(state, 'spin', 0.7);
  assert.equal(isExposed(state), true);
  assert.equal(setActiveTool(state, 'comic'), true);
  assert.equal(state.activeTool, 'comic');
  assert.equal(state.inputActive, false);
  assert.ok(state.stowTimer > 0, '切换动作应留下短暂收好风险');
  assert.equal(isExposed(state), true);
});

test('V3 课堂：空格/Esc 对应的收好动作会清除当前动作但保留收好风险', () => {
  const state = createGameState(fixedRandom);
  setInputActive(state, true);
  applyGesture(state, 'spin', 0.7);

  const events = focusNow(state);

  assert.equal(state.inputActive, false);
  assert.equal(state.performing, false);
  assert.ok(state.stowTimer > 0);
  assert.ok(events.some((event) => event.type === 'packing'));
});

test('V3 课堂：七种动作都有独立的手势反馈和完成事件', () => {
  const state = createGameState(fixedRandom);

  setActiveTool(state, 'doodle');
  setInputActive(state, true);
  const doodleEvents = applyGesture(state, 'doodle', 20);
  assert.ok(doodleEvents.some((event) => event.type === 'doodle-complete'));

  setActiveTool(state, 'note');
  const noteEvents = applyGesture(state, 'note', 30);
  assert.ok(noteEvents.some((event) => event.type === 'note-sent'));
  assert.equal(state.score, 90);

  setActiveTool(state, 'snack');
  const snackEvents = [1, 2, 3, 4].flatMap((bite) => applyGesture(state, 'snack', bite));
  assert.ok(snackEvents.some((event) => event.type === 'snack-finished'));
  assert.equal(state.snackBites, 0);

  setActiveTool(state, 'plane');
  assert.ok(applyGesture(state, 'plane', 0.7).some((event) => event.type === 'plane-folded'));
  assert.ok(applyGesture(state, 'plane', -0.2).some((event) => event.type === 'plane-thrown'));
  assert.equal(state.planeStage, 2);

  setActiveTool(state, 'console');
  const consoleEvents = [1, 2, 3, 4, 5, 6].flatMap((step) => applyGesture(state, 'console', step));
  assert.ok(consoleEvents.some((event) => event.type === 'console-clear'));
  assert.ok(state.memories.includes('new-hero'));
  assert.ok(state.memories.includes('paper-route'));
  assert.ok(state.memories.includes('snack-time'));
  assert.ok(state.memories.includes('paper-legend'));
  assert.ok(state.memories.includes('last-level'));
});

test('V3 课堂：转笔和涂鸦会持续得分，松手后进入收好状态', () => {
  const state = createGameState(() => 0);
  setInputActive(state, true);
  const spinEvents = applyGesture(state, 'spin', 4.2);
  assert.ok(spinEvents.some((event) => event.type === 'spin-turn'));
  assert.ok(state.memories.includes('pen-master'));
  const before = state.score;
  updateGame(state, 0.15, () => 0);
  assert.ok(state.score > before);

  const packingEvents = setInputActive(state, false);
  assert.ok(packingEvents.some((event) => event.type === 'packing'));
  assert.ok(state.stowTimer > 0);
});

test('V3 课堂：三节课拥有不同事件、不同观察者和 3–5 分钟总时长', () => {
  const totalDuration = LESSONS.reduce((total, lesson) => total + lesson.duration, 0);
  assert.ok(totalDuration >= 180 && totalDuration <= 300);
  assert.notDeepEqual(LESSONS[0].events, LESSONS[1].events);
  assert.notDeepEqual(LESSONS[1].events, LESSONS[2].events);

  const state = createGameState(fixedRandom);
  assert.equal(state.watchers.find((watcher) => watcher.key === 'teacher').mode, 'away');
  assert.equal(state.watchers.find((watcher) => watcher.key === 'corridor').mode, 'off');
  assert.equal(state.watchers.find((watcher) => watcher.key === 'monitor').mode, 'off');

  finishLesson(state);
  assert.equal(state.phase, 'between');
  assert.ok(startNextLesson(state, fixedRandom).some((event) => event.type === 'lesson-start'));
  assert.equal(state.watchers.find((watcher) => watcher.key === 'corridor').mode, 'away');
  assert.equal(state.watchers.find((watcher) => watcher.key === 'monitor').mode, 'off');

  finishLesson(state);
  assert.equal(state.phase, 'between');
  startNextLesson(state, fixedRandom);
  assert.equal(state.watchers.find((watcher) => watcher.key === 'monitor').mode, 'away');

  const finalEvents = finishLesson(state);
  assert.ok(finalEvents.some((event) => event.type === 'won'));
  assert.equal(state.phase, 'won');
});

test('V3 课堂：课堂事件会按课程变化，老师台词可能误报也可能真的提高警戒', () => {
  const state = createGameState(fixedRandom);
  state.nextEventTimer = 0;
  const eventEvents = updateGame(state, 0.05, fixedRandom);
  assert.ok(eventEvents.some((event) => event.type === 'class-event'));

  state.suspicion = 40;
  state.nextSpeechTimer = 0;
  const realLineEvents = updateGame(state, 0.05, () => 0.99);
  const realLine = realLineEvents.find((event) => event.type === 'teacher-line');
  assert.ok(realLine);
  assert.equal(realLine.fake, false);
  assert.equal(state.speechFake, false);

  state.suspicion = 40;
  state.nextSpeechTimer = 0;
  const fakeLineEvents = updateGame(state, 0.05, () => 0);
  const fakeLine = fakeLineEvents.find((event) => event.type === 'teacher-line');
  assert.ok(fakeLine);
  assert.equal(fakeLine.fake, true);
  assert.equal(state.speechFake, true);
});

test('V3 课堂：跨局只保存回忆，不增加属性或升级数值', () => {
  const firstRun = createGameState({ memories: ['pen-master', 'not-a-memory'] }, fixedRandom);
  assert.deepEqual(firstRun.memories, ['pen-master']);
  setInputActive(firstRun, true);
  applyGesture(firstRun, 'spin', 4);
  assert.ok(firstRun.memories.includes('pen-master'));

  const nextRun = createGameState({ memories: firstRun.memories }, fixedRandom);
  assert.deepEqual(nextRun.memories, ['pen-master']);
  assert.equal(nextRun.score, 0);
  assert.equal(nextRun.strikes, 0);
  assert.equal(nextRun.suspicion, 0);
  assert.equal(nextRun.combo, 1);
  assert.equal(Object.hasOwn(nextRun, 'level'), false);
  assert.equal(MEMORIES.length, 10);
});

test('V3 课堂：预警后收手可获得惊险分，持续暴露会被抓', () => {
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

test('V3 课堂：称号边界稳定', () => {
  assert.equal(scoreRank(2599), '偶尔发呆的同学');
  assert.equal(scoreRank(2600), '窗外观察员');
  assert.equal(scoreRank(5099), '窗外观察员');
  assert.equal(scoreRank(5100), '走神课代表');
  assert.equal(scoreRank(7599), '走神课代表');
  assert.equal(scoreRank(7600), '课桌下的宇宙学家');
});
