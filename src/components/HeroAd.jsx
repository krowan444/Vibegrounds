import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { thumbFor, onThumbError, LOGO_FALLBACK } from '../lib/thumbnail';
import { scoreLabel, scoreLabelColor, isUnrated } from '../lib/format';

/**
 * The front page's biggest slot.
 *
 * This used to hold a joke advert, and visitors told us the page looked scammy
 * — fair, since a fake ad in the most prominent position is the first thing a
 * stranger judges the site by. Now it showcases whatever is marked featured:
 * real work, by a real member, that they can click straight into.
 *
 * That is a better advert for VibeGrounds than any advert could be. The "this
 * space is available" line sits underneath, small and honest, rather than the
 * slot pretending to be sold.
 *
 * If nothing is featured yet it degrades to a plain, clearly-labelled house
 * card instead of a fake one.
 */
export default function HeroAd({ creation, creations }) {
  /*
   * With more than one staff pick the slot becomes a carousel, rotating every
   * six seconds so each featured creator gets front-page time rather than
   * whoever happens to be first forever.
   *
   * Rotation pauses on hover — nothing more annoying than a banner changing
   * under your cursor as you go to click it.
   */
  const picks = (creations && creations.length ? creations : (creation ? [creation] : []));
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState(null);
  const [paused, setPaused] = useState(false);

  // Remember the slide we just left so it can sit still underneath while the
  // new one slides in over the top of it, rather than both moving at once.
  const goTo = (next) => {
    setPrev((p) => (next === index ? p : index));
    setIndex(next);
  };

  useEffect(() => {
    if (picks.length < 2 || paused) return undefined;
    const t = setInterval(() => {
      setIndex((i) => {
        setPrev(i);
        return (i + 1) % picks.length;
      });
    }, 6000);
    return () => clearInterval(t);
  }, [picks.length, paused]);

  // Guard against the list shrinking under us (a pick being un-featured).
  const current = picks[index % picks.length];

  if (!current) {
    return (
      <div className="vg-hero-ad">
        <div className="vg-featured-empty">
          <div className="vg-featured-kicker">FEATURED SLOT</div>
          <h2>Nothing featured yet</h2>
          <p>
            Staff picks land here — the front page&#39;s biggest slot, given to
            something worth looking at rather than sold to the highest bidder.
          </p>
          <Link to="/portal" className="vg-featured-btn">BROWSE THE PORTAL</Link>
        </div>
      </div>
    );
  }

  const src = thumbFor(current, 900);
  const placeholder = src === LOGO_FALLBACK;

  return (
    <div className="vg-hero-ad">
      <div
        className="vg-featured"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="vg-featured-kicker">
          <span className="vg-featured-star">★</span> STAFF PICK
          {picks.length > 1 && (
            <span className="vg-featured-count">{index + 1} / {picks.length}</span>
          )}
        </div>

        {/*
          Every pick's screenshot is rendered and stacked; only the active one
          is opaque. Swapping a single <img> src (or remounting it) makes the
          browser tear down and reload the image, which is what read as a blink.
          Keeping them all mounted lets one genuinely cross-fade into the next,
          and means the images are already loaded when their turn comes.
        */}
        <Link to={`/creation/${current.id}`} className="vg-featured-shot">
          {picks.map((p, i) => {
            const psrc = thumbFor(p, 900);
            return (
              <img
                key={p.id}
                src={psrc}
                alt={i === index ? p.title : ''}
                aria-hidden={i !== index || undefined}
                onError={onThumbError}
                className={[
                  'vg-featured-slide',
                  i === index ? 'is-on' : (i === prev ? 'is-prev' : ''),
                  psrc === LOGO_FALLBACK ? 'vg-thumb-placeholder' : '',
                ].filter(Boolean).join(' ')}
              />
            );
          })}
        </Link>

        <div className="vg-featured-body" key={current.id}>
          <Link to={`/creation/${current.id}`} className="vg-featured-title">
            {current.title}
          </Link>
          <div className="vg-featured-by">
            by <strong>{current.creator_username}</strong>
            {current.category_name && <> · {current.category_icon} {current.category_name}</>}
          </div>

          {current.description && (
            <p className="vg-featured-desc">{current.description}</p>
          )}

          {picks.length > 1 && (
            <div className="vg-featured-dots" role="tablist" aria-label="Featured picks">
              {picks.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  className={`vg-featured-dot ${i === index ? 'is-on' : ''}`}
                  onClick={() => goTo(i)}
                  aria-label={`Show ${p.title}`}
                  aria-selected={i === index}
                  role="tab"
                />
              ))}
            </div>
          )}

          <div className="vg-featured-foot">
            <span className="vg-featured-score" style={{ color: scoreLabelColor(current) }}>
              {isUnrated(current) ? 'UNRATED' : `★ ${scoreLabel(current)}`}
            </span>
            <Link to={`/creation/${current.id}`} className="vg-featured-btn">
              {isUnrated(current) ? 'BE THE FIRST TO RATE IT' : 'HAVE A LOOK'}
            </Link>
          </div>
        </div>
      </div>

      <a href="/advertise" className="vg-ad-pitch">
        This slot showcases a staff pick, not a paid ad.{' '}
        <strong>Real ad space is available →</strong>
      </a>
    </div>
  );
}
