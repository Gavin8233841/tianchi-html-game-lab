export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeOutBack(t) {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

// 逻辑像素振幅；整数倍缩放 ≤3 时屏幕震幅 ≤6px，守住 <8px 上限
const MAX_AMP = 2;
const FLOAT_POOL = 32;
const FLY_POOL = 16;
const FLY_DURATION = 0.3;

export function createFx() {
  let trauma = 0;
  let freeze = 0;
  let floatCursor = 0;
  let flyCursor = 0;
  const floats = Array.from({ length: FLOAT_POOL }, () => ({ active: false, onDone: null }));
  const flies = Array.from({ length: FLY_POOL }, () => ({ active: false, onDone: null }));

  function takeSlot(pool, cursor) {
    for (let i = 0; i < pool.length; i++) {
      const slot = pool[(cursor + i) % pool.length];
      if (!slot.active) return { slot, next: (cursor + i + 1) % pool.length };
    }
    return { slot: pool[cursor], next: (cursor + 1) % pool.length };
  }

  return {
    addTrauma(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    hitStop(frames = 3) {
      freeze = Math.max(freeze, frames / 60);
    },
    isFrozen() {
      return freeze > 0;
    },
    shakeOffset() {
      const s = trauma * trauma * MAX_AMP;
      return {
        x: Math.round((Math.random() * 2 - 1) * s),
        y: Math.round((Math.random() * 2 - 1) * s),
      };
    },
    spawnFloatText(x, y, text, color, { size = 6, life = 0.7, rise = 12, fall = false } = {}) {
      const { slot, next } = takeSlot(floats, floatCursor);
      floatCursor = next;
      Object.assign(slot, { active: true, x, y, text, color, size, life, rise, fall, age: 0 });
    },
    spawnFly(fromX, fromY, toX, toY, sprite, onDone) {
      const { slot, next } = takeSlot(flies, flyCursor);
      flyCursor = next;
      Object.assign(slot, {
        active: true,
        fromX, fromY, toX, toY, sprite, onDone,
        ctrlX: (fromX + toX) / 2,
        ctrlY: Math.min(fromY, toY) - 20,
        age: 0,
      });
    },
    update(dt) {
      freeze = Math.max(0, freeze - dt);
      trauma = Math.max(0, trauma - dt * 1.4);
      for (const f of floats) {
        if (!f.active) continue;
        f.age += dt;
        if (f.age >= f.life) f.active = false;
      }
      for (const f of flies) {
        if (!f.active) continue;
        f.age += dt;
        if (f.age >= FLY_DURATION) {
          f.active = false;
          const cb = f.onDone;
          f.onDone = null;
          if (cb) cb();
        }
      }
    },
    render(g) {
      g.imageSmoothingEnabled = false;
      for (const f of flies) {
        if (!f.active) continue;
        const t = easeOutCubic(Math.min(1, f.age / FLY_DURATION));
        const u = 1 - t;
        const x = u * u * f.fromX + 2 * u * t * f.ctrlX + t * t * f.toX;
        const y = u * u * f.fromY + 2 * u * t * f.ctrlY + t * t * f.toY;
        const s = Math.max(4, Math.round(16 - 8 * t));
        g.drawImage(f.sprite, Math.round(x - s / 2), Math.round(y - s / 2), s, s);
      }
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const f of floats) {
        if (!f.active) continue;
        const p = Math.min(1, f.age / f.life);
        const dy = f.fall ? 12 * p : -f.rise * easeOutCubic(p);
        g.globalAlpha = p < 0.6 ? 1 : (1 - p) / 0.4;
        g.font = `bold ${f.size}px monospace`;
        const tx = Math.round(f.x);
        const ty = Math.round(f.y + dy);
        g.fillStyle = '#120e1a';
        g.fillText(f.text, tx + 1, ty + 1);
        g.fillStyle = f.color;
        g.fillText(f.text, tx, ty);
      }
      g.globalAlpha = 1;
    },
    clear() {
      trauma = 0;
      freeze = 0;
      for (const f of floats) { f.active = false; f.onDone = null; }
      for (const f of flies) { f.active = false; f.onDone = null; }
    },
  };
}