import { useEffect, useRef } from 'react';

/**
 * The machine.
 *
 * Everything here is drawn with CSS rather than an image, for two reasons.
 * A picture of a cabinet would be a big download on a phone for something
 * that is only a frame, and it could not carry working buttons — and the
 * buttons are the point on a phone, where there is no keyboard to fall back
 * on.
 *
 * The control panel is not decoration. Pressing a painted button feeds the
 * exact same input object the keyboard feeds, so no game knows or cares which
 * one you used.
 */
export default function ArcadeCabinet({
  screenRef,
  input,
  marquee,
  score,
  status,
  children,
  showControls = true,
}) {
  const heldRef = useRef(new Set());

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
    <div className="vg-cab">
      <div className="vg-cab-marquee">
        <span className="vg-cab-marquee-text">{marquee || 'VIBEGROUNDS ARCADE'}</span>
      </div>

      <div className="vg-cab-hood">
        <div className="vg-cab-bezel">
          <canvas ref={screenRef} className="vg-cab-screen" width={640} height={480} />
          {children && <div className="vg-cab-overlay">{children}</div>}
          {/* A curved-glass sheen. Purely for the look of the thing. */}
          <div className="vg-cab-glass" aria-hidden="true" />
        </div>

        <div className="vg-cab-readout">
          <span>SCORE <b>{String(score ?? 0).padStart(6, '0')}</b></span>
          <span className="vg-cab-status">{status}</span>
        </div>
      </div>

      {showControls && (
        <div className="vg-cab-panel">
          <div className="vg-cab-stick" role="group" aria-label="Direction controls">
            <button type="button" className="vg-cab-dir is-up" aria-label="Up" {...bind('up')}>▲</button>
            <button type="button" className="vg-cab-dir is-left" aria-label="Left" {...bind('left')}>◀</button>
            <button type="button" className="vg-cab-dir is-right" aria-label="Right" {...bind('right')}>▶</button>
            <button type="button" className="vg-cab-dir is-down" aria-label="Down" {...bind('down')}>▼</button>
            <span className="vg-cab-stick-hub" aria-hidden="true" />
          </div>

          <div className="vg-cab-fire">
            <button type="button" className="vg-cab-btn is-a" aria-label="Button A" {...bind('a')}>A</button>
            <button type="button" className="vg-cab-btn is-b" aria-label="Button B" {...bind('b')}>B</button>
          </div>
        </div>
      )}

      <div className="vg-cab-foot">
        <span className="vg-cab-slot" aria-hidden="true" />
        <span className="vg-cab-keys">
          Keyboard: <b>W A S D</b> or arrows to move · <b>J</b> / <b>K</b> for A and B
        </span>
      </div>
    </div>
  );
}
