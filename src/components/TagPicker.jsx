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

/*
 * Where it actually runs. Asked as tags rather than a database column
 * because it is the same kind of fact as everything else here, and because
 * "does this work on my phone" is the single most common thing a visitor
 * wants to know before clicking a link they have never heard of.
 */
const PLATFORM_TAGS = ['works-on-mobile', 'desktop-only', 'mobile-only'];

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

/*
 * Words that mean a tag without being the tag. Without these the matcher is
 * close to useless: people write "made with Claude Code", "built in GPT",
 * "a 2D platformer" — none of which contain the literal tag string.
 *
 * Deliberately conservative. A wrong tag is worse than a missing one, because
 * the missing one costs a click and the wrong one has to be spotted and
 * removed — and mostly will not be.
 */
const ALIASES = {
  claude:        ['claude code', 'anthropic', 'sonnet', 'opus'],
  chatgpt:       ['chat gpt', 'gpt-4', 'gpt4', 'gpt-5', 'openai'],
  copilot:       ['github copilot'],
  v0:            ['v zero', 'vercel v0'],
  'hand-coded':  ['by hand', 'from scratch', 'no ai', 'handwritten'],
  'pixel-art':   ['pixelart', '8-bit', '8 bit', '16-bit', '16 bit', 'sprite'],
  multiplayer:   ['co-op', 'coop', 'versus', 'pvp', 'two player', '2 player'],
  singleplayer:  ['single player', 'solo play'],
  roguelike:     ['rogue-like', 'roguelite', 'permadeath'],
  platformer:    ['jumping', 'side-scroller', 'side scroller'],
  puzzle:        ['puzzles', 'brain teaser'],
  '3d':          ['three.js', 'threejs', 'webgl'],
  horror:        ['scary', 'creepy', 'spooky'],
  comedy:        ['funny', 'humour', 'humor', 'joke'],
  productivity:  ['todo', 'to-do', 'task manager', 'workflow'],
  'landing-page':['landing site', 'one pager'],
  portfolio:     ['showcase site'],
  ecommerce:     ['e-commerce', 'shop', 'store', 'checkout'],
  'dark-mode':   ['dark theme'],
  generative:    ['procedural', 'generated art'],
  music:         ['soundtrack', 'song', 'audio track'],
  'ai-voice':    ['text to speech', 'tts', 'voice over', 'voiceover'],
  'work-in-progress': ['wip', 'unfinished', 'early days', 'prototype'],
  'open-source': ['github repo', 'source available', 'mit licence', 'mit license'],
  'mobile-friendly': ['responsive', 'works on mobile', 'mobile first'],
  free:          ['no cost', 'free to play', 'completely free'],
  'no-signup':   ['no account', 'no login', 'without signing up'],
  'works-on-mobile': ['works on phone', 'phone and desktop', 'any device', 'mobile and desktop'],
  'desktop-only':    ['desktop only', 'not on mobile', 'keyboard required', 'needs a keyboard', 'pc only'],
  'mobile-only':     ['phone only', 'mobile only', 'built for phones'],
};

/**
 * Which of the known tags does this text appear to be about?
 *
 * Plain substring matching would tag anything mentioning "art" with
 * "pixel-art" and anything with "free" inside "freedom". So: normalise
 * punctuation to spaces, then require whole-word matches with padding — the
 * cheapest thing that behaves correctly on real sentences.
 *
 * Kept as a standalone pure function on purpose. Swapping this for a real
 * model call later means replacing one function and nothing else.
 */
export function suggestFromText(text, vocabulary) {
  const hay = ` ${String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  if (hay.length < 12) return [];

  // Also tries the plain plural, because people write "wallpapers",
  // "puzzles" and "platformers" far more often than the singular. Only the
  // trailing -s: anything cleverer starts inventing stems and mis-firing.
  const has = (phrase) => {
    const base = phrase.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (base.length < 2) return false;
    return hay.includes(` ${base} `) || hay.includes(` ${base}s `);
  };

  return vocabulary.filter((tag) => {
    if (has(tag)) return true;
    return (ALIASES[tag] || []).some(has);
  });
}

export default function TagPicker({
  value = '',
  onChange,
  category = 'other',
  max = 12,
  disabled = false,
  // What the person has already written. Optional: without it the button
  // simply does not appear, so this stays a drop-in for callers that have
  // no description to offer.
  sourceText = '',
}) {
  const selected = parseTags(value);
  const suggestions = suggestionsFor(category);
  const full = selected.length >= max;

  // Everything the matcher is allowed to propose: this category's tags, the
  // generic ones, and the tools. Never invents a tag outside the vocabulary.
  const vocabulary = [...new Set([...suggestions, ...TOOL_TAGS, ...PLATFORM_TAGS])];
  const found = suggestFromText(sourceText, vocabulary);
  const fresh = found.filter((t) => !selected.includes(t));

  const applySuggested = () => {
    onChange([...selected, ...fresh].slice(0, max).join(', '));
  };

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

      {/* Only worth offering when it would actually do something: there is
          a description, and it contains tags they have not already picked. */}
      {fresh.length > 0 && !full && (
        <button
          type="button"
          className="vg-tagpicker-suggest"
          onClick={applySuggested}
          disabled={disabled}
        >
          ✨ Add {fresh.length} tag{fresh.length > 1 ? 's' : ''} from your description
          <span className="vg-tagpicker-suggest-list">{fresh.slice(0, 6).join(' · ')}</span>
        </button>
      )}

      <div className="vg-tagpicker-chips">{suggestions.map(chip)}</div>

      <div className="vg-tagpicker-head vg-tagpicker-head-sub">
        <span>📱 Where does it work?</span>
      </div>
      <div className="vg-tagpicker-chips">{PLATFORM_TAGS.map(chip)}</div>

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
