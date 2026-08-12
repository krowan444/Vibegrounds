import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase, retryOnAbort } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import NsfwImage from '../components/NsfwImage';
import MemeLightbox from '../components/MemeLightbox';
import { scoreLabel, scoreLabelColor, isUnrated } from '../lib/format';

/**
 * The meme board.
 *
 * Newest and top rated sit on one screen rather than behind tabs. A tab is a
 * thing nobody clicks: with the board split in two, a meme posted five
 * minutes ago was invisible unless you happened to switch to Newest, which
 * is precisely backwards — new uploads are the ones that need eyes on them
 * to get their first vote and climb.
 *
 * The image is the product, so the tiles are large and the text under each
 * is a label, not a card: title, who made it, score. Clicking opens it full
 * size in place so you can flick through with the arrow keys.
 */
export default function MemesPage() {
  const { user } = useAuth();
  const [newest, setNewest] = useState(null);
  const [top, setTop] = useState(null);
  const [error, setError] = useState('');

  // Which list the viewer is walking through, and where in it.
  const [view, setView] = useState(null); // { list: 'newest' | 'top', index }

  const load = useCallback(async () => {
    const settle = (r) => (r.status === 'fulfilled' ? r.value : { data: [], error: r.reason });
    const [n, t] = (await Promise.allSettled([
      retryOnAbort(() => supabase.from('memes_public').select('*')
        .order('created_at', { ascending: false }).limit(24)),
      retryOnAbort(() => supabase.from('chart_memes').select('*')
        .order('rank', { ascending: true }).limit(24)),
    ])).map(settle);

    const firstError = [n, t].find((r) => r.error)?.error;
    if (firstError) setError(`Could not load everything: ${firstError.message || firstError}`);

    setNewest(n.data || []);
    setTop(t.data || []);
  }, []);

  useEffect(() => {
    load().catch(() => { setNewest([]); setTop([]); });
  }, [load]);

  const openList = view?.list === 'top' ? (top || []) : (newest || []);

  const Tile = ({ m, onOpen }) => (
    <button type="button" className="vg-meme-card" onClick={onOpen} aria-label={`Open ${m.title}`}>
      <span className="vg-meme-shot">
        <NsfwImage
          src={m.thumbnail_url || m.project_url}
          alt={m.title}
          nsfw={m.is_nsfw}
          className="vg-meme-img"
        />
      </span>
      <span className="vg-meme-body">
        <span className="vg-meme-name">{m.title}</span>
        <span className="vg-meme-line">
          <span className="vg-meme-by">{m.creator_username}</span>
          <span className="vg-meme-score" style={{ color: scoreLabelColor(m) }}>
            {isUnrated(m) ? '–' : `★ ${scoreLabel(m)}`}
          </span>
        </span>
      </span>
    </button>
  );

  const loading = newest === null || top === null;
  const nothing = !loading && newest.length === 0 && top.length === 0;

  return (
    <>
      <SiteHeader />

      <div className="vg-page">
        <div className="vg-memes-head">
          <div>
            <h1 className="vg-memes-title">😂 Memes</h1>
            <p className="vg-memes-blurb">
              Free to post, rated out of 5 like everything else.
            </p>
          </div>
          <Link
            to={user ? '/memes/post' : '/auth?mode=signup'}
            className="retro-cta vg-memes-cta"
          >
            + POST A MEME
          </Link>
        </div>

        <Notice tone="error">{error}</Notice>

        {loading && <div className="vg-loading">⏳ Loading the memes...</div>}

        {nothing && (
          <div className="vg-memes-empty">
            <div className="vg-memes-empty-icon">🫥</div>
            <h3>No memes yet</h3>
            <p>The board is empty. Be the first.</p>
            <Link to={user ? '/memes/post' : '/auth?mode=signup'} className="retro-cta">
              POST THE FIRST ONE
            </Link>
          </div>
        )}

        {/* Newest first — a meme with no votes yet is the one that most
            needs to be seen. */}
        {!loading && newest.length > 0 && (
          <section className="vg-meme-section">
            <div className="vg-meme-section-head">
              <h2>🆕 Fresh</h2>
              <span className="vg-meme-section-sub">Straight off the press</span>
            </div>
            <div className="vg-meme-grid">
              {newest.map((m, i) => (
                <Tile key={m.id} m={m} onOpen={() => setView({ list: 'newest', index: i })} />
              ))}
            </div>
          </section>
        )}

        {!loading && top.length > 0 && (
          <section className="vg-meme-section">
            <div className="vg-meme-section-head">
              <h2>🏆 Top Rated</h2>
              <span className="vg-meme-section-sub">The best of the board, by score</span>
            </div>
            <div className="vg-meme-grid">
              {top.map((m, i) => (
                <Tile key={m.id} m={m} onOpen={() => setView({ list: 'top', index: i })} />
              ))}
            </div>
          </section>
        )}

        {!loading && newest.length > 0 && top.length === 0 && (
          <p className="vg-meme-note">
            Nothing has been rated yet — go and score a few and the Top Rated board fills up.
          </p>
        )}
      </div>

      {view && openList.length > 0 && (
        <MemeLightbox
          memes={openList}
          index={view.index}
          onIndex={(i) => setView((v) => ({ ...v, index: i }))}
          onClose={() => setView(null)}
        />
      )}
    </>
  );
}
