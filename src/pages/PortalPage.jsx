import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import SiteHeader from '../components/SiteHeader';
import CreationCard from '../components/CreationCard';
import Notice from '../components/Notice';

const SORTS = [
  { id: 'new',    label: 'Newest',      column: 'created_at', asc: false },
  { id: 'top',    label: 'Top Rated',   column: 'score',      asc: false },
  { id: 'viewed', label: 'Most Viewed', column: 'view_count', asc: false },
  { id: 'talked', label: 'Most Talked', column: 'review_count', asc: false },
];

const PAGE_SIZE = 24;

export default function PortalPage() {
  const [params, setParams] = useSearchParams();
  const sortId = params.get('sort') || 'new';
  const category = params.get('cat') || '';
  const query = params.get('q') || '';

  const sort = SORTS.find((s) => s.id === sortId) || SORTS[0];

  const [categories, setCategories] = useState([]);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(query);

  useEffect(() => {
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => setCategories(data || []));
  }, []);

  const load = useCallback(async (pageIndex) => {
    setLoading(true);
    let q = supabase
      .from('creations_public')
      .select('*', { count: 'exact' })
      .order(sort.column, { ascending: sort.asc })
      .range(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE - 1);

    if (category) q = q.eq('category', category);
    if (query) q = q.or(`title.ilike.%${query}%,description.ilike.%${query}%`);

    const { data, error: err, count } = await q;
    if (err) setError(err.message);
    else {
      setError('');
      setRows(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [sort.column, sort.asc, category, query]);

  useEffect(() => { setPage(0); load(0); }, [load]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };

  const pages = Math.ceil(total / PAGE_SIZE);
  const activeCat = categories.find((c) => c.slug === category);

  return (
    <>
      <SiteHeader />

      <div className="vg-page">
        <div className="vg-section-head">
          <h2>🌀 THE PORTAL</h2>
          <span className="vg-sub">
            Everything anyone has ever posted. {total} submission{total === 1 ? '' : 's'}
            {activeCat && ` in ${activeCat.name}`}
            {query && ` matching “${query}”`}
          </span>
        </div>

        <Notice tone="error">{error}</Notice>

        {/* Search */}
        <form
          className="vg-strip"
          onSubmit={(e) => { e.preventDefault(); setParam('q', search.trim()); }}
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles and descriptions..."
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

        {/* Category filter */}
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

        {/* Sort */}
        <div className="vg-tabs">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`vg-tab ${sortId === s.id ? 'is-active' : ''}`}
              onClick={() => setParam('sort', s.id)}
            >
              {s.label.toUpperCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="vg-loading">⏳ Loading submissions...</div>
        ) : rows.length === 0 ? (
          <div className="vg-empty">
            <p>Nothing here{query ? ' matches that search' : ' yet'}.</p>
            <p style={{ marginTop: '10px' }}>
              <Link to="/upload" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>
                Post the first one →
              </Link>
            </p>
          </div>
        ) : (
          <>
            <div className="vg-grid">
              {rows.map((c) => <CreationCard key={c.id} creation={c} />)}
            </div>

            {pages > 1 && (
              <div className="vg-tabs" style={{ marginTop: '16px', justifyContent: 'center' }}>
                <button
                  type="button" className="vg-tab" disabled={page === 0}
                  onClick={() => { const p = page - 1; setPage(p); load(p); window.scrollTo(0, 0); }}
                >
                  ← PREV
                </button>
                <span style={{
                  fontFamily: 'var(--font-retro)', fontSize: '17px',
                  color: 'var(--text-dim)', padding: '7px 10px',
                }}>
                  page {page + 1} of {pages}
                </span>
                <button
                  type="button" className="vg-tab" disabled={page + 1 >= pages}
                  onClick={() => { const p = page + 1; setPage(p); load(p); window.scrollTo(0, 0); }}
                >
                  NEXT →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
