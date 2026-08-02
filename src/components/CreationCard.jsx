import { Link } from 'react-router-dom';
import { compactNumber, timeAgo, scoreColor } from '../lib/format';
import { thumbFor, onThumbError, LOGO_FALLBACK } from '../lib/thumbnail';

/**
 * The single unit of the Portal. Used on Home, Portal, Category and
 * Profile so a submission looks the same everywhere.
 *
 * variant: "grid" (default) | "row" | "rank"
 */
export default function CreationCard({ creation: c, variant = 'grid', rank }) {
  const score = Number(c.score) || 0;
  const icon = c.category_icon || '✨';

  // Live screenshot of whatever they submitted, falling back to the
  // VibeGrounds mark if the page can't be shot.
  const src = thumbFor(c, 400);
  const isPlaceholder = src === LOGO_FALLBACK;
  const thumb = (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={onThumbError}
      className={isPlaceholder ? 'vg-thumb-placeholder' : undefined}
      aria-hidden={isPlaceholder || undefined}
    />
  );

  if (variant === 'row' || variant === 'rank') {
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
    return (
      <Link to={`/creation/${c.id}`} className={`vg-row ${rank <= 3 ? 'vg-row-top' : ''}`}>
        {variant === 'rank' && (
          <div className={`vg-rank ${medal ? 'vg-rank-medal' : ''}`}>{medal || rank}</div>
        )}
        <div className="vg-row-thumb">{thumb}</div>
        <div className="vg-row-body">
          <div className="vg-row-title">{c.title}</div>
          <div className="vg-row-meta">
            {icon} {c.category_name || c.category} · {c.creator_username}
            {' · '}👁 {compactNumber(c.view_count)}
          </div>
        </div>
        <div className="vg-row-score">
          <div style={{ color: scoreColor(score) }}>{score.toFixed(2)}</div>
          <span>{c.vote_count} vote{c.vote_count === 1 ? '' : 's'}</span>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/creation/${c.id}`} className="vg-card">
      <div className="vg-card-thumb">
        {thumb}
        <span className="vg-card-cat" style={{ borderColor: c.category_color || 'var(--orange)' }}>
          {icon} {c.category_name || c.category}
        </span>
        {c.is_featured && <span className="vg-card-featured">★ FEATURED</span>}
        {c.is_nsfw && <span className="vg-card-nsfw">18+</span>}
      </div>

      <div className="vg-card-body">
        <div className="vg-card-title">{c.title}</div>
        <div className="vg-card-author">by {c.creator_username}</div>
      </div>

      <div className="vg-card-foot">
        <span className="vg-card-score" style={{ color: scoreColor(score) }}>
          ★ {score.toFixed(2)}
        </span>
        <span className="vg-card-stats">
          👁 {compactNumber(c.view_count)} · 💬 {compactNumber(c.review_count)}
        </span>
        <span className="vg-card-age">{timeAgo(c.created_at)}</span>
      </div>
    </Link>
  );
}
