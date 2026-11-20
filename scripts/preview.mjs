import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeScore, normalizeRows, normalizeScore, normalizeNickname, validRunSummary } from '../web/classroom-slacking/leaderboard-core.js';

const root = fileURLToPath(new URL('../web/', import.meta.url));
const args = process.argv.slice(2);
const port = args.length === 0 ? 4173 : Number(args[1]);
if (args.length !== 0 && (args.length !== 2 || args[0] !== '--port')) {
  console.error('用法：npm run dev -- --port 4174');
  process.exit(1);
}
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('端口应为 0–65535 的整数。');
  process.exit(1);
}
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
};
let classroomScores = [];

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 16_384) throw new Error('body too large');
  }
  return JSON.parse(body || '{}');
}

const server = createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  if (pathname === '/api/classroom-scores') {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const payload = JSON.stringify({ scope: 'local', scores: normalizeRows(classroomScores) });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : payload);
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { Allow: 'GET, HEAD, POST' }).end();
      return;
    }
    try {
      const payload = await readJsonBody(req);
      if (!validRunSummary(payload.run)) {
        res.writeHead(422, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ error: 'invalid run' }));
        return;
      }
      classroomScores = mergeScore(classroomScores, {
        nickname: normalizeNickname(payload.nickname),
        score: normalizeScore(payload.score),
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ scope: 'local', scores: classroomScores }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ error: 'invalid json' }));
    }
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(resolve(root) + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) {
    res.writeHead(error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 500).end();
  }
});
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE'
    ? '端口已占用，请改用 npm run dev -- --port 4174'
    : error.message);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  console.log(`本地预览：http://127.0.0.1:${server.address().port}`);
  console.log('Ctrl+C 停止；课堂游戏入口：/classroom-slacking/index.html');
});
