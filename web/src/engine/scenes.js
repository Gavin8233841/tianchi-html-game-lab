export function cleanupGameState(ctx, { keepRun = true } = {}) {
  ctx.scheduler.clear();
  if (ctx.particles) ctx.particles.clear();
  if (ctx.fx) ctx.fx.clear();
  if (ctx.audio) ctx.audio.stopShake();
  ctx.input.unlock();
  ctx.hud.clear();
  ctx.panel.replaceChildren();
  ctx.canvas.style.display = 'none';
  if (!keepRun) ctx.run = null;
}

export function createSceneMachine({ scenes, ctx }) {
  let current = null;
  let name = null;
  ctx.goto = (target, opts = {}) => {
    if (opts.keepRun === false && target === 'tavern' && ctx.storage) ctx.storage.clear();
    cleanupGameState(ctx, { keepRun: opts.keepRun !== false });
    if (current && current.exit) current.exit(ctx);
    name = target;
    ctx.currentSceneName = name;
    current = scenes[target];
    if (current.enter) current.enter(ctx);
    if (ctx.persist) ctx.persist();
  };
  return {
    get name() { return name; },
    update(dt) { if (current && current.update) current.update(ctx, dt); },
    render() { if (current && current.render) current.render(ctx); },
    onPointer(evt) { if (current && current.onPointer) current.onPointer(ctx, evt); },
  };
}