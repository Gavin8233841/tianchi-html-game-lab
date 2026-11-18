export function createScheduler() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    after(seconds, fn) {
      const id = nextId++;
      timers.set(id, { deadline: now + seconds, fn });
      return id;
    },
    cancel(id) { timers.delete(id); },
    tick(dt) {
      now += dt;
      for (const [id, timer] of [...timers]) {
        if (now >= timer.deadline) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
    clear() { timers.clear(); },
  };
}

const STEP = 1 / 60;

export function createLoop({ update, render }) {
  let rafId = 0;
  let last = 0;
  let acc = 0;
  let running = false;
  function frame(t) {
    if (!running) return;
    acc += Math.min((t - last) / 1000, 0.25);
    last = t;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render(acc / STEP);
    rafId = requestAnimationFrame(frame);
  }
  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
  };
}