// 将课堂游戏的 ES modules 和 CSS 内联成一个可双击打开的 HTML。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gameDir = path.join(root, 'web', 'classroom-slacking');
const outPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, 'dist', 'classroom-slacking-offline.html');

const read = (id) => readFileSync(path.join(gameDir, id), 'utf8');
const resolve = (fromId, spec) => path.posix.normalize(path.posix.join(path.posix.dirname(fromId), spec));
const modules = new Map();

function transform(id) {
  if (modules.has(id)) return;
  let source = read(id);
  const exportNames = new Set();

  source = source.replace(/^import\s*\{([^}]+)\}\s*from\s*'([^']+)';?[ \t]*$/gm, (_, names, spec) => {
    return `const {${names}} = __req(${JSON.stringify(resolve(id, spec))});`;
  });
  source = source.replace(/^export\s+const\s+([A-Za-z0-9_$]+)/gm, (_, name) => {
    exportNames.add(name);
    return `const ${name}`;
  });
  source = source.replace(/^export\s+function\s+([A-Za-z0-9_$]+)/gm, (_, name) => {
    exportNames.add(name);
    return `function ${name}`;
  });
  for (const match of source.matchAll(/__req\("([^\"]+)"\)/g)) transform(match[1]);
  if (/^export\s/m.test(source) || /^import\s/m.test(source)) {
    throw new Error(`未处理的 import/export 语法: ${id}`);
  }
  const tail = [...exportNames].map((name) => `exports.${name} = ${name};`).join('\n');
  modules.set(id, `__def(${JSON.stringify(id)}, function (__req, exports) {\n${source}\n${tail}\n});`);
}

transform('game.js');

const runtime = `const __mods = {}; const __cache = {};
function __def(id, fn) { __mods[id] = fn; }
function __req(id) {
  if (__cache[id]) return __cache[id].exports;
  const module = { exports: {} };
  __cache[id] = module;
  __mods[id](__req, module.exports);
  return module.exports;
}`;
const bundle = `${runtime}\n${[...modules.values()].join('\n')}\n__req("game.js");`;
let html = read('index.html');
html = html.replace(/<link rel=['"]stylesheet['"] href=['"]style\.css['"]\s*\/?\s*>/i, `<style>\n${read('style.css')}\n</style>`);
html = html.replace(/<script type=['"]module['"] src=['"]game\.js['"]><\/script>/i, `<script>\n${bundle}\n</script>`);
if (html.includes('href=\'style.css\'') || html.includes('src=\'game.js\'')) throw new Error('课堂离线包替换失败');

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
console.log(`OK ${outPath} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB, ${modules.size} modules)`);
