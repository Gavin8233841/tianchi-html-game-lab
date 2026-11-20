import { COMIC, COMIC_STORIES, comicEnding } from './comics.js';

const ink = '#393245';
const uniforms = { lead: '#5379a8', mate: '#d88156', monitor: '#6f986e', teacher: '#846792' };

function text(ctx, value, x, y, size, color = ink, align = 'center') {
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px Microsoft YaHei, PingFang SC, sans-serif`;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

function oval(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function character(ctx, x, y, role, mood = 'calm') {
  const powdered = mood === 'dust';
  ctx.save();
  ctx.translate(x, y);
  oval(ctx, 0, 38, 30, 24, powdered ? '#cbc8bd' : uniforms[role]);
  oval(ctx, 0, 4, 25, 25, powdered ? '#e2dfd5' : '#f8d39e');
  oval(ctx, 0, -9, 25, 13, powdered ? '#d2cec5' : ink);
  if (role === 'monitor') {
    ctx.fillStyle = '#f0d16a';
    ctx.fillRect(15, -13, 9, 4);
  }
  oval(ctx, -9, 6, 2.6, mood === 'shock' ? 5 : 3.2, ink);
  oval(ctx, 9, 6, 2.6, mood === 'shock' ? 5 : 3.2, ink);
  oval(ctx, 0, 16, mood === 'shock' ? 7 : 5, mood === 'shock' ? 6 : 2, ink);
  if (role === 'teacher') {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(-17, 0, 14, 11);
    ctx.strokeRect(3, 0, 14, 11);
    ctx.fillRect(-3, 4, 6, 2);
  }
  ctx.restore();
}

function prop(ctx, x, y, width, height, color, label) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  if (label) text(ctx, label, x + width / 2, y + height / 2 + 5, 14);
}

function board(ctx, label) {
  prop(ctx, 17, 35, 154, 73, '#47796c');
  text(ctx, label, 94, 77, 26, '#fff4cf');
}

function dustCloud(ctx, x, y, color) {
  for (const [dx, dy, radius] of [[-48, 12, 24], [-22, 1, 34], [9, -11, 29], [34, 5, 26], [57, 26, 17]]) {
    oval(ctx, x + dx, y + dy, radius, radius, color);
  }
}

function paperPlane(ctx, x, y, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#fff9e8';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-38, -17);
  ctx.lineTo(41, 0);
  ctx.lineTo(-27, 23);
  ctx.lineTo(-15, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-15, 6);
  ctx.lineTo(41, 0);
  ctx.stroke();
  ctx.restore();
}

const panels = {
  quiz(ctx) {
    board(ctx, '③ = ？');
    character(ctx, 223, 71, 'teacher');
  },
  book(ctx) {
    character(ctx, 64, 79, 'lead', 'shock');
    character(ctx, 226, 75, 'mate');
    prop(ctx, 103, 69, 94, 46, '#f6db83', '标准答案');
  },
  sneak(ctx) {
    character(ctx, 65, 68, 'teacher');
    prop(ctx, 102, 90, 111, 42, '#f6db83', '标准答案');
    character(ctx, 247, 90, 'lead', 'shock');
  },
  menu(ctx) {
    prop(ctx, 36, 34, 186, 87, '#fff3ca');
    text(ctx, '食堂菜单', 129, 59, 20);
    text(ctx, '红烧肉 ✓    鸡腿 ✓', 129, 82, 14, '#93413c');
    text(ctx, '全都选 ✓', 129, 103, 15, '#93413c');
    character(ctx, 256, 86, 'lead', 'shock');
  },
  watch(ctx) {
    prop(ctx, 18, 37, 64, 94, '#afcaaf', '走廊');
    character(ctx, 131, 76, 'mate');
    character(ctx, 224, 85, 'lead');
  },
  snack(ctx) {
    character(ctx, 81, 79, 'lead');
    prop(ctx, 132, 51, 58, 69, '#e89960', '辣条');
    character(ctx, 229, 81, 'mate');
  },
  cough(ctx) {
    character(ctx, 87, 82, 'lead', 'shock');
    character(ctx, 207, 84, 'mate', 'shock');
    text(ctx, '咳！', 154, 61, 32, '#a34447');
  },
  spicy(ctx) {
    character(ctx, 67, 81, 'lead', 'shock');
    character(ctx, 212, 84, 'mate', 'shock');
    prop(ctx, 112, 76, 54, 50, '#e89960', '辣条');
    text(ctx, '辣！', 246, 59, 28, '#c44e3a');
  },
  board(ctx) {
    board(ctx, '值 日 表');
    character(ctx, 228, 79, 'monitor');
  },
  eraser(ctx) {
    board(ctx, '∠ ABC');
    character(ctx, 211, 77, 'lead');
    prop(ctx, 151, 89, 37, 19, '#ddae68');
  },
  cloud(ctx) {
    board(ctx, '……');
    dustCloud(ctx, 148, 82, '#eeeae0');
    text(ctx, '呼——', 148, 92, 31, '#746679');
  },
  dust(ctx) {
    dustCloud(ctx, 110, 87, '#ebe7dc');
    character(ctx, 104, 80, 'lead', 'dust');
    character(ctx, 225, 79, 'monitor', 'shock');
    prop(ctx, 147, 99, 36, 18, '#ddae68');
  },
  'homework-call'(ctx) {
    board(ctx, '交作业');
    character(ctx, 228, 68, 'teacher');
    prop(ctx, 189, 109, 78, 21, '#c88455');
    prop(ctx, 200, 102, 34, 8, '#f5e6bd');
  },
  'homework-fold'(ctx) {
    character(ctx, 60, 83, 'lead', 'shock');
    character(ctx, 229, 80, 'mate');
    prop(ctx, 98, 103, 106, 24, '#bd895c');
    paperPlane(ctx, 151, 94, -0.3);
  },
  'homework-flight'(ctx) {
    character(ctx, 68, 103, 'lead');
    character(ctx, 256, 76, 'teacher', 'shock');
    ctx.strokeStyle = '#a3564f';
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(74, 79);
    ctx.quadraticCurveTo(117, 37, 160, 53);
    ctx.stroke();
    ctx.setLineDash([]);
    paperPlane(ctx, 175, 59, 0.14);
  },
  'homework-return'(ctx) {
    character(ctx, 66, 89, 'lead', 'shock');
    character(ctx, 246, 72, 'teacher');
    paperPlane(ctx, 150, 76, Math.PI + 0.24);
    prop(ctx, 110, 99, 94, 28, '#ffc5ab', '退件 · 补名字');
  },
};

export function drawComicPage(ctx, story, index, left = 0, top = 0, scale = 1, concealed = false) {
  const { width, height } = COMIC;
  ctx.save();
  ctx.translate(left, top);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fff2d5';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);
  ctx.fillStyle = story.color;
  ctx.fillRect(1, 1, width - 2, 24);
  text(ctx, story.title, 11, 18, 14, ink, 'left');
  text(ctx, `${index + 1}/${story.pages.length}`, width - 10, 18, 13, ink, 'right');
  if (concealed) {
    prop(ctx, 18, 38, width - 36, 93, '#d5aa73');
    text(ctx, '↧', width / 2, 106, 44);
    text(ctx, '再往下拉一点', width / 2, 154, 16);
  } else {
    const page = story.pages[index];
    ctx.save();
    ctx.beginPath();
    ctx.rect(2, 27, width - 4, 111);
    ctx.clip();
    panels[page.scene](ctx);
    ctx.restore();
    ctx.fillStyle = '#f5e2b9';
    ctx.fillRect(1, 138, width - 2, 33);
    text(ctx, page.line, width / 2, 160, 17);
  }
  ctx.restore();
}

export function drawComicOnDesk(ctx, comic, availableWidth) {
  const story = COMIC_STORIES[comic.story];
  if (comic.open < COMIC.openForPage) {
    ctx.save();
    ctx.translate(COMIC.x, COMIC.y + 18 - comic.open * 16);
    prop(ctx, -78, -43, 156, 85, story.color, story.title);
    ctx.fillStyle = '#c05b51';
    ctx.fillRect(48, -44, 12, 31);
    text(ctx, comic.page > 0 ? `书签 ${comic.page + 1}/4 · ↓` : '↓', 0, 29, 13);
    ctx.restore();
    return;
  }
  const scale = Math.min(1, (availableWidth - 16) / COMIC.width);
  const left = COMIC.x - COMIC.width * scale / 2;
  const top = COMIC.y - COMIC.height * scale / 2 + (comic.open - COMIC.openForPage) * 22;
  const concealed = comicEnding(comic) && comic.open < COMIC.openForEnding && !comic.finished;
  drawComicPage(ctx, story, comic.page, left, top, scale, concealed);
}
