import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase, retryOnAbort } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import NsfwImage from '../components/NsfwImage';
import MemeLightbox from '../components/MemeLightbox';
import { scoreLabel, scoreLabelColor, isUnrated } from '../lib/format';

const SORTS = [
  { id: 'top',    label: 'Top Rated', view: 'chart_memes',  order: 'rank',       asc: true,  blurb: 'The best of the board, by score.' },
  { id: 'newest', label: 'Newest',    view: 'memes_public', order: 'created_at', asc: false, blurb: 'Straight off the press.' },
];

/**
 * The meme board.
 *
 * The image is the product here, so the tiles are large and everything else
 * is deliberately quiet: a title, who made it, and the score. Nothing else.
 * Voting used to sit on every tile, which meant five competing controls per
 * screen and a wall that read as busy rather than browsable — it lives in
 * the viewer now, where you are actually looking at the thing you'd rate.
 *
 * Clicking a tile opens it full size in place rather than navigating, so you
 * can move through the whole board with the arrow keys.
 */
export default function MemesPage() {
  const { user } = useAuth();
  const [sort, setSort] = useState('top');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null); // index into rows, or null

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
            {rows.map((m, i) => (
              <button
                key={m.id}
                type="button"
                className="vg-meme-card"
                onClick={() => setOpen(i)}
                aria-label={`Open ${m.title}`}
              >
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
            ))}
          </div>
        )}
      </div>

      {open !== null && rows && rows.length > 0 && (
        <MemeLightbox
          memes={rows}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
