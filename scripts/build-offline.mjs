// 把 web/ 下的 ES modules 游戏打包成单个离线 HTML（双击即玩，零网络请求）。
// 用法：node scripts/build-offline.mjs [输出路径]
// 原理：每个模块包进 __def(id, fn) 注册器，import 改写为 __req()，
//       export 改写为 exports 赋值；懒加载注册表保持原模块语义（含 audio 的动态 import）。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(root, 'web');
const outPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, 'dist', 'star-tavern-offline.html');

const read = (id) => readFileSync(path.join(webDir, id), 'utf8');
const resolve = (fromId, spec) => path.posix.normalize(path.posix.join(path.posix.dirname(fromId), spec));

const modules = new Map();

function transform(id) {
  if (modules.has(id)) return;
  let src = read(id);
  const exportNames = new Set();

  src = src.replace(/^import\s*\{([^}]+)\}\s*from\s*'([^']+)';?[ \t]*$/gm, (_, names, spec) => {
    return `const {${names}} = __req(${JSON.stringify(resolve(id, spec))});`;
  });
  src = src.replace(/^export\s+const\s+([A-Za-z0-9_$]+)/gm, (_, name) => {
    exportNames.add(name);
    return `const ${name}`;
  });
  src = src.replace(/^export\s+function\s+([A-Za-z0-9_$]+)/gm, (_, name) => {
    exportNames.add(name);
    return `function ${name}`;
  });
  src = src.replace(/^export\s*\{([^}]+)\};?[ \t]*$/gm, (_, names) => {
    return names.split(',').map((n) => n.trim()).filter(Boolean)
      .map((n) => { exportNames.add(n); return `exports.${n} = ${n};`; }).join('\n');
  });
  // audio.js 的动态 import → 注册表同步取模块（保持 Promise 接口）
  src = src.replace(/import\('([^']+)'\)/g, (_, spec) => {
    const dep = resolve(id, spec);
    transform(dep);
    return `Promise.resolve(__req(${JSON.stringify(dep)}))`;
  });
  // 收集静态依赖（在改写后的 __req 调用里）
  for (const m of src.matchAll(/__req\("([^"]+)"\)/g)) transform(m[1]);

  if (/^export\s/m.test(src) || /^import\s/m.test(src)) {
    throw new Error(`未处理的 import/export 语法: ${id}`);
  }
  const tail = [...exportNames].map((n) => `exports.${n} = ${n};`).join('\n');
  modules.set(id, `__def(${JSON.stringify(id)}, function (__req, exports) {\n${src}\n${tail}\n});`);
}

transform('src/main.js');

const runtime = `const __mods = {}; const __cache = {};
function __def(id, fn) { __mods[id] = fn; }
function __req(id) {
  if (__cache[id]) return __cache[id].exports;
  const m = { exports: {} };
  __cache[id] = m;
  __mods[id](__req, m.exports);
  return m.exports;
}`;

const bundle = `${runtime}\n${[...modules.values()].join('\n')}\n__req("src/main.js");`;

const css = read('styles/main.css');
let html = read('index.html');
html = html.replace(/<link rel="stylesheet" href="styles\/main.css">/, `<style>\n${css}\n</style>`);
html = html.replace(
  /<script type="module" src="src\/main.js"><\/script>/,
  `<!-- 离线单文件版：由 scripts/build-offline.mjs 生成（${new Date().toISOString().slice(0, 10)}），源码见 web/ -->\n<script>\n${bundle}\n</script>`,
);
if (html.includes('href="styles/main.css"') || html.includes('src="src/main.js"')) {
  throw new Error('index.html 替换失败');
}

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
console.log(`OK ${outPath} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB, ${modules.size} modules)`);