import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeScore, normalizeNickname, normalizeRows, normalizeScore, validRunSummary } from '../web/classroom-slacking/leaderboard-core.js';

test('排行榜：昵称和分数会被限制为安全、简洁的值', () => {
  assert.equal(normalizeNickname('  <小明>\n同学  '), '小明同学');
  assert.equal(normalizeNickname(''), '匿名同学');
  assert.equal(normalizeScore(123.9), 123);
  assert.equal(normalizeScore(-2), 0);
  assert.equal(normalizeScore(999999), 20000);
});

test('排行榜：同一昵称只保留最高分并按总分排序', () => {
  const rows = mergeScore([
    { nickname: '甲', score: 80 },
    { nickname: '乙', score: 120 },
  ], { nickname: '甲', score: 150 });
  assert.deepEqual(rows, [{ nickname: '甲', score: 150 }, { nickname: '乙', score: 120 }]);
  assert.deepEqual(mergeScore(rows, { nickname: '甲', score: 90 }), rows);
  assert.deepEqual(normalizeRows([{ nickname: '丙', score: 20 }, { nickname: '丁', score: 50 }], 1), [{ nickname: '丁', score: 50 }]);
});

test('排行榜：只接受合理的单局摘要', () => {
  assert.equal(validRunSummary({ durationMs: 30000, inputs: 12, lessons: 3 }), true);
  assert.equal(validRunSummary({ durationMs: 100, inputs: 12, lessons: 3 }), false);
  assert.equal(validRunSummary({ durationMs: 30000, inputs: 12.5, lessons: 3 }), false);
});
