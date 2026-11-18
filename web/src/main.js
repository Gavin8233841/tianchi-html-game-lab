import { createLoop, createScheduler } from './engine/loop.js';
import { createSceneMachine } from './engine/scenes.js';
import { createInput } from './engine/input.js';
import { createStorage } from './engine/storage.js';
import { createFx } from './engine/fx.js';
import { createParticles } from './engine/particles.js';
import { createAudio } from './engine/audio.js';
import { serialize } from './core/save.js';
import { createHud } from './ui/hud.js';
import { createBackpack } from './ui/backpack.js';
import { loading } from './scenes/loading.js';
import { tavern } from './scenes/tavern.js';
import { dive } from './scenes/dive.js';
import { extract } from './scenes/extract.js';
import { bar } from './scenes/bar.js';
import { result } from './scenes/result.js';

const canvas = document.getElementById('game');
const panel = document.getElementById('panel');
const hudRoot = document.getElementById('hud');

const seedParam = new URLSearchParams(location.search).get('seed');
const storage = createStorage();
const ctx = {
  canvas,
  g: canvas.getContext('2d'),
  panel,
  hud: createHud(hudRoot),
  scheduler: createScheduler(),
  fx: createFx(),
  particles: createParticles(),
  audio: createAudio(),
  storage,
  run: null,
  currentSceneName: null,
  debugSeed: seedParam !== null && Number.isFinite(Number(seedParam)) ? Number(seedParam) >>> 0 : null,
  goto: null,
  input: null,
  persist: null,
  commitRun: null,
};

ctx.persist = () => {
  const scene = ctx.currentSceneName;
  if (!scene || scene === 'loading') return;
  storage.save(serialize({ scene, run: ctx.run }));
};
ctx.commitRun = (state) => {
  ctx.run = state;
  ctx.persist();
};

const machine = createSceneMachine({
  scenes: { loading, tavern, dive, extract, bar, result },
  ctx,
});
ctx.input = createInput({ canvas, onPointer: (evt) => machine.onPointer(evt) });
createBackpack(ctx);

const loop = createLoop({
  update(dt) {
    ctx.fx.update(dt);
    if (ctx.fx.isFrozen()) return;
    ctx.scheduler.tick(dt);
    ctx.particles.update(dt);
    machine.update(dt);
  },
  render() {
    const { x, y } = ctx.fx.shakeOffset();
    ctx.g.save();
    ctx.g.translate(x, y);
    machine.render();
    ctx.particles.render(ctx.g);
    ctx.fx.render(ctx.g);
    ctx.g.restore();
  },
});

const onVisibility = () => {
  if (document.visibilityState === 'hidden') {
    ctx.persist();
    ctx.audio.suspend();
  } else {
    ctx.audio.resume();
  }
};
const onPointerDown = () => ctx.audio.unlock();
const onPageHide = () => {
  ctx.persist();
  detach();
  loop.stop();
};
const onPageShow = (evt) => {
  if (evt.persisted) {
    attach();
    loop.start();
  }
};
function attach() {
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pagehide', onPageHide);
}
function detach() {
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('pointerdown', onPointerDown, true);
  window.removeEventListener('pagehide', onPageHide);
}
attach();
window.addEventListener('pageshow', onPageShow);

ctx.goto('loading', { keepRun: false });
loop.start();