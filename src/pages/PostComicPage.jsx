import { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, retryOnAbort, withTimeout, describeError } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';

/**
 * Post a comic.
 *
 * The hard part of this screen is not the upload, it is the ordering. A
 * comic read out of order is not a comic, and the mistake is invisible to
 * the person who made it — they know what order it goes in, so their eye
 * skips over it. So the page order is the loudest thing on the page: a big
 * number in the corner of every tile, laid out in reading order, five to a
 * row like a contact sheet.
 *
 * Three ways to reorder, because one is never enough:
 *   - drag a page onto another (fast, on a desktop)
 *   - the ‹ › buttons on each tile (works on a phone, works with a keyboard)
 *   - drop new files anywhere; they append rather than overwrite
 *
 * Files are held in the browser and uploaded on submit, not on drop. That
 * way abandoning the page leaves nothing behind in storage, and the comic
 * row and its pages are written by one function in one transaction — so a
 * comic with a hole in the middle cannot exist.
 */

const MAX_PAGES = 200;
const MIN_SLOTS = 20;           // the empty grid people see first
const PER_ROW = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const OK_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

let uid = 0;
const nextId = () => `p${++uid}`;

export default function PostComicPage() {
  const { user, emailVerified } = useAuth();
  const navigate = useNavigate();
  const fileInput = useRef(null);

  const [pages, setPages] = useState([]);   // { id, file, url, w, h }
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isNsfw, setIsNsfw] = useState(false);

  const [dragFrom, setDragFrom] = useState(null);
  const [dropOn, setDropOn] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  // Object URLs are a manual resource: without this the browser hangs on to
  // every preview for the life of the tab, which for twenty full-size comic
  // pages is a serious amount of memory.
  //
  // The ref matters. Depending on `pages` here would run the cleanup on every
  // change to the list, so dropping a second batch of files would revoke the
  // previews of the pages already on the grid and blank their thumbnails.
  // Only unmount should revoke the lot; removing a single page revokes its own
  // URL in removeAt.
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  useEffect(() => () => pagesRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  // Nothing is uploaded until submit, so closing the tab with a staged comic
  // on screen loses the ordering work — which is the expensive part. The
  // browser's own "leave site?" prompt is the only thing that can stop that.
  useEffect(() => {
    if (!pages.length || busy) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pages.length, busy]);

  const addFiles = useCallback((fileList) => {
    const incoming = [...fileList];
    if (!incoming.length) return;
    setError('');

    const room = MAX_PAGES - pages.length;
    const taken = incoming.slice(0, room);
    if (incoming.length > room) {
      setError(`A comic can hold ${MAX_PAGES} pages, so ${incoming.length - room} of those were left out.`);
    }

    const rejected = [];
    const accepted = [];

    for (const file of taken) {
      if (!OK_TYPES.includes(file.type)) {
        rejected.push(`${file.name} is not a PNG, JPG, WebP or GIF`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        rejected.push(`${file.name} is ${(file.size / 1048576).toFixed(1)}MB — the limit is 10MB a page`);
        continue;
      }
      accepted.push(file);
    }

    if (rejected.length) setError(rejected.join('. ') + '.');
    if (!accepted.length) return;

    // Sorting by filename is the small kindness that makes this work.
    // Everyone names pages 01, 02, 03 — but a browser hands over multi-select
    // files in whatever order it feels like, so without this the artist
    // arrives at a shuffled grid and has to fix twenty tiles by hand.
    accepted.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    Promise.all(accepted.map((file) => new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ id: nextId(), file, url, w: img.naturalWidth, h: img.naturalHeight });
      // A file that will not decode is not a picture, whatever its mime type
      // claims. Keep it with unknown dimensions rather than dropping it
      // silently — the artist can see it is broken in the grid.
      img.onerror = () => resolve({ id: nextId(), file, url, w: 0, h: 0 });
      img.src = url;
    }))).then((loaded) => setPages((prev) => [...prev, ...loaded]));
  }, [pages.length]);

  const move = (from, to) => {
    setPages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const removeAt = (i) => setPages((prev) => {
    URL.revokeObjectURL(prev[i].url);
    return prev.filter((_, n) => n !== i);
  });

  const canSubmit = pages.length > 0 && title.trim().length >= 2 && !busy;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');

    try {
      const urls = [];
      const widths = [];
      const heights = [];

      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        setBusy(`Uploading page ${i + 1} of ${pages.length}...`);

        const ext = (p.file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
        // Namespaced by user id because the storage policy insists on it,
        // and stamped so re-posting the same filename never collides.
        const path = `${user.id}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: upErr } = await withTimeout(
          supabase.storage.from('comics').upload(path, p.file, {
            cacheControl: '31536000',
            contentType: p.file.type,
            upsert: false,
          }),
          60000,
          `page ${i + 1}`,
        );
        if (upErr) throw new Error(`Page ${i + 1} would not upload: ${describeError(upErr)}`);

        const { data: pub } = supabase.storage.from('comics').getPublicUrl(path);
        if (!pub?.publicUrl) throw new Error(`Could not work out the address for page ${i + 1}.`);

        urls.push(pub.publicUrl);
        widths.push(p.w || 0);
        heights.push(p.h || 0);
      }

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

  // Always show at least MIN_SLOTS tiles so the grid reads as "twenty of
  // these" rather than as one lonely button.
  const slots = Math.max(MIN_SLOTS, Math.ceil((pages.length + 1) / PER_ROW) * PER_ROW);
  const empties = Math.max(0, slots - pages.length);

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
              Drop your pages in — they sort by filename, so <code>01.png</code>,{' '}
              <code>02.png</code> lands in the right order on its own. Drag a page
              onto another to move it, or use the arrows. The big number is the
              page number readers will see.
              {' '}<strong>1400 × 2100</strong> is the sweet spot, but any size works.
            </p>

            <form onSubmit={submit}>
              {/* ---- the contact sheet ---- */}
              <div
                className="vg-comic-grid"
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  if (e.dataTransfer.files?.length) {
                    e.preventDefault();
                    addFiles(e.dataTransfer.files);
                  }
                }}
              >
                {pages.map((p, i) => (
                  <div
                    key={p.id}
                    className={[
                      'vg-comic-tile',
                      dropOn === i && dragFrom !== null && dragFrom !== i ? 'is-target' : '',
                      dragFrom === i ? 'is-lifting' : '',
                    ].filter(Boolean).join(' ')}
                    draggable
                    onDragStart={() => setDragFrom(i)}
                    onDragEnd={() => { setDragFrom(null); setDropOn(null); }}
                    onDragOver={(e) => { e.preventDefault(); setDropOn(i); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (dragFrom !== null && dragFrom !== i) move(dragFrom, i);
                      setDragFrom(null);
                      setDropOn(null);
                    }}
                  >
                    <span className="vg-comic-num">{i + 1}</span>
                    <img src={p.url} alt={`Page ${i + 1}`} />

                    {p.w === 0 && <span className="vg-comic-bad" title="This file would not open">!</span>}

                    <div className="vg-comic-tools">
                      <button
                        type="button" aria-label={`Move page ${i + 1} earlier`}
                        disabled={i === 0} onClick={() => move(i, i - 1)}
                      >‹</button>
                      <button
                        type="button" aria-label={`Remove page ${i + 1}`}
                        className="vg-comic-del" onClick={() => removeAt(i)}
                      >✕</button>
                      <button
                        type="button" aria-label={`Move page ${i + 1} later`}
                        disabled={i === pages.length - 1} onClick={() => move(i, i + 1)}
                      >›</button>
                    </div>

                    {p.w > 0 && <span className="vg-comic-dims">{p.w}×{p.h}</span>}
                  </div>
                ))}

                {Array.from({ length: empties }).map((_, n) => (
                  <button
                    key={`empty-${n}`}
                    type="button"
                    className={`vg-comic-slot ${n === 0 ? 'is-next' : ''}`}
                    onClick={() => fileInput.current?.click()}
                    aria-label={n === 0 ? 'Add pages' : `Empty slot ${pages.length + n + 1}`}
                  >
                    <span className="vg-comic-plus">+</span>
                    <span className="vg-comic-slotnum">{pages.length + n + 1}</span>
                  </button>
                ))}
              </div>

              <input
                ref={fileInput}
                type="file"
                accept={OK_TYPES.join(',')}
                multiple
                hidden
                onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
              />

              <div className="vg-comic-count">
                {pages.length === 0
                  ? 'No pages yet.'
                  : `${pages.length} page${pages.length === 1 ? '' : 's'} · reads top-left to bottom-right`}
              </div>

              {/* ---- the details ---- */}
              <div className="retro-form-group">
                <label htmlFor="comic-title">Title</label>
                <input
                  id="comic-title"
                  className="vg-comic-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="The Squirrel Chronicles, Chapter 1"
                  disabled={!!busy}
                />
              </div>

              <div className="retro-form-group">
                <label htmlFor="comic-desc">What is it? <span className="vg-comic-opt">optional</span></label>
                <textarea
                  id="comic-desc"
                  className="vg-comic-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="A squirrel takes on the pigeon cartel. Drawn in a week, mostly at night."
                  disabled={!!busy}
                />
              </div>

              <label className="vg-comic-nsfw">
                <input
                  type="checkbox"
                  checked={isNsfw}
                  onChange={(e) => setIsNsfw(e.target.checked)}
                  disabled={!!busy}
                />
                <span>Not for children — put it behind a cover</span>
              </label>

              <div className="vg-comic-actions">
                {busy && <span className="vg-comic-busy">{busy}</span>}
                <button
                  type="submit"
                  className="retro-cta"
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
