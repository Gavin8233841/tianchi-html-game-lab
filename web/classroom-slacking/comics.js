export const COMIC = Object.freeze({
  x: 480, y: 512, width: 300, height: 172,
  openForPage: 0.46, openForEnding: 0.88, endingSeconds: 0.7, bonus: 140,
});

export const COMIC_STORIES = [
  {
    id: 'answer-key', title: '标准答案', color: '#e7cc8d',
    pages: [
      { scene: 'quiz', line: '老师：最后一题，独立完成。' },
      { scene: 'book', line: '同桌：给你看标准答案。' },
      { scene: 'sneak', line: '趁老师转身……' },
      { scene: 'menu', line: '同桌：今天食堂的。' },
    ],
  },
  {
    id: 'hallway-guard', title: '走廊哨兵', color: '#adcfaa',
    pages: [
      { scene: 'watch', line: '同桌：老师来了就咳一声。' },
      { scene: 'snack', line: '主角：那我开袋了。' },
      { scene: 'cough', line: '「咳！咳！咳！」' },
      { scene: 'spicy', line: '同桌：我只是吃到辣的了。' },
    ],
  },
  {
    id: 'clean-board', title: '今天谁值日', color: '#b8c9e5',
    pages: [
      { scene: 'board', line: '班长：黑板也要擦干净。' },
      { scene: 'eraser', line: '主角：交给我！' },
      { scene: 'cloud', line: '「呼——」' },
      { scene: 'dust', line: '班长：现在谁来擦你？' },
    ],
  },
];

export function createComicState(collected) {
  return {
    open: 0, story: 0, page: 0, endingTime: 0, finished: false, catches: 0, packing: 0,
    collected: COMIC_STORIES.filter((story) => Array.isArray(collected) && collected.includes(story.id)).map((story) => story.id),
  };
}

export function comicEnding(comic) {
  return comic.page === COMIC_STORIES[comic.story].pages.length - 1;
}

export function comicConfiscated(comic) {
  return comic.catches >= 2;
}
