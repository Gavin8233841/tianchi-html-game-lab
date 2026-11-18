import { CONFIG } from '../core/config.js';

function chip(text, kind) {
  const el = document.createElement('span');
  el.className = kind ? `hud-chip ${kind}` : 'hud-chip';
  el.textContent = text;
  return el;
}

function bar(label, value, goal, unit, kind) {
  const wrap = document.createElement('div');
  wrap.className = `bar-wrap ${kind}${value >= goal ? ' full' : ''}`;
  const lab = document.createElement('div');
  lab.className = 'bar-label';
  lab.textContent = `${label} ${Math.min(value, goal)}/${goal}${unit}`;
  const track = document.createElement('div');
  track.className = 'bar-track';
  const fill = document.createElement('div');
  fill.className = 'bar-fill';
  fill.style.width = `${Math.min(100, Math.round((value / goal) * 100))}%`;
  track.append(fill);
  wrap.append(lab, track);
  return wrap;
}

function badge(text, kind) {
  const el = document.createElement('span');
  el.className = `badge ${kind}`;
  el.textContent = text;
  return el;
}

export function createHud(root) {
  return {
    update(run) {
      const { water, stardust } = CONFIG.recipe;
      const totalWater = run.stored.water + run.carried.water;
      const totalStardust = run.stored.stardust + run.carried.stardust;
      root.replaceChildren();

      const stats = document.createElement('div');
      stats.className = 'hud-line';
      const shield = document.createElement('span');
      shield.className = 'hud-chip';
      shield.append('护盾');
      for (let i = 0; i < CONFIG.shield.max; i++) {
        const pip = document.createElement('span');
        pip.className = `shield-pip${i < run.shield ? ' on' : ''}`;
        shield.append(pip);
      }
      stats.append(chip(`层数 L${run.floor}`), chip(`体力 ${run.stamina}`), shield);
      if (run.interference && run.interference.remaining > 0) {
        stats.append(chip(`静电干扰 ×${run.interference.remaining}（扫描+${run.interference.extra}体力）`, 'jam'));
      }

      const bars = document.createElement('div');
      bars.className = 'hud-line hud-bars';
      bars.append(
        bar('水', totalWater, water, 'ml', 'water'),
        bar('星尘', totalStardust, stardust, 'g', 'stardust'),
      );

      const store = document.createElement('div');
      store.className = 'hud-line';
      store.append(
        badge(`已存 水${run.stored.water}ml · 星${run.stored.stardust}g`, 'stored'),
        badge(`未存 水${run.carried.water}ml · 星${run.carried.stardust}g`, 'carried'),
      );

      root.append(stats, bars, store);
    },
    clear() { root.replaceChildren(); },
  };
}