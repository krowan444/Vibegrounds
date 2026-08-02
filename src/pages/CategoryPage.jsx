import { useParams, Link, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import SiteHeader from '../components/SiteHeader';
import CreationCard from '../components/CreationCard';
import Notice from '../components/Notice';
import SubmitCta from '../components/SubmitCta';
import { compactNumber } from '../lib/format';

export default function CategoryPage() {
  const { category } = useParams();
  const [meta, setMeta] = useState(null);
  const [top, setTop] = useState([]);
  const [latest, setLatest] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const { data: cat } = await supabase
        .from('categories').select('*').eq('slug', category).maybeSingle();

      if (!alive) return;
      if (!cat) { setNotFound(true); setLoading(false); return; }
      setMeta(cat);

      const [topRes, latestRes, countRes] = await Promise.all([
        supabase.from('creations_public').select('*').eq('category', category)
          .gte('vote_count', 3).order('score', { ascending: false }).limit(6),
        supabase.from('creations_public').select('*').eq('category', category)
          .order('created_at', { ascending: false }).limit(24),
        supabase.from('creations_public').select('id', { count: 'exact', head: true })
          .eq('category', category),
      ]);

      if (!alive) return;
      if (latestRes.error) setError(latestRes.error.message);
      setTop(topRes.data || []);
      setLatest(latestRes.data || []);
      setCount(countRes.count || 0);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [category]);

  if (notFound) return <Navigate to="/portal" replace />;

  if (loading) {
    return (
      <>
        <SiteHeader />
        <div className="vg-page"><div className="vg-loading">⏳ Loading {category}...</div></div>
      </>
    );
  }

  return (
    <>
      <SiteHeader />

      <div className="vg-page">
        {/* Category banner */}
        <div
          className="vg-strip"
          style={{
            borderColor: meta.color,
            background: `linear-gradient(90deg, ${meta.color}22, transparent)`,
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '15px', color: meta.color }}>
              {meta.icon} {meta.name.toUpperCase()}
            </div>
            <div style={{
              fontFamily: 'var(--font-retro)', fontSize: '18px',
              color: 'var(--text-secondary)', marginTop: '6px',
            }}>
              {meta.tagline}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '14px', color: 'var(--text-bright)' }}>
              {compactNumber(count)}
            </div>
            <div style={{ fontFamily: 'var(--font-retro)', fontSize: '15px', color: 'var(--text-dim)' }}>
              submission{count === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        <Notice tone="error">{error}</Notice>

        {count === 0 ? (
          <div className="vg-empty">
            <p>Nothing in {meta.name} yet.</p>
            <p style={{ marginTop: '10px' }}>
              <Link to="/upload" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>
                Claim the first spot →
              </Link>
            </p>
          </div>
        ) : (
          <>
            {top.length > 0 && (
              <div className="vg-section">
                <div className="vg-section-head">
                  <h2>🏆 BEST IN {meta.name.toUpperCase()}</h2>
                  <Link to={`/portal?cat=${meta.slug}&sort=top`}>See all top rated →</Link>
                </div>
                <div className="vg-grid">
                  {top.map((c) => <CreationCard key={c.id} creation={c} />)}
                </div>
              </div>
            )}

            <div className="vg-section">
              <div className="vg-section-head">
                <h2>🆕 LATEST</h2>
                <Link to={`/portal?cat=${meta.slug}`}>Browse everything →</Link>
              </div>
              <div className="vg-grid">
                {latest.map((c) => <CreationCard key={c.id} creation={c} />)}
              </div>
            </div>

            <SubmitCta text={`Got something for ${meta.name}? Put it on the board.`} />
          </>
        )}
      </div>
    </>
  );
}
