import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

/**
 * A paid advertiser's slot, cycling through several creatives.
 *
 * This is deliberately a separate component from AdSlot rather than another
 * prop on it. AdSlot serves house ads and gags: it links inward to /advertise,
 * and it carries a joke label. A paying advertiser is the opposite on both
 * counts — the click has to reach *them*, and the label has to be honest and
 * plain. Bolting that onto AdSlot would mean a component whose every line is
 * an if/else between two opposite jobs.
 *
 * Multiple creatives in one slot is the advertiser's own request. It is also
 * simply better: the same picture in the same corner stops being seen after a
 * couple of visits, and three gives them three shots at a different hook.
 */

// Everything about a campaign lives in one object, so selling slot two is a
// matter of adding a second key here and dropping <SponsorSlot id="..." /> in.
export const SPONSORS = {
  cue: {
    name: 'Cue Marketing Solutions',
    href: 'https://aaronc1992.github.io/cms-website/',
    // Order matters — creatives[0] is what a first-time visitor sees, so the
    // strongest hook goes first. "No big budget? No problem." states the
    // offer without needing the reader to already know what CMS is.
    creatives: [
      { img: '/images/ads/ad-cue-no-problem.webp',  alt: 'Cue Marketing Solutions — no big budget? No problem. Marketing help for indie devs and small creators.' },
      { img: '/images/ads/ad-cue-tiny-budget.webp', alt: 'Cue Marketing Solutions — indie dev on a tiny budget? Friendly marketing help for launches, websites and promo.' },
      { img: '/images/ads/ad-cue-indie-devs.webp',  alt: 'Cue Marketing Solutions — marketing for indie devs. Small-budget marketing help.' },
    ],
  },
};

const INTERVAL = 7000;

export default function SponsorSlot({ id = 'cue', sticky = false }) {
  const sponsor = SPONSORS[id];
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const box = useRef(null);

  const count = sponsor?.creatives.length || 0;

  /*
   * Do not rotate while the slot is scrolled off screen.
   *
   * The advertiser is buying attention, not wall-clock time. Cycling through
   * all three while the slot sits below the fold would burn two creatives on
   * nobody, and whoever we eventually report impressions to would be reading
   * a number that never happened.
   */
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (count < 2 || paused || !visible) return undefined;

    // Someone who has asked their system for less motion gets a static ad and
    // the dots to page through by hand. They still see the campaign; it just
    // does not move underneath them.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const t = setInterval(() => setI((n) => (n + 1) % count), INTERVAL);
    return () => clearInterval(t);
  }, [count, paused, visible]);

  const go = useCallback((n) => { setI(n); setPaused(true); }, []);

  if (!sponsor || !count) return null;

  return (
    <div
      className={`vg-ad vg-sponsor ${sticky ? 'vg-ad-sticky' : ''}`}
      ref={box}
      // Pointer and keyboard both hold the rotation. Nothing is more annoying
      // than an ad that swaps out from under the cursor as you go to click it.
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="vg-ad-label">ADVERTISEMENT</div>

      <a
        href={sponsor.href}
        target="_blank"
        // sponsored tells search engines this is a paid placement, which is
        // the rule we would want followed if it were our link out there.
        rel="sponsored noopener noreferrer"
        className="vg-ad-body vg-sponsor-stage"
        title={`${sponsor.name} — opens in a new tab`}
      >
        {/* All creatives are in the DOM and cross-fade between each other.
            Swapping one <img> src instead would show a blank frame the first
            time each new file is fetched. */}
        {sponsor.creatives.map((c, n) => (
          <img
            key={c.img}
            src={c.img}
            alt={n === i ? c.alt : ''}
            // Only the visible one is announced; the other two are decoration
            // for a screen reader, not three separate ads.
            aria-hidden={n !== i ? 'true' : undefined}
            className={`vg-sponsor-shot ${n === i ? 'is-on' : ''}`}
            width="1200"
            height="1200"
            loading={n === 0 ? 'eager' : 'lazy'}
          />
        ))}
      </a>

      {count > 1 && (
        <div className="vg-sponsor-dots">
          {sponsor.creatives.map((c, n) => (
            <button
              key={c.img}
              type="button"
              className={`vg-sponsor-dot ${n === i ? 'is-on' : ''}`}
              onClick={() => go(n)}
              aria-label={`Show advert ${n + 1} of ${count}`}
              aria-current={n === i ? 'true' : undefined}
            />
          ))}
        </div>
      )}

      <a href={sponsor.href} target="_blank" rel="sponsored noopener noreferrer" className="vg-ad-caption">
        {sponsor.name} →
      </a>

      {/* Kept from the house ads. A visible advertiser is the best possible
          argument that the space is worth buying, so say so right underneath
          the one who bought it. */}
      <Link to="/advertise" className="vg-ad-foot">
        Paid placement. <strong>Advertise here too →</strong>
      </Link>
    </div>
  );
}
