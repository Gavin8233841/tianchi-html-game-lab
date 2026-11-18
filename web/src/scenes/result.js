const WISH_DONE = {
  relief: '烦恼溶进酒里，今晚好眠。',
  fun: '这一口下去，星星都在舌尖炸开！',
};
const WISH_HALF = {
  relief: '酒是淡了点，但烦恼也淡了点。',
  fun: '乐子找着一半，下次挖深点。',
};

export const result = {
  enter(ctx) {
    const run = ctx.run;
    const s = run.settlement;
    const title = document.createElement('h2');
    title.textContent = s.fulfilled ? '愿望达成！' : '愿望打折……';
    const wishLine = document.createElement('p');
    wishLine.textContent = s.fulfilled ? WISH_DONE[run.wish] : WISH_HALF[run.wish];
    const detail = document.createElement('p');
    const percent = Math.round(s.completion * 100);
    detail.textContent = s.fulfilled
      ? `完成度 ${percent}%，这杯免单！`
      : `完成度 ${percent}%，原价 100 币，折后价 ${s.price} 币。`;
    const surplus = document.createElement('p');
    surplus.textContent = `余料卖钱：水 ${s.surplusWater}ml × 1 + 星尘 ${s.surplusStardust}g × 5 = ${s.coins} 币（钱包只显示，暂不消费）。`;
    ctx.panel.append(title, wishLine, detail, surplus);
    if (run.status === 'settled' && run.shield <= 0) {
      const fallen = document.createElement('p');
      fallen.className = 'hint';
      fallen.textContent = '（这次是扶着墙回来的……已存原料保住了，身上带的全丢了。）';
      ctx.panel.append(fallen);
    }
    const again = document.createElement('button');
    again.type = 'button';
    again.textContent = '再来一局';
    again.addEventListener('click', () => {
      again.disabled = true;
      ctx.goto('tavern', { keepRun: false });
    });
    ctx.panel.append(again);
  },
};