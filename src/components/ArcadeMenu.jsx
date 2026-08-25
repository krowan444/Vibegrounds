import { useEffect, useRef } from 'react';

/**
 * The game list, on the screen, where it belongs.
 *
 * It used to be a grid of tiles under the cabinet, which worked and felt
 * wrong: on a real machine you never pick your game from a leaflet taped to
 * the floor. You push the stick and the screen changes. So this is drawn
 * inside the bezel and driven by the same stick that plays the games.
 *
 * Three ways in, on purpose:
 *
 *   stick up/down + A   what the machine is for
 *   arrow keys + space  the same thing, for anybody on a keyboard
 *   tapping a row       because on a phone a tap is faster than a thumb on a
 *                       painted stick, and refusing that would be style
 *                       winning an argument with usability
 *
 * It is real text in the page rather than something painted on the canvas, so
 * a screen reader can read the list and a keyboard can tab through it. A menu
 * drawn in pixels would look marginally more authentic and would be a locked
 * door to anybody not using their eyes to read it.
 */
export default function ArcadeMenu({
  games,
  pickedId,
  onPick,
  onChoose,
  input,
  bestFor,
  active = true,
}) {
  const listRef = useRef(null);
  const rowsRef = useRef([]);

  // The handlers change every render, and the polling loop must always call
  // the newest ones or it selects using a stale index.
  const live = useRef({});
  live.current = { games, pickedId, onPick, onChoose };

  useEffect(() => {
    if (!active || !input) return undefined;
    let raf = 0;

    // Held-to-repeat, so running down a list of nine does not need nine
    // separate pushes — but with a wait before the first repeat, or a normal
    // push skips two rows.
    let repeatAt = 0;
    const FIRST = 380;
    const AGAIN = 110;

    const move = (by) => {
      const { games: gs, pickedId: id, onPick: pick } = live.current;
      if (!gs.length) return;
      const at = Math.max(0, gs.findIndex((g) => g.meta.id === id));
      // Wraps. Falling off the bottom of a nine-item list and stopping dead
      // feels broken on a machine where the stick has no end stops.
      const next = (at + by + gs.length) % gs.length;
      pick(gs[next].meta.id);
    };

    const look = () => {
      const now = performance.now();

      if (input.pressed('up')) { move(-1); repeatAt = now + FIRST; }
      else if (input.pressed('down')) { move(1); repeatAt = now + FIRST; }
      else if (input.held('up') && now > repeatAt) { move(-1); repeatAt = now + AGAIN; }
      else if (input.held('down') && now > repeatAt) { move(1); repeatAt = now + AGAIN; }
      else if (!input.held('up') && !input.held('down')) repeatAt = 0;

      // Left and right do the same as up and down here. On a stick that only
      // has one axis to hand, guessing wrong should not be a dead end.
      if (input.pressed('left')) move(-1);
      if (input.pressed('right')) move(1);

      if (input.pressed('a') || input.pressed('b')) live.current.onChoose?.();

      raf = requestAnimationFrame(look);
    };

    // Anything held over from the last go — a fire button still down at the
    // moment the game ended — would instantly choose again and start another
    // paid go the player never asked for.
    input.clear();
    raf = requestAnimationFrame(look);
    return () => cancelAnimationFrame(raf);
  }, [active, input]);

  // Keep the chosen row on screen when the stick runs past the bottom of the
  // little window. `nearest` so it does not jump the list about when the row
  // is already visible.
  useEffect(() => {
    const at = games.findIndex((g) => g.meta.id === pickedId);
    rowsRef.current[at]?.scrollIntoView({ block: 'nearest' });
  }, [pickedId, games]);

  const picked = games.find((g) => g.meta.id === pickedId) || games[0];

  return (
    <div className="vg-menu">
      <div className="vg-menu-head">
        <span className="vg-menu-title">SELECT GAME</span>
        <span className="vg-menu-hint" aria-hidden="true">▲▼ CHOOSE</span>
      </div>

      <ul className="vg-menu-list" ref={listRef} role="listbox" aria-label="Games in the cabinet">
        {games.map((g, i) => {
          const on = g.meta.id === pickedId;
          const best = bestFor?.(g.meta.id);
          return (
            <li key={g.meta.id} ref={(el) => { rowsRef.current[i] = el; }}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                className={`vg-menu-row ${on ? 'is-on' : ''}`}
                onClick={() => (on ? onChoose?.() : onPick(g.meta.id))}
              >
                <span className="vg-menu-arrow" aria-hidden="true">{on ? '▶' : ''}</span>
                <span className="vg-menu-name">{g.meta.name}</span>
                <span className="vg-menu-best">
                  {best ? `${best.username} ${best.score}` : '— — —'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Says out loud that the list runs past the bottom of the screen. The
          list has no scrollbar on purpose — a scrollbar down the side of a
          CRT gives the whole thing away — so without this a half-visible row
          reads as a rendering fault rather than as more games. */}
      <div className="vg-menu-more" aria-hidden="true">▾ MORE ▾</div>

      <div className="vg-menu-foot">
        <p className="vg-menu-blurb">{picked?.meta.blurb}</p>
        <p className="vg-menu-how">{picked?.meta.how}</p>
      </div>
    </div>
  );
}
