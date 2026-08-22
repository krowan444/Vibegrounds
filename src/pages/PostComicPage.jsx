import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, retryOnAbort, withTimeout, describeError } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import ComicPageGrid from '../components/ComicPageGrid';
import { releasePage } from '../lib/comicFiles';
import { uploadPages } from '../lib/comicUpload';

/**
 * Post a comic.
 *
 * Files are held in the browser and uploaded on save, not on drop. That way
 * abandoning the page leaves nothing behind in storage, and the comic row
 * and its pages are written by one function in one transaction — so a comic
 * with a hole in the middle cannot exist.
 */
export default function PostComicPage() {
  const { user, emailVerified } = useAuth();
  const navigate = useNavigate();

  const [pages, setPages] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isNsfw, setIsNsfw] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  // The ref matters. Depending on `pages` here would run the cleanup on every
  // change to the list, so dropping a second batch of files would revoke the
  // previews of the pages already on the grid and blank their thumbnails.
  // Only unmount releases the lot; removing one page releases its own.
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  useEffect(() => () => pagesRef.current.forEach(releasePage), []);

  // Nothing is uploaded until save, so closing the tab with a staged comic on
  // screen loses the ordering work — which is the expensive part.
  useEffect(() => {
    if (!pages.length || busy) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pages.length, busy]);

  const canSubmit = pages.length > 0 && title.trim().length >= 2 && !busy;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');

    try {
      const { urls, widths, heights } = await uploadPages(pages, user.id, setBusy);

      setBusy('Posting the comic...');
      const { data, error: rpcErr } = await withTimeout(
        retryOnAbort(() => supabase.rpc('submit_comic', {
          p_title: title.trim(),
          p_description: description.trim(),
          p_is_nsfw: isNsfw,
          p_pages: urls,
          p_widths: widths,
          p_heights: heights,
        })),
        30000,
      );
      if (rpcErr) throw new Error(describeError(rpcErr));

      setBusy('');
      navigate(`/comics/${data}`);
    } catch (e2) {
      console.error('comic post failed:', e2);
      setBusy('');
      setError(describeError(e2));
    }
  };

  if (!user) {
    return (
      <>
        <SiteHeader />
        <div className="vg-page">
          <div className="retro-panel">
            <div className="section-header"><h2>📖 Post a Comic</h2></div>
            <div className="vg-empty">
              <p><Link to="/auth?mode=signup">Join up</Link> to post a comic.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <div className="vg-page vg-comic-post">
        <div className="retro-panel">
          <div className="section-header"><h2>📖 Post a Comic</h2></div>

          <div className="retro-panel-body">
            <Notice tone="error">{error}</Notice>
            {!emailVerified && (
              <Notice tone="warn">Confirm your email address before posting.</Notice>
            )}

            <p className="vg-comic-hint">
              Drop your pages in. They stay in the order they arrive — if that
              is not the order you want, drag them about, use the arrows, or
              press <strong>Sort by name</strong>. The big number is the page
              number readers will see.
              {' '}<strong>1400 × 2100</strong> is the sweet spot, but any size works.
            </p>

            <form onSubmit={submit}>
              <ComicPageGrid
                pages={pages}
                onChange={setPages}
                disabled={!!busy}
                onProblems={(p) => setError(p.length ? p.join('. ') + '.' : '')}
              />

              <div className="retro-form-group">
                <label htmlFor="comic-title">Title</label>
                <input
                  id="comic-title" className="vg-comic-input" value={title}
                  onChange={(e) => setTitle(e.target.value)} maxLength={120}
                  placeholder="The Squirrel Chronicles, Chapter 1" disabled={!!busy}
                />
              </div>

              <div className="retro-form-group">
                <label htmlFor="comic-desc">What is it? <span className="vg-comic-opt">optional</span></label>
                <textarea
                  id="comic-desc" className="vg-comic-input" value={description}
                  onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3}
                  placeholder="A squirrel takes on the pigeon cartel. Drawn in a week, mostly at night."
                  disabled={!!busy}
                />
              </div>

              <label className="vg-comic-nsfw">
                <input type="checkbox" checked={isNsfw} disabled={!!busy}
                  onChange={(e) => setIsNsfw(e.target.checked)} />
                <span>Not for children — put it behind a cover</span>
              </label>

              <div className="vg-comic-actions">
                {busy && <span className="vg-comic-busy">{busy}</span>}
                <button
                  type="submit" className="retro-cta"
                  disabled={!canSubmit || !emailVerified}
                  title={emailVerified ? undefined : 'Confirm your email address first'}
                >
                  {busy ? 'WORKING...' : '📖 POST THE COMIC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
