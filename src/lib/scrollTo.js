/**
 * Getting somewhere on a very long page.
 *
 * The comic reader's "▼ Comments" button used a smooth scrollIntoView and did
 * nothing at all on a real comic. Measured on the live site: the comments sit
 * about 18,500px down, an instant jump lands exactly on them, and the smooth
 * version finishes at zero — it never moves.
 *
 * Chrome will not reliably animate a scroll that long. Even when it does, the
 * animation runs for seconds and anything can cancel it: a nudge of the wheel,
 * an image finishing and shifting the layout, the browser's own scroll
 * anchoring. On a page made of twenty full-height images, one of those is
 * near certain.
 *
 * So distance decides. A short hop is animated, because seeing the page move
 * tells you it moved rather than changed. A long one is instant, because an
 * animation that might not arrive is worse than no animation.
 */

// Roughly two screens. Under this, an animation is quick and hard to derail.
const ANIMATE_UNDER = 2400;

export function scrollToY(y) {
  const target = Math.max(0, Math.round(y));
  const far = Math.abs(target - window.scrollY) > ANIMATE_UNDER;
  window.scrollTo({ top: target, left: 0, behavior: far ? 'auto' : 'smooth' });
}

/**
 * Scroll an element to the top of the screen, and keep it there.
 *
 * A long comic is still settling while you travel: images decode, panels
 * reveal, and the thing you aimed at moves. One jump lands near it rather than
 * on it. So the position is corrected for a short while afterwards, stopping
 * as soon as it has held still — no animation to fight, so the corrections are
 * invisible.
 */
export function scrollToElement(el, { offset = 0, settleMs = 900 } = {}) {
  if (!el) return;

  const aim = () => el.getBoundingClientRect().top + window.scrollY - offset;
  scrollToY(aim());

  const started = performance.now();
  let stillFor = 0;

  const correct = () => {
    const drift = el.getBoundingClientRect().top - offset;

    // Within a couple of pixels is arrived. Hold that for a few frames before
    // giving up the watch, or a late-loading image lands us short again.
    if (Math.abs(drift) <= 2) {
      stillFor += 1;
      if (stillFor >= 4) return;
    } else {
      stillFor = 0;
      window.scrollBy({ top: drift, left: 0, behavior: 'auto' });
    }

    if (performance.now() - started < settleMs) requestAnimationFrame(correct);
  };

  requestAnimationFrame(correct);
}

export function scrollToTop() {
  scrollToY(0);
}
