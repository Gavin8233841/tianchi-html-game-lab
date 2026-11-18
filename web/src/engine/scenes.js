export function cleanupGameState(ctx, { keepRun = true } = {}) {
  ctx.scheduler.clear();
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
    cleanupGameState(ctx, { keepRun: opts.keepRun !== false });
    if (current && current.exit) current.exit(ctx);
    name = target;
    current = scenes[target];
    if (current.enter) current.enter(ctx);
  };
  return {
    get name() { return name; },
    update(dt) { if (current && current.update) current.update(ctx, dt); },
    render() { if (current && current.render) current.render(ctx); },
    onPointer(evt) { if (current && current.onPointer) current.onPointer(ctx, evt); },
  };
}