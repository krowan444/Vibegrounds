import { Children, useEffect, useRef, useState } from 'react';
import { BUTTONS } from '../lib/arcade/input';

/**
 * The machine.
 *
 * This is the second version. The first was an honest frame — a marquee, a
 * screen, a d-pad — and it read as a web page with a border round it rather
 * than as a machine you walk up to. Kieran's note was exactly right: it should
 * look far more like you are standing at an arcade cabinet, and you should
 * choose your next game on the screen rather than from a list underneath it.
 *
 * So: sloped side wings, a lit marquee, a hooded monitor behind curved glass
 * with scanlines, speaker grilles, a control deck tilted away from you in
 * perspective, a ball-top stick on a real shaft, concave buttons, and a coin
 * door with a slot and a return flap. The game list moved onto the screen and
 * is driven by the stick.
 *
 * Still no image file. A photograph of a cabinet would be a few hundred KB on
 * somebody's phone data for something that is only a frame, and — the part
 * that actually decides it — a picture cannot have working buttons, which are
 * the only controls that exist on a touchscreen.
 *
 * The stick leans and the buttons sink when they are pressed, whether that
 * press came from a thumb or from the W key. That is not decoration: on a
 * keyboard it is the only feedback that the machine heard you at all, and the
 * first version had none.
 */
export default function ArcadeCabinet({
  screenRef,
  input,
  marquee,
  score,
  status,
  children,
  playing = false,
  onStart,
  startLabel,
  startDisabled = false,
  inserting = false,
  freePlay = false,
}) {
  const heldRef = useRef(new Set());
  const [lit, setLit] = useState('');   // which buttons are down, as a string

  // A finger that slides off a button never sends the matching "up" event to
  // that button, so the ship would keep drifting left for ever. Releasing
  // everything on any pointer-up anywhere is blunt and correct.
  useEffect(() => {
    const releaseAll = () => {
      heldRef.current.forEach((b) => input?.release(b));
      heldRef.current.clear();
    };
    window.addEventListener('pointerup', releaseAll);
    window.addEventListener('pointercancel', releaseAll);
    return () => {
      window.removeEventListener('pointerup', releaseAll);
      window.removeEventListener('pointercancel', releaseAll);
    };
  }, [input]);

  // What the machine's own controls do is read from the input layer rather
  // than from the clicks on them, so a key press moves the stick too. Polled
  // on a frame because the input layer is imperative and has no events to
  // subscribe to — cheap, and only while this page is open.
  useEffect(() => {
    if (!input) return undefined;
    let raf = 0;
    let was = '';
    const look = () => {
      const now = BUTTONS.filter((b) => input.held(b)).join(' ');
      if (now !== was) { was = now; setLit(now); }
      raf = requestAnimationFrame(look);
    };
    raf = requestAnimationFrame(look);
    return () => cancelAnimationFrame(raf);
  }, [input]);

  const down = (b) => lit.split(' ').includes(b);

  // Whether there is anything to actually put on the screen.
  //
  // This cannot be a plain `children &&` check. The page passes two
  // conditional blocks, so while a game is running `children` is the array
  // [false, false] — which is truthy. That rendered an empty overlay with a
  // solid background over the top of the canvas, and the game played
  // perfectly behind a blank screen. Children.toArray drops false and null,
  // so this counts what would really be drawn.
  const hasOverlay = Children.toArray(children).length > 0;

  // The stick leans toward whatever is held. Both axes at once gives the
  // diagonal, which is what a real stick does.
  const lean = [
    down('left') ? -1 : down('right') ? 1 : 0,
    down('up') ? -1 : down('down') ? 1 : 0,
  ];

  const bind = (button) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      heldRef.current.add(button);
      input?.press(button);
    },
    onPointerUp: (e) => {
      e.preventDefault();
      heldRef.current.delete(button);
      input?.release(button);
    },
    onPointerLeave: () => {
      heldRef.current.delete(button);
      input?.release(button);
    },
    // Stops the long-press menu and the double-tap zoom on a phone, both of
    // which fire constantly when somebody is jabbing a fire button.
    onContextMenu: (e) => e.preventDefault(),
  });

  return (
    <div className="vg-cab-room">
      <div className={`vg-cab ${playing ? 'is-playing' : ''}`}>

        {/* The sloped uprights either side. Pure silhouette — they carry the
            side art and give the thing a depth that a flat panel cannot. */}
        <div className="vg-cab-wing is-left" aria-hidden="true">
          <span className="vg-cab-sideart">VIBEGROUNDS</span>
        </div>

        <div className="vg-cab-body">

          {/* ---- marquee ---- */}
          <div className="vg-cab-crown" aria-hidden="true" />
          <div className="vg-cab-marquee">
            <span className="vg-cab-marquee-text">{marquee || 'VIBEGROUNDS ARCADE'}</span>
            {/* The strip light behind the perspex. */}
            <span className="vg-cab-tube" aria-hidden="true" />
          </div>

          {/* ---- monitor ---- */}
          <div className="vg-cab-hood">
            <div className="vg-cab-bezel">
              <canvas
                ref={screenRef}
                className="vg-cab-screen"
                width={640}
                height={480}
                // Hidden from the reader when nothing is running: an empty
                // canvas announced as "graphic" is noise, and everything the
                // menu says is in the overlay as real text.
                aria-hidden={!playing}
              />
              {hasOverlay && <div className="vg-cab-overlay">{children}</div>}
              <div className="vg-cab-scan" aria-hidden="true" />
              <div className="vg-cab-glass" aria-hidden="true" />
              <div className="vg-cab-vignette" aria-hidden="true" />
            </div>

            <div className="vg-cab-readout">
              <span className="vg-cab-score">SCORE <b>{String(score ?? 0).padStart(6, '0')}</b></span>
              <span className="vg-cab-status">{status}</span>
            </div>
          </div>

          {/* ---- control deck ---- */}
          <div className="vg-cab-deck">
            <div className="vg-cab-panel">
              {/* Both grilles belong to the panel, pinned to its edges, so the
                  stick and the buttons can sit near each other in the middle
                  the way they do on a real deck. The first version had one
                  grille outside the panel and one inside, which shoved the
                  controls to opposite corners with a hole between them. */}
              <div className="vg-cab-grille is-left" aria-hidden="true" />

              <div className="vg-cab-stickwell">
                <span className="vg-cab-washer" aria-hidden="true" />
                <span
                  className="vg-cab-shaft"
                  aria-hidden="true"
                  style={{ transform: `translate(-50%,-100%) rotate(${lean[0] * 11}deg)` }}
                />
                <span
                  className="vg-cab-ball"
                  aria-hidden="true"
                  style={{ transform: `translate(calc(-50% + ${lean[0] * 9}px), calc(-50% + ${lean[1] * 7}px))` }}
                />

                {/* The real controls. Invisible hit areas over the quarters of
                    the stick well, so a thumb pushes the stick where it looks
                    like it is pushing it rather than at a separate d-pad. */}
                <button type="button" className="vg-cab-dir is-up" aria-label="Up" {...bind('up')} />
                <button type="button" className="vg-cab-dir is-down" aria-label="Down" {...bind('down')} />
                <button type="button" className="vg-cab-dir is-left" aria-label="Left" {...bind('left')} />
                <button type="button" className="vg-cab-dir is-right" aria-label="Right" {...bind('right')} />
              </div>

              <div className="vg-cab-buttons">
                <button
                  type="button"
                  className={`vg-cab-btn is-a ${down('a') ? 'is-down' : ''}`}
                  aria-label="Button A"
                  {...bind('a')}
                >
                  <span>A</span>
                </button>
                <button
                  type="button"
                  className={`vg-cab-btn is-b ${down('b') ? 'is-down' : ''}`}
                  aria-label="Button B"
                  {...bind('b')}
                >
                  <span>B</span>
                </button>
              </div>

              <div className="vg-cab-grille is-right" aria-hidden="true" />
            </div>

            {/* The START button lives on the deck like it does on a real
                machine, not as a web button floating under the cabinet. It is
                the same action as pressing A on the menu — two ways to the
                same place, because a first-time visitor looks for a button
                that says what it does. */}
            {onStart && (
              <button
                type="button"
                className="vg-cab-start"
                disabled={startDisabled}
                onClick={onStart}
              >
                <span className="vg-cab-start-lamp" aria-hidden="true" />
                {startLabel || 'PRESS START'}
              </button>
            )}
          </div>

          {/* ---- coin door ----

              Pressing START drops a coin into the slot. The point is not
              decoration: starting a go costs a coin, and until now the only
              sign of that was a number changing somewhere else on the page.
              A machine should visibly take your money.

              The coin is mounted on the slot rather than the door so it lands
              exactly on the mouth however the door is laid out — on a narrow
              phone the door's flex row shuffles, and a coin animated in door
              coordinates would fall past the side of the slot.

              `key` is the counter, not a boolean: pressing START twice in a
              row must replay the animation, and React reuses an element with
              the same key rather than restarting its CSS animation. */}
          <div className={`vg-cab-door ${inserting ? 'is-taking' : ''}`}>
            <span className="vg-cab-slot" aria-hidden="true">
              <span className="vg-cab-slot-mouth" />
              {inserting > 0 && (
                <span className="vg-cab-coin" key={inserting}>
                  <b className="vg-cab-coin-face">V</b>
                </span>
              )}
            </span>
            <span className="vg-cab-plate">
              <b>1 COIN</b>
              <i>1 PLAY</i>
            </span>
            <span className="vg-cab-return" aria-hidden="true" />

            {/* Announced, because for somebody using a screen reader this is
                the only word that the machine took the go. */}
            {inserting > 0 && (
              <span className="vg-cab-credit" key={`c${inserting}`} role="status">
                {freePlay ? 'FREE PLAY' : 'CREDIT'}
              </span>
            )}
          </div>

          <div className="vg-cab-kick" aria-hidden="true" />
        </div>

        <div className="vg-cab-wing is-right" aria-hidden="true">
          <span className="vg-cab-sideart">ARCADE</span>
        </div>
      </div>

      <p className="vg-cab-keys">
        Keyboard: <b>W A S D</b> or the arrow keys to move · <b>J</b> or <b>space</b> for A · <b>K</b> for B
      </p>
    </div>
  );
}
