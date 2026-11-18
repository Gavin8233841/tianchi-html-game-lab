import { createLoop, createScheduler } from './engine/loop.js';
import { createSceneMachine } from './engine/scenes.js';
import { createInput } from './engine/input.js';
import { createHud } from './ui/hud.js';
import { loading } from './scenes/loading.js';
import { tavern } from './scenes/tavern.js';
import { dive } from './scenes/dive.js';
import { extract } from './scenes/extract.js';
import { mix } from './scenes/mix.js';
import { result } from './scenes/result.js';

const canvas = document.getElementById('game');
const panel = document.getElementById('panel');
const hudRoot = document.getElementById('hud');

const seedParam = new URLSearchParams(location.search).get('seed');
const ctx = {
  canvas,
  g: canvas.getContext('2d'),
  panel,
  hud: createHud(hudRoot),
  scheduler: createScheduler(),
  run: null,
  debugSeed: seedParam !== null && Number.isFinite(Number(seedParam)) ? Number(seedParam) >>> 0 : null,
  goto: null,
  input: null,
};

const machine = createSceneMachine({
  scenes: { loading, tavern, dive, extract, mix, result },
  ctx,
});
ctx.input = createInput({ canvas, onPointer: (evt) => machine.onPointer(evt) });

const loop = createLoop({
  update(dt) {
    ctx.scheduler.tick(dt);
    machine.update(dt);
  },
  render() { machine.render(); },
});

ctx.goto('loading', { keepRun: false });
loop.start();