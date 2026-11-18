import { applyAction } from '../core/rules.js';

const WISH_TEXT = {
  relief: '买醉解忧',
  fun: '喝酒找乐',
};

export const mix = {
  enter(ctx) {
    let run = ctx.run;
    if (run.status === 'emergency') {
      run = applyAction(run, { type: 'extract' }).state;
      ctx.commitRun(run);
    }
    const title = document.createElement('h2');
    title.textContent = '回到酒馆';
    const story = document.createElement('p');
    if (run.status === 'dead') {
      story.textContent = '你在矿区倒下了……背上的原料散了一地。好在酒馆老板认账：已存好的原料还在，照样给你调这一杯。';
    } else if (run.settlement === null && run.stored.water + run.stored.stardust === 0) {
      story.textContent = '你两手空空地回来了。老板耸耸肩，还是摇起了壶。';
    } else {
      story.textContent = `老板接过你存好的原料——水 ${run.stored.water}ml、星尘 ${run.stored.stardust}g，开始为你调「${WISH_TEXT[run.wish]}」。`;
    }
    const mixing = document.createElement('p');
    mixing.className = 'hint';
    mixing.textContent = '摇壶中……';
    ctx.panel.append(title, story, mixing);
    ctx.audio.startShake();
    ctx.scheduler.after(1.2, () => {
      ctx.audio.stopShake();
      const { state, effects } = applyAction(ctx.run, { type: 'settle' });
      if (effects.some((e) => e.type === 'rejected')) return;
      ctx.commitRun(state);
      ctx.goto('result');
    });
  },
};