import {
  LESSONS,
  MAX_STRIKES,
  MEMORIES,
  TOOLS,
  createGameState,
  isExposed,
  remainingSeconds,
  scoreRank,
  setActiveTool,
  setInputActive,
  applyGesture,
  startNextLesson,
  updateGame,
} from './core.js';
import { drawShareCard, renderClassroom, toLogicalPoint } from './art.js';
import { createLeaderboard, loadNickname, saveNickname } from './leaderboard.js';

const shell = document.getElementById('game-shell');
const canvas = document.getElementById('classroom');
const g = canvas.getContext('2d');
const hud = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const lessonCountEl = document.getElementById('lesson-count');
const lessonNameEl = document.getElementById('lesson-name');
const timeLeftEl = document.getElementById('time-left');
const suspicionValueEl = document.getElementById('suspicion-value');
const suspicionFillEl = document.getElementById('suspicion-fill');
const strikesEl = document.getElementById('strikes');
const progressEl = document.getElementById('lesson-progress-fill');
const bannerEl = document.getElementById('banner');
const activityEl = document.getElementById('activity');
const promptEl = document.getElementById('hold-prompt');
const screen = document.getElementById('screen');
const toolDock = document.getElementById('tool-dock');
const bestScoreEl = document.getElementById('best-score');
const soundButton = document.getElementById('sound-toggle');
const cueEls = Object.fromEntries(
  [...document.querySelectorAll('.danger-cue')].map((element) => [element.dataset.watcher, element]),
);

const BEST_KEY = 'classroom_slacking_best_v2';
const WATCHER_NAMES = { teacher: '老师', corridor: '巡课老师', monitor: '班长' };
const TOOL_NAMES = Object.fromEntries(TOOLS.map((tool) => [tool.id, tool.name]));

let state = null;
let selectedTools = ['spin', 'doodle'];
let pointerId = null;
let lastPoint = null;
let lastGestureAngle = null;
let spinAngle = 0;
let doodlePath = [];
let lastFrame = performance.now();
let bannerTimer = 0;
let shake = 0;
let teacherTurn = 0;
let corridorPresence = 0;
let monitorTurn = 0;
let muted = false;
let best = loadBest();
let runStartedAt = 0;
let leaderboard = createLeaderboard(window.CLASSROOM_LEADERBOARD_ENDPOINT || '/api/classroom-scores');

function loadBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}

function saveBest(value) {
  best = Math.max(best, Math.floor(value));
  try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* Optional local score. */ }
}

function showBanner(text, seconds = 1.2) {
  bannerEl.textContent = text;
  bannerTimer = seconds;
}

function formatTime(seconds) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function updateLoadoutButtons() {
  document.querySelectorAll('[data-loadout]').forEach((button) => {
    button.classList.toggle('is-selected', selectedTools.includes(button.dataset.loadout));
  });
  const count = document.getElementById('loadout-count');
  if (count) count.textContent = `${selectedTools.length} / 2`;
}

function toggleLoadout(toolId) {
  if (!TOOLS.some((tool) => tool.id === toolId)) return;
  if (selectedTools.includes(toolId)) {
    if (selectedTools.length > 1) selectedTools = selectedTools.filter((id) => id !== toolId);
  } else if (selectedTools.length < 2) {
    selectedTools = [...selectedTools, toolId];
  } else {
    selectedTools = [selectedTools[1], toolId];
  }
  updateLoadoutButtons();
}

function updateHud() {
  if (!state) return;
  const lesson = LESSONS[state.lessonIndex];
  scoreEl.textContent = Math.floor(state.score).toLocaleString('zh-CN');
  lessonCountEl.textContent = `第 ${state.lessonIndex + 1} 节 / ${LESSONS.length}`;
  lessonNameEl.textContent = lesson.title;
  timeLeftEl.textContent = formatTime(remainingSeconds(state));
  suspicionValueEl.textContent = `${Math.round(state.suspicion)}`;
  suspicionFillEl.style.width = `${state.suspicion}%`;
  progressEl.style.width = `${Math.min(100, state.lessonTime / lesson.duration * 100)}%`;
  [...strikesEl.children].forEach((dot, index) => dot.classList.toggle('is-hit', index < state.strikes));
  strikesEl.setAttribute('aria-label', `${state.strikes} 次被抓，最多 ${MAX_STRIKES} 次`);

  const exposed = isExposed(state);
  shell.classList.toggle('is-active', exposed);
  activityEl.textContent = exposed
    ? `正在：${TOOL_NAMES[state.activeTool]} · 怀疑 ${Math.round(state.suspicion)}`
    : state.focusLock > 0 ? '老师还在看，先老实一会儿' : '正在：认真听课';

  if (state.focusLock > 0) promptEl.textContent = '别动 · 老师还在看';
  else if (state.activeTool === 'spin') promptEl.textContent = exposed ? '绕着笔画圈 · 预警就松手' : '按住并画圈 · 转笔';
  else if (state.activeTool === 'doodle') promptEl.textContent = exposed ? '快收笔 · 预警就松手' : '按住并画线 · 涂鸦';
  else promptEl.textContent = state.comicOpen > 0.06 ? '向上拖 · 藏回桌洞' : '向下拖 · 打开漫画';

  for (const button of toolDock.querySelectorAll('.tool-button')) {
    button.classList.toggle('is-active', button.dataset.tool === state.activeTool);
    button.disabled = exposed || state.focusLock > 0;
  }
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

function showIntermission() {
  const next = LESSONS[state.lessonIndex + 1];
  toolDock.classList.add('is-hidden');
  screen.classList.remove('is-hidden');
  screen.innerHTML = `
    <div class='screen-copy'>
      <p class='eyebrow'>下课铃 · ${state.lessonIndex + 1} / ${LESSONS.length}</p>
      <h1>下一节 · ${next.title}</h1>
      <p class='tagline'>${next.topic}</p>
      <div class='loadout-picker' aria-label='换两件装备'>
        <p class='picker-label'>换两件装备？<span id='loadout-count'>2 / 2</span></p>
        <div class='loadout-options'>
          ${TOOLS.map((tool) => `<button class='loadout-button' type='button' data-loadout='${tool.id}'><b>${tool.mark}</b><span>${tool.name}</span><small>${tool.id === 'spin' ? '画圈' : tool.id === 'doodle' ? '画线' : '拖开'}</small></button>`).join('')}
        </div>
      </div>
      <button id='continue-button' class='primary-button' type='button'>继续上课</button>
    </div>`;
  updateLoadoutButtons();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function leaderboardMarkup(rows, online) {
  const list = rows.length
    ? rows.map((row, index) => `<li><span>${index + 1}</span><span>${escapeHtml(row.nickname)}</span><strong>${row.score.toLocaleString('zh-CN')}</strong></li>`).join('')
    : '<li><span>—</span><span>还没有成绩</span><strong>—</strong></li>';
  return `
    <div class='leaderboard-head'><span>全球榜</span><small class='leaderboard-status'>${online ? '在线' : '本机 · 待上线'}</small></div>
    <ol class='leaderboard-list'>${list}</ol>
    <div class='nickname-row'><input id='nickname-input' maxlength='10' value='${escapeHtml(loadNickname())}' aria-label='昵称' placeholder='你的昵称'><button id='submit-score' type='button'>上榜</button></div>`;
}

function showEndScreen(won) {
  const score = Math.floor(state.score);
  saveBest(score);
  bannerTimer = 0;
  bannerEl.textContent = '';
  toolDock.classList.add('is-hidden');
  screen.classList.remove('is-hidden');
  const memoryDots = MEMORIES.filter((memory) => state.memories.includes(memory.id)).map((memory) => `<i class='memory-dot' title='${memory.name}'>${memory.mark}</i>`).join('');
  screen.innerHTML = `
    <div class='screen-copy'>
      <p class='eyebrow'>${won ? '放学铃响了' : '纪律记录已满'}</p>
      <h1>${won ? '平安熬到放学' : '被请去办公室'}</h1>
      <p class='score-line'>${score.toLocaleString('zh-CN')}</p>
      <p class='tagline'>${scoreRank(score)} · 被抓 ${state.strikes} 次</p>
      <div class='memory-strip'>${memoryDots || '<i class="memory-dot">?</i>'}</div>
      <div id='leaderboard-box' class='leaderboard-box'><div class='leaderboard-head'><span>全球榜</span><small class='leaderboard-status'>读取中…</small></div></div>
      <div class='end-actions'><button id='download-card' class='secondary-button' type='button'>保存成绩单</button><button id='restart-button' class='primary-button' type='button'>再来一天</button></div>
      <p class='best-score'>本机最高 ${best.toLocaleString('zh-CN')}</p>
    </div>`;
  const durationMs = Math.max(8000, performance.now() - runStartedAt);
  const run = { durationMs: Math.floor(durationMs), inputs: state.stats.inputs, lessons: state.lessonIndex + (won ? 1 : 0) };
  leaderboard.list().then(({ rows, online }) => {
    const box = document.getElementById('leaderboard-box');
    if (!box || !screen.contains(box)) return;
    box.innerHTML = leaderboardMarkup(rows, online);
    box.dataset.run = JSON.stringify(run);
  });
}

function hideScreen() {
  screen.classList.add('is-hidden');
}

function processEvents(events) {
  for (const event of events) {
    if (event.type === 'warning') audio.warning(event.watcher);
    else if (event.type === 'fake') { showBanner('假动作！', 0.7); audio.fake(); }
    else if (event.type === 'spin-turn') audio.tap(350);
    else if (event.type === 'doodle-complete') showBanner('新角色诞生！', 0.8);
    else if (event.type === 'comic-open') audio.page();
    else if (event.type === 'near-miss') { showBanner(`极限收手 +${event.bonus}`, 1); audio.near(); }
    else if (event.type === 'class-event') { showBanner(event.event.label, 1); audio.event(); }
    else if (event.type === 'memory') showBanner(`回忆解锁：${event.memory.name}`, 1.1);
    else if (event.type === 'caught') { showBanner(`被${WATCHER_NAMES[event.watcher]}抓到了`, 1.4); shake = 1; audio.caught(); }
    else if (event.type === 'lesson-end') audio.bell();
    else if (event.type === 'prep') showIntermission();
    else if (event.type === 'lesson-start') { hideScreen(); toolDock.classList.remove('is-hidden'); showBanner(`第 ${state.lessonIndex + 1} 节 · ${LESSONS[state.lessonIndex].title}`, 1.5); }
    else if (event.type === 'won') { showEndScreen(true); audio.finish(); }
    else if (event.type === 'lost') showEndScreen(false);
  }
}

function startGame() {
  audio.unlock();
  state = createGameState({ selectedTools });
  state.activeTool = selectedTools[0];
  runStartedAt = performance.now();
  pointerId = null;
  doodlePath = [];
  spinAngle = 0;
  hud.classList.remove('is-hidden');
  activityEl.classList.remove('is-hidden');
  promptEl.classList.remove('is-hidden');
  toolDock.classList.remove('is-hidden');
  hideScreen();
  showBanner('第一节 · 数学课', 1.5);
  audio.bell();
  updateHud();
}

function continueLesson() {
  if (!state || state.phase !== 'between') return;
  processEvents(startNextLesson(state, selectedTools));
}

function downloadShareCard() {
  if (!state) return;
  const card = document.createElement('canvas');
  card.width = 1080;
  card.height = 1080;
  drawShareCard(card.getContext('2d'), { nickname: loadNickname(), score: Math.floor(state.score), rank: scoreRank(state.score), memories: state.memories });
  const link = document.createElement('a');
  link.download = '课桌下的宇宙-成绩单.png';
  link.href = card.toDataURL('image/png');
  link.click();
}

async function submitScore() {
  const input = document.getElementById('nickname-input');
  const button = document.getElementById('submit-score');
  const box = document.getElementById('leaderboard-box');
  if (!input || !button || !box) return;
  const nickname = saveNickname(input.value);
  button.disabled = true;
  button.textContent = '提交中';
  let run;
  try { run = JSON.parse(box.dataset.run || '{}'); } catch { run = {}; }
  const result = await leaderboard.submit(nickname, Math.floor(state.score), run);
  box.innerHTML = leaderboardMarkup(result.rows, result.online);
  box.dataset.run = JSON.stringify(run);
}

screen.addEventListener('click', (event) => {
  const loadoutButton = event.target.closest('[data-loadout]');
  if (loadoutButton) { toggleLoadout(loadoutButton.dataset.loadout); return; }
  if (event.target.closest('#continue-button')) { continueLesson(); return; }
  if (event.target.closest('#restart-button')) { startGame(); return; }
  if (event.target.closest('#download-card')) { downloadShareCard(); return; }
  if (event.target.closest('#submit-score')) submitScore();
});

document.querySelectorAll('.loadout-button').forEach((button) => {
  button.dataset.loadout = button.dataset.tool;
});
document.getElementById('start-button').addEventListener('click', startGame);
updateLoadoutButtons();
bestScoreEl.textContent = best ? `本机最高脑洞值 ${best.toLocaleString('zh-CN')}` : '';

toolDock.addEventListener('click', (event) => {
  const button = event.target.closest('[data-tool]');
  if (!button || !state) return;
  if (setActiveTool(state, button.dataset.tool)) {
    doodlePath = [];
    showBanner(TOOL_NAMES[state.activeTool], 0.45);
    audio.tap(260);
  }
});

function pointFromEvent(event) {
  return toLogicalPoint(event.clientX, event.clientY, canvas.getBoundingClientRect());
}

function normalizeAngle(angle) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function handlePointerDown(event) {
  if (!state || state.phase !== 'playing' || !screen.classList.contains('is-hidden')) return;
  if (event.target.closest('button')) return;
  event.preventDefault();
  pointerId = event.pointerId;
  canvas.setPointerCapture?.(pointerId);
  lastPoint = pointFromEvent(event);
  if (state.activeTool === 'spin') lastGestureAngle = Math.atan2(lastPoint.y - 520, lastPoint.x - 480);
  else if (state.activeTool === 'doodle') doodlePath = [lastPoint];
  processEvents(setInputActive(state, true));
}

function handlePointerMove(event) {
  if (!state || event.pointerId !== pointerId || state.phase !== 'playing') return;
  const point = pointFromEvent(event);
  if (state.activeTool === 'spin' && lastPoint) {
    const angle = Math.atan2(point.y - 520, point.x - 480);
    const delta = normalizeAngle(angle - lastGestureAngle);
    lastGestureAngle = angle;
    spinAngle += delta;
    processEvents(applyGesture(state, 'spin', Math.abs(delta) / (Math.PI * 2)));
  } else if (state.activeTool === 'doodle' && lastPoint) {
    const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
    if (distance > 0.5) {
      doodlePath.push(point);
      if (doodlePath.length > 100) doodlePath.shift();
      processEvents(applyGesture(state, 'doodle', distance / 100));
    }
  } else if (state.activeTool === 'comic' && lastPoint) {
    processEvents(applyGesture(state, 'comic', (point.y - lastPoint.y) / 180));
  }
  lastPoint = point;
}

function releasePointer(event) {
  if (!state || event.pointerId !== pointerId) return;
  processEvents(setInputActive(state, false));
  pointerId = null;
  lastPoint = null;
  lastGestureAngle = null;
}

canvas.addEventListener('pointerdown', handlePointerDown);
canvas.addEventListener('pointermove', handlePointerMove);
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
window.addEventListener('pointerup', releasePointer);
window.addEventListener('blur', () => { if (state && pointerId !== null) releasePointer({ pointerId }); });
shell.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  if ((event.code === 'Space' || event.code === 'Enter') && state?.phase === 'playing') {
    event.preventDefault();
    if (!event.repeat) {
      processEvents(setInputActive(state, true));
      if (state.activeTool === 'spin') processEvents(applyGesture(state, 'spin', 0.18));
      if (state.activeTool === 'doodle') processEvents(applyGesture(state, 'doodle', 0.28));
      if (state.activeTool === 'comic') processEvents(applyGesture(state, 'comic', 0.12));
    }
  }
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'Space' || event.code === 'Enter') processEvents(setInputActive(state, false));
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && state) processEvents(setInputActive(state, false)); });

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
      gain.gain.value = 0.18;
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
    volume.gain.exponentialRampToValueAtTime(0.45, start + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(volume); volume.connect(gain); oscillator.start(start); oscillator.stop(start + duration + 0.03);
  }
  return {
    unlock,
    setMuted(value) { isMuted = value; },
    tap(frequency) { tone(frequency, 0.045, 'triangle', 0, frequency * 1.15); },
    warning(kind) { const base = kind === 'teacher' ? 620 : kind === 'corridor' ? 460 : 760; tone(base, 0.1, 'square'); tone(base * 1.18, 0.1, 'square', 0.12); },
    fake() { tone(420, 0.08, 'triangle', 0, 260); },
    page() { tone(260, 0.08, 'triangle', 0, 190); },
    event() { tone(510, 0.08, 'sine'); },
    near() { tone(480, 0.08, 'triangle'); tone(720, 0.12, 'triangle', 0.07); },
    caught() { tone(180, 0.28, 'sawtooth', 0, 65); tone(95, 0.32, 'square', 0.05, 45); },
    bell() { tone(880, 0.42, 'sine'); tone(660, 0.55, 'sine', 0.19); },
    finish() { [440, 554, 660, 880].forEach((frequency, index) => tone(frequency, 0.3, 'triangle', index * 0.12)); },
  };
}

const audio = createAudio();

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
  const teacher = state?.watchers.find((watcher) => watcher.key === 'teacher');
  const corridor = state?.watchers.find((watcher) => watcher.key === 'corridor');
  const monitor = state?.watchers.find((watcher) => watcher.key === 'monitor');
  const teacherTarget = teacher?.mode === 'look' ? 1 : teacher?.mode === 'warn' ? 0.58 : 0;
  const corridorTarget = corridor?.mode === 'look' ? 1 : corridor?.mode === 'warn' ? 0.48 : 0;
  const monitorTarget = monitor?.mode === 'look' ? 1 : monitor?.mode === 'warn' ? 0.62 : 0;
  teacherTurn += (teacherTarget - teacherTurn) * 0.12;
  corridorPresence += (corridorTarget - corridorPresence) * 0.1;
  monitorTurn += (monitorTarget - monitorTurn) * 0.14;
  renderClassroom(g, width, height, { state, time, teacherTurn, corridorPresence, monitorTurn, shake, spinAngle, doodlePath });
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (state) { processEvents(updateGame(state, dt)); updateHud(); }
  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) bannerEl.textContent = ''; }
  shake = Math.max(0, shake - dt * 2.7);
  render(now / 1000);
  requestAnimationFrame(frame);
}

updateLoadoutButtons();
render(0);
requestAnimationFrame(frame);

window.__classroomGame = {
  start: startGame,
  get state() { return state; },
  tools: TOOLS,
};
