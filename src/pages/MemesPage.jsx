import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase, retryOnAbort } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import NsfwImage from '../components/NsfwImage';
import VoteWidget from '../components/VoteWidget';
import { scoreLabel, scoreLabelColor, isUnrated, timeAgo } from '../lib/format';

const SORTS = [
  { id: 'top',    label: 'Top Rated', view: 'chart_memes',  order: 'rank',       asc: true,  blurb: 'The best of the board, by score.' },
  { id: 'newest', label: 'Newest',    view: 'memes_public', order: 'created_at', asc: false, blurb: 'Straight off the press.' },
];

/**
 * The meme board.
 *
 * Deliberately a wall of images rather than the card-and-metadata layout
 * the Portal uses. Memes are judged in about a second, so the image gets
 * the space and everything else gets out of the way.
 */
export default function MemesPage() {
  const { user } = useAuth();
  const [sort, setSort] = useState('top');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async (which) => {
    const cfg = SORTS.find((s) => s.id === which) || SORTS[0];
    setRows(null);
    setError('');

    const { data, error: err } = await retryOnAbort(() =>
      supabase.from(cfg.view).select('*').order(cfg.order, { ascending: cfg.asc }).limit(60));

    if (err) {
      setError(`Could not load the memes: ${err.message || err}`);
      setRows([]);
      return;
    }
    setRows(data || []);
  }, []);

  useEffect(() => { load(sort).catch(() => setRows([])); }, [sort, load]);

  const active = SORTS.find((s) => s.id === sort) || SORTS[0];

  return (
    <>
      <SiteHeader />

      <div className="vg-page">
        <div className="vg-memes-head">
          <div>
            <h1 className="vg-memes-title">😂 Memes</h1>
            <p className="vg-memes-blurb">
              Free to post, rated out of 5 like everything else. {active.blurb}
            </p>
          </div>
          <Link
            to={user ? '/memes/post' : '/auth?mode=signup'}
            className="retro-cta vg-memes-cta"
          >
            + POST A MEME
          </Link>
        </div>

        <div className="vg-memes-tabs">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`vg-memes-tab ${sort === s.id ? 'is-on' : ''}`}
              onClick={() => setSort(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <Notice tone="error">{error}</Notice>

        {rows === null && <div className="vg-loading">⏳ Loading the memes...</div>}

        {rows !== null && rows.length === 0 && !error && (
          <div className="vg-memes-empty">
            <div className="vg-memes-empty-icon">🫥</div>
            <h3>No memes yet</h3>
            <p>
              {sort === 'top'
                ? 'Nothing has been rated yet. Post one, or go and rate what is already there.'
                : 'The board is empty. Be the first.'}
            </p>
            <Link to={user ? '/memes/post' : '/auth?mode=signup'} className="retro-cta">
              POST THE FIRST ONE
            </Link>
          </div>
        )}

        {rows !== null && rows.length > 0 && (
          <div className="vg-meme-grid">
            {rows.map((m) => (
              <div key={m.id} className="vg-meme-card">
                <Link to={`/creation/${m.id}`} className="vg-meme-shot">
                  <NsfwImage
                    src={m.thumbnail_url || m.project_url}
                    alt={m.title}
                    nsfw={m.is_nsfw}
                    className="vg-meme-img"
                  />
                </Link>

                <div className="vg-meme-body">
                  <Link to={`/creation/${m.id}`} className="vg-meme-name">{m.title}</Link>
                  <div className="vg-meme-meta">
                    by <Link to={`/profile/${m.creator_username}`}>{m.creator_username}</Link>
                    {' · '}{timeAgo(m.created_at)}
                  </div>

                  <div className="vg-meme-foot">
                    <span className="vg-meme-score" style={{ color: scoreLabelColor(m) }}>
                      {isUnrated(m) ? 'UNRATED' : `★ ${scoreLabel(m)}`}
                    </span>
                    <VoteWidget creation={m} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
