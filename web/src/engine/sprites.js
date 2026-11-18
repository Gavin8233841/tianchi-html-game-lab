import { PIXELS, PALETTE, SPRITE_PALETTES, DIGIT_COLORS } from '../art/pixels.js';

export function paint(map, palette = PALETTE) {
  const height = map.length;
  const width = map[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  for (let y = 0; y < height; y++) {
    const row = map[y];
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const color = palette[ch];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

const cache = new Map();

export function bake() {
  if (cache.size > 0) return;
  for (const [name, map] of Object.entries(PIXELS)) {
    if (name === 'digits') continue;
    cache.set(name, paint(map, SPRITE_PALETTES[name] || PALETTE));
  }
  for (let n = 1; n <= 8; n++) {
    cache.set(`digit${n}`, paint(PIXELS.digits[n], { x: DIGIT_COLORS[n] }));
  }
}

export function get(name) {
  bake();
  return cache.get(name);
}

export function spr(g, sprite, x, y, scale = 1) {
  const s = Math.max(1, Math.floor(scale));
  g.imageSmoothingEnabled = false;
  g.drawImage(sprite, Math.floor(x), Math.floor(y), sprite.width * s, sprite.height * s);
}

const neonCache = new Map();

// shadowBlur 只在这里静态预烘焙一次，运行期仅 blit。
// scale>1 时按显示分辨率烘焙，调用方以 width/scale 的逻辑尺寸绘制 → 文字清晰不糊。
export function neon(text, color, px = 12, scale = 1) {
  const s = Math.max(1, Math.floor(scale));
  const key = `${text}|${color}|${px}|${s}`;
  if (neonCache.has(key)) return neonCache.get(key);
  const pad = 10 * s;
  const font = `bold ${px * s}px monospace`;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const w = Math.ceil(probe.measureText(text).width) + pad * 2;
  const h = px * s + pad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 8 * s;
  g.fillStyle = color;
  g.fillText(text, w / 2, h / 2);
  g.fillText(text, w / 2, h / 2);
  g.shadowBlur = 0;
  g.globalAlpha = 0.85;
  g.fillStyle = '#ffffff';
  g.fillText(text, w / 2, h / 2);
  neonCache.set(key, canvas);
  return canvas;
}

export function fitCanvas(ctx, logicalW, logicalH) {
  if (ctx.canvas.width !== logicalW) ctx.canvas.width = logicalW;
  if (ctx.canvas.height !== logicalH) ctx.canvas.height = logicalH;
  ctx.g.setTransform(1, 0, 0, 1, 0, 0);
  const parent = ctx.canvas.parentElement;
  const style = getComputedStyle(parent);
  const avail = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const scale = Math.max(1, Math.floor(avail / logicalW));
  ctx.canvas.style.width = `${logicalW * scale}px`;
  ctx.canvas.style.height = 'auto';
}

// 高分辨率画布：backing = 逻辑尺寸 × 整数显示倍率。
// 像素 sprite 仍整数倍放大（保留像素味），文字/矢量/动画按全分辨率光栅化（清晰）。
// 返回倍率 s；场景 render 每帧开头 g.setTransform(s,0,0,s,0,0)。
export function fitCanvasHD(ctx, logicalW, logicalH) {
  const parent = ctx.canvas.parentElement;
  const style = getComputedStyle(parent);
  const avail = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const s = Math.max(1, Math.floor(avail / logicalW));
  if (ctx.canvas.width !== logicalW * s) ctx.canvas.width = logicalW * s;
  if (ctx.canvas.height !== logicalH * s) ctx.canvas.height = logicalH * s;
  ctx.canvas.style.width = `${logicalW * s}px`;
  ctx.canvas.style.height = 'auto';
  ctx.g.setTransform(s, 0, 0, s, 0, 0);
  return s;
}

export function pourGlass(g, x, y, scale, fill) {
  const s = Math.max(1, Math.floor(scale));
  spr(g, get('glass'), x, y, s);
  const f = Math.min(1, Math.max(0, fill));
  if (f <= 0) return;
  g.save();
  g.beginPath();
  g.moveTo(x + 1.5 * s, y + s);
  g.lineTo(x + 14.5 * s, y + s);
  g.lineTo(x + 8 * s, y + 7.6 * s);
  g.closePath();
  g.clip();
  const top = y + (1 + (1 - f) * 6.6) * s;
  const bottom = y + 8 * s;
  g.fillStyle = '#ef5da8';
  g.fillRect(x, top, 16 * s, bottom - top);
  g.fillStyle = '#f2c14e';
  g.fillRect(x, top, 16 * s, Math.min(1.5 * s, bottom - top));
  g.fillStyle = '#fff3c4';
  g.fillRect(x, top, 16 * s, Math.max(1, 0.5 * s));
  g.restore();
}