import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase, retryOnAbort, loadFailure } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import NsfwImage from '../components/NsfwImage';
import MemeLightbox from '../components/MemeLightbox';
import { scoreLabel, scoreLabelColor, isUnrated } from '../lib/format';

/**
 * The meme board.
 *
 * The old layout was two lists of 24 — "Fresh" and "Top Rated" — drawn from a
 * board of eighteen memes. Every meme appeared in both, so the page read as
 * the same wall of images twice and neither heading meant anything. Worse,
 * there was no way to see the whole board: 24 was the ceiling.
 *
 * So: two short highlight rows and one full catalogue underneath.
 *
 *   🔥 Hot      the best-scoring memes, a handful of them
 *   🆕 New      the most recent, with anything already in Hot removed
 *   📚 All      the entire board, sortable, filterable, paged
 *
 * Hot and New are deliberately small. They are a shop window, not a list —
 * the catalogue is where you go to actually browse, and it is the only
 * section that grows. Deduplicating New against Hot is what stops the two
 * rows being the same pictures, which was the original complaint.
 */

const HOT_N = 6;
const NEW_N = 6;
const PAGE = 24;

const SORTS = {
  newest: { label: 'Newest',     col: 'created_at' },
  top:    { label: 'Top rated',  col: 'score' },
  voted:  { label: 'Most voted', col: 'vote_count' },
};

export default function MemesPage() {
  const { user } = useAuth();

  const [hot, setHot] = useState(null);
  const [fresh, setFresh] = useState(null);

  // The catalogue is paged and independently sorted/filtered.
  const [all, setAll] = useState([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('newest');
  const [tag, setTag] = useState('');
  const [tags, setTags] = useState([]);
  const [more, setMore] = useState(false);

  const [error, setError] = useState('');
  const [view, setView] = useState(null); // { list, index }

  /* Highlight rows + the tag vocabulary. Loaded once. */
  const loadTop = useCallback(async () => {
    const settle = (r) => (r.status === 'fulfilled' ? r.value : { data: [], error: r.reason });
    const [h, n, t] = (await Promise.allSettled([
      retryOnAbort(() => supabase.from('chart_memes').select('*')
        .order('rank', { ascending: true }).limit(HOT_N)),
      // Over-fetch so that removing the Hot ones still leaves a full row.
      retryOnAbort(() => supabase.from('memes_public').select('*')
        .order('created_at', { ascending: false }).limit(HOT_N + NEW_N)),
      retryOnAbort(() => supabase.from('memes_public').select('tags')),
    ])).map(settle);

    const firstError = [h, n, t].find((r) => r.error)?.error;
    if (firstError) setError(loadFailure(firstError, 'everything'));

    const hotList = h.data || [];
    const hotIds = new Set(hotList.map((m) => m.id));
    setHot(hotList);
    setFresh((n.data || []).filter((m) => !hotIds.has(m.id)).slice(0, NEW_N));

    // Every tag anyone has used, most common first, so the filter row is
    // ordered by usefulness rather than alphabetically.
    const counts = new Map();
    (t.data || []).forEach((row) => (row.tags || []).forEach((x) => counts.set(x, (counts.get(x) || 0) + 1)));
    setTags([...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, n2]) => ({ name, n: n2 })));
  }, []);

  /* The catalogue. Re-runs whenever the sort or tag filter changes. */
  const loadPage = useCallback(async (from) => {
    let q = supabase.from('memes_public').select('*', { count: 'exact' });
    if (tag) q = q.contains('tags', [tag]);
    const { data, count, error: err } = await retryOnAbort(() => q
      .order(SORTS[sort].col, { ascending: false })
      .range(from, from + PAGE - 1));

    if (err) { setError(loadFailure(err, 'the catalogue')); return; }
    const rows = data || [];
    setTotal(count || 0);
    setAll((prev) => (from === 0 ? rows : [...prev, ...rows]));
    setMore(from + rows.length < (count || 0));
  }, [sort, tag]);

  useEffect(() => { loadTop().catch(() => { setHot([]); setFresh([]); }); }, [loadTop]);
  useEffect(() => { loadPage(0).catch(() => setAll([])); }, [loadPage]);

  const openList = useMemo(() => {
    if (view?.list === 'hot') return hot || [];
    if (view?.list === 'fresh') return fresh || [];
    return all;
  }, [view, hot, fresh, all]);

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
        {/* Tags double as a browse affordance: seeing them on a meme is what
            tells you the filter row above is worth using. */}
        {m.tags?.length > 0 && (
          <span className="vg-meme-tags">
            {m.tags.slice(0, 3).map((x) => <span key={x} className="vg-meme-tag">{x}</span>)}
          </span>
        )}
      </span>
    </button>
  );

  const Row = ({ id, icon, title, sub, list, keyName }) => (
    <section className="vg-meme-section" id={id}>
      <div className="vg-meme-section-head">
        <h2>{icon} {title}</h2>
        <span className="vg-meme-section-sub">{sub}</span>
      </div>
      <div className="vg-meme-grid vg-meme-grid-row">
        {list.map((m, i) => (
          <Tile key={m.id} m={m} onOpen={() => setView({ list: keyName, index: i })} />
        ))}
      </div>
    </section>
  );

  const loading = hot === null || fresh === null;
  const nothing = !loading && hot.length === 0 && fresh.length === 0 && all.length === 0;

  /*
   * Highlight rows only earn their space once the board is bigger than they
   * are. On a board of four, Hot is the whole board, so showing Hot and then
   * the catalogue underneath is the same four pictures twice — which is the
   * exact repetition this rebuild set out to remove.
   *
   * Below the threshold the catalogue alone does the job: the sort buttons
   * already give you hot (Top rated) and new (Newest) without repeating a
   * single tile. The rows appear on their own once there is enough to sample.
   */
  const showcase = total > HOT_N + NEW_N;

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

        {!loading && showcase && hot.length > 0 && (
          <Row id="hot" icon="🔥" title="Hot" sub="Best scoring on the board" list={hot} keyName="hot" />
        )}

        {!loading && showcase && fresh.length > 0 && (
          <Row id="new" icon="🆕" title="New" sub="Straight off the press" list={fresh} keyName="fresh" />
        )}

        {/* The catalogue. Everything, always — the two rows above are only a
            sample of it, so this is the section that has to scale. */}
        {!loading && total > 0 && (
          <section className="vg-meme-section" id="all">
            <div className="vg-meme-section-head">
              <h2>📚 All Memes</h2>
              <span className="vg-meme-section-sub">
                {tag
                  ? `${total} tagged “${tag}”`
                  : `${showcase ? 'The whole board' : 'Everything on the board'} — ${total} in total`}
              </span>
            </div>

            <div className="vg-meme-controls">
              <div className="vg-meme-sorts">
                {Object.entries(SORTS).map(([k, s]) => (
                  <button
                    key={k}
                    type="button"
                    className={sort === k ? 'vg-meme-sort is-on' : 'vg-meme-sort'}
                    onClick={() => setSort(k)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Only worth showing once somebody has actually tagged something,
                  otherwise it is an empty control that makes the page look broken. */}
              {tags.length > 0 && (
                <div className="vg-meme-tagbar">
                  <button
                    type="button"
                    className={tag === '' ? 'vg-meme-tagpill is-on' : 'vg-meme-tagpill'}
                    onClick={() => setTag('')}
                  >
                    All
                  </button>
                  {tags.slice(0, 12).map(({ name, n }) => (
                    <button
                      key={name}
                      type="button"
                      className={tag === name ? 'vg-meme-tagpill is-on' : 'vg-meme-tagpill'}
                      onClick={() => setTag(name === tag ? '' : name)}
                    >
                      {name} <span className="vg-meme-tagpill-n">{n}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {all.length === 0 ? (
              <p className="vg-meme-note">Nothing tagged “{tag}” yet.</p>
            ) : (
              <div className="vg-meme-grid">
                {all.map((m, i) => (
                  <Tile key={m.id} m={m} onOpen={() => setView({ list: 'all', index: i })} />
                ))}
              </div>
            )}

            {more && (
              <button
                type="button"
                className="retro-cta vg-meme-more"
                onClick={() => loadPage(all.length)}
              >
                LOAD MORE ({total - all.length} to go)
              </button>
            )}
          </section>
        )}

        {!loading && showcase && hot.length === 0 && all.length > 0 && (
          <p className="vg-meme-note">
            Nothing has been rated yet — go and score a few and the Hot row fills up.
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
