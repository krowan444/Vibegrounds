import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, retryOnAbort, describeError } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import NsfwImage from '../components/NsfwImage';
import { timeAgo, compactNumber } from '../lib/format';

/**
 * The comics shelf.
 *
 * Covers, big. A comic sells itself on its first page and nothing else, so
 * the grid is mostly picture with the title underneath, rather than a list
 * of names with thumbnails attached.
 */
export default function ComicsPage() {
  const { user } = useAuth();
  const [comics, setComics] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    retryOnAbort(() =>
      supabase.from('comics_public').select('*').order('created_at', { ascending: false }).limit(60),
    ).then(({ data, error: err }) => {
      if (!alive) return;
      if (err) setError(describeError(err));
      setComics(data || []);
    });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <SiteHeader />
      <div className="vg-page">

        <div className="retro-panel" style={{ marginBottom: '10px' }}>
          <div className="section-header">
            <h2>📖 Comics</h2>
            {comics?.length > 0 && (
              <span className="vg-updates-count">{comics.length} on the shelf</span>
            )}
          </div>
          <div className="retro-panel-body vg-comics-intro">
            <p>
              Single pages, one-shots, chapters of something longer. Drawn,
              painted, pixelled, or photographed off a sketchbook — it all counts.
            </p>
            <p className="vg-comics-spec">
              Posting one? <strong>1400 × 2100 pixels</strong> is the size to aim
              for — sharp on a phone, right proportions for a comic page, and
              small enough that nobody waits. Under 2MB a page if you can.
              Any size works though, including tall webtoon strips.
            </p>
            <Link to={user ? '/comics/post' : '/auth?mode=signup'} className="retro-cta">
              📖 POST A COMIC
            </Link>
          </div>
        </div>

        <Notice tone="error">{error}</Notice>

        {comics === null ? (
          <div className="vg-loading">⏳ Loading...</div>
        ) : comics.length === 0 ? (
          <div className="retro-panel">
            <div className="vg-empty">
              <p>No comics yet. This is the good bit — whoever goes first sets the tone.</p>
              <p style={{ marginTop: '10px' }}>
                <Link to={user ? '/comics/post' : '/auth?mode=signup'} style={{ color: 'var(--orange)', fontWeight: 'bold' }}>
                  Post the first one →
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <div className="vg-comics-grid">
            {comics.map((c) => (
              <Link key={c.id} to={`/comics/${c.id}`} className="vg-comic-card">
                <div className="vg-comic-cover-frame">
                  {c.cover_url
                    ? <NsfwImage src={c.cover_url} alt={c.title} nsfw={c.is_nsfw} />
                    : <div className="vg-comic-nocover">📖</div>}
                  <span className="vg-comic-pages">{c.page_count}p</span>
                </div>
                <div className="vg-comic-card-body">
                  <span className="vg-comic-card-title">{c.title}</span>
                  <span className="vg-comic-card-by">
                    by {c.creator_username} · {compactNumber(c.view_count)} read{c.view_count === 1 ? '' : 's'} · {timeAgo(c.created_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
