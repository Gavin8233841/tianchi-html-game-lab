// ZzFX 参数序：volume, randomness, frequency, attack, sustain, release, shape,
// shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise,
// modulation, bitCrush, delay, sustainVolume, decay, tremolo, filter
// 全局 zzfxV=0.3，下列 volume≤0.7 → 实际峰值 ≤0.21，不炸耳。
// 多layer预设用 attack 错峰包络峰值实现琶音/序进（ZzFX 无 onset 偏移参数）。
const PRESETS = {
  dig: [[0.5, 0, 520, 0, 0.02, 0.06, 5, 1]],
  pickupWater: [[0.5, 0, 660, 0, 0.06, 0.08, 0, 1, 0, 0, 330, 0.06]],
  pickupStardust: [[0.45, 0, 1568, 0, 0.04, 0.18, 0, 1, 0, 0, 0, 0, 0.05, 0, 8, 0, 0.06, 1, 0, 0.3]],
  mine: [
    [0.7, 0, 220, 0, 0.05, 0.15, 4, 1, 0, 0, 0, 0, 0, 1, 0, 4],
    [0.7, 0, 110, 0, 0.05, 0.18, 0, 1, -3],
  ],
  death: [
    [0.5, 0, 660, 0, 0.04, 0.08, 1, 1],
    [0.5, 0, 494, 0.12, 0.04, 0.08, 1, 1],
    [0.5, 0, 330, 0.24, 0.06, 0.12, 1, 1],
    [0.35, 0, 400, 0.3, 0.05, 0.35, 4, 1, 0, 0, 0, 0, 0, 1],
  ],
  exit: [
    [0.45, 0, 523, 0, 0.04, 0.16, 0, 1],
    [0.45, 0, 659, 0.07, 0.04, 0.16, 0, 1],
    [0.45, 0, 784, 0.14, 0.04, 0.16, 0, 1],
    [0.45, 0, 1047, 0.21, 0.06, 0.22, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0.06],
  ],
  uiClick: [[0.35, 0, 880, 0, 0.005, 0.04, 5, 1]],
  probe: [[0.35, 0, 740, 0.01, 0.06, 0.12, 0, 1, 0, 0, 180, 0.06]],
  probeMine: [[0.45, 0, 150, 0, 0.04, 0.16, 4, 1, -2]],
  flag: [[0.3, 0, 1300, 0, 0.003, 0.03, 5, 1]],
  eventUp: [[0.5, 0, 523, 0, 0.08, 0.12, 0, 1, 0, 0, 262, 0.08]],
  eventDown: [[0.5, 0, 523, 0, 0.08, 0.12, 0, 1, 0, 0, -196, 0.08]],
  mixShake: [[0.35, 0, 300, 0.01, 0.12, 0.04, 4, 1, 0, 0, 0, 0, 0.09, 1, 0, 6, 0, 1, 0, 0.6]],
  fulfill: [
    [0.5, 0, 523, 0, 0.06, 0.2, 1, 1],
    [0.5, 0, 659, 0.09, 0.06, 0.2, 1, 1],
    [0.5, 0, 784, 0.18, 0.06, 0.2, 1, 1],
    [0.5, 0, 1047, 0.27, 0.1, 0.3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0.08],
  ],
  discount: [[0.4, 0, 440, 0, 0.1, 0.15, 0, 1, 0, 0, -110, 0.1]],
};

const CHAIN_BASE = 440;

export function createAudio() {
  let mod = null;
  let loading = null;
  let failed = false;
  let unlocked = false;
  let muted = false;
  let shakeSource = null;
  const pending = [];

  function load() {
    if (mod || loading || failed) return loading;
    loading = import('../vendor/zzfxmicro.js')
      .then((m) => {
        mod = m;
        return m;
      })
      .catch(() => {
        failed = true;
        pending.length = 0;
        return null;
      });
    return loading;
  }

  function flush() {
    const jobs = pending.splice(0);
    for (const job of jobs) job();
  }

  function emit(params) {
    if (muted || failed) return;
    if (mod) {
      mod.zzfx(...params);
      return;
    }
    if (pending.length >= 8) pending.shift();
    pending.push(() => {
      if (!muted && mod) mod.zzfx(...params);
    });
  }

  function stopShake() {
    if (!shakeSource) return;
    try { shakeSource.stop(); } catch { /* 已自然结束 */ }
    shakeSource = null;
  }

  function startShake() {
    stopShake();
    if (muted || failed) return;
    if (!mod) {
      if (pending.length >= 8) pending.shift();
      pending.push(() => startShake());
      return;
    }
    shakeSource = mod.zzfx(...PRESETS.mixShake[0]);
    shakeSource.loop = true;
  }

  return {
    unlock() {
      unlocked = true;
      const p = load();
      if (!p) {
        if (mod && mod.zzfxX.state === 'suspended' && document.visibilityState !== 'hidden') mod.zzfxX.resume();
        return;
      }
      p.then((m) => {
        if (!m) return;
        if (m.zzfxX.state === 'suspended' && document.visibilityState !== 'hidden') m.zzfxX.resume();
        flush();
      });
    },
    suspend() {
      if (mod && mod.zzfxX.state === 'running') mod.zzfxX.suspend();
    },
    resume() {
      if (mod && unlocked && mod.zzfxX.state === 'suspended') mod.zzfxX.resume();
    },
    setMuted(value) {
      muted = !!value;
      if (muted) stopShake();
    },
    isMuted() { return muted; },
    play(name) {
      const layers = PRESETS[name];
      if (!layers) return;
      for (const params of layers) emit(params);
    },
    playChain(order) {
      const semitone = Math.min(order, 24);
      const freq = CHAIN_BASE * Math.pow(2, semitone / 12);
      emit([0.4, 0, freq, 0, 0.01, 0.05, 5, 1]);
    },
    startShake,
    stopShake,
  };
}