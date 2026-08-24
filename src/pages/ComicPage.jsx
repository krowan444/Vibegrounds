import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, describeError, looksMissing } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import CouldNotLoad from '../components/CouldNotLoad';
import ReportButton from '../components/ReportButton';
import ReviewSection from '../components/ReviewSection';
import VoteWidget from '../components/VoteWidget';
import BackToTop from '../components/BackToTop';
import { useDocumentTitle } from '../lib/pageMeta';
import { timeAgo, compactNumber } from '../lib/format';

/**
 * Read a comic.
 *
 * The whole design is in service of one thing: getting out of the way. A
 * comic page is a picture somebody spent hours on, so it gets the width of
 * the screen and the furniture stays at the edges.
 *
 * Two ways to read, because people genuinely differ:
 *
 *   Scroll — every page stacked, full width, one continuous fall. Panels
 *            arrive as you go, which is closer to turning pages than
 *            clicking is, and it is the only sane way to read a tall strip.
 *            This is the default.
 *   Page   — one page fitted to the window, click or arrow to advance. Still
 *            the right answer on a small screen, or for dense pages you want
 *            whole in front of you.
 *
 * In both, moving to a page puts the top of that page at the top of the
 * screen. Landing halfway down a page you have not read yet is disorienting
 * in a way that is hard to name and easy to feel.
 */
const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_STEP = 10;
const ZOOM_DEFAULT = 90;

export default function ComicPage() {
  const { id } = useParams();
  const { user, isStaff } = useAuth();

  const [comic, setComic] = useState(null);
  const [pages, setPages] = useState([]);
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  // Bumped by the Try again button, which is all the reload the effect needs.
  const [attempt, setAttempt] = useState(0);
  // Where "skip to the bottom" lands: the rating and comments, not the very
  // end of the document, which would put the footer on screen instead.
  const talkRef = useRef(null);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [resumed, setResumed] = useState(0);

  const counted = useRef(false);
  const railRef = useRef(null);
  const sheetRefs = useRef([]);
  const stageRef = useRef(null);
  const touch = useRef(null);
  // Set while a jump is in flight, so the observer watching what is on
  // screen does not fight the scroll it is watching.
  const jumping = useRef(false);

  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem('vg-comic-mode') === 'page' ? 'page' : 'scroll'; }
    catch { return 'scroll'; }
  });
  useEffect(() => {
    try { localStorage.setItem('vg-comic-mode', mode); } catch { /* private mode */ }
  }, [mode]);

  /**
   * How big the pages are.
   *
   * 90 rather than 100 by default: full width was a shade much to sit and
   * read at, and the ten per cent back gives the page air on either side
   * without making it small again.
   *
   * Above 100 is worth having even though it means showing a picture larger
   * than it was drawn. On a phone, a 1400px page is already squeezed into a
   * 360px screen — about a quarter of its real size — so zooming in there
   * reveals detail that genuinely is in the file, and the reel scrolls
   * sideways to let you go and look at it.
   */
  const [zoom, setZoom] = useState(() => {
    try {
      const n = parseInt(localStorage.getItem('vg-comic-zoom') || '', 10);
      return Number.isFinite(n) && n >= ZOOM_MIN && n <= ZOOM_MAX ? n : ZOOM_DEFAULT;
    } catch { return ZOOM_DEFAULT; }
  });
  useEffect(() => {
    try { localStorage.setItem('vg-comic-zoom', String(zoom)); } catch { /* private mode */ }
  }, [zoom]);
  const nudgeZoom = (by) => setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + by)));

  useDocumentTitle(comic?.title, comic?.description || undefined);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setNotFound(false);
    setUnreachable(false);
    setI(0);
    setResumed(0);
    sheetRefs.current = [];

    (async () => {
      const [c, p] = await Promise.all([
        supabase.from('comics_public').select('*').eq('id', id).maybeSingle(),
        supabase.from('comic_pages_public').select('*').eq('comic_id', id).order('position'),
      ]);

      if (!alive) return;
      // A comic that is not there and a comic we could not ask about are
      // different things. Blaming a moderator for a dropped connection
      // accuses somebody of removing work that is still sitting there.
      if (c.error && !looksMissing(c.error)) { setUnreachable(true); setLoading(false); return; }
      if (!c.data) { setNotFound(true); setLoading(false); return; }
      if (p.error) setError(describeError(p.error));

      setComic(c.data);
      setPages(p.data || []);
      setLoading(false);

      const last = p.data?.length || 0;
      try {
        const saved = parseInt(localStorage.getItem(`vg-comic-at:${id}`) || '', 10);
        if (saved > 1 && saved < last) { setI(saved); setResumed(saved + 1); }
      } catch { /* private mode */ }

      if (!counted.current) {
        counted.current = true;
        supabase.rpc('register_comic_view', { p_comic: id }).then(
          () => {}, (e) => console.warn('view not counted:', e),
        );
      }
    })();

    return () => { alive = false; };
  }, [id, attempt]);

  const total = pages.length;

  /**
   * Go to a page, and put its top edge at the top of the screen.
   *
   * The flag is the fiddly bit: a smooth scroll takes about half a second,
   * during which the observer sees three or four pages slide past and would
   * happily rewrite the page number under the reader's feet. It stays set
   * until the scrolling stops.
   */
  const go = useCallback((n) => {
    const target = Math.min(Math.max(n, 0), Math.max(total - 1, 0));
    setI(target);

    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    jumping.current = true;
    window.clearTimeout(go._t);
    go._t = window.setTimeout(() => { jumping.current = false; }, smooth ? 700 : 60);

    requestAnimationFrame(() => {
      const el = sheetRefs.current[target] || stageRef.current;
      el?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    });
  }, [total]);

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

  /**
   * In scroll mode the page number follows the reader rather than the other
   * way round. Whichever sheet covers the middle of the screen is the page
   * you are on — measuring against the middle rather than the top means a
   * tall page stays "the page you are on" for the whole time you are inside
   * it, instead of flicking over the moment its bottom edge appears.
   */
  useEffect(() => {
    if (mode !== 'scroll' || !total) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (jumping.current) return;
        const seen = entries.filter((e) => e.isIntersecting);
        if (!seen.length) return;
        const best = seen.reduce((a, b) => (a.intersectionRatio >= b.intersectionRatio ? a : b));
        const n = Number(best.target.dataset.n);
        if (!Number.isNaN(n)) setI(n);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.01, 0.5, 1] },
    );
    sheetRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [mode, total, revealed]);

  /** Panels arriving as you reach them, rather than all at once up front. */
  useEffect(() => {
    if (mode !== 'scroll' || !total) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      sheetRefs.current.forEach((el) => el?.classList.add('is-here'));
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-here'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    sheetRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [mode, total, revealed]);

  // Preload around where you are, so paging forward is instant and paging
  // back does not re-fetch what you just looked at.
  useEffect(() => {
    [i + 1, i + 2, i - 1].forEach((n) => {
      const p = pages[n];
      if (p) { const im = new Image(); im.src = p.image_url; }
    });
  }, [i, pages]);

  // Remember the page. Cleared on the last one: finishing a comic and coming
  // back should start you at the front, not at the end.
  useEffect(() => {
    if (!total || !id) return;
    try {
      if (i >= total - 1) localStorage.removeItem(`vg-comic-at:${id}`);
      else localStorage.setItem(`vg-comic-at:${id}`, String(i));
    } catch { /* private mode */ }
  }, [i, total, id]);

  // Keep the current thumbnail in view, or the jump strip stops being useful
  // the moment you are past page six.
  useEffect(() => {
    const rail = railRef.current;
    const thumb = rail?.children?.[i];
    if (!rail || !thumb) return;
    const left = thumb.offsetLeft - rail.clientWidth / 2 + thumb.clientWidth / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [i, total]);

  // Swipe, for page mode on a phone. Horizontal only, and only past 45px, so
  // scrolling down a tall page never turns it by accident.
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

  if (unreachable) {
    return (
      <CouldNotLoad
        what="This Comic"
        onRetry={() => setAttempt((n) => n + 1)}
        backTo="/comics"
        backLabel="Back to the comics"
      />
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
  const mine = user && user.id === comic.creator_id;

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
          <div className="vg-comic-headlinks">
            {(mine || isStaff) && (
              <Link to={`/comics/${id}/edit`} className="vg-comic-edit">✏️ Edit</Link>
            )}
            <Link to="/comics" className="vg-comic-back">← all comics</Link>
          </div>
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
                <button type="button" onClick={() => { go(0); setResumed(0); }}>Start from page 1</button>
                <button type="button" className="vg-comic-resume-x" onClick={() => setResumed(0)} aria-label="Dismiss">✕</button>
              </div>
            )}

            {mode === 'scroll' ? (
              /* ---- the whole comic, falling ---- */
              <div className="vg-comic-reel" ref={stageRef} style={{ '--z': zoom / 100 }}>
                {pages.map((p, n) => (
                  <figure
                    key={p.id}
                    className="vg-comic-sheet"
                    data-n={n}
                    ref={(el) => { sheetRefs.current[n] = el; }}
                  >
                    <img
                      src={p.image_url}
                      alt={`${comic.title}, page ${n + 1}`}
                      width={p.width || undefined}
                      height={p.height || undefined}
                      // The width the page wants at 100%: as wide as there is
                      // room for, but never past the size it was drawn at, so
                      // nothing is upscaled unless the reader asks for it.
                      // The zoom multiplies this.
                      style={{ '--base': p.width ? `min(100%, ${p.width}px)` : '100%' }}
                      loading={n < 2 ? 'eager' : 'lazy'}
                      decoding="async"
                    />
                    <figcaption>{n + 1}</figcaption>
                  </figure>
                ))}
                <div className="vg-comic-end">
                  <p>That&#39;s the lot — {total} page{total === 1 ? '' : 's'} by {comic.creator_username}.</p>
                  <Link to="/comics" className="retro-cta">📖 MORE COMICS</Link>
                </div>
              </div>
            ) : (
              /* ---- one page at a time ---- */
              <div
                className="vg-comic-stage"
                ref={stageRef}
                style={{ '--z': zoom / 100 }}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                <button
                  type="button" className="vg-comic-edge vg-comic-edge-prev"
                  onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous page"
                ><span>‹</span></button>

                <img
                  key={page.id}
                  className="vg-comic-page"
                  src={page.image_url}
                  alt={`${comic.title}, page ${i + 1}`}
                  width={page.width || undefined}
                  height={page.height || undefined}
                  onClick={() => go(i + 1)}
                />

                <button
                  type="button" className="vg-comic-edge vg-comic-edge-next"
                  onClick={() => go(i + 1)} disabled={i === total - 1} aria-label="Next page"
                ><span>›</span></button>
              </div>
            )}

            {/* ---- where you are. Sticks to the bottom so it is still there
                    thirty pages down, without ever covering the page. ---- */}
            <div className="vg-comic-bar">
              <button type="button" onClick={() => go(i - 1)} disabled={i === 0}>‹ Prev</button>
              <span className="vg-comic-counter">Page <b>{i + 1}</b> of {total}</span>
              <button type="button" onClick={() => go(i + 1)} disabled={i === total - 1}>Next ›</button>

              <span className="vg-comic-sep" aria-hidden="true" />

              {/* Jumps. A comic can be a very long page, and the two places
                  anybody actually wants are the first panel and the talk
                  underneath — not some midpoint they have to hunt for. */}
              <span className="vg-comic-jump">
                <button
                  type="button"
                  title="Back to the first page"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >▲ Top</button>
                <button
                  type="button"
                  title="Skip to the rating and comments"
                  onClick={() => talkRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >▼ Comments</button>
              </span>

              <span className="vg-comic-sep" aria-hidden="true" />

              {/* Size. Grouped so the two buttons read as one control with
                  the number between them, rather than three loose things. */}
              <span className="vg-comic-zoom">
                <button
                  type="button" aria-label="Smaller"
                  onClick={() => nudgeZoom(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN}
                >−</button>
                <button
                  type="button"
                  className="vg-comic-zoom-num"
                  onClick={() => setZoom(ZOOM_DEFAULT)}
                  title="Back to the normal size"
                  aria-label={`Page size ${zoom} per cent — press to reset`}
                >{zoom}%</button>
                <button
                  type="button" aria-label="Bigger"
                  onClick={() => nudgeZoom(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX}
                >+</button>
              </span>

              <button
                type="button"
                className="vg-comic-fit"
                onClick={() => setMode((m) => (m === 'scroll' ? 'page' : 'scroll'))}
                title={mode === 'scroll'
                  ? 'One page at a time, fitted to the window'
                  : 'The whole comic, full width, scroll straight through it'}
              >
                {mode === 'scroll' ? '⤢ One page' : '⇕ Scroll it'}
              </button>
            </div>

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
          {user && !mine && <ReportButton targetType="comic" targetId={comic.id} />}
          {isStaff && <span className="vg-comic-staff">Staff: moderate from the control room.</span>}
        </div>

        {/*
          * Comments sit under everything, which is where they belong on a
          * comic: you read the thing first, then you talk about it. This is
          * the same component the submissions use, so a comment here is
          * reported, edited, moderated and rate limited by exactly the same
          * rules — there is no second set to keep in step.
          */}
        <div className="vg-comic-talk" ref={talkRef}>
          {/* Rated out of 5 like everything else here, using the same
              formula, so a comic's 3.4 means what a game's 3.4 means.
              Deliberately no chart yet — two comics is not a leaderboard. */}
          <div className="retro-panel vg-comic-rate">
            <div className="section-header"><h2>⭐ Rate this comic</h2></div>
            <div className="retro-panel-body">
              <VoteWidget kind="comic" creation={comic} />
            </div>
          </div>

          <ReviewSection comicId={comic.id} />
        </div>

        {/*
          * A comic can be a very long page. Having read to the bottom, the
          * only way back was a long scroll or the browser's own shortcut,
          * which nobody on a phone has.
          */}
        <BackToTop label="Back to the top of the comic" />
      </div>
    </>
  );
}
