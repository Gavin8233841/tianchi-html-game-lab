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
  throwPlane,
  updateGame,
} from '../web/classroom-slacking/core.js';
import { HANDHELD, PLANE_FOLDS, SPIN, canStartSpin, spinDelta } from '../web/classroom-slacking/desk-actions.js';
import { COMIC, COMIC_STORIES, comicConfiscated } from '../web/classroom-slacking/comics.js';

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

test('课堂：涂鸦完成后解锁回忆，漫画拉开时有反馈', () => {
  const state = createGameState(fixedRandom);

  setActiveTool(state, 'doodle');
  setInputActive(state, true);
  const doodleEvents = applyGesture(state, 'doodle', 20);
  assert.ok(doodleEvents.some((event) => event.type === 'doodle-complete'));

  setActiveTool(state, 'comic');
  assert.ok(applyGesture(state, 'comic', 0.9).some((event) => event.type === 'comic-open'));
  assert.ok(state.memories.includes('new-hero'));
  assert.equal(state.memories.includes('desk-diver'), false);
});

function quietClassroom(state) {
  state.nextEventTimer = state.nextSpeechTimer = 100;
  for (const watcher of state.watchers) {
    if (watcher.mode !== 'off') watcher.timer = 100;
  }
}

function tick(state, seconds) {
  const events = [];
  for (let time = 0; time < seconds; time += 0.05) events.push(...updateGame(state, 0.05, fixedRandom));
  return events;
}

test('漫画：翻阅四格，半开看不到结尾；读完才计奖并保存', () => {
  const state = createGameState({ comics: ['invalid', COMIC_STORIES[1].id, COMIC_STORIES[1].id] }, fixedRandom);
  quietClassroom(state);
  const move = (amount) => applyGesture(state, 'comic', amount);
  setActiveTool(state, 'comic');
  assert.deepEqual(move('next-page'), []);
  assert.deepEqual(state.comic.collected, [COMIC_STORIES[1].id]);
  move(0.56);
  for (let index = 0; index < 3; index += 1) assert.equal(move('next-page')[0].type, 'comic-page');
  assert.equal(state.comic.page, 3);
  assert.equal(tick(state, 1).some((event) => event.type === 'comic-finished'), false);
  assert.equal(state.comic.finished, false);
  assert.deepEqual(move('next-page'), []);
  move(0.5);
  const completed = tick(state, 0.8);
  assert.equal(completed.find((event) => event.type === 'comic-finished').bonus, COMIC.bonus);
  assert.equal(state.comic.finished, true);
  assert.ok(state.comic.collected.includes(COMIC_STORIES[0].id));
  assert.ok(state.memories.includes('desk-diver'));
  assert.equal(tick(state, 0.8).some((event) => event.type === 'comic-finished'), false);
  assert.equal(move('next-page')[0].type, 'comic-page');
  assert.deepEqual([state.comic.story, state.comic.page, state.comic.finished], [2, 0, false]);
});

test('漫画：四轮各四页无重复，读过三篇的存档先打开第四篇', () => {
  assert.equal(COMIC_STORIES.length, 4);
  assert.ok(COMIC_STORIES.every((story) => story.pages.length === 4));
  assert.equal(new Set(COMIC_STORIES.flatMap((story) => story.pages.map((page) => page.scene))).size, 16);
  const state = createGameState({ comics: COMIC_STORIES.slice(0, 3).map((story) => story.id) }, fixedRandom);
  quietClassroom(state);
  setActiveTool(state, 'comic');
  const next = () => applyGesture(state, 'comic', 'next-page');
  const seen = [];
  applyGesture(state, 'comic', 1);
  for (let round = 0; round < 4; round += 1) {
    assert.equal(state.comic.page, 0);
    seen.push(state.comic.story);
    for (let page = 0; page < 3; page += 1) assert.equal(next()[0].type, 'comic-page');
    assert.deepEqual(next(), []);
    assert.ok(tick(state, 0.8).some((event) => event.type === 'comic-finished'));
    if (round < 3) assert.equal(next()[0].type, 'comic-page');
  }
  assert.deepEqual(seen, [3, 0, 1, 2]);
  assert.deepEqual(next(), []);
  assert.equal(state.comic.collected.length, 4);
});

test('漫画：第一次被抓保存页码，第二次整局没收，第三节也不能再打开', () => {
  const otherTool = createGameState(fixedRandom);
  setInputActive(otherTool, true);
  Object.assign(otherTool.watchers[0], { mode: 'look', timer: 1 });
  updateGame(otherTool, 0.05, fixedRandom);
  assert.equal(otherTool.strikes, 1);
  assert.equal(otherTool.comic.catches, 0, '其他道具被抓不计入漫画');

  const state = createGameState(fixedRandom);
  quietClassroom(state);
  const look = () => Object.assign(state.watchers[0], { mode: 'look', timer: 1 });
  setActiveTool(state, 'comic');
  applyGesture(state, 'comic', 0.6);
  applyGesture(state, 'comic', 'next-page');
  look();
  assert.ok(updateGame(state, 0.05, fixedRandom).some((event) => event.type === 'comic-bookmarked'));
  assert.equal(state.comic.open, 0);
  assert.equal(state.comic.page, 1);
  assert.equal(state.strikes, 1);
  assert.equal(comicConfiscated(state.comic), false);

  finishLesson(state);
  startNextLesson(state, fixedRandom);
  quietClassroom(state);
  assert.equal(state.comic.page, 1);
  applyGesture(state, 'comic', 0.6);
  focusNow(state);
  look();
  assert.ok(updateGame(state, 0.05, fixedRandom).some((event) => event.type === 'comic-confiscated'));
  assert.equal(state.strikes, 2);
  assert.equal(comicConfiscated(state.comic), true);
  assert.equal(setActiveTool(state, 'comic'), false);
  assert.deepEqual(applyGesture(state, 'comic', 1), []);
  finishLesson(state);
  startNextLesson(state, fixedRandom);
  assert.equal(setActiveTool(state, 'comic'), false);
  assert.equal(comicConfiscated(createGameState(fixedRandom).comic), false);
});

test('纸条：先写后传，发送内容轮换且随课程变化', () => {
  const state = createGameState(fixedRandom);
  quietClassroom(state);
  setActiveTool(state, 'note');
  assert.deepEqual(applyGesture(state, 'note', 'pass', fixedRandom), []);
  const send = () => {
    applyGesture(state, 'note', 'write', fixedRandom);
    assert.ok(state.note.draft);
    const events = applyGesture(state, 'note', 'pass', fixedRandom);
    tick(state, 0.4);
    return events.find((event) => event.type === 'note-sent').text;
  };
  const math = Array.from({ length: 8 }, send);
  assert.equal(new Set(math).size, 8);
  assert.equal(state.score, 720);
  assert.equal(state.note.waiting, null);
  assert.ok(state.memories.includes('paper-route'));
  finishLesson(state);
  startNextLesson(state, fixedRandom);
  assert.ok(!math.includes(send()));
});

test('纸条：回信等待解锁，自动切换并暂停其他动作', () => {
  const state = createGameState(fixedRandom);
  quietClassroom(state);
  setActiveTool(state, 'note');
  const replyRandom = () => 0;
  applyGesture(state, 'note', 'write', replyRandom);
  applyGesture(state, 'note', 'pass', replyRandom);
  state.focusLock = 3;
  tick(state, 2.4);
  assert.equal(state.note.incoming, '');
  assert.ok(tick(state, 0.75).some((event) => event.type === 'note-reply'));
  applyGesture(state, 'note', 'read');
  assert.equal(state.note.incoming, '');
  applyGesture(state, 'note', 'write', replyRandom);
  applyGesture(state, 'note', 'pass', replyRandom);
  setActiveTool(state, 'console');
  applyGesture(state, 'console', -1);
  assert.ok(tick(state, 2.3).some((event) => event.type === 'note-reply'));
  assert.equal(state.activeTool, 'note');
  assert.equal(state.handheld.active, false);
  assert.ok(state.handheld.dodged > 0);
  assert.equal(state.handheld.confiscated, false);
  assert.ok(state.note.incoming);
  focusNow(state);
  assert.equal(state.note.incoming, '');
});

test('辣条：先撕再吃，快撕更吵，第四口吃完获得回忆', () => {
  const state = createGameState(fixedRandom);
  quietClassroom(state);
  setActiveTool(state, 'snack');
  assert.deepEqual(applyGesture(state, 'snack', 'bite'), []);
  assert.equal(applyGesture(state, 'snack', 'tear-fast')[0].loud, true);
  assert.equal(state.suspicion, 10);
  for (let bite = 0; bite < 4; bite += 1) {
    const events = applyGesture(state, 'snack', 'bite');
    assert.ok(events.some((event) => event.type === 'snack-crunch'));
    assert.deepEqual(applyGesture(state, 'snack', 'bite'), []);
    if (bite === 3) assert.ok(events.some((event) => event.type === 'snack-finished'));
    tick(state, 0.35);
  }
  assert.deepEqual(state.snack, { open: false, bites: 0, crunch: 0 });
  assert.equal(state.score, 120);
  assert.ok(state.memories.includes('snack-time'));
  const suspicion = state.suspicion;
  assert.equal(applyGesture(state, 'snack', 'tear')[0].loud, false);
  assert.equal(state.suspicion - suspicion, 2);
});

test('掌机：还没收好就被抓会没收，下节课恢复方块和进度', () => {
  const state = createGameState(fixedRandom);
  quietClassroom(state);
  setActiveTool(state, 'console');
  applyGesture(state, 'console', -1);
  tick(state, 1.4);
  const { dodged, progress, lane, obstacle } = state.handheld;
  assert.equal(dodged, 1);
  focusNow(state);
  Object.assign(state.watchers[0], { mode: 'look', timer: 1 });
  const caught = updateGame(state, 0.05, fixedRandom);
  assert.ok(caught.some((event) => event.type === 'handheld-confiscated'));
  assert.equal(state.strikes, 1);
  assert.equal(state.handheld.active, false);
  assert.equal(state.handheld.confiscated, true);
  assert.equal(setActiveTool(state, 'console'), false);
  assert.deepEqual(applyGesture(state, 'console', 1), []);
  assert.ok(setActiveTool(state, 'note'));
  finishLesson(state);
  assert.ok(startNextLesson(state, fixedRandom).some((event) => event.type === 'handheld-returned'));
  assert.equal(state.handheld.confiscated, false);
  assert.deepEqual({ dodged, progress, lane, obstacle },
    Object.fromEntries(['dodged', 'progress', 'lane', 'obstacle'].map((key) => [key, state.handheld[key]])));
  assert.ok(setActiveTool(state, 'console'));
  applyGesture(state, 'console', 1);
  assert.equal(state.handheld.active, true);
  assert.equal(state.handheld.dodged, dodged);
});

test('纸飞机：依次折叠，可跨课短投，远投每局一次且风险更高', () => {
  const state = createGameState(fixedRandom);
  const fold = () => PLANE_FOLDS.flatMap((direction) => applyGesture(state, 'plane', direction));
  setActiveTool(state, 'plane');
  assert.deepEqual(applyGesture(state, 'plane', -1), []);
  assert.deepEqual(throwPlane(state, 'short'), []);
  assert.ok(fold().some((event) => event.type === 'plane-folded'));
  assert.ok(throwPlane(state, 'short').some((event) => event.type === 'plane-thrown'));
  const shortExposure = state.stowTimer;
  const shortScore = state.score;
  const shortRisk = state.suspicion;
  assert.ok(state.memories.includes('paper-legend'));
  assert.equal(state.farThrowUsed, false);

  finishLesson(state);
  startNextLesson(state, fixedRandom);
  fold();
  const before = { score: state.score, suspicion: state.suspicion };
  throwPlane(state, 'far');
  assert.ok(state.score - before.score > shortScore);
  assert.ok(state.suspicion - before.suspicion > shortRisk);
  assert.ok(state.stowTimer > shortExposure);
  assert.equal(state.farThrowUsed, true);
  setActiveTool(state, 'doodle');
  assert.equal(state.planeFlight.mode, 'far');
  assert.equal(isExposed(state), true);

  finishLesson(state);
  startNextLesson(state, fixedRandom);
  setActiveTool(state, 'plane');
  fold();
  assert.deepEqual(throwPlane(state, 'far'), []);
  assert.ok(throwPlane(state, 'short').some((event) => event.type === 'plane-thrown'));
});

test('掌机：左右换道，碰撞涨怀疑，收好可恢复原进度，躲过六次通关', () => {
  const state = createGameState(fixedRandom);
  const game = state.handheld;
  state.watchers[0].timer = 100;
  state.nextEventTimer = state.nextSpeechTimer = 100;
  const step = (seconds) => {
    const events = [];
    for (let time = 0; time < seconds; time += 0.04) events.push(...updateGame(state, 0.04, fixedRandom));
    return events;
  };
  setActiveTool(state, 'console');
  applyGesture(state, 'console', -1);
  assert.equal(game.lane, 0);
  assert.equal(isExposed(state), true);
  step(0.4);
  focusNow(state);
  const progress = game.progress;
  step(0.8);
  assert.equal(game.progress, progress);
  applyGesture(state, 'console', 1);
  assert.equal(game.lane, 1);
  assert.ok(step(0.8).some((event) => event.type === 'handheld-hit'));
  assert.equal(game.dodged, 0);
  for (let index = 0; index < HANDHELD.goal; index += 1) {
    applyGesture(state, 'console', game.lane === 0 ? 1 : -1);
    const events = step(HANDHELD.interval);
    if (index === HANDHELD.goal - 1) assert.ok(events.some((event) => event.type === 'console-clear'));
  }
  assert.equal(game.active, false);
  assert.ok(state.memories.includes('last-level'));
});

test('转笔：反复小幅来回不算一圈，连续快转的怀疑涨得更多', () => {
  const state = createGameState(fixedRandom);
  setInputActive(state, true);
  for (let index = 0; index < 12; index += 1) {
    applyGesture(state, 'spin', 0.25);
    applyGesture(state, 'spin', -0.25);
  }
  assert.equal(state.stats.spinTurns, 0);
  const first = applyGesture(state, 'spin', 1)[0];
  state.lessonTime += 0.5;
  const fast = applyGesture(state, 'spin', 1)[0];
  assert.equal(first.type, 'spin-turn');
  assert.equal(fast.fast, true);
  assert.ok(fast.suspicion > first.suspicion);
});

test('转笔：偏离提示环的椭圆也能完成整圈，支持两个方向', () => {
  assert.equal(canStartSpin({ x: SPIN.x, y: SPIN.y }), true);
  assert.equal(canStartSpin({ x: SPIN.x + 149, y: SPIN.y }), true);
  assert.equal(canStartSpin({ x: SPIN.x + 200, y: SPIN.y }), false);

  for (const direction of [-1, 1]) {
    const state = createGameState(fixedRandom);
    setInputActive(state, true);
    let previous = { x: SPIN.x + 159, y: SPIN.y };
    for (let i = 1; i <= 24; i += 1) {
      const theta = direction * i * Math.PI / 12;
      const point = { x: SPIN.x + 18 + 141 * Math.cos(theta), y: SPIN.y + 24 * Math.sin(theta) };
      applyGesture(state, 'spin', spinDelta(previous, point) / (Math.PI * 2));
      previous = point;
    }
    assert.equal(state.stats.spinTurns, 1);
  }
});

test('转笔：经过笔心或横划时不丢已有进度，也不会误算半圈', () => {
  const state = createGameState(fixedRandom);
  setInputActive(state, true);
  const center = { x: SPIN.x, y: SPIN.y };
  const right = { x: SPIN.x + 86, y: SPIN.y };
  const bottom = { x: SPIN.x, y: SPIN.y + 24 };
  const left = { x: SPIN.x - 161, y: SPIN.y };
  const top = { x: SPIN.x, y: SPIN.y - 32 };
  const move = (a, b) => applyGesture(state, 'spin', spinDelta(a, b) / (Math.PI * 2));
  move(right, bottom);
  move(bottom, center);
  move(center, bottom);
  move(bottom, top);
  assert.equal(state.spinTurnBuffer, 0.25);
  move(bottom, left);
  move(left, top);
  assert.ok(move(top, right).some((event) => event.type === 'spin-turn'));
  setInputActive(state, false);
  assert.equal(state.spinTurnBuffer, 0);
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
  assert.deepEqual(createGameState({ memories: { invalid: true } }, fixedRandom).memories, []);
});

test('回忆：粉笔擦过时已收好道具才解锁贴纸', () => {
  const focused = createGameState(fixedRandom);
  const exposed = createGameState(fixedRandom);
  for (const state of [focused, exposed]) {
    state.nextEventTimer = 0;
  }
  setInputActive(exposed, true);
  const chalkNear = () => {
    const values = [0, 0.9, 0.5];
    return () => values.shift() ?? 0.5;
  };
  const focusedEvents = updateGame(focused, 0.05, chalkNear());
  assert.ok(focusedEvents.some((event) => event.type === 'chalk-near'));
  assert.ok(focusedEvents.some((event) => event.type === 'memory' && event.memory.id === 'chalk-dodge'));
  updateGame(exposed, 0.05, chalkNear());
  assert.equal(exposed.memories.includes('chalk-dodge'), false);
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
