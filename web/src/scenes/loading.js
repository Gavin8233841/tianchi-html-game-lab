import { deserialize } from '../core/save.js';

const RESTORABLE = ['dive', 'extract', 'mix', 'result'];

export const loading = {
  enter(ctx) {
    const raw = ctx.storage.load();
    const data = deserialize(raw);
    if (data && data.run && RESTORABLE.includes(data.scene)) {
      ctx.run = data.run;
      ctx.goto(data.scene, { keepRun: true, restored: true });
      return;
    }
    ctx.goto('tavern', { keepRun: false });
    if (raw !== null && !data) {
      const toast = document.createElement('p');
      toast.className = 'hint';
      toast.textContent = '存档损坏，已开新局';
      ctx.panel.append(toast);
      ctx.scheduler.after(2.5, () => toast.remove());
    }
  },
};