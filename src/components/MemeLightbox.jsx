import { useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import NsfwImage from './NsfwImage';
import VoteWidget from './VoteWidget';
import { scoreLabel, scoreLabelColor, isUnrated } from '../lib/format';

/**
 * Full-size meme viewer.
 *
 * Browsing memes is a flicking motion, not a navigating one — going back to
 * the grid and clicking the next thumbnail breaks the rhythm completely. So
 * this opens over the board and moves through the list in place: arrows,
 * keyboard, or swipe, with no page loads between memes.
 *
 * The image is the whole point, so it gets the space and everything else is
 * a thin strip underneath. Comments live on the full creation page — there
 * is a link, but nothing here competes with the picture.
 */
export default function MemeLightbox({ memes, index, onClose, onIndex }) {
  const meme = memes[index];

  const go = useCallback((delta) => {
    if (!memes.length) return;
    // Wraps, so you can keep going in one direction forever.
    onIndex((index + delta + memes.length) % memes.length);
  }, [index, memes.length, onIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);

    // Stop the grid scrolling underneath while the viewer is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  if (!meme) return null;

  return (
    <div
      className="vg-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={meme.title}
      onClick={onClose}
    >
      <button type="button" className="vg-lb-close" onClick={onClose} aria-label="Close">×</button>

      {memes.length > 1 && (
        <button
          type="button"
          className="vg-lb-arrow vg-lb-prev"
          aria-label="Previous meme"
          onClick={(e) => { e.stopPropagation(); go(-1); }}
        >
          ‹
        </button>
      )}

      {/* Clicks inside the panel must not fall through to the backdrop. */}
      <div className="vg-lb-panel" onClick={(e) => e.stopPropagation()}>
        <div className="vg-lb-stage">
          <NsfwImage
            src={meme.thumbnail_url || meme.project_url}
            alt={meme.title}
            nsfw={meme.is_nsfw}
            className="vg-lb-img"
            eager
          />
        </div>

        <div className="vg-lb-bar">
          <div className="vg-lb-info">
            <span className="vg-lb-title">{meme.title}</span>
            <span className="vg-lb-by">
              by <Link to={`/profile/${meme.creator_username}`}>{meme.creator_username}</Link>
            </span>
          </div>

          <div className="vg-lb-actions">
            <span className="vg-lb-score" style={{ color: scoreLabelColor(meme) }}>
              {isUnrated(meme) ? 'UNRATED' : `★ ${scoreLabel(meme)}`}
            </span>
            <VoteWidget creation={meme} />
            <Link to={`/creation/${meme.id}`} className="vg-lb-full">Comments →</Link>
          </div>
        </div>

        <div className="vg-lb-count">{index + 1} / {memes.length}</div>
      </div>

      {memes.length > 1 && (
        <button
          type="button"
          className="vg-lb-arrow vg-lb-next"
          aria-label="Next meme"
          onClick={(e) => { e.stopPropagation(); go(1); }}
        >
          ›
        </button>
      )}
    </div>
  );
}
