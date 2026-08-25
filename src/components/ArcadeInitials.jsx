import { useEffect, useRef, useState } from 'react';

/**
 * ENTER YOUR NAME.
 *
 * The three letters you put in after a good go, and then never have to think
 * about again — the machine remembers them and every game after this one
 * comes up already knowing who you are.
 *
 * Two ways in, and both had to work:
 *
 *   the stick    up and down change the character, left and right move
 *                between the three slots, A locks it in. This is the real
 *                thing, and on a phone it is the only thing.
 *   the keyboard just type it. Letters and numbers fill the slot and move on,
 *                backspace goes back, Enter locks it in.
 *
 * The second one needs the keyboard taken off the arcade input layer while
 * this is open. To a game, A means left and W means up, so typing "WAD" would
 * have shoved the stick around instead of writing anything. So the panel
 * suspends the machine's key capture on the way in and gives it back on the
 * way out — the painted buttons carry on working throughout, because they
 * call the input layer directly and never touch a key event.
 */

// A to Z then 0 to 9. Real cabinets took digits and people want 1UP.
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

/** Where to start somebody who has never done this. */
function seedFrom(username) {
  const clean = (username || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return [0, 1, 2].map((i) => {
    const at = CHARS.indexOf(clean[i]);
    return at === -1 ? 0 : at;   // 0 is 'A'
  });
}

export default function ArcadeInitials({
  input,
  username,
  current,
  onSave,
  onSkip,
  saving = false,
  error = '',
  madeTheBoard = false,
}) {
  const start = current
    ? current.split('').map((c) => Math.max(0, CHARS.indexOf(c)))
    : seedFrom(username);

  const [slots, setSlots] = useState(start);
  const [at, setAt] = useState(0);

  // The polling loop and the key handler both need the newest state, and both
  // outlive the render that created them.
  const live = useRef({});
  live.current = { slots, at, saving, onSave };

  const move = (by) => setAt((a) => (a + by + 3) % 3);

  const bump = (by) => setSlots((s) => {
    const next = [...s];
    const i = live.current.at;
    next[i] = (next[i] + by + CHARS.length) % CHARS.length;
    return next;
  });

  const put = (ch) => {
    const idx = CHARS.indexOf(ch);
    if (idx === -1) return;
    setSlots((s) => {
      const next = [...s];
      next[live.current.at] = idx;
      return next;
    });
    // Typing walks forward, and stops at the last slot rather than wrapping
    // round to overwrite the first character you just typed.
    setAt((a) => Math.min(2, a + 1));
  };

  const commit = () => {
    if (live.current.saving) return;
    live.current.onSave(live.current.slots.map((i) => CHARS[i]).join(''));
  };

  // ---- the stick ----
  useEffect(() => {
    if (!input) return undefined;
    let raf = 0;
    let repeatAt = 0;
    const FIRST = 360;
    const AGAIN = 90;

    const look = () => {
      const now = performance.now();

      if (input.pressed('up')) { bump(1); repeatAt = now + FIRST; }
      else if (input.pressed('down')) { bump(-1); repeatAt = now + FIRST; }
      else if (input.held('up') && now > repeatAt) { bump(1); repeatAt = now + AGAIN; }
      else if (input.held('down') && now > repeatAt) { bump(-1); repeatAt = now + AGAIN; }
      else if (!input.held('up') && !input.held('down')) repeatAt = 0;

      if (input.pressed('left')) move(-1);
      if (input.pressed('right')) move(1);
      if (input.pressed('a')) commit();

      raf = requestAnimationFrame(look);
    };

    // Anything still held from the go that just ended would otherwise submit
    // the name the instant this appeared.
    input.clear();
    raf = requestAnimationFrame(look);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  // ---- the keyboard ----
  useEffect(() => {
    if (!input) return undefined;
    input.suspend();

    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Enter') { e.preventDefault(); commit(); return; }
      if (e.key === 'Backspace') {
        e.preventDefault();
        setAt((a) => Math.max(0, a - 1));
        return;
      }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); move(-1); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); move(1); return; }
      if (e.key === 'ArrowUp')    { e.preventDefault(); bump(1); return; }
      if (e.key === 'ArrowDown')  { e.preventDefault(); bump(-1); return; }

      if (e.key.length === 1) {
        const ch = e.key.toUpperCase();
        if (CHARS.includes(ch)) { e.preventDefault(); put(ch); }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      input.resume();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const word = slots.map((i) => CHARS[i]).join('');

  return (
    <div className="vg-initials">
      <div className="vg-initials-head">
        {madeTheBoard ? 'YOU MADE THE BOARD' : 'NEW CHALLENGER'}
      </div>
      <div className="vg-initials-sub">ENTER YOUR NAME</div>

      <div className="vg-initials-slots" role="group" aria-label="Your three character arcade name">
        {slots.map((c, i) => (
          <button
            key={i}
            type="button"
            className={`vg-initials-slot ${i === at ? 'is-on' : ''}`}
            aria-label={`Character ${i + 1}: ${CHARS[c]}`}
            onClick={() => setAt(i)}
          >
            <span className="vg-initials-up" aria-hidden="true">▲</span>
            <span className="vg-initials-char">{CHARS[c]}</span>
            <span className="vg-initials-down" aria-hidden="true">▼</span>
          </button>
        ))}
      </div>

      <p className="vg-initials-how">
        Stick up and down to change · left and right to move · <b>A</b> to lock it in.
        Or just type it.
      </p>

      {error && <p className="vg-initials-error">{error}</p>}

      <div className="vg-initials-buttons">
        <button type="button" className="retro-cta" disabled={saving} onClick={commit}>
          {saving ? 'SAVING…' : `LOCK IN ${word}`}
        </button>
        {/* Skippable on purpose. Being made to name yourself before you are
            allowed to see your score would be a toll gate, and this is
            supposed to be the fun bit. Skipping shows the first three letters
            of the username on the board instead, and the offer comes back. */}
        <button type="button" className="vg-initials-skip" onClick={onSkip}>
          not now
        </button>
      </div>
    </div>
  );
}
