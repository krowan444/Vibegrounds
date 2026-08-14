/**
 * TagPicker — a row of one-click tag suggestions that sit under the tags input.
 *
 * People were being asked to invent tags from a blank box, which is the sort of
 * small friction that makes someone skip the field entirely. Now they get the
 * obvious ones for their category and can just tap them on and off.
 *
 * It deliberately does NOT replace the free-text input: the box stays the
 * source of truth, and this only edits the same comma-separated string. That
 * keeps custom tags working exactly as before.
 */

/** Tags worth offering on anything, whatever section it lands in. */
const COMMON_TAGS = [
  'ai-made',
  'solo-dev',
  'work-in-progress',
  'open-source',
  'free',
  'mobile-friendly',
  'no-signup',
];

/** Section-specific suggestions, keyed by the category slug. */
const CATEGORY_TAGS = {
  'games': [
    'multiplayer', 'singleplayer', 'pixel-art', 'retro', 'roguelike', 'puzzle',
    'platformer', 'arcade', 'horror', 'idle', '3d', 'browser-game',
  ],
  'ai-movies': [
    'short-film', 'animation', 'trailer', 'music-video', 'sci-fi', 'comedy',
    'horror', 'documentary', 'sora', 'veo', 'runway',
  ],
  'software': [
    'productivity', 'dev-tool', 'ai-tool', 'automation', 'chrome-extension',
    'cli', 'api', 'saas', 'no-code', 'open-source',
  ],
  'websites': [
    'landing-page', 'portfolio', 'blog', 'directory', 'ecommerce', 'one-page',
    'dark-mode', 'animated', 'minimal',
  ],
  'art': [
    'generative', 'pixel-art', 'midjourney', 'stable-diffusion', '3d', 'glitch',
    'wallpaper', 'abstract', 'character-design', 'photorealistic',
  ],
  'audio': [
    'music', 'lofi', 'ai-voice', 'sound-design', 'synthwave', 'chiptune',
    'remix', 'podcast', 'ambient',
  ],
  'experiments': [
    'prototype', 'unfinished', 'cursed', 'physics', 'shader', 'canvas',
    'webgl', 'chaos', 'one-hour-build',
  ],
  'memes': [
    'shitpost', 'relatable', 'ai-fail', 'dev-humor', 'retro', 'wholesome',
    'cursed',
  ],
  'other': [
    'weird', 'random', 'hard-to-explain', 'experimental',
  ],
};

/*
 * What it was built with, offered separately from what it is.
 *
 * This came from a visitor: the draw of a site like this is seeing *how*
 * something was made, not just that it exists. "Built with Cursor" is a
 * different kind of fact from "multiplayer", and mixing the two into one
 * undifferentiated pile makes both harder to scan — so they get their own
 * labelled row.
 *
 * They are ordinary tags underneath, sharing the same eight-tag budget and
 * the same comma-separated field. No new column, nothing to migrate.
 */
const TOOL_TAGS = [
  'claude',
  'cursor',
  'chatgpt',
  'copilot',
  'lovable',
  'bolt',
  'v0',
  'replit',
  'windsurf',
  'gemini',
  'figma-make',
  'hand-coded',
];

/** Split the raw input string into clean tags, the same way submit does. */
export function parseTags(raw) {
  return (raw || '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Suggestions for a category: its own list first, then the generic ones,
 * with duplicates dropped so nothing appears twice.
 */
export function suggestionsFor(category) {
  const own = CATEGORY_TAGS[category] || CATEGORY_TAGS.other;
  return [...new Set([...own, ...COMMON_TAGS])];
}

export default function TagPicker({
  value = '',
  onChange,
  category = 'other',
  max = 8,
  disabled = false,
}) {
  const selected = parseTags(value);
  const suggestions = suggestionsFor(category);
  const full = selected.length >= max;

  const toggle = (tag) => {
    const next = selected.includes(tag)
      ? selected.filter((t) => t !== tag)
      : [...selected, tag].slice(0, max);
    // Trailing ", " so whatever they type next lands in a fresh tag.
    onChange(next.join(', '));
  };

  const chip = (tag) => {
    const on = selected.includes(tag);
    return (
      <button
        key={tag}
        type="button"
        className={on ? 'vg-tag-chip is-on' : 'vg-tag-chip'}
        // Only block the ones you can't add — you can always remove.
        disabled={disabled || (full && !on)}
        aria-pressed={on}
        onClick={() => toggle(tag)}
      >
        {on ? '✓ ' : '+ '}{tag}
      </button>
    );
  };

  return (
    <div className="vg-tagpicker">
      <div className="vg-tagpicker-head">
        <span>Tap to add</span>
        <span className={full ? 'vg-tagpicker-count is-full' : 'vg-tagpicker-count'}>
          {selected.length}/{max}
        </span>
      </div>

      <div className="vg-tagpicker-chips">{suggestions.map(chip)}</div>

      <div className="vg-tagpicker-head vg-tagpicker-head-sub">
        <span>🛠 Built with</span>
      </div>
      <div className="vg-tagpicker-chips">{TOOL_TAGS.map(chip)}</div>

      {full && (
        <div className="vg-tagpicker-note">
          That&#39;s the {max} tag limit — remove one to swap it out.
        </div>
      )}
    </div>
  );
}
