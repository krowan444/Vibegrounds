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

  const press = (b) => {
    if (!BUTTONS.includes(b)) return;
    if (!down.has(b)) edge.add(b);
    down.add(b);
  };
  const release = (b) => { down.delete(b); };

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
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      down.clear();
      edge.clear();
    },
  };
}
