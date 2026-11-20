export const MAX_NAME_LENGTH = 10;
export const MAX_SCORE = 20000;

export function normalizeNickname(value) {
  const cleaned = String(value || '')
    .replace(/[<>\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return cleaned || '匿名同学';
}

export function normalizeScore(value) {
  return Math.max(0, Math.min(MAX_SCORE, Math.floor(Number(value) || 0)));
}

export function normalizeRows(rows, limit = 10) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({ nickname: normalizeNickname(row?.nickname), score: normalizeScore(row?.score) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname, 'zh-CN'))
    .slice(0, Math.max(1, limit));
}

export function mergeScore(rows, entry, limit = 10) {
  const normalized = { nickname: normalizeNickname(entry?.nickname), score: normalizeScore(entry?.score) };
  const current = normalizeRows(rows, 100).find((row) => row.nickname === normalized.nickname);
  const kept = normalizeRows(rows, 100).filter((row) => row.nickname !== normalized.nickname);
  if (normalized.score > 0) kept.push(current && current.score > normalized.score ? current : normalized);
  return normalizeRows(kept, limit);
}

export function validRunSummary(run) {
  const duration = Number(run?.durationMs);
  const inputs = Number(run?.inputs);
  const lessons = Number(run?.lessons);
  return Number.isFinite(duration) && duration >= 8000 && duration <= 360000
    && Number.isInteger(inputs) && inputs >= 0 && inputs <= 8000
    && Number.isInteger(lessons) && lessons >= 1 && lessons <= 3;
}
