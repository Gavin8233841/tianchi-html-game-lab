import {
  DISTRACTIONS,
  LESSONS,
  MAX_STRIKES,
  createGameState,
  remainingSeconds,
  scoreRank,
  setHolding,
  updateGame,
} from './core.js';

const shell = document.getElementById('game-shell');
const canvas = document.getElementById('classroom');
const g = canvas.getContext('2d');
const hud = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const lessonCountEl = document.getElementById('lesson-count');
const lessonNameEl = document.getElementById('lesson-name');
const timeLeftEl = document.getElementById('time-left');
const strikesEl = document.getElementById('strikes');
const progressEl = document.getElementById('lesson-progress-fill');
const bannerEl = document.getElementById('banner');
const activityEl = document.getElementById('activity');
const promptEl = document.getElementById('hold-prompt');
const screen = document.getElementById('screen');
const startButton = document.getElementById('start-button');
const bestScoreEl = document.getElementById('best-score');
const soundButton = document.getElementById('sound-toggle');
const cueEls = Object.fromEntries(
  [...document.querySelectorAll('.danger-cue')].map((element) => [element.dataset.watcher, element]),
);

const LOGICAL_W = 960;
const LOGICAL_H = 640;
const BEST_KEY = 'classroom_slacking_best';
const WATCHER_NAMES = { teacher: '老师', corridor: '巡课老师', monitor: '班长' };

let state = null;
let pressed = false;
let lastFrame = performance.now();
let bannerTimer = 0;
let shake = 0;
let teacherTurn = 0;
let corridorPresence = 0;
let monitorTurn = 0;
let muted = false;
let best = loadBest();

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  best = Math.max(best, Math.floor(value));
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // The game still works when storage is unavailable.
  }
}

function showBanner(text, seconds = 1.2) {
  bannerEl.textContent = text;
  bannerTimer = seconds;
}

function formatTime(seconds) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function updateHud() {
  if (!state) return;
  const lesson = LESSONS[state.lessonIndex];
  scoreEl.textContent = Math.floor(state.score).toLocaleString('zh-CN');
  lessonCountEl.textContent = `第 ${state.lessonIndex + 1} 节 / ${LESSONS.length}`;
  lessonNameEl.textContent = lesson.title;
  timeLeftEl.textContent = formatTime(remainingSeconds(state));
  progressEl.style.width = `${Math.min(100, state.lessonTime / lesson.duration * 100)}%`;
  [...strikesEl.children].forEach((dot, index) => dot.classList.toggle('is-hit', index < state.strikes));
  strikesEl.setAttribute('aria-label', `${state.strikes} 次被抓，最多 ${MAX_STRIKES} 次`);

  shell.classList.toggle('is-daydreaming', state.daydreaming);
  activityEl.textContent = state.daydreaming
    ? `正在：${state.activity.name} · 风险${state.activity.risk} · ×${state.combo.toFixed(1)}`
    : state.focusLock > 0 ? '老师还在看，先老实一会儿' : '正在：认真听课';

  if (state.phase === 'between') promptEl.textContent = '下课了';
  else if (state.focusLock > 0) promptEl.textContent = '别动 · 老师还在看';
  else if (state.daydreaming && !state.holding) promptEl.textContent = '正在收好...';
  else if (state.daydreaming) promptEl.textContent = '松手 · 回到课本';
  else promptEl.textContent = '按住 · 开小差';

  for (const watcher of state.watchers) {
    const cue = cueEls[watcher.key];
    cue.classList.toggle('is-active', watcher.mode === 'warn' || watcher.mode === 'look');
    cue.classList.toggle('is-looking', watcher.mode === 'look');
    cue.querySelector('span').textContent = watcher.mode === 'look'
      ? `${WATCHER_NAMES[watcher.key]}正在看你`
      : watcher.key === 'teacher' ? '老师要回头了'
        : watcher.key === 'corridor' ? '走廊有脚步' : '班长在看你';
  }
}

function showEndScreen(won) {
  const score = Math.floor(state.score);
  saveBest(score);
  bannerTimer = 0;
  bannerEl.textContent = '';
  screen.classList.remove('is-hidden');
  screen.innerHTML = `
    <div class='screen-copy'>
      <p class='eyebrow'>${won ? '放学铃响了' : '纪律记录已满'}</p>
      <h1>${won ? '平安熬到放学' : '被请去办公室'}</h1>
      <p class='tagline'>脑洞值 ${score.toLocaleString('zh-CN')} · ${scoreRank(score)}<br>被抓 ${state.strikes} 次 · 最高 ${best.toLocaleString('zh-CN')}</p>
      <button id='restart-button' class='primary-button' type='button'>再来一天</button>
    </div>`;
  document.getElementById('restart-button').addEventListener('click', startGame);
}

function showIntermission() {
  const next = LESSONS[state.lessonIndex + 1];
  screen.classList.remove('is-hidden');
  screen.innerHTML = `
    <div class='screen-copy'>
      <p class='eyebrow'>下课铃</p>
      <h1>下一节 · ${next.title}</h1>
      <p class='tagline'>${next.topic}</p>
    </div>`;
}

function hideScreen() {
  screen.classList.add('is-hidden');
}

function processEvents(events) {
  for (const event of events) {
    if (event.type === 'activity') {
      audio.tap(180 + event.activity.rate * 11);
    } else if (event.type === 'warning') {
      audio.warning(event.watcher);
    } else if (event.type === 'fake') {
      showBanner('假动作！', 0.7);
      audio.fake();
    } else if (event.type === 'near-miss') {
      showBanner(`极限收手 +${event.bonus}`, 1);
      audio.near();
    } else if (event.type === 'caught') {
      showBanner(`被${WATCHER_NAMES[event.watcher]}抓到了`, 1.4);
      shake = 1;
      audio.caught();
    } else if (event.type === 'lesson-end') {
      audio.bell();
      if (state.phase === 'between') showIntermission();
    } else if (event.type === 'lesson-start') {
      hideScreen();
      showBanner(`第 ${state.lessonIndex + 1} 节 · ${LESSONS[state.lessonIndex].title}`, 1.5);
    } else if (event.type === 'won') {
      showEndScreen(true);
      audio.finish();
    } else if (event.type === 'lost') {
      showEndScreen(false);
    }
  }
}

function setPressed(value) {
  if (!state || state.phase !== 'playing') return;
  pressed = value;
  processEvents(setHolding(state, value));
}

function startGame() {
  audio.unlock();
  pressed = false;
  state = createGameState();
  hud.classList.remove('is-hidden');
  activityEl.classList.remove('is-hidden');
  promptEl.classList.remove('is-hidden');
  hideScreen();
  showBanner('第一节 · 数学课', 1.5);
  audio.bell();
  updateHud();
}

startButton.addEventListener('click', startGame);
bestScoreEl.textContent = best ? `最高脑洞值 ${best.toLocaleString('zh-CN')}` : '';

shell.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button') || !screen.classList.contains('is-hidden')) return;
  event.preventDefault();
  setPressed(true);
});

window.addEventListener('pointerup', () => setPressed(false));
window.addEventListener('pointercancel', () => setPressed(false));
window.addEventListener('blur', () => setPressed(false));
shell.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  if ((event.code === 'Space' || event.code === 'Enter') && state?.phase === 'playing') {
    event.preventDefault();
    if (!event.repeat) setPressed(true);
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'Space' || event.code === 'Enter') setPressed(false);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') setPressed(false);
});

soundButton.addEventListener('click', () => {
  muted = !muted;
  audio.setMuted(muted);
  soundButton.textContent = muted ? '×' : '♪';
  soundButton.setAttribute('aria-label', muted ? '打开声音' : '关闭声音');
});

function createAudio() {
  let context = null;
  let gain = null;
  let isMuted = false;

  function unlock() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context = new AudioContext();
      gain = context.createGain();
      gain.gain.value = 0.22;
      gain.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume();
  }

  function tone(frequency, duration, type = 'sine', delay = 0, endFrequency = frequency) {
    if (!context || isMuted) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(0.5, start + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(volume);
    volume.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  return {
    unlock,
    setMuted(value) { isMuted = value; },
    tap(frequency) { tone(frequency, 0.055, 'triangle', 0, frequency * 1.15); },
    warning(kind) {
      const base = kind === 'teacher' ? 620 : kind === 'corridor' ? 460 : 760;
      tone(base, 0.1, 'square');
      tone(base * 1.18, 0.1, 'square', 0.12);
    },
    fake() { tone(420, 0.08, 'triangle', 0, 260); },
    near() {
      tone(480, 0.08, 'triangle');
      tone(720, 0.12, 'triangle', 0.07);
    },
    caught() {
      tone(180, 0.28, 'sawtooth', 0, 65);
      tone(95, 0.32, 'square', 0.05, 45);
    },
    bell() {
      tone(880, 0.42, 'sine');
      tone(660, 0.55, 'sine', 0.19);
    },
    finish() {
      [440, 554, 660, 880].forEach((frequency, index) => tone(frequency, 0.3, 'triangle', index * 0.12));
    },
  };
}

const audio = createAudio();

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

function drawBoard(ctx, time) {
  ctx.fillStyle = '#8c6d45';
  roundedRect(ctx, 82, 48, 648, 292, 8);
  ctx.fill();
  ctx.fillStyle = '#285e4d';
  roundedRect(ctx, 94, 59, 624, 265, 4);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#d8efe2';
  ctx.lineWidth = 2;
  for (let x = 125; x < 700; x += 95) {
    ctx.beginPath();
    ctx.moveTo(x, 70);
    ctx.lineTo(x + 28, 314);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#e7f0da';
  ctx.font = '24px KaiTi, serif';
  ctx.fillText('y = ax² + bx + c', 132, 122);
  ctx.font = '20px KaiTi, serif';
  ctx.fillText('∠A + ∠B + ∠C = 180°', 146, 172);
  ctx.fillText('请同学们看黑板', 185, 255);
  ctx.strokeStyle = '#e7f0da';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(480, 112);
  ctx.lineTo(555, 215);
  ctx.lineTo(622, 112);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(555, 215, 18, Math.PI * 1.1, Math.PI * 1.55);
  ctx.stroke();
  const chalkX = 108 + (time * 18 % 570);
  ctx.fillStyle = 'rgb(235 242 218 / 55%)';
  ctx.fillRect(chalkX, 314, 22, 3);
}

function drawWindows(ctx, corridor, time) {
  ctx.fillStyle = '#54756f';
  ctx.fillRect(755, 54, 168, 300);
  ctx.fillStyle = '#8dd0e3';
  ctx.fillRect(767, 66, 144, 276);
  ctx.fillStyle = '#d9f3f7';
  ctx.fillRect(767, 120, 144, 7);
  ctx.fillRect(834, 66, 7, 276);
  ctx.fillStyle = '#f7e7a9';
  ctx.beginPath();
  ctx.arc(884, 92, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5c9a91';
  ctx.fillRect(767, 274, 144, 68);
  ctx.fillStyle = '#477f76';
  for (let x = 774; x < 910; x += 24) ctx.fillRect(x, 245 + (x % 3) * 4, 17, 97);

  if (corridor > 0.02) {
    ctx.save();
    ctx.globalAlpha = corridor;
    const x = 908 - corridor * 72;
    ctx.fillStyle = '#273b3b';
    ctx.beginPath();
    ctx.arc(x, 176, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 21, 199, 42, 92);
    ctx.fillStyle = '#f0c19f';
    ctx.beginPath();
    ctx.arc(x, 180, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b2929';
    ctx.fillRect(x - 10, 177, 5, 4);
    ctx.fillRect(x + 5, 177, 5, 4);
    ctx.restore();
  }

  ctx.strokeStyle = 'rgb(255 255 255 / 35%)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(770, 82 + Math.sin(time) * 3);
  ctx.lineTo(905, 232 + Math.sin(time) * 3);
  ctx.stroke();
}

function drawStudent(ctx, x, y, scale, shirt, turned = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#6f533d';
  ctx.fillRect(-42, 51, 84, 12);
  ctx.fillStyle = shirt;
  roundedRect(ctx, -26, 12, 52, 51, 12);
  ctx.fill();
  ctx.fillStyle = '#e6b792';
  ctx.beginPath();
  ctx.arc(turned * 9, 0, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2f2928';
  ctx.beginPath();
  ctx.arc(turned * 9, -6, 21, Math.PI, Math.PI * 2);
  ctx.fill();
  if (turned > 0.45) {
    ctx.fillStyle = '#252525';
    ctx.fillRect(5, -2, 4, 4);
    ctx.fillRect(15, -2, 4, 4);
  }
  ctx.restore();
}

function drawTeacher(ctx, turn, time) {
  ctx.save();
  ctx.translate(628, 263 + Math.sin(time * 2.2) * 2);
  ctx.fillStyle = '#273b4b';
  ctx.fillRect(-30, 48, 18, 88);
  ctx.fillRect(13, 48, 18, 88);
  ctx.fillStyle = '#2f6f9a';
  roundedRect(ctx, -43, -14, 86, 78, 13);
  ctx.fill();
  ctx.fillStyle = '#e6b58d';
  ctx.beginPath();
  ctx.arc(0, -42, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#242322';
  ctx.beginPath();
  ctx.arc(0, -50, 31, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-30, -50, 60, 11);
  if (turn > 0.4) {
    ctx.fillStyle = '#1b2221';
    ctx.fillRect(-13, -43, 6, 5);
    ctx.fillRect(8, -43, 6, 5);
    ctx.strokeStyle = '#7f4736';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -27);
    ctx.lineTo(8, -27);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#242322';
    ctx.fillRect(-26, -52, 52, 16);
  }
  ctx.save();
  ctx.rotate(-0.7 + turn * 0.9);
  ctx.fillStyle = '#2f6f9a';
  roundedRect(ctx, 29, -4, 76, 16, 7);
  ctx.fill();
  ctx.fillStyle = '#e6b58d';
  ctx.beginPath();
  ctx.arc(106, 4, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawMonitor(ctx, turn) {
  drawStudent(ctx, 196, 382, 0.9, '#b44f4c', turn);
  if (turn > 0.5) {
    ctx.fillStyle = '#fff6c7';
    ctx.font = '700 17px Microsoft YaHei, sans-serif';
    ctx.fillText('班长', 156, 437);
  }
}

function drawRoom(ctx, time) {
  ctx.fillStyle = '#d9e6df';
  ctx.fillRect(0, 0, LOGICAL_W, 390);
  ctx.fillStyle = '#8da8a0';
  ctx.fillRect(0, 344, LOGICAL_W, 296);
  ctx.fillStyle = '#b6cbc4';
  for (let y = 360; y < 640; y += 46) ctx.fillRect(0, y, LOGICAL_W, 2);
  ctx.fillStyle = '#f4ead0';
  ctx.fillRect(0, 0, LOGICAL_W, 30);
  drawBoard(ctx, time);
  drawWindows(ctx, corridorPresence, time);
  drawStudent(ctx, 92, 366, 0.72, '#d79b3f');
  drawStudent(ctx, 352, 362, 0.76, '#4f8e70');
  drawStudent(ctx, 516, 374, 0.7, '#765ca2');
  drawStudent(ctx, 756, 371, 0.75, '#d8784f');
  drawMonitor(ctx, monitorTurn);
  drawTeacher(ctx, teacherTurn, time);
}

function drawNotebook(ctx, daydreaming) {
  ctx.save();
  ctx.translate(480, 558);
  ctx.rotate(-0.025);
  ctx.fillStyle = '#6f4932';
  roundedRect(ctx, -420, -60, 840, 190, 13);
  ctx.fill();
  ctx.fillStyle = '#8c5d3b';
  ctx.fillRect(-420, -42, 840, 18);
  ctx.fillStyle = '#f6f0d8';
  roundedRect(ctx, -246, -95, 492, 176, 8);
  ctx.fill();
  ctx.strokeStyle = '#9fc8d8';
  ctx.lineWidth = 1.5;
  for (let y = -64; y < 67; y += 23) {
    ctx.beginPath();
    ctx.moveTo(-226, y);
    ctx.lineTo(225, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#e8a4a4';
  ctx.beginPath();
  ctx.moveTo(-188, -88);
  ctx.lineTo(-188, 73);
  ctx.stroke();
  if (!daydreaming) {
    ctx.fillStyle = '#385274';
    ctx.font = '21px KaiTi, serif';
    ctx.fillText('解：设函数的顶点为 P……', -166, -40);
    ctx.fillText('∵ a ＞ 0，∴ 开口向上', -166, -16);
    ctx.fillText('答：下课后再想。', -166, 30);
  }
  ctx.restore();
}

function drawHands(ctx) {
  ctx.fillStyle = '#395f74';
  roundedRect(ctx, 80, 550, 210, 100, 38);
  ctx.fill();
  roundedRect(ctx, 670, 550, 210, 100, 38);
  ctx.fill();
  ctx.fillStyle = '#e4ae87';
  ctx.beginPath();
  ctx.ellipse(300, 588, 44, 27, -0.2, 0, Math.PI * 2);
  ctx.ellipse(660, 588, 44, 27, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawActivity(ctx, activity, time) {
  if (!activity) return;
  ctx.save();
  if (activity.id === 'spin') {
    ctx.translate(480, 505);
    ctx.rotate(time * 7);
    ctx.fillStyle = '#244b8f';
    roundedRect(ctx, -95, -7, 190, 14, 7);
    ctx.fill();
    ctx.fillStyle = '#e6b83f';
    ctx.fillRect(63, -7, 24, 14);
  } else if (activity.id === 'doodle') {
    ctx.strokeStyle = '#34486a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(480, 492, 22, 0, Math.PI * 2);
    ctx.moveTo(480, 514);
    ctx.lineTo(480, 558);
    ctx.moveTo(480, 525);
    ctx.lineTo(449, 544);
    ctx.moveTo(480, 525);
    ctx.lineTo(514, 538);
    ctx.moveTo(480, 558);
    ctx.lineTo(456, 585);
    ctx.moveTo(480, 558);
    ctx.lineTo(507, 585);
    ctx.stroke();
    ctx.fillStyle = '#34486a';
    ctx.font = '700 18px KaiTi, serif';
    ctx.fillText('必杀技！', 525, 490);
  } else if (activity.id === 'note') {
    ctx.translate(480, 520 + Math.sin(time * 3) * 5);
    ctx.rotate(-0.08);
    ctx.fillStyle = '#fff4b6';
    ctx.fillRect(-115, -50, 230, 100);
    ctx.strokeStyle = '#b58b38';
    ctx.strokeRect(-115, -50, 230, 100);
    ctx.fillStyle = '#7a492f';
    ctx.font = '700 23px KaiTi, serif';
    ctx.fillText('放学去小卖部？', -84, 6);
  } else if (activity.id === 'snack') {
    ctx.translate(480, 520 + Math.sin(time * 5) * 3);
    ctx.fillStyle = '#dc463b';
    roundedRect(ctx, -72, -86, 144, 145, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd45c';
    ctx.beginPath();
    ctx.moveTo(-45, -70);
    ctx.lineTo(50, -53);
    ctx.lineTo(31, 38);
    ctx.lineTo(-54, 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9b2723';
    ctx.font = '900 48px Microsoft YaHei, sans-serif';
    ctx.fillText('辣', -27, 11);
  } else if (activity.id === 'comic') {
    ctx.translate(480, 508);
    ctx.fillStyle = '#f8e7cc';
    ctx.fillRect(-190, -105, 184, 196);
    ctx.fillRect(6, -105, 184, 196);
    ctx.strokeStyle = '#3d3b42';
    ctx.lineWidth = 5;
    ctx.strokeRect(-190, -105, 184, 196);
    ctx.strokeRect(6, -105, 184, 196);
    ctx.fillStyle = '#e85f45';
    ctx.font = '900 40px sans-serif';
    ctx.fillText('咚！', -145, -35);
    ctx.strokeStyle = '#354d6c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(90, -23, 30, 0, Math.PI * 2);
    ctx.moveTo(90, 8);
    ctx.lineTo(90, 66);
    ctx.moveTo(90, 28);
    ctx.lineTo(45, 56);
    ctx.moveTo(90, 28);
    ctx.lineTo(145, 43);
    ctx.stroke();
  } else if (activity.id === 'plane') {
    ctx.translate(480 + Math.sin(time * 2.5) * 36, 505 + Math.cos(time * 3) * 8);
    ctx.rotate(-0.16 + Math.sin(time * 2) * 0.08);
    ctx.fillStyle = '#eef6f0';
    ctx.strokeStyle = '#7d9a96';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-132, 35);
    ctx.lineTo(130, -54);
    ctx.lineTo(34, 63);
    ctx.lineTo(-8, 23);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8, 23);
    ctx.lineTo(130, -54);
    ctx.stroke();
  } else if (activity.id === 'console') {
    ctx.translate(480, 515 + Math.sin(time * 5) * 2);
    ctx.fillStyle = '#253b50';
    roundedRect(ctx, -155, -85, 310, 170, 22);
    ctx.fill();
    ctx.fillStyle = '#90c777';
    ctx.fillRect(-92, -61, 184, 122);
    ctx.fillStyle = '#1f4e3c';
    for (let y = -48; y < 50; y += 18) {
      for (let x = -78; x < 80; x += 18) {
        if ((x + y) % 36 === 0) ctx.fillRect(x, y, 12, 12);
      }
    }
    ctx.fillStyle = '#f0c54f';
    ctx.fillRect(-55 + Math.sin(time * 4) * 45, 8, 14, 14);
    ctx.fillStyle = '#d9e4e8';
    ctx.fillRect(-132, -8, 50, 14);
    ctx.fillRect(-114, -26, 14, 50);
    ctx.beginPath();
    ctx.arc(122, -17, 10, 0, Math.PI * 2);
    ctx.arc(101, 12, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDaydreamMarks(ctx, time) {
  ctx.save();
  ctx.strokeStyle = 'rgb(255 218 105 / 76%)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i += 1) {
    const x = 72 + i * 135 + Math.sin(time * 1.5 + i) * 18;
    const y = 170 + (i % 3) * 78 + Math.cos(time * 1.8 + i) * 13;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 0.35 + i);
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(9, 0);
    ctx.moveTo(0, -9);
    ctx.lineTo(0, 9);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function render(time) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, width, height);

  const teacher = state?.watchers.find((watcher) => watcher.key === 'teacher');
  const corridor = state?.watchers.find((watcher) => watcher.key === 'corridor');
  const monitor = state?.watchers.find((watcher) => watcher.key === 'monitor');
  const teacherTarget = teacher?.mode === 'look' ? 1 : teacher?.mode === 'warn' ? 0.58 : 0;
  const corridorTarget = corridor?.mode === 'look' ? 1 : corridor?.mode === 'warn' ? 0.48 : 0;
  const monitorTarget = monitor?.mode === 'look' ? 1 : monitor?.mode === 'warn' ? 0.62 : 0;
  teacherTurn += (teacherTarget - teacherTurn) * 0.12;
  corridorPresence += (corridorTarget - corridorPresence) * 0.1;
  monitorTurn += (monitorTarget - monitorTurn) * 0.14;

  const scale = Math.max(width / LOGICAL_W, height / LOGICAL_H);
  const offsetX = (width - LOGICAL_W * scale) / 2;
  const offsetY = (height - LOGICAL_H * scale) / 2;
  g.save();
  const shakeAmount = shake > 0 ? shake * 9 : 0;
  g.translate(offsetX + (Math.random() - 0.5) * shakeAmount, offsetY + (Math.random() - 0.5) * shakeAmount);
  g.scale(scale, scale);
  drawRoom(g, time);
  drawNotebook(g, state?.daydreaming);
  if (state?.daydreaming) {
    drawActivity(g, state.activity, time);
    drawDaydreamMarks(g, time);
  }
  drawHands(g);

  if (state?.watchers.some((watcher) => watcher.mode === 'look')) {
    const vignette = g.createRadialGradient(480, 350, 120, 480, 350, 560);
    vignette.addColorStop(0, 'rgb(190 37 30 / 0%)');
    vignette.addColorStop(1, 'rgb(167 32 25 / 48%)');
    g.fillStyle = vignette;
    g.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }
  g.restore();
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (state) {
    processEvents(updateGame(state, dt));
    updateHud();
  }
  if (bannerTimer > 0) {
    bannerTimer -= dt;
    if (bannerTimer <= 0) bannerEl.textContent = '';
  }
  shake = Math.max(0, shake - dt * 2.7);
  render(now / 1000);
  requestAnimationFrame(frame);
}

render(0);
requestAnimationFrame(frame);

window.__classroomGame = {
  start: startGame,
  get state() { return state; },
  distractions: DISTRACTIONS,
};
