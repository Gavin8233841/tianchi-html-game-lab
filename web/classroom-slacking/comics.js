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
  {
    id: 'homework-airmail', title: '自动交作业', color: '#e6b1a8',
    pages: [
      { scene: 'homework-call', line: '老师：作业交到讲台。' },
      { scene: 'homework-fold', line: '同桌：试试我的自动投递。' },
      { scene: 'homework-flight', line: '「嗖——」' },
      { scene: 'homework-return', line: '老师：退件，名字没写。' },
    ],
  },
];

export function createComicState(collected) {
  const read = [];
  const unread = [];
  for (const [index, story] of COMIC_STORIES.entries()) {
    const group = Array.isArray(collected) && collected.includes(story.id) ? read : unread;
    group.push(index);
  }
  const [story, ...nextStories] = [...unread, ...read];
  return {
    open: 0, story, nextStories, page: 0, endingTime: 0, finished: false, catches: 0, packing: 0,
    collected: read.map((index) => COMIC_STORIES[index].id),
  };
}

export function comicEnding(comic) {
  return comic.page === COMIC_STORIES[comic.story].pages.length - 1;
}

export function canFlipComicForward(comic) {
  return !comicEnding(comic) || (comic.finished && comic.nextStories.length > 0);
}

export function comicConfiscated(comic) {
  return comic.catches >= 2;
}
