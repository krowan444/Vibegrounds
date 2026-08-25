import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase, retryOnAbort, withTimeout, describeError } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import ComicPageGrid from '../components/ComicPageGrid';
import { pageFromRemote, releasePage } from '../lib/comicFiles';
import { uploadPages, forgetRemovedPages, recompressExisting } from '../lib/comicUpload';
import { useDocumentTitle } from '../lib/pageMeta';

/**
 * Edit a comic.
 *
 * Same grid as posting one, loaded with what is already there. The one thing
 * this screen has to do that the post screen does not is tell you what is
 * about to change — you are altering something that already exists and that
 * people may already have read, so "save" should never be a surprise. The
 * summary above the button is that promise: added, removed, reordered, in
 * plain words, before you commit to any of it.
 */
export default function EditComicPage() {
  const { id } = useParams();
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();

  const [comic, setComic] = useState(null);
  const [original, setOriginal] = useState(null);   // { pages: [url], title, description, isNsfw }
  const [pages, setPages] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isNsfw, setIsNsfw] = useState(false);

  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [shrinkResult, setShrinkResult] = useState('');

  useDocumentTitle(comic ? `Editing ${comic.title}` : undefined);

  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  useEffect(() => () => pagesRef.current.forEach(releasePage), []);

  useEffect(() => {
    if (!user) return undefined;
    let alive = true;

    (async () => {
      const [c, p] = await Promise.all([
        supabase.from('comics').select('*').eq('id', id).maybeSingle(),
        supabase.from('comic_pages').select('*').eq('comic_id', id).order('position'),
      ]);
      if (!alive) return;

      if (c.error || !c.data) { setDenied('That comic does not exist, or it has been removed.'); setLoading(false); return; }
      if (c.data.creator_id !== user.id && !isStaff) { setDenied('That comic belongs to somebody else.'); setLoading(false); return; }
      if (p.error) setError(describeError(p.error));

      const loaded = (p.data || []).map(pageFromRemote);
      setComic(c.data);
      setPages(loaded);
      setTitle(c.data.title);
      setDescription(c.data.description || '');
      setIsNsfw(!!c.data.is_nsfw);
      setOriginal({
        pages: loaded.map((x) => x.remoteUrl),
        title: c.data.title,
        description: c.data.description || '',
        isNsfw: !!c.data.is_nsfw,
      });
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [id, user, isStaff]);

  /** What "save" is actually going to do, in words, before it does it. */
  const changes = useMemo(() => {
    if (!original) return { list: [], any: false };
    const was = original.pages;
    const now = pages.map((p) => p.remoteUrl);          // null for anything new
    const kept = now.filter(Boolean);

    const added = pages.filter((p) => p.file).length;
    const removed = was.filter((u) => !kept.includes(u)).length;
    // Reordering counts only among the pages that were there before and
    // still are — otherwise adding a page to the front would report as a
    // reorder as well, which is technically true and not what anyone means.
    const before = was.filter((u) => kept.includes(u));
    const reordered = before.some((u, i) => kept[i] !== u);

    const list = [];
    if (added) list.push(`${added} page${added === 1 ? '' : 's'} added`);
    if (removed) list.push(`${removed} page${removed === 1 ? '' : 's'} removed`);
    if (reordered) list.push('pages reordered');
    if (title.trim() !== original.title) list.push('title changed');
    if (description.trim() !== original.description) list.push('description changed');
    if (isNsfw !== original.isNsfw) list.push(isNsfw ? 'marked not for children' : 'no longer marked 18+');

    // A page the person has only just chosen has no stored URL yet, so it is
    // compared against a sentinel that no real URL can equal. This used to be
    // a literal NUL character, which worked but made git treat this whole file
    // as binary — no diffs, no review.
    const firstPageNow = pages[0]?.remoteUrl ?? '(newly chosen file)';
    const coverChanged = firstPageNow !== (was[0] ?? null);
    if (coverChanged && !list.includes('pages reordered')) list.push('new title page');

    return { list, any: list.length > 0 };
  }, [original, pages, title, description, isNsfw]);

  const canSave = pages.length > 0 && title.trim().length >= 2 && !busy && changes.any;

  useEffect(() => {
    if (!changes.any || busy) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changes.any, busy]);

  /**
   * Squash pages that were posted before we started squashing them.
   *
   * Kept as its own button rather than folded into Save, because it rewrites
   * every page of somebody's comic and that should be a thing you choose,
   * not a side effect of fixing a typo in the title.
   */
  const shrinkExisting = async () => {
    const already = pages.filter((p) => p.remoteUrl).length;
    if (!already) return;
    if (!window.confirm(
      `Make the ${already} page${already === 1 ? '' : 's'} already on this comic smaller?\n\n`
      + 'The pictures stay the same — they are just stored in a more efficient format, '
      + 'so the comic loads faster and costs readers far less data. '
      + 'Your original files are kept.',
    )) return;

    setError('');
    setShrinkResult('');
    try {
      const r = await recompressExisting(pages, comic.creator_id, setBusy);

      setBusy('Saving...');
      const { error: rpcErr } = await withTimeout(
        retryOnAbort(() => supabase.rpc('update_comic', {
          p_comic: id,
          p_title: title.trim(),
          p_description: description.trim(),
          p_is_nsfw: isNsfw,
          p_pages: r.urls,
          p_widths: r.widths,
          p_heights: r.heights,
        })),
        30000,
      );
      if (rpcErr) throw new Error(describeError(rpcErr));

      // Deliberately does NOT delete the originals. If this made a mess, the
      // old pages are still there to point back at.
      setBusy('');
      setShrinkResult(
        r.changed
          ? `Done — ${r.changed} page${r.changed === 1 ? '' : 's'} shrunk${r.saved ? `: ${r.saved}` : ''}`
            + (r.skipped ? `. ${r.skipped} left as they were.` : '.')
          : 'Nothing to do — these pages are already as small as they are going to get.',
      );
    } catch (e2) {
      setBusy('');
      setError(describeError(e2));
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setError('');

    try {
      const { urls, widths, heights, saved } = await uploadPages(pages, comic.creator_id, setBusy);

      setBusy(saved ? `Saving the comic... (pages shrunk: ${saved})` : 'Saving the comic...');
      const { error: rpcErr } = await withTimeout(
        retryOnAbort(() => supabase.rpc('update_comic', {
          p_comic: id,
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

      // Only after the save is safely done, and only best effort.
      const dropped = original.pages.filter((u) => !urls.includes(u));
      if (dropped.length) await forgetRemovedPages(dropped, comic.creator_id);

      setBusy('');
      navigate(`/comics/${id}`);
    } catch (e2) {
      console.error('comic edit failed:', e2);
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
            <div className="section-header"><h2>✏️ Edit Comic</h2></div>
            <div className="vg-empty"><p><Link to="/auth">Sign in</Link> to edit your comic.</p></div>
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <SiteHeader />
        <div className="vg-page"><div className="vg-loading">⏳ Loading...</div></div>
      </>
    );
  }

  if (denied) {
    return (
      <>
        <SiteHeader />
        <div className="vg-page">
          <div className="retro-panel">
            <div className="section-header"><h2>✏️ Edit Comic</h2></div>
            <div className="vg-empty">
              <p>{denied}</p>
              <p style={{ marginTop: '10px' }}>
                <Link to="/comics" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>← Back to the comics</Link>
              </p>
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
          <div className="section-header">
            <h2>✏️ Editing “{comic.title}”</h2>
            <Link to={`/comics/${id}`} className="vg-comic-back">← back to the comic</Link>
          </div>

          <div className="retro-panel-body">
            <Notice tone="error">{error}</Notice>

            <p className="vg-comic-hint">
              Add pages, take pages out, drag them into a different order.
              Nothing changes on the site until you press save, and the box at
              the bottom says exactly what saving will do.
            </p>

            {pages.some((p) => p.remoteUrl) && (
              <div className="vg-comic-shrink">
                <div>
                  <b>Make this comic lighter</b>
                  <p>
                    Pages posted before we started compressing them are stored
                    as they arrived. Squashing them keeps the pictures exactly
                    as they look and makes the comic far quicker to read — a
                    big help to anybody on a phone.
                  </p>
                  {shrinkResult && <p className="vg-comic-shrink-done">{shrinkResult}</p>}
                </div>
                <button type="button" onClick={shrinkExisting} disabled={!!busy}>
                  ↓ Shrink the pages
                </button>
              </div>
            )}

            <form onSubmit={save}>
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
                  onChange={(e) => setTitle(e.target.value)} maxLength={120} disabled={!!busy}
                />
              </div>

              <div className="retro-form-group">
                <label htmlFor="comic-desc">What is it? <span className="vg-comic-opt">optional</span></label>
                <textarea
                  id="comic-desc" className="vg-comic-input" value={description}
                  onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} disabled={!!busy}
                />
              </div>

              <label className="vg-comic-nsfw">
                <input type="checkbox" checked={isNsfw} disabled={!!busy}
                  onChange={(e) => setIsNsfw(e.target.checked)} />
                <span>Not for children — put it behind a cover</span>
              </label>

              {/* ---- what saving will do ---- */}
              <div className={`vg-comic-diff ${changes.any ? 'is-live' : ''}`}>
                {changes.any ? (
                  <>
                    <b>Saving will:</b>
                    <ul>{changes.list.map((c) => <li key={c}>{c}</li>)}</ul>
                    <span className="vg-comic-diff-note">
                      The comic keeps its address and its read count, so anyone
                      who already linked to it still lands in the right place.
                    </span>
                  </>
                ) : (
                  <span>Nothing has changed yet.</span>
                )}
              </div>

              <div className="vg-comic-actions">
                {busy && <span className="vg-comic-busy">{busy}</span>}
                <button type="submit" className="retro-cta" disabled={!canSave}>
                  {busy ? 'WORKING...' : '💾 SAVE THE CHANGES'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
