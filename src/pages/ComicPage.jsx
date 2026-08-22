import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, describeError } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import ReportButton from '../components/ReportButton';
import { useDocumentTitle } from '../lib/pageMeta';
import { timeAgo, compactNumber } from '../lib/format';

/**
 * Read a comic.
 *
 * One page at a time, fitted to the screen. The whole design is in service
 * of one thing: getting out of the way. A comic page is a picture somebody
 * spent hours on, so the reader gives it the entire window and keeps the
 * furniture at the edges.
 *
 * Moving through it: click the right half of the page, press → or space,
 * or use the arrows. Click the left half or press ← to go back. The
 * thumbnail rail underneath is for jumping, not for scrolling — a reader
 * who wants page 14 should not have to click Next eleven times.
 *
 * Neighbouring pages are preloaded, which is the difference between a
 * comic that reads like a comic and one that flashes white between pages.
 */
export default function ComicPage() {
  const { id } = useParams();
  const { user, isStaff } = useAuth();

  const [comic, setComic] = useState(null);
  const [pages, setPages] = useState([]);
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const counted = useRef(false);
  const stageRef = useRef(null);
  const railRef = useRef(null);
  const touch = useRef(null);

  // Whole page on screen, or full width and scroll down it. Tall webtoon
  // strips are unreadable fitted to a laptop screen — the lettering ends up
  // three pixels high — so the reader needs both and remembers which you
  // picked. Wrapped because a locked-down browser can throw on the read.
  const [fit, setFit] = useState(() => {
    try { return localStorage.getItem('vg-comic-fit') === 'width' ? 'width' : 'page'; }
    catch { return 'page'; }
  });
  useEffect(() => {
    try { localStorage.setItem('vg-comic-fit', fit); } catch { /* private mode */ }
  }, [fit]);

  // "You were on page 7" — shown, not done silently, with a way back to the
  // start. Landing somewhere in the middle of a comic with no explanation
  // reads as a bug.
  const [resumed, setResumed] = useState(0);

  useDocumentTitle(comic?.title, comic?.description || undefined);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setNotFound(false);
    setI(0);
    setResumed(0);

    (async () => {
      const [c, p] = await Promise.all([
        supabase.from('comics_public').select('*').eq('id', id).maybeSingle(),
        supabase.from('comic_pages_public').select('*').eq('comic_id', id).order('position'),
      ]);

      if (!alive) return;
      if (c.error || !c.data) { setNotFound(true); setLoading(false); return; }
      if (p.error) setError(describeError(p.error));

      setComic(c.data);
      setPages(p.data || []);
      setLoading(false);

      // Pick the reader back up where they stopped. Only worth doing past
      // page two — restoring somebody to page 2 of 40 is not a favour.
      const last = p.data?.length || 0;
      try {
        const saved = parseInt(localStorage.getItem(`vg-comic-at:${id}`) || '', 10);
        if (saved > 1 && saved < last) { setI(saved); setResumed(saved + 1); }
      } catch { /* private mode */ }

      if (!counted.current) {
        counted.current = true;
        // A read is the least important thing here — never let it break the page.
        supabase.rpc('register_comic_view', { p_comic: id }).then(
          () => {}, (e) => console.warn('view not counted:', e),
        );
      }
    })();

    return () => { alive = false; };
  }, [id]);

  const total = pages.length;
  const go = useCallback((n) => setI((cur) => Math.min(Math.max(n, 0), Math.max(total - 1, 0))), [total]);

  // Keyboard. Space and → forward, ← back, Home and End to the ends.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches?.('input, textarea')) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(i + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(i - 1); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(total - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, total, go]);

  // Preload the next two and the previous one, so paging forward is instant
  // and paging back does not re-fetch what you just looked at.
  useEffect(() => {
    [i + 1, i + 2, i - 1].forEach((n) => {
      const p = pages[n];
      if (p) { const im = new Image(); im.src = p.image_url; }
    });
  }, [i, pages]);

  // Remember the page. Cleared on the last page: finishing a comic and
  // coming back should start you at the front, not at the end.
  useEffect(() => {
    if (!total || !id) return;
    try {
      if (i >= total - 1) localStorage.removeItem(`vg-comic-at:${id}`);
      else localStorage.setItem(`vg-comic-at:${id}`, String(i));
    } catch { /* private mode */ }
  }, [i, total, id]);

  // Keep the current thumbnail in the rail. Without this the rail sits at
  // page 1 while you read page 30, and the jump strip stops being useful.
  useEffect(() => {
    const rail = railRef.current;
    const thumb = rail?.children?.[i];
    if (!rail || !thumb) return;
    const left = thumb.offsetLeft - rail.clientWidth / 2 + thumb.clientWidth / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [i, total]);

  // Back to the top of the page when it changes in fit-to-width, where you
  // are usually scrolled to the bottom of the previous one.
  useEffect(() => {
    if (fit === 'width') stageRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [i, fit]);

  // Swipe. Most comics get read on a phone, and on a phone the edge buttons
  // are a thin target — a flick across the page is the natural gesture.
  // Horizontal-only, and only past 45px, so scrolling down a tall page never
  // turns the page by accident.
  const onTouchStart = (e) => {
    const t = e.changedTouches?.[0];
    touch.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e) => {
    const start = touch.current;
    const t = e.changedTouches?.[0];
    touch.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(dx < 0 ? i + 1 : i - 1);
  };

  if (loading) {
    return (
      <>
        <SiteHeader compact />
        <div className="vg-page"><div className="vg-loading">⏳ Loading...</div></div>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <SiteHeader compact />
        <div className="vg-page">
          <div className="retro-panel">
            <div className="section-header"><h2>👻 Not Found</h2></div>
            <div className="vg-empty">
              <p>That comic doesn&#39;t exist, or a moderator removed it.</p>
              <p style={{ marginTop: '10px' }}>
                <Link to="/comics" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>
                  ← Back to the comics
                </Link>
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const page = pages[i];
  const hidden = comic.is_nsfw && !revealed;

  return (
    <>
      <SiteHeader compact />
      <div className="vg-page vg-comic-read">

        <div className="vg-comic-head">
          <div>
            <h1 className="vg-comic-title">{comic.title}</h1>
            <div className="vg-comic-meta">
              by <Link to={`/profile/${comic.creator_username}`}>{comic.creator_username}</Link>
              {' · '}{comic.page_count} page{comic.page_count === 1 ? '' : 's'}
              {' · '}{compactNumber(comic.view_count)} read{comic.view_count === 1 ? '' : 's'}
              {' · '}{timeAgo(comic.created_at)}
            </div>
          </div>
          <Link to="/comics" className="vg-comic-back">← all comics</Link>
        </div>

        <Notice tone="error">{error}</Notice>

        {hidden ? (
          <div className="vg-comic-cover">
            <div className="vg-comic-cover-badge">18+</div>
            <p>This comic is marked as not for children.</p>
            <button type="button" className="retro-cta" onClick={() => setRevealed(true)}>
              I&#39;m over 18 — read it
            </button>
          </div>
        ) : total === 0 ? (
          <div className="vg-empty"><p>This comic has no pages yet.</p></div>
        ) : (
          <>
            {resumed > 0 && (
              <div className="vg-comic-resume">
                <span>📑 Picked you up on page {resumed}.</span>
                <button type="button" onClick={() => { go(0); setResumed(0); }}>
                  Start from page 1
                </button>
                <button type="button" className="vg-comic-resume-x" onClick={() => setResumed(0)} aria-label="Dismiss">✕</button>
              </div>
            )}

            {/* ---- the page ---- */}
            <div
              ref={stageRef}
              className={`vg-comic-stage ${fit === 'width' ? 'is-wide' : ''}`}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <button
                type="button"
                className="vg-comic-edge vg-comic-edge-prev"
                onClick={() => go(i - 1)}
                disabled={i === 0}
                aria-label="Previous page"
              ><span>‹</span></button>

              <img
                key={page.id}
                className="vg-comic-page"
                src={page.image_url}
                alt={`${comic.title}, page ${i + 1}`}
                width={page.width || undefined}
                height={page.height || undefined}
                // Fill the width, but never past the size it was drawn at.
                // A 800px webtoon strip stretched across a 1400px column is
                // just a blurrier version of the same picture.
                style={fit === 'width' && page.width ? { maxWidth: `${page.width}px` } : undefined}
                onClick={fit === 'page' ? () => go(i + 1) : undefined}
              />

              <button
                type="button"
                className="vg-comic-edge vg-comic-edge-next"
                onClick={() => go(i + 1)}
                disabled={i === total - 1}
                aria-label="Next page"
              ><span>›</span></button>
            </div>

            {/* ---- where you are ---- */}
            <div className="vg-comic-bar">
              <button type="button" onClick={() => go(i - 1)} disabled={i === 0}>‹ Prev</button>
              <span className="vg-comic-counter">
                Page <b>{i + 1}</b> of {total}
              </span>
              <button type="button" onClick={() => go(i + 1)} disabled={i === total - 1}>Next ›</button>
              {/* Long strips need the width option or the lettering shrinks to
                  nothing; ordinary pages need the fit option or you scroll
                  through every one. Neither is the right default for both. */}
              <button
                type="button"
                className="vg-comic-fit"
                onClick={() => setFit((f) => (f === 'page' ? 'width' : 'page'))}
                title={fit === 'page' ? 'Fill the width and scroll — better for tall strips' : 'Fit the whole page on screen'}
              >
                {fit === 'page' ? '⇕ Fit width' : '⤢ Fit page'}
              </button>
            </div>

            {/* ---- jump anywhere ---- */}
            <div className="vg-comic-rail" role="tablist" aria-label="Jump to a page" ref={railRef}>
              {pages.map((p, n) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={n === i}
                  aria-label={`Page ${n + 1}`}
                  className={`vg-comic-thumb ${n === i ? 'is-on' : ''}`}
                  onClick={() => go(n)}
                >
                  <img src={p.image_url} alt="" loading="lazy" />
                  <span>{n + 1}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {comic.description && (
          <div className="retro-panel vg-comic-about">
            <div className="section-header"><h2>📖 About</h2></div>
            <div className="retro-panel-body vg-comic-desc">{comic.description}</div>
          </div>
        )}

        <div className="vg-comic-foot">
          {user && user.id !== comic.creator_id && (
            <ReportButton targetType="comic" targetId={comic.id} />
          )}
          {isStaff && <span className="vg-comic-staff">Staff: moderate from the control room.</span>}
        </div>
      </div>
    </>
  );
}
