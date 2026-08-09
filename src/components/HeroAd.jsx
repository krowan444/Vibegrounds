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
export default function HeroAd({ creation }) {
  if (!creation) {
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

  const src = thumbFor(creation, 900);
  const placeholder = src === LOGO_FALLBACK;

  return (
    <div className="vg-hero-ad">
      <div className="vg-featured">
        <div className="vg-featured-kicker">
          <span className="vg-featured-star">★</span> STAFF PICK
        </div>

        <Link to={`/creation/${creation.id}`} className="vg-featured-shot">
          <img
            src={src}
            alt={creation.title}
            onError={onThumbError}
            className={placeholder ? 'vg-thumb-placeholder' : undefined}
          />
        </Link>

        <div className="vg-featured-body">
          <Link to={`/creation/${creation.id}`} className="vg-featured-title">
            {creation.title}
          </Link>
          <div className="vg-featured-by">
            by <strong>{creation.creator_username}</strong>
            {creation.category_name && <> · {creation.category_icon} {creation.category_name}</>}
          </div>

          {creation.description && (
            <p className="vg-featured-desc">{creation.description}</p>
          )}

          <div className="vg-featured-foot">
            <span className="vg-featured-score" style={{ color: scoreLabelColor(creation) }}>
              {isUnrated(creation) ? 'UNRATED' : `★ ${scoreLabel(creation)}`}
            </span>
            <Link to={`/creation/${creation.id}`} className="vg-featured-btn">
              {isUnrated(creation) ? 'BE THE FIRST TO RATE IT' : 'HAVE A LOOK'}
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
