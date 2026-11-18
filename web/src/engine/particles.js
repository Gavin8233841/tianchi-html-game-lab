const MAX = 200;

export function createParticles() {
  const pool = Array.from({ length: MAX }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, size: 1, gravity: 0, color: '#fff',
  }));
  let cursor = 0;

  function emit(x, y, {
    count = 8, color = '#fff', colors = null, speed = 30, life = 0.5,
    gravity = 0, size = 2, spread = Math.PI * 2, angle = -Math.PI / 2,
  } = {}) {
    for (let i = 0; i < count; i++) {
      const p = pool[cursor];
      cursor = (cursor + 1) % MAX;
      const a = angle + (Math.random() - 0.5) * spread;
      const sp = speed * (0.4 + Math.random() * 0.6);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.age = 0;
      p.life = life * (0.6 + Math.random() * 0.4);
      p.gravity = gravity;
      p.size = size;
      p.color = colors ? colors[(Math.random() * colors.length) | 0] : color;
    }
  }

  return {
    emit,
    dust(x, y) {
      emit(x, y, { count: 5, colors: ['#8c5aa8', '#453a6b', '#b8aed4'], speed: 22, life: 0.45, gravity: 30, size: 2, spread: Math.PI * 1.2 });
    },
    debris(x, y) {
      emit(x, y, { count: 14, colors: ['#ff6b6b', '#4a1f2e', '#f2c14e', '#120e1a'], speed: 55, life: 0.6, gravity: 90, size: 2 });
    },
    confetti(x, y) {
      emit(x, y, { count: 18, colors: ['#f2c14e', '#ef5da8', '#57e6d9', '#7ee787', '#fff3c4'], speed: 60, life: 1.1, gravity: 55, size: 2, spread: Math.PI });
    },
    stardust(x, y) {
      emit(x, y, { count: 8, colors: ['#f2c14e', '#fff3c4', '#ffffff'], speed: 14, life: 0.8, gravity: -6, size: 1 });
    },
    update(dt) {
      for (const p of pool) {
        if (!p.active) continue;
        p.age += dt;
        if (p.age >= p.life) { p.active = false; continue; }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    },
    render(g) {
      for (const p of pool) {
        if (!p.active) continue;
        const k = 1 - p.age / p.life;
        const s = Math.max(1, Math.round(p.size * k));
        g.globalAlpha = k;
        g.fillStyle = p.color;
        g.fillRect(Math.round(p.x), Math.round(p.y), s, s);
      }
      g.globalAlpha = 1;
    },
    clear() {
      for (const p of pool) p.active = false;
      cursor = 0;
    },
  };
}