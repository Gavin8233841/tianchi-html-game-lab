import { mergeScore, normalizeNickname, normalizeRows, normalizeScore } from './leaderboard-core.js';

const SCORE_KEY = 'classroom_slacking_scores_v2';
const NAME_KEY = 'classroom_slacking_name_v2';

function readLocalRows() {
  try {
    return normalizeRows(JSON.parse(localStorage.getItem(SCORE_KEY) || '[]'));
  } catch {
    return [];
  }
}

function writeLocalRows(rows) {
  try {
    localStorage.setItem(SCORE_KEY, JSON.stringify(normalizeRows(rows)));
  } catch {
    // Private browsing can disable storage; remote ranking still works.
  }
}

export function loadNickname() {
  try {
    return normalizeNickname(localStorage.getItem(NAME_KEY) || `同学${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`);
  } catch {
    return '匿名同学';
  }
}

export function saveNickname(value) {
  const nickname = normalizeNickname(value);
  try { localStorage.setItem(NAME_KEY, nickname); } catch { /* Optional preference. */ }
  return nickname;
}

export function createLeaderboard(endpoint = '/api/classroom-scores') {
  let online = false;

  async function fetchRemote() {
    const response = await fetch(endpoint, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`leaderboard ${response.status}`);
    const payload = await response.json();
    online = true;
    return { rows: normalizeRows(payload.scores), scope: payload.scope || 'global' };
  }

  return {
    get online() { return online; },
    async list() {
      try {
        const remote = await fetchRemote();
        writeLocalRows(remote.rows);
        return { ...remote, online: true };
      } catch {
        online = false;
        return { rows: readLocalRows(), online: false, scope: 'local' };
      }
    },
    async submit(nickname, score, run) {
      const entry = { nickname: saveNickname(nickname), score: normalizeScore(score) };
      const localRows = mergeScore(readLocalRows(), entry);
      writeLocalRows(localRows);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ ...entry, run }),
        });
        if (!response.ok) throw new Error(`leaderboard ${response.status}`);
        const payload = await response.json();
        const rows = normalizeRows(payload.scores);
        writeLocalRows(rows);
        online = true;
        return { rows, online: true, scope: payload.scope || 'global' };
      } catch {
        online = false;
        return { rows: localRows, online: false, scope: 'local' };
      }
    },
  };
}
