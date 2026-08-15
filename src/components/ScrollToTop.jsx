import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Put every new page at the top.
 *
 * A single-page app does not reload on navigation, so the scroll position
 * simply stays where it was. Click an advert from halfway down the home page
 * and you land halfway down the advertise page — which reads as a broken
 * link, because the thing you clicked for is off screen above you.
 *
 * Two deliberate exceptions:
 *
 *   - a hash (/creation/x#reviews) means somebody asked for a specific spot,
 *     so leave it alone and let the browser do its job
 *   - POP means the back button, and going back should return you to where
 *     you were reading, not to the top of a page you have already seen
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    if (typeof window === 'undefined') return;

    // Instant, not smooth: a smooth scroll on navigation looks like the page
    // is still loading, and on a long page it is a visible slide upwards.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return null;
}
