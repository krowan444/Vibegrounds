import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase, retryOnAbort } from '../lib/supabase';
import SiteHeader from '../components/SiteHeader';
import AdSlot from '../components/AdSlot';
import Notice from '../components/Notice';
import SubmitCta from '../components/SubmitCta';
import { scoreColor, timeAgo, compactNumber } from '../lib/format';
import { thumbFor, onThumbError, LOGO_FALLBACK } from '../lib/thumbnail';

/** A long, scrollable ranked column — the heart of the Portal. */
function ChartColumn({ title, icon, rows, to, empty, showAge }) {
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
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
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
              <span className="vg-rail-score" style={{ color: scoreColor(c.score) }}>
                {Number(c.score).toFixed(2)}
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
      if (category) out = out.eq('category', category);
      if (query) out = out.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      return out;
    };

    const settle = (r) => (r.status === 'fulfilled' ? r.value : { data: [], error: r.reason });
    const [n, m, a, c] = (await Promise.allSettled([
      retryOnAbort(() => apply(supabase.from('creations_public').select('*'))
        .order('created_at', { ascending: false }).limit(50)),
      retryOnAbort(() => apply(supabase.from('chart_monthly').select('*'))
        .order('rank').limit(100)),
      retryOnAbort(() => apply(supabase.from('chart_alltime').select('*'))
        .order('rank').limit(100)),
      retryOnAbort(() => apply(supabase.from('creations_public').select('id', { count: 'exact', head: true }))),
    ])).map(settle);

    const firstError = [n, m, a].find((r) => r.error)?.error;
    setError(firstError ? `Could not load everything: ${firstError.message || firstError}` : '');

    setNewest(n.data || []);
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
          <div className="vg-3col vg-3col-even">
            {/* LEFT — newest */}
            <div className="vg-col">
              <ChartColumn
                title="Newest 50" icon="🆕" rows={newest} showAge
                to="/charts?chart=daily"
                empty="Nothing posted yet. Be the first."
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
          </div>
        )}
      </div>
    </>
  );
}
