import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import SubmitCta from '../components/SubmitCta';
import { thumbFor, onThumbError, LOGO_FALLBACK } from '../lib/thumbnail';
import { scoreLabel, scoreLabelColor, isUnrated } from '../lib/format';

/**
 * `sort` is spelled out only where the list is not a chart.
 *
 * Every ranked view carries a `rank` column the database works out. Newest
 * is not ranked by anything — it is everything, most recent first — so it
 * sorts on the date and gets numbered as it comes. It is here because the
 * Portal's "Newest 50" had a "full" link and nowhere honest to send it: it
 * pointed at the daily chart, which is a different list of different things
 * in a different order.
 */
const CHARTS = [
  { id: 'daily',   view: 'chart_daily',   label: 'Top Daily',    icon: '☀️', blurb: 'Best of the last 24 hours.' },
  { id: 'weekly',  view: 'chart_weekly',  label: 'Top Weekly',   icon: '📅', blurb: 'Best of the last 7 days.' },
  { id: 'monthly', view: 'chart_monthly', label: 'Top Monthly',  icon: '🗓️', blurb: 'Best of the last 30 days.' },
  { id: 'alltime', view: 'chart_alltime', label: 'All-Time 100', icon: '👑', blurb: 'The hall of fame. Earn your place.' },
  { id: 'hot',     view: 'chart_hot',     label: 'Hot Now',      icon: '🔥', blurb: 'Whatever everyone is voting on right now.' },
  // Last on purpose. CHARTS[0] is what /charts shows with no chart chosen,
  // and the nav calls that link "Top 100" — so the first entry has to stay a
  // top chart. Newest is not a chart, it is the pile in the order it landed.
  { id: 'newest',  view: 'creations_public', label: 'Newest', icon: '🆕',
    blurb: 'Everything, most recent first.',
    sort: { col: 'created_at', asc: false }, unranked: true },
];

/** Colour a score the way an arcade cabinet would. */
function scoreColor(score) {
  if (score >= 4.5) return '#ffd700';
  if (score >= 4.0) return '#66ff66';
  if (score >= 3.0) return '#e8a317';
  if (score >= 2.0) return '#cc7722';
  return '#888';
}

function RankRow({ row }) {
  const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
      borderBottom: '1px solid var(--border-dark)',
      background: row.rank <= 3 ? 'rgba(232,163,23,0.06)' : undefined,
    }}>
      <div style={{
        width: '42px', flexShrink: 0, textAlign: 'center',
        fontFamily: 'var(--font-pixel)', fontSize: medal ? '18px' : '12px',
        color: row.rank <= 3 ? 'var(--yellow)' : 'var(--text-dim)',
      }}>
        {medal || row.rank}
      </div>

      <div style={{
        width: '64px', height: '48px', flexShrink: 0, background: 'var(--bg-dark)',
        border: '2px solid var(--border-dark)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: '22px', overflow: 'hidden',
      }}>
        <img
          src={thumbFor(row, 160)}
          alt=""
          loading="lazy"
          onError={onThumbError}
          className={thumbFor(row, 160) === LOGO_FALLBACK ? 'vg-thumb-placeholder' : undefined}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <Link to={`/creation/${row.id}`} style={{
          fontFamily: 'var(--font-retro)', fontSize: '19px',
          color: 'var(--blue-link)', fontWeight: 'bold', textDecoration: 'none',
        }}>
          {row.title}
        </Link>
        <div style={{ fontFamily: 'var(--font-retro)', fontSize: '15px', color: 'var(--text-dim)' }}>
          {row.category_icon} {row.category_name || row.category} · by{' '}
          <Link to={`/profile/${row.creator_username}`} style={{ color: 'var(--text-secondary)' }}>
            {row.creator_username}
          </Link>
          {' · '}👁 {row.view_count}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontFamily: 'var(--font-pixel)', fontSize: '14px',
          color: scoreLabelColor(row),
        }}>
          {scoreLabel(row)}
        </div>
        <div style={{ fontFamily: 'var(--font-retro)', fontSize: '14px', color: 'var(--text-dim)' }}>
          {isUnrated(row) ? 'no votes yet' : `${row.vote_count} vote${row.vote_count === 1 ? '' : 's'}`}
        </div>
      </div>
    </div>
  );
}

export default function ChartsPage() {
  const [params, setParams] = useSearchParams();
  const active = CHARTS.find((c) => c.id === params.get('chart')) || CHARTS[0];
  const category = params.get('cat') || '';

  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      let q = supabase.from(active.view).select('*');
      // Filtering by category means the view's own rank column no longer
      // applies, so re-rank client-side below.
      if (category) q = q.eq('category', category);
      // Memes are excluded from Newest for the same reason the Portal
      // excludes them: they are far cheaper to make and would bury
      // everything else by sheer volume. Browsing the memes category
      // directly still works.
      if (active.unranked && category !== 'memes') q = q.neq('category', 'memes');

      const sort = active.sort || { col: 'rank', asc: true };
      const { data, error: err } = await q
        .order(sort.col, { ascending: sort.asc })
        .limit(100);
      if (!alive) return;
      if (err) setError(err.message);
      else {
        setError('');
        // An unranked list has no rank of its own, so it is numbered in the
        // order it arrives — same as when a category filter invalidates a
        // chart's ranking.
        const renumber = category || active.unranked;
        setRows((data || []).map((r, i) => (renumber ? { ...r, rank: i + 1 } : r)));
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [active.view, category]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };

  return (
    <>
      <SiteHeader compact />
      <div className="profile-page" style={{ paddingBottom: '40px' }}>
        <div className="retro-panel">
          <div className="section-header"><h2>📈 The Charts</h2></div>

          <div style={{ display: 'flex', gap: '2px', padding: '8px', background: 'var(--bg-panel-header)', flexWrap: 'wrap' }}>
            {CHARTS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setParam('chart', c.id)}
                style={{
                  background: active.id === c.id ? 'var(--orange)' : 'transparent',
                  color: active.id === c.id ? '#000' : 'var(--text-secondary)',
                  border: `2px solid ${active.id === c.id ? 'var(--orange-dim)' : 'var(--border-dark)'}`,
                  fontFamily: 'var(--font-pixel)', fontSize: '9px',
                  padding: '7px 12px', cursor: 'pointer',
                }}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>

          {/* Per-category charts — "#1 in Games all time" is its own trophy */}
          <div style={{ display: 'flex', gap: '3px', padding: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-dark)' }}>
            <button
              type="button"
              className={`vg-tab ${!category ? 'is-active' : ''}`}
              onClick={() => setParam('cat', '')}
            >
              ALL CATEGORIES
            </button>
            {categories.map((c) => (
              <button
                key={c.slug}
                type="button"
                className={`vg-tab ${category === c.slug ? 'is-active' : ''}`}
                onClick={() => setParam('cat', c.slug)}
              >
                {c.icon} {c.name.toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{
            padding: '8px 12px', fontFamily: 'var(--font-retro)', fontSize: '17px',
            color: 'var(--text-dim)', borderBottom: '1px solid var(--border-dark)',
          }}>
            {active.blurb} Scores are a weighted average out of 5, so a handful of
            friendly votes will not carry a submission to the top.
          </div>

          <Notice tone="error" style={{ margin: '12px' }}>{error}</Notice>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-retro)', fontSize: '20px', color: 'var(--orange)' }}>
              ⏳ Counting the votes...
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-retro)', fontSize: '19px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              <p>Nothing has charted here yet.</p>
              <p style={{ marginTop: '8px' }}>
                Submissions need a few votes before they appear —{' '}
                <Link to="/portal" style={{ color: 'var(--orange)' }}>go and rate some</Link>.
              </p>
            </div>
          ) : (
            rows.map((row) => <RankRow key={row.id} row={row} />)
          )}
        </div>

        <SubmitCta text="Fancy your chances on this chart?" />
      </div>
    </>
  );
}
