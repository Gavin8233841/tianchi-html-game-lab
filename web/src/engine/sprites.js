import { PIXELS, PALETTE, DIGIT_COLORS } from '../art/pixels.js';

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
    cache.set(name, paint(map));
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