import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DISTRACTIONS,
  LESSONS,
  MAX_STRIKES,
  createGameState,
  scoreRank,
  setHolding,
  updateGame,
} from '../web/classroom-slacking/core.js';

const fixedRandom = () => 0.5;

function step(state, seconds, random = fixedRandom) {
  const events = [];
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) {
    events.push(...updateGame(state, 0.05, random));
  }
  return events;
}

test('课堂原型：首节只启用老师，后续课程逐步增加盯梢者', () => {
  const state = createGameState(fixedRandom);
  assert.equal(state.phase, 'playing');
  assert.equal(state.lessonIndex, 0);
  assert.equal(state.watchers.find((watcher) => watcher.key === 'teacher').mode, 'away');
  assert.equal(state.watchers.find((watcher) => watcher.key === 'corridor').mode, 'off');
  assert.equal(state.watchers.find((watcher) => watcher.key === 'monitor').mode, 'off');
  state.lessonTime = LESSONS[0].duration - 0.01;
  updateGame(state, 0.05, fixedRandom);
  assert.equal(state.phase, 'between');
  step(state, 3, fixedRandom);
  assert.equal(state.lessonIndex, 1);
  assert.equal(state.watchers.find((watcher) => watcher.key === 'corridor').mode, 'away');
});

test('课堂原型：按住开始开小差，分数和连击随时间增长', () => {
  const state = createGameState(() => 0);
  const events = setHolding(state, true, () => 0);
  assert.ok(events.some((event) => event.type === 'activity'));
  assert.equal(state.daydreaming, true);
  const before = state.score;
  step(state, 1, () => 0);
  assert.ok(state.score > before);
  assert.ok(state.combo > 1);
  assert.ok(DISTRACTIONS.some((activity) => activity.id === state.activity.id));
});

test('课堂原型：松手后按活动风险延迟收好，再恢复听课', () => {
  const state = createGameState(() => 0);
  setHolding(state, true, () => 0);
  state.activity = DISTRACTIONS.find((activity) => activity.id === 'console');
  setHolding(state, false, () => 0);
  assert.equal(state.daydreaming, true);
  updateGame(state, state.activity.hide / 2, () => 0);
  assert.equal(state.daydreaming, true);
  const events = step(state, state.activity.hide + 0.05, () => 0);
  assert.equal(state.daydreaming, false);
  assert.ok(events.some((event) => event.type === 'focused'));
});

test('课堂原型：盯梢者看过来时仍开小差会记一次，被抓三次结束', () => {
  const state = createGameState(() => 0.9);
  const teacher = state.watchers.find((watcher) => watcher.key === 'teacher');
  for (let strike = 1; strike <= MAX_STRIKES; strike += 1) {
    state.focusLock = 0;
    setHolding(state, true, () => 0);
    teacher.mode = 'warn';
    teacher.timer = 0;
    teacher.fake = false;
    const events = updateGame(state, 0.05, () => 0.9);
    assert.ok(events.some((event) => event.type === 'caught'));
    assert.equal(state.strikes, strike);
  }
  assert.equal(state.phase, 'lost');
});

test('课堂原型：预警后刚好收手可获得极限操作奖励', () => {
  const state = createGameState(() => 0.9);
  const teacher = state.watchers.find((watcher) => watcher.key === 'teacher');
  state.daydreaming = false;
  state.holding = false;
  state.sinceFocused = 0.1;
  teacher.mode = 'warn';
  teacher.timer = 0;
  teacher.fake = false;
  const before = state.score;
  const events = updateGame(state, 0.05, () => 0.9);
  assert.ok(events.some((event) => event.type === 'near-miss'));
  assert.ok(state.score > before);
  assert.equal(state.strikes, 0);
});

test('课堂原型：完成三节课后进入放学结算，分数称号有稳定边界', () => {
  const state = createGameState(fixedRandom);
  for (let lesson = 0; lesson < LESSONS.length; lesson += 1) {
    state.lessonTime = LESSONS[state.lessonIndex].duration - 0.01;
    updateGame(state, 0.05, fixedRandom);
    if (lesson < LESSONS.length - 1) step(state, 3, fixedRandom);
  }
  assert.equal(state.phase, 'won');
  assert.equal(scoreRank(849), '偶尔走神的普通同学');
  assert.equal(scoreRank(850), '窗外观察员');
  assert.equal(scoreRank(1550), '开小差优等生');
  assert.equal(scoreRank(2300), '课桌下的宇宙学家');
});
