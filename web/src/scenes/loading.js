export const loading = {
  enter(ctx) {
    ctx.goto('tavern', { keepRun: false });
  },
};