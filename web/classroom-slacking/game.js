import {
  LESSONS,
  MAX_STRIKES,
  MEMORIES,
  TOOLS,
  applyGesture,
  createGameState,
  focusNow,
  isExposed,
  remainingSeconds,
  scoreRank,
  setActiveTool,
  setInputActive,
  startNextLesson,
  throwPlane,
  updateGame,
} from './core.js';
import { drawShareCard, renderClassroom, toLogicalPoint } from './art.js';
import { HANDHELD, PAPER, PLANE_FLIGHT, PLANE_FOLDS, SPIN } from './desk-actions.js';

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
const promptEl = document.getElementById('hold-prompt');
const controls = document.getElementById('desk-controls');
const doodleActions = document.getElementById('doodle-actions');
const consoleActions = document.getElementById('console-actions');
const planeActions = document.getElementById('plane-actions');
const stowButton = document.getElementById('stow-tool');
const undoButton = document.getElementById('doodle-undo');
const clearButton = document.getElementById('doodle-clear');
const farButton = planeActions.querySelector('[data-throw="far"]');
const screen = document.getElementById('screen');
const toolDock = document.getElementById('tool-dock');
const bestScoreEl = document.getElementById('best-score');
const soundButton = document.getElementById('sound-toggle');
const cueEls = Object.fromEntries(
  [...document.querySelectorAll('.danger-cue')].map((element) => [element.dataset.watcher, element]),
);

const BEST_KEY = 'classroom_slacking_best_v3';
const MEMORY_KEY = 'classroom_slacking_memories_v3';
const WATCHER_NAMES = { teacher: '老师', corridor: '巡课老师', monitor: '班长' };
const TOOL_NAMES = Object.fromEntries(TOOLS.map((tool) => [tool.id, tool.name]));
const TOOL_KEYS = Object.fromEntries(TOOLS.map((tool, index) => [`Digit${index + 1}`, tool.id]));

let state = null;
let pointerId = null;
let lastPoint = null;
let pointerStart = null;
let lastGestureAngle = null;
let spinAngle = 0;
let doodleStrokes = [];
let activeStroke = null;
let lastFrame = performance.now();
let bannerTimer = 0;
let shake = 0;
let teacherTurn = 0;
let corridorPresence = 0;
let monitorTurn = 0;
let muted = false;
let best = loadBest();

function loadBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}

function loadMemories() {
  try { return JSON.parse(localStorage.getItem(MEMORY_KEY) || '[]'); } catch { return []; }
}

function saveMemories(memories) {
  try { localStorage.setItem(MEMORY_KEY, JSON.stringify(memories)); } catch { /* Optional local collection. */ }
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

function updateHud() {
  if (!state) return;
  const lesson = LESSONS[state.lessonIndex];
  const exposed = isExposed(state);
  scoreEl.textContent = Math.floor(state.score).toLocaleString('zh-CN');
  lessonCountEl.textContent = `第 ${state.lessonIndex + 1} 节 / ${LESSONS.length}`;
  lessonNameEl.textContent = lesson.title;
  timeLeftEl.textContent = formatTime(remainingSeconds(state));
  suspicionValueEl.textContent = `${Math.round(state.suspicion)}`;
  suspicionFillEl.style.width = `${state.suspicion}%`;
  progressEl.style.width = `${Math.min(100, state.lessonTime / lesson.duration * 100)}%`;
  [...strikesEl.children].forEach((dot, index) => dot.classList.toggle('is-hit', index < state.strikes));
  strikesEl.setAttribute('aria-label', `${state.strikes} 次被抓，最多 ${MAX_STRIKES} 次`);
  shell.classList.toggle('is-active', exposed);

  const playing = state.phase === 'playing';
  const ready = state.planeFolds === PLANE_FOLDS.length;
  const locked = state.focusLock > 0;
  controls.classList.toggle('is-hidden', !playing);
  shell.classList.toggle('is-playing', playing);
  doodleActions.classList.toggle('is-hidden', state.activeTool !== 'doodle');
  planeActions.classList.toggle('is-hidden', state.activeTool !== 'plane' || !ready);
  consoleActions.classList.toggle('is-hidden', state.activeTool !== 'console');
  undoButton.disabled = clearButton.disabled = doodleStrokes.length === 0;
  for (const button of consoleActions.querySelectorAll('button')) button.disabled = locked;
  farButton.disabled = state.farThrowUsed;
  farButton.textContent = state.farThrowUsed ? '远投已用' : `冒险远投 +${PLANE_FLIGHT.far.score}`;
  if (state.focusLock > 0) promptEl.textContent = '别动 · 老师还在看';
  else if (exposed && state.watchers.some((watcher) => watcher.mode === 'warn')) promptEl.textContent = '快收好！';
  else if (state.activeTool === 'spin') promptEl.textContent = '沿圆环转笔';
  else if (state.activeTool === 'doodle') promptEl.textContent = '在纸上画';
  else if (state.activeTool === 'note') promptEl.textContent = '横向拖动 · 传给同桌';
  else if (state.activeTool === 'snack') promptEl.textContent = '点几下 · 偷吃一口';
  else if (state.activeTool === 'comic') promptEl.textContent = state.comicOpen > 0.06 ? '向上拖 · 藏回桌洞' : '向下拖 · 打开漫画';
  else if (state.activeTool === 'plane') {
    const arrow = PLANE_FOLDS[state.planeFolds] === -1 ? '←' : '→';
    promptEl.textContent = ready ? '向上甩可短投' : state.planeFlight ? '飞机飞出去了' : `沿 ${arrow} 划一下 · ${state.planeFolds}/${PLANE_FOLDS.length}`;
  } else promptEl.textContent = state.handheld.active
    ? `躲开方块 · ${state.handheld.dodged}/${HANDHELD.goal}`
    : state.handheld.dodged === HANDHELD.goal ? '通关！← → 再玩一盘' : '← → 开始 / 继续躲方块';

  for (const button of toolDock.querySelectorAll('.tool-button')) {
    button.classList.toggle('is-active', button.dataset.tool === state.activeTool);
    button.setAttribute('aria-pressed', String(button.dataset.tool === state.activeTool));
    button.disabled = state.focusLock > 0;
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
  screen.classList.remove('is-hidden');
  screen.innerHTML = `
    <div class='screen-copy'>
      <p class='eyebrow'>下课铃 · ${state.lessonIndex + 1} / ${LESSONS.length}</p>
      <h1>下一节 · ${next.title}</h1>
      <p class='tagline'>${next.topic}<br>回忆已收集 ${state.memories.length} / ${MEMORIES.length}</p>
      <button id='continue-button' class='primary-button' type='button'>继续上课</button>
    </div>`;
}

function showEndScreen(won) {
  const score = Math.floor(state.score);
  saveBest(score);
  saveMemories(state.memories);
  bannerTimer = 0;
  bannerEl.textContent = '';
  screen.classList.remove('is-hidden');
  const memoryDots = MEMORIES.map((memory) => state.memories.includes(memory.id)
    ? `<i class='memory-dot' title='${memory.name}'>${memory.mark}</i>` : '').join('');
  screen.innerHTML = `
    <div class='screen-copy'>
      <p class='eyebrow'>${won ? '放学铃响了' : '纪律记录已满'}</p>
      <h1>${won ? '平安熬到放学' : '被请去办公室'}</h1>
      <p class='score-line'>${score.toLocaleString('zh-CN')}</p>
      <p class='tagline'>${scoreRank(score)} · 被抓 ${state.strikes} 次<br>回忆已收集 ${state.memories.length} / ${MEMORIES.length}</p>
      <div class='memory-strip'>${memoryDots || '<i class="memory-dot">?</i>'}</div>
      <div class='end-actions'><button id='download-card' class='secondary-button' type='button'>保存成绩单</button><button id='restart-button' class='primary-button' type='button'>再来一天</button></div>
      <p class='best-score'>本机最高 ${best.toLocaleString('zh-CN')}</p>
    </div>`;
}

function hideScreen() {
  screen.classList.add('is-hidden');
}

function processEvents(events) {
  for (const event of events) {
    if (event.type === 'warning') audio.warning(event.watcher);
    else if (event.type === 'fake') { showBanner('假动作！', 0.7); audio.fake(); }
    else if (event.type === 'teacher-line') { showBanner(`老师：“${event.line}”`, 2); audio.teacherLine(event.line, event.fake); }
    else if (event.type === 'spin-turn') {
      audio.tap(event.fast ? 490 : 350);
      showBanner(`${event.fast ? '快转！' : '转了一圈'} · 怀疑 +${event.suspicion}`, 0.6);
    }
    else if (event.type === 'doodle-complete') showBanner('新角色诞生！', 0.8);
    else if (event.type === 'note-sent') { showBanner('纸条到了！', 0.8); audio.paper(); }
    else if (event.type === 'snack-crunch') audio.crunch();
    else if (event.type === 'snack-finished') showBanner('包装袋藏好了！', 0.8);
    else if (event.type === 'comic-open') { showBanner('漫画翻到关键页', 0.8); audio.page(); }
    else if (event.type === 'plane-folded') showBanner('折好了！', 0.65);
    else if (event.type === 'plane-fold') audio.paper();
    else if (event.type === 'plane-thrown') {
      showBanner(`${event.mode === 'far' ? '飞到讲台了！' : '飞到同桌那儿！'} +${event.score}`, 0.9);
      audio.paper();
    }
    else if (event.type === 'handheld-hit') { showBanner('撞到了！ · 怀疑 +7', 0.75); audio.fake(); }
    else if (event.type === 'handheld-dodge') audio.tap(410);
    else if (event.type === 'console-clear') showBanner('这一关过了！', 0.8);
    else if (event.type === 'chalk-near') { showBanner('擦边！', 0.65); audio.chalk(); }
    else if (event.type === 'class-event') { showBanner(event.event.label, 1); audio.event(); }
    else if (event.type === 'memory') { saveMemories(state.memories); showBanner(`回忆解锁：${event.memory.name}`, 1.1); }
    else if (event.type === 'near-miss') { showBanner(`极限收手 +${event.bonus}`, 1); audio.near(); }
    else if (event.type === 'caught') { resetPointer(); showBanner(`被${WATCHER_NAMES[event.watcher]}抓到了`, 1.4); shake = 1; audio.caught(); }
    else if (event.type === 'lesson-end') { resetPointer(); audio.bell(); }
    else if (event.type === 'prep') showIntermission();
    else if (event.type === 'lesson-start') { hideScreen(); showBanner(`第 ${state.lessonIndex + 1} 节 · ${LESSONS[state.lessonIndex].title}`, 1.5); }
    else if (event.type === 'won') { showEndScreen(true); audio.finish(); }
    else if (event.type === 'lost') showEndScreen(false);
  }
}

function startGame() {
  audio.unlock();
  state = createGameState({ memories: loadMemories() });
  resetPointer();
  doodleStrokes = [];
  spinAngle = 0;
  hud.classList.remove('is-hidden');
  hideScreen();
  showBanner('第一节 · 数学课', 1.5);
  audio.bell();
  updateHud();
}

function continueLesson() {
  if (!state || state.phase !== 'between') return;
  processEvents(startNextLesson(state));
}

function downloadShareCard() {
  if (!state) return;
  const card = document.createElement('canvas');
  card.width = 1080;
  card.height = 1080;
  drawShareCard(card.getContext('2d'), { nickname: '今日同学', score: Math.floor(state.score), rank: scoreRank(state.score), memories: state.memories });
  const link = document.createElement('a');
  link.download = '课桌下的宇宙-成绩单.png';
  link.href = card.toDataURL('image/png');
  link.click();
}

function cycleTool(direction) {
  if (!state) return;
  const index = TOOLS.findIndex((tool) => tool.id === state.activeTool);
  const next = TOOLS[(index + direction + TOOLS.length) % TOOLS.length];
  selectTool(next.id);
}

function selectTool(toolId) {
  if (!state || !setActiveTool(state, toolId)) return false;
  resetPointer();
  showBanner(TOOL_NAMES[state.activeTool], 0.45);
  audio.tap(260);
  return true;
}

screen.addEventListener('click', (event) => {
  if (event.target.closest('#continue-button')) { continueLesson(); return; }
  if (event.target.closest('#restart-button')) { startGame(); return; }
  if (event.target.closest('#download-card')) downloadShareCard();
});
document.getElementById('start-button').addEventListener('click', startGame);
bestScoreEl.textContent = best ? `本机最高脑洞值 ${best.toLocaleString('zh-CN')}` : '';

toolDock.addEventListener('click', (event) => {
  const button = event.target.closest('[data-tool]');
  if (!button || !state) return;
  selectTool(button.dataset.tool);
});

function packUp() {
  if (!state) return;
  resetPointer();
  processEvents(focusNow(state));
}

function launchPlane(mode) {
  const events = throwPlane(state, mode);
  if (events.length) resetPointer();
  processEvents(events);
}

function eraseDrawing(all = false) {
  if (state?.activeTool !== 'doodle' || state.phase !== 'playing') return;
  if (pointerId !== null) releasePointer({ pointerId, type: 'pointercancel' });
  if (all) doodleStrokes.length = 0;
  else doodleStrokes.pop();
}

stowButton.addEventListener('click', packUp);
undoButton.addEventListener('click', () => eraseDrawing());
clearButton.addEventListener('click', () => eraseDrawing(true));
planeActions.addEventListener('click', (event) => {
  const button = event.target.closest('[data-throw]');
  if (button) launchPlane(button.dataset.throw);
});
consoleActions.addEventListener('click', (event) => {
  const button = event.target.closest('[data-direction]');
  if (button) processEvents(applyGesture(state, 'console', Number(button.dataset.direction)));
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

function spinPointAngle(point) {
  const dx = point.x - SPIN.x;
  const dy = point.y - SPIN.y;
  const radius = Math.hypot(dx, dy);
  return radius >= SPIN.inner && radius <= SPIN.outer ? Math.atan2(dy, dx) : null;
}

function onPaper(point) {
  return point.x >= PAPER.left && point.x <= PAPER.right && point.y >= PAPER.top && point.y <= PAPER.bottom;
}

function handlePointerDown(event) {
  if (!state || state.phase !== 'playing' || state.focusLock > 0 || pointerId !== null || event.button !== 0) return;
  if (state.activeTool === 'plane' && state.planeFlight) return;
  const point = pointFromEvent(event);
  if (state.activeTool === 'console') {
    const dx = point.x - HANDHELD.x;
    const onButton = Math.abs(dx) >= HANDHELD.screenHalfWidth && Math.abs(dx) <= HANDHELD.halfWidth
      && Math.abs(point.y - HANDHELD.y) <= HANDHELD.halfHeight;
    if (onButton) {
      event.preventDefault();
      processEvents(applyGesture(state, 'console', Math.sign(dx)));
    }
    return;
  }
  if (state.activeTool === 'doodle' && !onPaper(point)) return;
  if (state.activeTool === 'spin' && spinPointAngle(point) === null) return;
  if (state.activeTool === 'plane' && (Math.abs(point.x - 480) > 118 || Math.abs(point.y - 520) > 83)) return;
  event.preventDefault();
  pointerId = event.pointerId;
  canvas.setPointerCapture?.(pointerId);
  lastPoint = pointerStart = point;
  if (state.activeTool === 'spin') lastGestureAngle = spinPointAngle(point);
  processEvents(setInputActive(state, true));
  if (state.activeTool === 'snack') processEvents(applyGesture(state, 'snack', 1));
}

function handlePointerMove(event) {
  if (!state || event.pointerId !== pointerId || state.phase !== 'playing') return;
  const point = pointFromEvent(event);
  if (state.activeTool === 'spin') {
    const angle = spinPointAngle(point);
    const previous = lastGestureAngle;
    lastGestureAngle = angle;
    if (angle === null || previous === null) {
      state.spinTurnBuffer = 0;
      return;
    }
    const delta = normalizeAngle(angle - previous);
    spinAngle += delta;
    processEvents(applyGesture(state, 'spin', delta / (Math.PI * 2)));
  } else if (state.activeTool === 'doodle') {
    if (!onPaper(point)) {
      activeStroke = lastPoint = null;
      return;
    }
    if (!lastPoint) { lastPoint = point; return; }
    const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
    if (distance < 2) return;
    if (!activeStroke) {
      activeStroke = [lastPoint];
      doodleStrokes.push(activeStroke);
    }
    activeStroke.push(point);
    processEvents(applyGesture(state, 'doodle', distance / 100));
  } else if (state.activeTool === 'note' && lastPoint) {
    processEvents(applyGesture(state, 'note', Math.abs(point.x - lastPoint.x) / 100));
  } else if (state.activeTool === 'comic' && lastPoint) {
    processEvents(applyGesture(state, 'comic', (point.y - lastPoint.y) / 180));
  }
  lastPoint = point;
}

function releasePointer(event) {
  if (!state || event.pointerId !== pointerId) return;
  if (event.type === 'pointerup' && state.activeTool === 'plane') {
    const end = pointFromEvent(event);
    const dx = end.x - pointerStart.x;
    const dy = end.y - pointerStart.y;
    if (state.planeFolds === PLANE_FOLDS.length && dy < -42 && -dy > Math.abs(dx)) launchPlane('short');
    else if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) processEvents(applyGesture(state, 'plane', Math.sign(dx)));
  }
  processEvents(setInputActive(state, false));
  resetPointer(false);
}

function resetPointer(releaseCapture = true) {
  const released = pointerId;
  pointerId = null;
  lastPoint = pointerStart = null;
  lastGestureAngle = null;
  activeStroke = null;
  if (releaseCapture && released !== null && canvas.hasPointerCapture?.(released)) canvas.releasePointerCapture(released);
}

canvas.addEventListener('pointerdown', handlePointerDown);
canvas.addEventListener('pointermove', handlePointerMove);
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', (event) => {
  // A prior drag can lose capture just after a new pointerdown with the same ID.
  if (event.buttons === 0 && !canvas.hasPointerCapture(event.pointerId)) releasePointer(event);
});
window.addEventListener('pointerup', releasePointer);
window.addEventListener('blur', packUp);
shell.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  if (!state || state.phase !== 'playing' || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  if (TOOL_KEYS[event.code]) {
    event.preventDefault();
    selectTool(TOOL_KEYS[event.code]);
    return;
  }
  if (event.code === 'KeyQ' || event.code === 'KeyE') {
    event.preventDefault();
    if (!event.repeat) cycleTool(event.code === 'KeyQ' ? -1 : 1);
    return;
  }
  if (event.code === 'KeyZ' && state.activeTool === 'doodle') {
    event.preventDefault();
    if (!event.repeat) eraseDrawing(event.shiftKey);
    return;
  }
  if (event.code === 'Space' || event.code === 'Escape') {
    event.preventDefault();
    if (!event.repeat) packUp();
    return;
  }
  const arrow = event.key || event.code;
  if (state.activeTool === 'console' && (arrow === 'ArrowLeft' || arrow === 'ArrowRight')) {
    event.preventDefault();
    processEvents(applyGesture(state, 'console', arrow === 'ArrowLeft' ? -1 : 1));
  }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') packUp(); });

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
  function speak(text) {
    if (isMuted || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.92;
    utterance.pitch = 0.8;
    utterance.volume = 0.72;
    window.speechSynthesis.speak(utterance);
  }
  return {
    unlock,
    setMuted(value) { isMuted = value; if (isMuted && 'speechSynthesis' in window) window.speechSynthesis.cancel(); },
    tap(frequency) { tone(frequency, 0.045, 'triangle', 0, frequency * 1.15); },
    warning(kind) { const base = kind === 'teacher' ? 620 : kind === 'corridor' ? 460 : 760; tone(base, 0.1, 'square'); tone(base * 1.18, 0.1, 'square', 0.12); },
    fake() { tone(420, 0.08, 'triangle', 0, 260); },
    page() { tone(260, 0.08, 'triangle', 0, 190); },
    paper() { tone(300, 0.12, 'triangle', 0, 520); },
    crunch() { tone(150, 0.08, 'square', 0, 90); },
    chalk() { tone(230, 0.12, 'sawtooth', 0, 170); },
    event() { tone(510, 0.08, 'sine'); },
    teacherLine(text) { tone(190, 0.18, 'triangle', 0, 150); speak(text); },
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
  renderClassroom(g, width, height, { state, time, teacherTurn, corridorPresence, monitorTurn, shake, spinAngle, doodleStrokes });
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

render(0);
requestAnimationFrame(frame);

window.__classroomGame = {
  start: startGame,
  get state() { return state; },
  tools: TOOLS,
};
