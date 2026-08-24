import { useEffect, useRef, useState } from 'react';
import { scrollToTop } from '../lib/scrollTo';

/**
 * A way back up from the bottom of a long page.
 *
 * Deliberately not a floating button that hovers over the page the whole
 * time. A comic reader is a picture somebody spent hours on, and a badge
 * parked on top of it competes with the thing you came to look at. This one
 * sits in the flow of the page, at the bottom, where you arrive once you
 * have finished reading and actually want it.
 *
 * It appears only when the page is long enough for the trip back to be
 * annoying — on a two-page comic it would be noise.
 */
export default function BackToTop({
  label = 'Back to the top',
  minPageHeight = 2000,
}) {
  const [worthIt, setWorthIt] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const check = () => {
      const doc = document.documentElement;
      setWorthIt(doc.scrollHeight > Math.max(minPageHeight, window.innerHeight * 2));
    };
    check();
    // Comic pages arrive one at a time as images decode, so the page keeps
    // growing after first paint. A one-off measurement would be taken while
    // the page was still short.
    const ro = new ResizeObserver(check);
    ro.observe(document.body);
    window.addEventListener('resize', check);
    return () => { ro.disconnect(); window.removeEventListener('resize', check); };
  }, [minPageHeight]);

  if (!worthIt) return null;

  return (
    <div className="vg-backtotop" ref={ref}>
      <button
        type="button"
        // Distance decides whether this animates. From the bottom of a long
        // comic it is thousands of pixels, and Chrome will not reliably
        // animate that far — the old smooth scroll here simply did nothing.
        onClick={scrollToTop}
      >
        ▲ {label}
      </button>
    </div>
  );
}
