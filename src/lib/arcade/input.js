/**
 * One set of controls for every cabinet game.
 *
 * A game asks "is left held?" and never has to care whether that came from a
 * key, a thumb on the on-screen pad, or a mouse. That matters because the
 * cabinet has to work three ways at once:
 *
 *   - WASD, because that is what Kieran asked for, with the arrow keys
 *     alongside since half of people will reach for those first
 *   - the painted buttons on the machine itself, which is the only option on
 *     a phone
 *   - J / K for the two action buttons, so a right hand resting over the
 *     home row can press fire without crossing over the left hand
 *
 * `held` is for steering — you want the paddle to keep moving while the key
 * is down. `pressed` is for firing and jumping — it goes true exactly once
 * per press, so leaning on the key does not empty the magazine.
 */

export const BUTTONS = ['left', 'right', 'up', 'down', 'a', 'b'];

/**
 * One letter per button, for the log. Written out rather than derived from
 * the array above so that reordering BUTTONS can never silently change what
 * an old recording means.
 */
const LETTER = { left: 'l', right: 'r', up: 'u', down: 'd', a: 'a', b: 'b' };

/**
 * How much of a go gets written down.
 *
 * A busy game of Stacker is maybe fifteen presses a second; at roughly six
 * characters an event that is 5KB a minute, and a long go could run for ten.
 * Storing all of it for every play on a free-plan database is not a sensible
 * thing to do to the site's storage for a feature nobody is using yet, so the
 * log stops at this many characters and says so by ending with a "+".
 *
 * A truncated log cannot verify a score. That is honest and stated on the
 * page: the log is evidence, not proof, and a go that ran past the cap simply
 * has less of it. When replay checking is actually built, this cap gets
 * revisited with real numbers rather than this guess.
 */
export const LOG_LIMIT = 6000;

const KEY_MAP = {
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyJ: 'a', Space: 'a', Enter: 'a',
  KeyK: 'b', KeyL: 'b',
};

export default function createInput() {
  const down = new Set();
  const edge = new Set();     // pressed since the game last looked

  // The log, when the machine has asked for one. `clock` returns the tick the
  // press will land on — the next one to run, since events arrive between
  // frames — so a recording can be lined up against a replay later.
  let log = null;
  let logged = 0;
  let clipped = false;
  let clock = () => 0;

  const note = (b, isDown) => {
    if (!log || clipped) return;
    const entry = `${clock()}${LETTER[b]}${isDown ? 1 : 0}`;
    if (logged + entry.length + 1 > LOG_LIMIT) { clipped = true; return; }
    log.push(entry);
    logged += entry.length + 1;
  };

  const press = (b) => {
    if (!BUTTONS.includes(b)) return;
    if (!down.has(b)) { edge.add(b); note(b, true); }
    down.add(b);
  };
  const release = (b) => {
    if (down.has(b)) note(b, false);
    down.delete(b);
  };

  const onKeyDown = (e) => {
    const b = KEY_MAP[e.code];
    if (!b) return;
    // Space and the arrows scroll the page, which is ruinous mid-game.
    e.preventDefault();
    if (e.repeat) return;   // held keys must not re-fire `pressed`
    press(b);
  };
  const onKeyUp = (e) => {
    const b = KEY_MAP[e.code];
    if (!b) return;
    e.preventDefault();
    release(b);
  };
  // A key released while the page was in the background never sends keyup,
  // so the paddle would run into the wall for ever on return.
  const onBlur = () => { down.clear(); };

  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp, { passive: false });
  window.addEventListener('blur', onBlur);

  return {
    held: (b) => down.has(b),
    pressed: (b) => {
      if (!edge.has(b)) return false;
      edge.delete(b);
      return true;
    },
    // The on-screen pad and any mouse control call these.
    press,
    release,
    clear: () => { down.clear(); edge.clear(); },

    /** Start writing down what gets pressed, against the machine's tick. */
    record(tickFn) {
      log = [];
      logged = 0;
      clipped = false;
      clock = typeof tickFn === 'function' ? tickFn : () => 0;
    },
    stopRecording() { log = null; clock = () => 0; },
    recording: () => (log ? log.join(',') + (clipped ? ',+' : '') : ''),
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      down.clear();
      edge.clear();
    },
  };
}
