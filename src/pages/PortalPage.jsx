import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase, retryOnAbort, describeError } from '../lib/supabase';
import SiteHeader from '../components/SiteHeader';
import AdSlot from '../components/AdSlot';
import Notice from '../components/Notice';
import SubmitCta from '../components/SubmitCta';
import { timeAgo, compactNumber, scoreLabel, scoreLabelColor, isUnrated } from '../lib/format';
import { thumbFor, onThumbError, LOGO_FALLBACK } from '../lib/thumbnail';

/**
 * A long, scrollable column — the heart of the Portal.
 *
 * `ranked` matters: a medal means "this beat the others". On a list sorted by
 * recency it means nothing at all, and handing 🥇 to whoever posted last
 * cheapens the medals on the charts that are actually earned. Recency columns
 * get plain numbers.
 */
function ChartColumn({ title, icon, rows, to, empty, showAge, ranked = true }) {
  return (
    <div className="vg-rail-box vg-rail-scroll">
      <div className="vg-rail-head" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
        <span>{icon} {title}</span>
        {to && <Link to={to}>full</Link>}
      </div>

      {rows.length === 0 ? (
        <div className="vg-rail-empty">{empty}</div>
      ) : (
        rows.map((c, i) => {
          const rank = c.rank ?? i + 1;
          const medal = ranked && rank <= 3
            ? (rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉')
            : null;
          return (
            <Link key={c.id} to={`/creation/${c.id}`} className="vg-rail-row">
              <span className={`vg-rail-rank ${medal ? 'medal' : ''}`}>{medal || rank}</span>
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
                <span className="vg-rail-by">
                  by {c.creator_username}
                  {showAge && ` · ${timeAgo(c.created_at)}`}
                </span>
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

export default function PortalPage() {
  const [params, setParams] = useSearchParams();
  const category = params.get('cat') || '';
  const query = params.get('q') || '';

  const [categories, setCategories] = useState([]);
  const [newest, setNewest] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [alltime, setAlltime] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(query);

  useEffect(() => {
    retryOnAbort(() =>
      supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
    ).then(({ data }) => setCategories(data || []));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);

    // Filters apply to all three columns so the whole page stays coherent.
    const apply = (q) => {
      let out = q;
      // The Portal is the projects board. Memes live at /memes and would
      // otherwise flood this by sheer volume — they are far cheaper to
      // make. Browsing to the memes category explicitly still works.
      if (category !== 'memes') out = out.neq('category', 'memes');
      if (category) out = out.eq('category', category);
      if (query) out = out.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      return out;
    };

    const settle = (r) => (r.status === 'fulfilled' ? r.value : { data: [], error: r.reason });
    const [n, w, m, a, c] = (await Promise.allSettled([
      retryOnAbort(() => apply(supabase.from('creations_public').select('*'))
        .order('created_at', { ascending: false }).limit(50)),
      // This week, sitting directly under Newest. The gap between "posted
      // recently" and "posted three months ago and still winning" was the
      // whole month — long enough that something good posted on Tuesday had
      // nowhere to show up except the newest list, where it scrolls away.
      retryOnAbort(() => apply(supabase.from('chart_weekly').select('*'))
        .order('rank').limit(50)),
      retryOnAbort(() => apply(supabase.from('chart_monthly').select('*'))
        .order('rank').limit(100)),
      retryOnAbort(() => apply(supabase.from('chart_alltime').select('*'))
        .order('rank').limit(100)),
      retryOnAbort(() => apply(supabase.from('creations_public').select('id', { count: 'exact', head: true }))),
    ])).map(settle);

    // describeError rather than `err.message || err`: an error object with an
    // empty message used to fall through to the object itself and render as
    // "[object Object]", which told nobody anything. Same fix as the home page.
    const firstError = [n, w, m, a].find((r) => r.error)?.error;
    if (firstError) console.warn('[VibeGrounds] portal load failure:', [n, w, m, a].filter((r) => r.error));
    setError(firstError ? `Could not load everything: ${describeError(firstError)}` : '');

    setNewest(n.data || []);
    setWeekly(w.data || []);
    setMonthly(m.data || []);
    setAlltime(a.data || []);
    setTotal(c.count || 0);
    setLoading(false);
  }, [category, query]);

  useEffect(() => { load(); }, [load]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };

  const activeCat = categories.find((c) => c.slug === category);

  // Below this many submissions, three ranked columns would all show the same
  // rows and the site reads as empty rather than new. Ten is roughly where a
  // scrollable column stops looking like a stub.
  const SPARSE_THRESHOLD = 10;
  const sparse = newest.length < SPARSE_THRESHOLD;

  return (
    <>
      <SiteHeader />

      <div className="vg-page">
        <div className="vg-section-head">
          <h2>🌀 THE PORTAL</h2>
          <span className="vg-sub">
            {compactNumber(total)} submission{total === 1 ? '' : 's'}
            {activeCat && ` in ${activeCat.name}`}
            {query && ` matching “${query}”`}
          </span>
        </div>

        <Notice tone="error">{error}</Notice>

        <form
          className="vg-strip"
          onSubmit={(e) => { e.preventDefault(); setParam('q', search.trim()); }}
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the Portal..."
            style={{
              flex: '1 1 240px', padding: '7px 10px', background: 'var(--bg-input)',
              border: '2px solid var(--border-dark)', color: 'var(--text-primary)',
              fontFamily: 'var(--font-retro)', fontSize: '17px',
            }}
          />
          <button type="submit" className="vg-tab is-active">SEARCH</button>
          {query && (
            <button type="button" className="vg-tab" onClick={() => { setSearch(''); setParam('q', ''); }}>
              CLEAR
            </button>
          )}
        </form>

        <div className="vg-tabs">
          <button
            type="button"
            className={`vg-tab ${!category ? 'is-active' : ''}`}
            onClick={() => setParam('cat', '')}
          >
            ALL
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

        <SubmitCta />

        {loading ? (
          <div className="vg-loading">⏳ Loading the Portal...</div>
        ) : (
          /*
           * Three columns of the same handful of submissions reads as broken,
           * not busy — the reader clocks instantly that all three charts are
           * the same two rows. Below the threshold we show one honest column;
           * the three-column wall arrives when there is enough to fill it.
           */
          <div className={sparse ? 'vg-1col' : 'vg-3col vg-3col-even'}>
            {sparse ? (
              <div className="vg-col">
                <ChartColumn
                  title="Everything, newest first" icon="🆕" rows={newest} showAge
                  ranked={false}
                  empty="Nothing posted yet. Be the first."
                />
                <div className="vg-rail-note">
                  The daily, monthly and all-time charts open up once there are a
                  few more submissions to rank. <Link to="/upload">Add yours →</Link>
                </div>
                <AdSlot index={0} />
              </div>
            ) : (
              <>
                {/* LEFT — newest, then this week. Recency first, then the
                    best of the last seven days: something good posted on
                    Tuesday used to have nowhere to appear except the newest
                    list, where it scrolled away by Thursday. */}
                <div className="vg-col">
                  <ChartColumn
                    title="Newest 50" icon="🆕" rows={newest} showAge
                    ranked={false}
                    to="/charts?chart=daily"
                    empty="Nothing posted yet. Be the first."
                  />
                  <ChartColumn
                    title="Top 50 This Week" icon="📅" rows={weekly}
                    to="/charts?chart=weekly"
                    empty="Nothing charted this week yet."
                  />
                </div>

                {/* MIDDLE — this month */}
                <div className="vg-col">
                  <ChartColumn
                    title="Top 100 This Month" icon="🗓️" rows={monthly}
                    to="/charts?chart=monthly"
                    empty="Nothing charted this month yet."
                  />
                  <AdSlot index={0} />
                </div>

                {/* RIGHT — all time */}
                <div className="vg-col">
                  <ChartColumn
                    title="All-Time Top 100" icon="👑" rows={alltime}
                    to="/charts?chart=alltime"
                    empty="Nothing charted yet."
                  />
                  <AdSlot index={1} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
