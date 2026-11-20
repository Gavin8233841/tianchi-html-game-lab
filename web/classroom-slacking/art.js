import { LESSONS, MEMORIES } from './core.js';
import { HANDHELD, NOTE, PAPER, PLANE_FLIGHT, PLANE_FOLDS, SNACK, SPIN } from './desk-actions.js';

export const LOGICAL_W = 960;
export const LOGICAL_H = 640;

const palette = {
  ink: '#21343a', chalk: '#e8eed9', board: '#285d4e', boardEdge: '#7a5a38',
  wall: '#d9e2d5', floor: '#91a69f', desk: '#754a2d', deskLight: '#9b6741',
  skin: '#e5ad83', sleeve: '#315f79', danger: '#c84436', yellow: '#f1ca55',
};

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export function viewportFor(width, height) {
  const scale = height / LOGICAL_H;
  return {
    scale,
    offsetX: (width - LOGICAL_W * scale) / 2,
    offsetY: (height - LOGICAL_H * scale) / 2,
  };
}

export function toLogicalPoint(clientX, clientY, rect) {
  const view = viewportFor(rect.width, rect.height);
  return {
    x: (clientX - rect.left - view.offsetX) / view.scale,
    y: (clientY - rect.top - view.offsetY) / view.scale,
  };
}

function drawWall(ctx, lessonIndex, time) {
  const lesson = LESSONS[lessonIndex] || LESSONS[0];
  const wallColors = { morning: '#dce6d8', noon: '#d8e4dc', dusk: '#d5d4c8' };
  ctx.fillStyle = wallColors[lesson.light];
  ctx.fillRect(0, 0, LOGICAL_W, 390);
  ctx.fillStyle = '#c4d3cb';
  ctx.fillRect(0, 332, LOGICAL_W, 15);
  ctx.fillStyle = palette.floor;
  ctx.fillRect(0, 347, LOGICAL_W, 293);
  ctx.strokeStyle = 'rgb(255 255 255 / 24%)';
  ctx.lineWidth = 2;
  for (let y = 365; y < 640; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(LOGICAL_W, y + 4);
    ctx.stroke();
  }

  ctx.fillStyle = '#f2ecda';
  ctx.fillRect(0, 0, LOGICAL_W, 31);
  ctx.fillStyle = '#6d7c75';
  ctx.font = '700 12px Microsoft YaHei, sans-serif';
  ctx.fillText('好好学习', 26, 21);
  ctx.fillText('天天向上', 875, 21);

  ctx.save();
  ctx.translate(480, 21);
  ctx.fillStyle = '#fffdf2';
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#53625d';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.rotate((time * 0.04) % (Math.PI * 2));
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -13);
  ctx.moveTo(0, 0);
  ctx.lineTo(9, 4);
  ctx.stroke();
  ctx.restore();
}

function drawBoard(ctx, lessonIndex) {
  ctx.fillStyle = palette.boardEdge;
  roundedRect(ctx, 78, 49, 652, 286, 9);
  ctx.fill();
  ctx.fillStyle = palette.board;
  roundedRect(ctx, 91, 60, 626, 260, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgb(229 241 221 / 14%)';
  ctx.lineWidth = 2;
  for (let x = 130; x < 700; x += 98) {
    ctx.beginPath();
    ctx.moveTo(x, 70);
    ctx.lineTo(x + 25, 310);
    ctx.stroke();
  }
  ctx.fillStyle = palette.chalk;
  ctx.font = '24px KaiTi, STKaiti, serif';
  if (lessonIndex === 0) {
    ctx.fillText('y = ax² + bx + c', 125, 118);
    ctx.fillText('∠A + ∠B + ∠C = 180°', 145, 168);
    ctx.strokeStyle = palette.chalk;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(478, 105);
    ctx.lineTo(554, 212);
    ctx.lineTo(625, 105);
    ctx.closePath();
    ctx.stroke();
  } else if (lessonIndex === 1) {
    ctx.font = '30px KaiTi, STKaiti, serif';
    ctx.fillText('背影', 132, 126);
    ctx.font = '21px KaiTi, STKaiti, serif';
    ctx.fillText('我与父亲不相见已二年余了……', 132, 176);
    ctx.fillText('全班背诵，随机抽查。', 366, 258);
  } else {
    ctx.font = '34px KaiTi, STKaiti, serif';
    ctx.fillText('自 习', 136, 132);
    ctx.font = '22px KaiTi, STKaiti, serif';
    ctx.fillText('保持安静', 139, 182);
    ctx.fillText('班长记名', 500, 250);
  }
  ctx.fillStyle = '#d9e7d3';
  ctx.fillRect(112, 315, 24, 4);
  ctx.fillStyle = '#e7b9a1';
  ctx.fillRect(145, 314, 16, 5);
}

function drawWindows(ctx, lessonIndex, corridor, time) {
  const sky = ['#8ed0e0', '#77c6df', '#e2aa7e'][lessonIndex] || '#8ed0e0';
  ctx.fillStyle = '#58736f';
  ctx.fillRect(752, 52, 174, 304);
  ctx.fillStyle = sky;
  ctx.fillRect(765, 65, 148, 278);
  ctx.fillStyle = 'rgb(255 255 255 / 72%)';
  ctx.fillRect(765, 121, 148, 7);
  ctx.fillRect(834, 65, 7, 278);
  const sunX = lessonIndex === 2 ? 870 : 886;
  const sunY = lessonIndex === 2 ? 105 : 91;
  ctx.fillStyle = lessonIndex === 2 ? '#ef9a64' : '#f5e19b';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 23, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5e9387';
  ctx.fillRect(765, 272, 148, 71);
  ctx.fillStyle = '#477d73';
  for (let x = 773; x < 910; x += 23) ctx.fillRect(x, 245 + (x % 4) * 3, 16, 98);
  ctx.strokeStyle = 'rgb(255 255 255 / 36%)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(770, 82 + Math.sin(time) * 2);
  ctx.lineTo(906, 235 + Math.sin(time) * 2);
  ctx.stroke();

  if (corridor > 0.01) {
    ctx.save();
    ctx.globalAlpha = corridor;
    const x = 926 - corridor * 83;
    ctx.fillStyle = '#253437';
    ctx.beginPath();
    ctx.arc(x, 178, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 23, 199, 46, 99);
    ctx.fillStyle = '#e0aa82';
    ctx.beginPath();
    ctx.arc(x, 181, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#202728';
    ctx.fillRect(x - 10, 177, 5, 4);
    ctx.fillRect(x + 5, 177, 5, 4);
    ctx.restore();
  }
}

function drawPoster(ctx) {
  ctx.fillStyle = '#eee2bb';
  ctx.fillRect(18, 72, 46, 119);
  ctx.strokeStyle = '#af8d59';
  ctx.strokeRect(18, 72, 46, 119);
  ctx.fillStyle = '#bb4b3d';
  ctx.font = '700 17px KaiTi, serif';
  [...'文明班级'].forEach((char, index) => ctx.fillText(char, 31, 96 + index * 22));
  ctx.fillStyle = '#dfe8dc';
  ctx.fillRect(20, 216, 44, 88);
  ctx.fillStyle = '#47756c';
  ctx.font = '700 12px Microsoft YaHei, sans-serif';
  ctx.fillText('值日表', 25, 235);
  for (let y = 246; y < 293; y += 12) ctx.fillRect(26, y, 30, 2);
}

function drawStudent(ctx, x, y, scale, shirt, turned = 0, bob = 0) {
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#6b4e36';
  ctx.fillRect(-43, 53, 86, 11);
  ctx.fillStyle = shirt;
  roundedRect(ctx, -27, 13, 54, 51, 11);
  ctx.fill();
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(turned * 9, 0, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2d2827';
  ctx.beginPath();
  ctx.arc(turned * 9, -7, 21, Math.PI, Math.PI * 2);
  ctx.fill();
  if (turned > 0.4) {
    ctx.fillStyle = '#22292a';
    ctx.fillRect(5, -2, 4, 4);
    ctx.fillRect(15, -2, 4, 4);
  }
  ctx.restore();
}

function drawTeacher(ctx, turn, time, event, speech) {
  const pace = Math.sin(time * 0.55) * 9;
  ctx.save();
  ctx.translate(628 + pace, 260 + Math.sin(time * 2.2) * 2);
  ctx.fillStyle = '#273b4b';
  ctx.fillRect(-31, 51, 18, 87);
  ctx.fillRect(13, 51, 18, 87);
  ctx.fillStyle = '#35749c';
  roundedRect(ctx, -44, -13, 88, 80, 13);
  ctx.fill();
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(0, -43, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#242322';
  ctx.beginPath();
  ctx.arc(0, -51, 31, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-30, -51, 60, 11);
  if (turn > 0.38) {
    ctx.fillStyle = '#1b2221';
    ctx.fillRect(-14, -44, 6, 5);
    ctx.fillRect(8, -44, 6, 5);
    ctx.strokeStyle = '#7f4736';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -28);
    ctx.lineTo(8, -28);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#242322';
    ctx.fillRect(-26, -53, 52, 16);
  }
  ctx.save();
  ctx.rotate(-0.7 + turn * 0.95);
  ctx.fillStyle = '#35749c';
  roundedRect(ctx, 29, -4, 76, 16, 7);
  ctx.fill();
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(106, 4, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (event === 'question') {
    ctx.fillStyle = '#fff8db';
    roundedRect(ctx, -72, -105, 144, 36, 10);
    ctx.fill();
    ctx.fillStyle = '#3b4a49';
    ctx.font = '800 17px Microsoft YaHei, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('你来回答。', 0, -81);
    ctx.textAlign = 'left';
  }
  if (speech?.timer > 0) {
    ctx.fillStyle = '#fff8db';
    roundedRect(ctx, -126, -150, 252, 38, 10);
    ctx.fill();
    ctx.fillStyle = '#3b4a49';
    ctx.font = '800 14px Microsoft YaHei, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(speech.text, 0, -126);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function drawRoom(ctx, scene) {
  const { state, time, teacherTurn, corridorPresence, monitorTurn } = scene;
  const lessonIndex = state?.lessonIndex || 0;
  drawWall(ctx, lessonIndex, time);
  drawPoster(ctx);
  drawBoard(ctx, lessonIndex);
  drawWindows(ctx, lessonIndex, corridorPresence, time);
  const laugh = state?.classEvent === 'laugh' ? Math.sin(time * 18) * 4 : 0;
  drawStudent(ctx, 100, 369, 0.72, '#d39a3d', 0, laugh);
  drawStudent(ctx, 352, 365, 0.76, '#4e8d70', 0, -laugh);
  drawStudent(ctx, 520, 377, 0.7, '#755ea1', 0, laugh);
  drawStudent(ctx, 756, 374, 0.75, '#d77950', 0, -laugh);
  drawStudent(ctx, 205, 386, 0.9, '#b84f4d', monitorTurn);
  drawTeacher(ctx, teacherTurn, time, state?.classEvent, { text: state?.speechText, timer: state?.speechTimer });

  if (state?.classEvent === 'chalk') {
    const p = 1 - state.classEventTimer / 1.8;
    ctx.save();
    ctx.translate(630 - p * 330, 235 + Math.sin(p * Math.PI) * -110);
    ctx.rotate(p * 16);
    ctx.fillStyle = '#f2e9bd';
    ctx.fillRect(-10, -3, 20, 6);
    ctx.restore();
  }
  if (state?.classEvent === 'fake-bell') {
    ctx.fillStyle = '#f8e8b3';
    ctx.font = '900 34px KaiTi, serif';
    ctx.fillText('叮？', 840, 42);
  }
}

function drawNotebook(ctx, scene) {
  const { state, doodleStrokes } = scene;
  ctx.save();
  ctx.translate(480, 552);
  ctx.fillStyle = palette.desk;
  roundedRect(ctx, -425, -55, 850, 205, 12);
  ctx.fill();
  ctx.fillStyle = palette.deskLight;
  ctx.fillRect(-425, -38, 850, 17);
  ctx.fillStyle = '#4d2f20';
  ctx.fillRect(-352, 82, 704, 7);
  ctx.fillStyle = '#f4edd5';
  roundedRect(ctx, -250, -91, 500, 176, 7);
  ctx.fill();
  ctx.strokeStyle = '#9fc7d6';
  ctx.lineWidth = 1.4;
  for (let y = -62; y < 71; y += 23) {
    ctx.beginPath();
    ctx.moveTo(-229, y);
    ctx.lineTo(230, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#e6a2a2';
  ctx.beginPath();
  ctx.moveTo(-188, -85);
  ctx.lineTo(-188, 76);
  ctx.stroke();
  if ((!state || state.activeTool !== 'doodle') && !doodleStrokes?.length) {
    ctx.fillStyle = '#405a73';
    ctx.font = '20px KaiTi, STKaiti, serif';
    ctx.fillText('解：设函数的顶点为 P……', -166, -38);
    ctx.fillText('∵ a ＞ 0，∴ 开口向上', -166, -14);
    ctx.fillText('答：放学后再想。', -166, 32);
  }
  ctx.restore();

  if (doodleStrokes?.length) {
    ctx.save();
    roundedRect(ctx, PAPER.left, PAPER.top, PAPER.right - PAPER.left, PAPER.bottom - PAPER.top, 7);
    ctx.clip();
    ctx.strokeStyle = '#334d76';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const stroke of doodleStrokes) {
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let index = 1; index < stroke.length; index += 1) ctx.lineTo(stroke[index].x, stroke[index].y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawPlane(ctx) {
  ctx.fillStyle = '#f3f9ea';
  ctx.strokeStyle = '#668480';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-88, 24);
  ctx.lineTo(94, -36);
  ctx.lineTo(26, 40);
  ctx.lineTo(-10, 14);
  ctx.lineTo(-25, 35);
  ctx.lineTo(-29, 19);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-10, 14);
  ctx.lineTo(94, -36);
  ctx.stroke();
}

function drawFoldingPaper(ctx, folds) {
  ctx.save();
  ctx.translate(480, 520);
  if (folds === PLANE_FOLDS.length) {
    drawPlane(ctx);
    ctx.restore();
    return;
  }
  const width = 202 - folds * 29;
  ctx.fillStyle = '#f3f9ea';
  ctx.strokeStyle = '#668480';
  ctx.lineWidth = 2;
  roundedRect(ctx, -width / 2, -60, width, 120, 5);
  ctx.fill();
  ctx.stroke();

  for (let index = 0; index < folds; index += 1) {
    const direction = PLANE_FOLDS[index];
    ctx.fillStyle = index % 2 ? '#d4e4d9' : '#e3ebe0';
    ctx.beginPath();
    ctx.moveTo(direction * width / 2, -58 + index * 22);
    ctx.lineTo(direction * width / 2, 60);
    ctx.lineTo(0, index * 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  const direction = PLANE_FOLDS[folds];
  ctx.strokeStyle = '#54796b';
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.moveTo(-direction * 48, 0);
  ctx.lineTo(direction * 48, 0);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(direction * 32, -14);
  ctx.lineTo(direction * 48, 0);
  ctx.lineTo(direction * 32, 14);
  ctx.stroke();
  ctx.restore();
}

function drawFlyingPlane(ctx, flight) {
  const progress = 1 - flight.remaining / PLANE_FLIGHT[flight.mode].seconds;
  const far = flight.mode === 'far';
  ctx.save();
  ctx.translate(480 + (far ? 99 : -116) * progress, 520 - (far ? 240 : 102) * progress - 65 * Math.sin(Math.PI * progress));
  ctx.rotate((far ? -0.52 : -2.9) + 0.48 * progress);
  const scale = 0.9 - progress * (far ? 0.7 : 0.38);
  ctx.scale(scale, scale);
  drawPlane(ctx);
  ctx.restore();
}

function drawHandheld(ctx, game) {
  const { x, y, halfWidth, halfHeight, screenHalfWidth } = HANDHELD;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#253b50';
  roundedRect(ctx, -halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2, 16);
  ctx.fill();
  ctx.fillStyle = game.hit > 0 ? '#e7a471' : '#a6ce83';
  ctx.fillRect(-screenHalfWidth, -56, screenHalfWidth * 2, 112);
  ctx.strokeStyle = '#6c9a65';
  for (const x of [-24, 24]) {
    ctx.beginPath();
    ctx.moveTo(x, -35);
    ctx.lineTo(x, 51);
    ctx.stroke();
  }
  ctx.fillStyle = '#234c3e';
  ctx.font = '700 15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${game.dodged}/${HANDHELD.goal}`, 0, -40);
  ctx.fillRect((game.obstacle - 1) * 48 - 13, -32 + game.progress * 69, 26, 12);
  const player = (game.lane - 1) * 48;
  ctx.beginPath();
  ctx.moveTo(player, 29);
  ctx.lineTo(player + 13, 47);
  ctx.lineTo(player - 13, 47);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d2e0dd';
  ctx.fillText('◀', -94, 7);
  ctx.fillText('▶', 94, 7);
  ctx.restore();
}

function drawDeskArrow(ctx, x, y, length, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(length, 0);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(length - 11, -8);
  ctx.lineTo(length, 0);
  ctx.lineTo(length - 11, 8);
  ctx.stroke();
  ctx.restore();
}

function drawNote(ctx, note, drag) {
  const handoff = note.handoff > 0;
  const writing = !note.draft && !note.incoming && !handoff;
  const offset = handoff ? 88 + (1 - note.handoff / 0.38) * 63
    : note.draft && !note.incoming ? Math.min(88, Math.max(0, drag?.dx || 0)) : 0;
  if ((note.draft && !note.incoming) || handoff) {
    ctx.fillStyle = palette.skin;
    ctx.beginPath();
    ctx.ellipse(NOTE.x + 114, NOTE.y + 28, 38, 13, -0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(NOTE.x + offset, NOTE.y);
  ctx.rotate(handoff ? 0.12 : -0.04);
  const halfWidth = handoff ? 39 : NOTE.halfWidth;
  const halfHeight = handoff ? 20 : NOTE.halfHeight;
  ctx.fillStyle = note.incoming ? '#dcecbc' : '#fff2b8';
  ctx.strokeStyle = '#ad864e';
  ctx.lineWidth = 2;
  roundedRect(ctx, -halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2, 4);
  ctx.fill();
  ctx.stroke();
  if (handoff) {
    ctx.beginPath();
    ctx.moveTo(-halfWidth + 4, -halfHeight + 4);
    ctx.lineTo(0, 4);
    ctx.lineTo(halfWidth - 4, -halfHeight + 4);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#5d4537';
    ctx.textAlign = 'center';
    if (note.incoming) {
      ctx.font = '700 11px Microsoft YaHei, sans-serif';
      ctx.fillText('同桌回信', 0, -11);
    }
    ctx.font = '700 17px KaiTi, Microsoft YaHei, sans-serif';
    ctx.fillText(note.incoming || note.draft, 0, note.incoming ? 14 : 5, halfWidth * 2 - 15);
    if (writing) {
      ctx.strokeStyle = '#b6a072';
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.moveTo(-57, 4);
      ctx.lineTo(57, 4);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (note.draft && !note.incoming) drawDeskArrow(ctx, -21, 20, 44, 0, '#84703b');
  }
  ctx.restore();
  if (writing && drag) {
    ctx.strokeStyle = '#3e516e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(drag.point.x + 2, drag.point.y - 2);
    ctx.lineTo(drag.point.x + 20, drag.point.y - 26);
    ctx.stroke();
  }
}

function drawSnack(ctx, snack, drag) {
  const { x, y, sealY, bites } = SNACK;
  const lip = sealY - y;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#aa392d';
  roundedRect(ctx, -60, lip, 120, 111, 7);
  ctx.fill();
  ctx.fillStyle = '#d65136';
  roundedRect(ctx, -56, lip + 8, 112, 96, 7);
  ctx.fill();
  ctx.fillStyle = '#ffd77e';
  ctx.textAlign = 'center';
  ctx.font = '900 28px Microsoft YaHei, sans-serif';
  ctx.fillText('辣条', 0, 14);
  ctx.font = '700 12px Microsoft YaHei, sans-serif';
  ctx.fillText(`${bites - snack.bites} 根`, 0, 42);
  if (!snack.open && snack.crunch === 0) {
    ctx.fillStyle = '#ee985c';
    ctx.fillRect(-60 + Math.min(47, Math.max(0, drag?.dx || 0)), lip - 6, 120, 13);
    drawDeskArrow(ctx, -36, lip, 69, 0, '#73392a');
  } else if (snack.open) {
    ctx.fillStyle = '#532619';
    ctx.beginPath();
    ctx.ellipse(0, lip + 2, 55, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    if (snack.crunch === 0) {
      const lift = Math.min(83, Math.max(0, -(drag?.dy || 0)));
      drawDeskArrow(ctx, 24, lip - 10, 58, -Math.PI / 2, '#944920');
      ctx.fillStyle = '#e5803a';
      roundedRect(ctx, -7, lip - 23 - lift, 14, 33, 4);
      ctx.fill();
      ctx.fillStyle = '#b94523';
      ctx.fillRect(-2, lip - 18 - lift, 3, 19);
    }
  }
  if (snack.crunch > 0) {
    ctx.fillStyle = '#f5ab4d';
    for (const [dx, dy] of [[-15, -14], [12, -21], [21, -5]]) {
      ctx.fillRect(dx, lip - 67 + dy, 5, 4);
    }
  }
  ctx.restore();
}

function drawHands(ctx, scene) {
  const { state, time, spinAngle } = scene;
  const tool = state?.activeTool;
  const comic = state?.comicOpen || 0;
  const leftX = tool === 'comic' ? 350 - comic * 38 : tool === 'spin' ? 410 : 305;
  const rightX = tool === 'comic' ? 610 + comic * 38 : tool === 'spin' ? 550 : 655;
  const handY = tool === 'comic' ? 590 + comic * 10 : tool === 'doodle' && state?.inputActive ? 520 : 586;

  ctx.fillStyle = palette.sleeve;
  roundedRect(ctx, 66, 548, 224, 112, 38);
  ctx.fill();
  roundedRect(ctx, 670, 548, 224, 112, 38);
  ctx.fill();
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.ellipse(leftX, handY, 43, 26, -0.18, 0, Math.PI * 2);
  ctx.ellipse(rightX, handY, 43, 26, 0.18, 0, Math.PI * 2);
  ctx.fill();

  if (tool === 'spin') {
    ctx.save();
    ctx.translate(SPIN.x, SPIN.y);
    const warning = state.watchers.some((watcher) => watcher.mode === 'warn');
    const riskColor = warning || state.suspicion >= 60 ? '#db614e' : '#8d632d';
    ctx.strokeStyle = riskColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, SPIN.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (state.inputActive) {
      const progress = state.spinTurnBuffer;
      const start = spinAngle - progress * Math.PI * 2;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, SPIN.radius, start, spinAngle, progress < 0);
      ctx.stroke();
    }
    ctx.rotate(spinAngle + (warning && state.inputActive ? Math.sin(time * 32) * 0.1 : 0));
    ctx.fillStyle = '#254d90';
    roundedRect(ctx, -102, -6, 204, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#e7b941';
    ctx.fillRect(69, -6, 25, 12);
    ctx.restore();
  } else if (tool === 'doodle' && state?.inputActive) {
    ctx.save();
    ctx.translate(rightX - 20, handY - 20);
    ctx.rotate(-0.75);
    ctx.fillStyle = '#315d9a';
    roundedRect(ctx, -6, -55, 12, 110, 6);
    ctx.fill();
    ctx.restore();
  } else if (tool === 'note') {
    drawNote(ctx, state.note, scene.deskDrag);
  } else if (tool === 'snack') {
    drawSnack(ctx, state.snack, scene.deskDrag);
  } else if (tool === 'plane' && !state.planeFlight) {
    drawFoldingPaper(ctx, state.planeFolds);
  } else if (tool === 'console') {
    drawHandheld(ctx, state.handheld);
  }
}

function drawComicDrawer(ctx, scene) {
  const open = scene.state?.comicOpen || 0;
  if (open <= 0.01 && scene.state?.activeTool !== 'comic') return;
  const y = 520 + open * 94;
  ctx.save();
  ctx.fillStyle = '#3c281d';
  roundedRect(ctx, 265, y - 26, 430, 142, 11);
  ctx.fill();
  ctx.fillStyle = '#543a29';
  ctx.fillRect(285, y - 12, 390, 101);
  ctx.fillStyle = '#f2d4a9';
  ctx.fillRect(338, y - 74, 138, 158);
  ctx.fillRect(484, y - 74, 138, 158);
  ctx.strokeStyle = '#3f3a43';
  ctx.lineWidth = 4;
  ctx.strokeRect(338, y - 74, 138, 158);
  ctx.strokeRect(484, y - 74, 138, 158);
  ctx.fillStyle = '#db553f';
  ctx.font = '900 34px Microsoft YaHei, sans-serif';
  ctx.fillText('咚!', 365, y - 24);
  ctx.strokeStyle = '#354e70';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(550, y - 22, 25, 0, Math.PI * 2);
  ctx.moveTo(550, y + 3);
  ctx.lineTo(550, y + 49);
  ctx.moveTo(550, y + 16);
  ctx.lineTo(517, y + 36);
  ctx.moveTo(550, y + 16);
  ctx.lineTo(586, y + 31);
  ctx.stroke();
  ctx.fillStyle = '#c7a06c';
  roundedRect(ctx, 420, y + 88, 120, 16, 8);
  ctx.fill();
  ctx.restore();
}

function drawDanger(ctx, scene) {
  const looking = scene.state?.watchers?.some((watcher) => watcher.mode === 'look');
  if (!looking) return;
  const vignette = ctx.createRadialGradient(480, 350, 135, 480, 350, 570);
  vignette.addColorStop(0, 'rgb(182 43 31 / 0%)');
  vignette.addColorStop(1, 'rgb(158 32 25 / 52%)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
}

export function renderClassroom(ctx, width, height, scene) {
  const view = viewportFor(width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  const shake = scene.shake > 0 ? scene.shake * 8 : 0;
  ctx.translate(
    view.offsetX + (Math.random() - 0.5) * shake,
    view.offsetY + (Math.random() - 0.5) * shake,
  );
  ctx.scale(view.scale, view.scale);
  drawRoom(ctx, scene);
  drawNotebook(ctx, scene);
  drawComicDrawer(ctx, scene);
  drawHands(ctx, scene);
  if (scene.state?.planeFlight) drawFlyingPlane(ctx, scene.state.planeFlight);
  drawDanger(ctx, scene);
  ctx.restore();
}

export function drawShareCard(ctx, result) {
  const { nickname, score, rank, memories = [] } = result;
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
  gradient.addColorStop(0, '#d8e4d9');
  gradient.addColorStop(1, '#8ba9a0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = '#285d4e';
  ctx.fillRect(70, 72, 940, 310);
  ctx.fillStyle = '#f0ead7';
  ctx.font = '700 44px Microsoft YaHei, sans-serif';
  ctx.fillText('初中 · 今日课堂记录', 116, 142);
  ctx.font = '900 82px KaiTi, STKaiti, serif';
  ctx.fillText('课桌下的宇宙', 112, 252);
  ctx.fillStyle = '#f0ca55';
  ctx.font = '900 42px Microsoft YaHei, sans-serif';
  ctx.fillText(nickname, 116, 334);

  ctx.fillStyle = '#f7f1de';
  roundedRect(ctx, 70, 416, 940, 570, 20);
  ctx.fill();
  ctx.fillStyle = '#263d42';
  ctx.font = '800 42px Microsoft YaHei, sans-serif';
  ctx.fillText('脑洞值', 126, 514);
  ctx.fillStyle = '#c84e3b';
  ctx.font = '900 178px Arial, sans-serif';
  ctx.fillText(Number(score).toLocaleString('zh-CN'), 118, 710);
  ctx.fillStyle = '#294e49';
  ctx.font = '700 48px KaiTi, STKaiti, serif';
  ctx.fillText(rank, 128, 795);

  const unlocked = MEMORIES.filter((memory) => memories.includes(memory.id));
  unlocked.forEach((memory, index) => {
    const x = 138 + index * 155;
    ctx.fillStyle = index % 2 ? '#78a68d' : '#e1b54e';
    ctx.beginPath();
    ctx.arc(x, 900, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffbea';
    ctx.textAlign = 'center';
    ctx.font = '900 48px Microsoft YaHei, sans-serif';
    ctx.fillText(memory.mark, x, 918);
  });
  ctx.textAlign = 'left';
  ctx.fillStyle = '#586d69';
  ctx.font = '600 28px Microsoft YaHei, sans-serif';
  ctx.fillText('老师转身以后，一节课可以很长。', 126, 958);
}
