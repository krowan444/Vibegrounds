import { useParams, Link, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import SiteHeader from '../components/SiteHeader';
import CreationCard from '../components/CreationCard';
import Notice from '../components/Notice';
import SubmitCta from '../components/SubmitCta';
import CreditNote from '../components/CreditNote';
import { compactNumber } from '../lib/format';
import { useDocumentTitle } from '../lib/pageMeta';

/*
 * Categories where most of the best work is made by people outside this
 * site, so pointing at other people's stuff is genuinely worth encouraging.
 * The value is the noun used in the prompt — "great films", "great tracks".
 */
const CREDIT_CATEGORIES = {
  'ai-movies': 'films',
  audio: 'music or sound',
  art: 'art',
};

/**
 * A real shout-out, as an example of the behaviour we are asking for:
 * named, linked, and clearly not ours.
 */
function DorBrothersShoutOut() {
  return (
    <div className="vg-shoutout">
      <div className="vg-shoutout-label">⭐ Shout-out</div>
      <div className="vg-shoutout-body">
        <strong>The Dor Brothers</strong> — Yonatan Dor&#39;s Berlin studio, and
        about the best AI film-making going. Hundreds of projects, well over
        100 million views, and they were doing cinematic AI before most people
        knew it was possible. Not ours, nothing to do with us, just worth your
        time.{' '}
        <a href="https://thedorbrothers.com/" target="_blank" rel="noreferrer noopener">
          thedorbrothers.com
        </a>{' '}
        ·{' '}
        <a href="https://www.youtube.com/@thedorbrothers" target="_blank" rel="noreferrer noopener">
          YouTube
        </a>
      </div>
    </div>
  );
}

export default function CategoryPage() {
  const { category } = useParams();
  const [meta, setMeta] = useState(null);
  const [top, setTop] = useState([]);
  const [latest, setLatest] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  useDocumentTitle(meta?.name, meta?.tagline || undefined);


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

        {/*
          Only on the categories where the good stuff is overwhelmingly made
          by people who are not members here. Putting this on Games or
          Software would just be noise — those are things members build
          themselves.
        */}
        {CREDIT_CATEGORIES[category] && (
          <CreditNote
            what={CREDIT_CATEGORIES[category]}
            shoutOut={category === 'ai-movies' ? <DorBrothersShoutOut /> : null}
          />
        )}

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
