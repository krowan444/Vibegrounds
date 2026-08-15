import { Link } from 'react-router-dom';
import { scoreLabel, scoreLabelColor, isUnrated } from '../lib/format';
import { thumbFor, onThumbError, LOGO_FALLBACK } from '../lib/thumbnail';

/**
 * The sidebar charts — the thing that made the old Portal addictive.
 *
 * Seeing your own submission sitting at #3 on the front page is the
 * whole reward loop, so these are deliberately compact and dense:
 * rank, tiny thumb, title, score. Five rows, no padding waste.
 */
export default function ChartRail({ title, icon, rows = [], to, emptyText = 'Nothing charted yet.' }) {
  return (
    <div className="vg-rail-box">
      <div className="vg-rail-head">
        <span>{icon} {title}</span>
        {to && <Link to={to}>more</Link>}
      </div>

      {rows.length === 0 ? (
        <div className="vg-rail-empty">{emptyText}</div>
      ) : (
        rows.slice(0, 5).map((c, i) => {
          const rank = c.rank ?? i + 1;
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
          return (
            <Link key={c.id} to={`/creation/${c.id}`} className="vg-rail-row">
              <span className={`vg-rail-rank ${medal ? 'medal' : ''}`}>
                {medal || rank}
              </span>
              <span className="vg-rail-thumb">
                <img
                  src={thumbFor(c, 120)}
                  alt=""
                  loading="lazy"
                  onError={onThumbError}
                  className={thumbFor(c, 120) === LOGO_FALLBACK ? 'vg-thumb-placeholder' : undefined}
                />
              </span>
              <span className="vg-rail-body">
                <span className="vg-rail-title">{c.title}</span>
                <span className="vg-rail-by">by {c.creator_username}</span>
              </span>
              <span
                className="vg-rail-score"
                style={{ color: scoreLabelColor(c) }}
                title={isUnrated(c) ? 'Not rated yet — be the first' : undefined}
              >
                {scoreLabel(c)}
              </span>
            </Link>
          );
        })
      )}
    </div>
  );
}

/** Compact creator leaderboard for the rail. */
export function CreatorRail({ rows = [] }) {
  return (
    // vg-creator-rail carries no styling of its own. It exists so CSS can tell
    // this box apart from the two chart rails, which are otherwise identical
    // siblings — the mobile running order needs to place them separately.
    <div className="vg-rail-box vg-creator-rail">
      <div className="vg-rail-head">
        <span>👑 Top Creators</span>
        <Link to="/charts?chart=creators">more</Link>
      </div>
      {rows.length === 0 ? (
        <div className="vg-rail-empty">No creators yet.</div>
      ) : (
        rows.slice(0, 5).map((u, i) => (
          <Link key={u.id} to={`/profile/${u.username}`} className="vg-rail-row">
            <span className={`vg-rail-rank ${i < 3 ? 'medal' : ''}`}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
            </span>
            <span className="vg-rail-thumb">
              {u.avatar_url ? <img src={u.avatar_url} alt="" loading="lazy" /> : <span>👾</span>}
            </span>
            <span className="vg-rail-body">
              <span className="vg-rail-title">{u.username}</span>
              <span className="vg-rail-by">{u.rank_title} · lv {u.level}</span>
            </span>
            <span className="vg-rail-score" style={{ color: 'var(--orange)' }}>
              {u.submission_count}
            </span>
          </Link>
        ))
      )}
    </div>
  );
}
