import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { scoreLabel, isUnrated } from '../lib/format';

/**
 * Top-rated memes, on the front page.
 *
 * Smaller than the hero on purpose — this is a taster that says "there is
 * a whole board of these" rather than something competing with the staff
 * pick above it.
 *
 * It scrolls rather than cross-fading. A carousel that swaps one item at a
 * time hides how much is there; a rail you can push along shows the depth,
 * which is the actual job here. It auto-advances slowly and stops the
 * moment you touch it.
 *
 * Anything flagged 18+ never reaches this component — the query behind it
 * uses `chart_memes_safe`, which filters them out in SQL. That keeps the
 * decision on the server rather than relying on this component to be
 * careful.
 */
export default function MemeRail({ memes }) {
  const railRef = useRef(null);
  const [paused, setPaused] = useState(false);

  const picks = (memes || []).slice(0, 12);

  useEffect(() => {
    if (paused || picks.length < 3) return undefined;

    const rail = railRef.current;
    if (!rail) return undefined;

    const t = setInterval(() => {
      if (!railRef.current) return;
      const el = railRef.current;
      const card = el.firstElementChild;
      const step = card ? card.getBoundingClientRect().width + 12 : 220;

      // Loop back rather than dead-ending at the right edge.
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + step, behavior: 'smooth' });
    }, 4000);

    return () => clearInterval(t);
  }, [paused, picks.length]);

  if (!picks.length) return null;

  const nudge = (dir) => {
    const el = railRef.current;
    if (!el) return;
    const card = el.firstElementChild;
    const step = card ? card.getBoundingClientRect().width + 12 : 220;
    el.scrollBy({ left: dir * step * 2, behavior: 'smooth' });
  };

  return (
    <div className="vg-meme-rail-wrap">
      <div className="vg-meme-rail-head">
        <h2 className="vg-meme-rail-title">😂 Top Memes</h2>
        <div className="vg-meme-rail-tools">
          <button type="button" className="vg-rail-btn" onClick={() => nudge(-1)} aria-label="Scroll left">‹</button>
          <button type="button" className="vg-rail-btn" onClick={() => nudge(1)} aria-label="Scroll right">›</button>
          <Link to="/memes" className="vg-meme-rail-all">See all →</Link>
        </div>
      </div>

      <div
        className="vg-meme-rail"
        ref={railRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
      >
        {picks.map((m) => (
          <Link key={m.id} to={`/creation/${m.id}`} className="vg-meme-rail-card">
            <span className="vg-meme-rail-shot">
              <img src={m.thumbnail_url || m.project_url} alt={m.title} loading="lazy" />
            </span>
            <span className="vg-meme-rail-name">{m.title}</span>
            <span className="vg-meme-rail-score">
              {isUnrated(m) ? 'Unrated' : `★ ${scoreLabel(m)}`}
            </span>
          </Link>
        ))}

        <Link to="/memes" className="vg-meme-rail-card vg-meme-rail-more">
          <span className="vg-meme-rail-more-icon">→</span>
          <span>See the whole board</span>
        </Link>
      </div>
    </div>
  );
}
