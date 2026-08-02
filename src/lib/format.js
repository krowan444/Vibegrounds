/** Small shared formatters so every page speaks the same language. */

export function compactNumber(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  return String(v);
}

export function timeAgo(date) {
  if (!date) return '';
  const then = new Date(date).getTime();
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function shortDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** Arcade-cabinet colour coding for a 0–5 score. */
export function scoreColor(score) {
  const s = Number(score) || 0;
  if (s >= 4.5) return '#ffd700';
  if (s >= 4.0) return '#66ff66';
  if (s >= 3.0) return '#e8a317';
  if (s >= 2.0) return '#cc7722';
  return '#8d8d8d';
}

/**
 * A submission nobody has voted on has no score — it has an absence of one.
 * Printing "0.00" next to it reads as "everyone hated this", which is the
 * opposite of true and actively discourages the first vote. Anything unvoted
 * gets a dash and the muted colour instead.
 */
export function isUnrated(creation) {
  return !creation || Number(creation.vote_count) === 0;
}

/** The number to print in a score slot, or "–" when there is nothing to print. */
export function scoreLabel(creation) {
  if (isUnrated(creation)) return '–';
  return Number(creation.score).toFixed(2);
}

/** Colour for that slot — unrated is deliberately quiet, not alarming. */
export function scoreLabelColor(creation) {
  if (isUnrated(creation)) return '#6f6f6f';
  return scoreColor(creation.score);
}

export const TIER_COLORS = {
  common:    '#9e9e9e',
  uncommon:  '#66bb6a',
  rare:      '#4fc3f7',
  epic:      '#ba68c8',
  legendary: '#ffd700',
  mythic:    '#ff5c8a',
};

export const RARITY_COLORS = {
  'Common':     '#9e9e9e',
  'Uncommon':   '#66bb6a',
  'Rare':       '#4fc3f7',
  'Very Rare':  '#ba68c8',
  'Ultra Rare': '#ffd700',
  'Unobtained': '#5a5a5a',
};

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
