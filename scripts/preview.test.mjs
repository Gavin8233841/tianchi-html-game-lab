import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('新工作区可预览网页，项目资料不通过预览端口公开', { timeout: 10000 }, async (t) => {
  const child = spawn(process.execPath, ['scripts/preview.mjs', '--port', '0'], {
    cwd: new URL('../', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null) {
      const closed = once(child, 'close');
      child.kill();
      await closed;
    }
  });
  const base = await new Promise((resolve, reject) => {
    let output = '';
    let errors = '';
    child.stderr.on('data', (chunk) => { errors += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => reject(new Error(`预览进程退出 ${code}: ${errors}`)));
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) resolve(match[0]);
    });
  });
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(await response.text(), /星际酒馆/);
  assert.equal((await fetch(`${base}/missing-file`)).status, 404);
  assert.equal((await fetch(`${base}/AGENTS.md`)).status, 404);
  assert.equal((await fetch(`${base}/%2e%2e%2fAGENTS.md`)).status, 403);
  const scores = await fetch(`${base}/api/classroom-scores`);
  assert.equal(scores.status, 200);
  assert.deepEqual(await scores.json(), { scope: 'local', scores: [] });
  const rejectedScore = await fetch(`${base}/api/classroom-scores`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: '测试', score: 100, run: { durationMs: 1, inputs: 1, lessons: 1 } }),
  });
  assert.equal(rejectedScore.status, 422);
  const acceptedScore = await fetch(`${base}/api/classroom-scores`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: '测试', score: 100, run: { durationMs: 8000, inputs: 1, lessons: 1 } }),
  });
  assert.equal(acceptedScore.status, 200);
  assert.deepEqual(await acceptedScore.json(), { scope: 'local', scores: [{ nickname: '测试', score: 100 }] });
  const head = await fetch(base, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});
