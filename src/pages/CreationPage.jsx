import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { supabase, withTimeout } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import WorksOnBadge from '../components/WorksOn';
import VoteWidget from '../components/VoteWidget';
import ReviewSection from '../components/ReviewSection';
import IdeasSection from '../components/IdeasSection';
import UpdatesSection from '../components/UpdatesSection';
import ReportButton from '../components/ReportButton';
import ShareBar from '../components/ShareBar';
import CreationCard from '../components/CreationCard';
import Notice from '../components/Notice';
import { compactNumber, shortDate, hostOf } from '../lib/format';
import { thumbFor, onThumbError, LOGO_FALLBACK } from '../lib/thumbnail';
import { useDocumentTitle } from '../lib/pageMeta';

/**
 * The invitation to review.
 *
 * Rendered twice, in two places, with only one ever visible. On a wide
 * screen it belongs in the sidebar beside the reviews. On a phone the
 * sidebar stacks *under* the main column — under the reviews it was
 * pointing at — so up there it was a button asking you to scroll down to
 * something you had already scrolled past. The phone copy sits in the
 * main column instead, just above the reviews themselves.
 *
 * One component rather than two blocks of copy-pasted markup, so the
 * wording can never drift apart between them.
 */
function ReviewJump({ count = 0, className = '' }) {
  return (
    <button
      type="button"
      className={`vg-jump-reviews ${className}`.trim()}
      onClick={() => {
        document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Focus after the smooth scroll has had a moment, otherwise the
        // browser snaps straight there and the animation is lost.
        setTimeout(() => document.getElementById('vg-review-input')?.focus(), 550);
      }}
    >
      <span className="vg-jump-reviews-top">
        💬 {count} {count === 1 ? 'review' : 'reviews'}
      </span>
      <span className="vg-jump-reviews-cta">
        {count ? 'Read them or add yours ↓' : 'Be the first to review it ↓'}
      </span>
    </button>
  );
}

/**
 * Who made this, shown on phones directly under the Launch button.
 *
 * The full Creator card lives in the sidebar, which on a narrow screen
 * lands below the description, the reviews and the ideas — long past the
 * point anyone is still scrolling. A creation with no visible maker is
 * just a link, so this puts the person back beside their work, with
 * enough standing on display (rank, level, what else they have made) to
 * be worth tapping through to.
 */
function CreatorStrip({ author }) {
  if (!author) return null;
  return (
    <Link to={`/profile/${author.username}`} className="vg-creator-strip">
      {author.avatar_url
        ? <img src={author.avatar_url} alt="" />
        : <span className="vg-creator-strip-avatar" aria-hidden="true">👾</span>}
      <span className="vg-creator-strip-text">
        <span className="vg-creator-strip-name">{author.username}</span>
        <span className="vg-creator-strip-meta" style={author.rank_colour ? { color: author.rank_colour } : undefined}>
          {author.rank_title} · level {author.level}
        </span>
        <span className="vg-creator-strip-stats">
          {author.submission_count} submissions · {author.badge_count} badges
        </span>
      </span>
      <span className="vg-creator-strip-go">see their stuff →</span>
    </Link>
  );
}

export default function CreationPage() {
  const { id } = useParams();
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();

  const [c, setC] = useState(null);
  const [author, setAuthor] = useState(null);
  const [more, setMore] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Titles the browser tab and the search result with the creation itself,
  // rather than every page on the site sharing one name. Waits for the
  // fetch — passing nothing leaves the previous title alone.
  useDocumentTitle(
    c?.title,
    c?.description
      ? `${c.description.slice(0, 155)}${c.description.length > 155 ? '…' : ''}`
      : undefined,
  );

  const viewed = useRef(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setNotFound(false);
    (async () => {
      const { data, error: err } = await supabase
        .from('creations_public').select('*').eq('id', id).maybeSingle();

      if (!alive) return;
      if (err || !data) { setNotFound(true); setLoading(false); return; }
      setC(data);

      /*
       * Count the view.
       *
       * This never worked. The call was written fire-and-forget without an
       * await — but a supabase-js builder is a lazy thenable: it only sends
       * the request when something calls .then() on it. Nothing did, so no
       * request was ever made and every view_count in the database sat at
       * zero while votes and comments piled up.
       *
       * Awaiting it fixes that. It stays inside the try/catch below so a
       * failed count can never take the page down — a view is the least
       * important thing on this screen.
       *
       * sessionStorage keeps a refresh from inflating the number. Per tab
       * rather than per browser, so it forgives someone coming back
       * tomorrow but not someone holding F5.
       */
      const seenKey = `vg_viewed_${id}`;
      if (!viewed.current && !sessionStorage.getItem(seenKey)) {
        viewed.current = true;
        try {
          sessionStorage.setItem(seenKey, '1');
          await withTimeout(supabase.rpc('register_view', { p_creation: id }), 8000, 'registerView');
          if (alive) setC((prev) => (prev ? { ...prev, view_count: (prev.view_count || 0) + 1 } : prev));
        } catch (e) {
          console.warn('View not counted:', e?.message || e);
        }
      }

      const [prof, others] = await Promise.all([
        supabase.from('profiles_public').select('*').eq('id', data.creator_id).maybeSingle(),
        supabase.from('creations_public').select('*')
          .eq('category', data.category).neq('id', id)
          .order('score', { ascending: false }).limit(4),
      ]);

      if (!alive) return;
      setAuthor(prof.data || null);
      setMore(others.data || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  const isOwner = user && c && user.id === c.creator_id;

  const remove = async () => {
    const { error: err } = await supabase.from('creations').delete().eq('id', c.id);
    if (err) setError(err.message);
    else navigate('/portal');
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
              <p>This submission doesn&#39;t exist, or it was removed by a moderator.</p>
              <p style={{ marginTop: '10px' }}>
                <Link to="/portal" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>
                  ← Back to the Portal
                </Link>
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader compact />

      <div className="vg-page">
        <Notice tone="error">{error}</Notice>

        <div style={{
          display: 'grid', gap: '14px',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, 300px)',
          alignItems: 'start',
        }} className="vg-creation-layout">

          {/* ── main column ── */}
          <div>
            <div className="retro-panel">
              <div className="section-header">
                <h2>{c.category_icon} {c.title}</h2>
              </div>

              {/* Preview */}
              {/* maxHeight caps this on a wide screen. Without it a 16:9 box
                  in a 590px column is over 330px tall, which pushed "Launch it"
                  below the fold — the one thing every visitor came to click.
                  aspect-ratio yields to max-height, so narrow screens keep the
                  full 16:9 and only wide ones get trimmed. */}
              <div style={{
                position: 'relative', background: 'var(--bg-dark)',
                borderBottom: '2px solid var(--border-panel)',
                // width:100% is load-bearing. aspect-ratio plus max-height
                // makes the capped height transfer back through the ratio and
                // shrink the width to match (360 x 16/9 = 640px), leaving the
                // picture 640px wide in an 842px panel and jammed against the
                // left edge, well off-centre from the Launch button beneath.
                // Stating the width outright stops the transfer: the box fills
                // the panel and the height is what gets clamped instead.
                width: '100%',
                aspectRatio: '16 / 9', maxHeight: '360px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
                <img
                  src={thumbFor(c, 900)}
                  alt={c.title}
                  onError={onThumbError}
                  className={thumbFor(c, 900) === LOGO_FALLBACK ? 'vg-thumb-placeholder' : undefined}
                  /* objectPosition was missing, so cover cropped from the dead
                     centre. Almost nothing people upload is 16:9 — a square or
                     portrait screenshot lost equal slices off the top and
                     bottom, eating the title bar and menus that are the whole
                     point of a screenshot. Anchor to the top and the cut comes
                     off the bottom instead. Same fix the staff picks carry. */
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
                />
              </div>

              {/* Launch */}
              <div style={{ padding: '16px 12px 18px', textAlign: 'center' }}>
                <a
                  href={c.project_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="retro-cta"
                  style={{ display: 'inline-block', fontSize: '12px' }}
                >
                  ▶ LAUNCH IT
                </a>
                <div style={{
                  fontFamily: 'var(--font-retro)', fontSize: '15px',
                  color: 'var(--text-dim)', marginTop: '7px', wordBreak: 'break-all',
                }}>
                  opens {hostOf(c.project_url)} in a new tab
                </div>
              </div>

              {/* Phone only — hidden on desktop, where the full Creator card
                  is already sitting in the sidebar. */}
              <CreatorStrip author={author} />

              {/* Description */}
              <div className="vg-desc-body vg-prose" style={{
                padding: '12px', borderTop: '1px solid var(--border-dark)',
              }}>
                {c.description || <span style={{ color: 'var(--text-dim)' }}>No description given.</span>}
              </div>

              {/* Tags */}
              {c.tags?.length > 0 && (
                <div style={{ padding: '0 12px 12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {c.tags.map((t) => (
                    <Link
                      key={t}
                      to={`/portal?q=${encodeURIComponent(t)}`}
                      style={{
                        fontFamily: 'var(--font-retro)', fontSize: '15px',
                        color: 'var(--text-secondary)', background: 'var(--bg-input)',
                        border: '1px solid var(--border-dark)', padding: '2px 8px',
                        textDecoration: 'none',
                      }}
                    >
                      #{t}
                    </Link>
                  ))}
                </div>
              )}

              {/* Meta bar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                padding: '9px 12px', borderTop: '1px solid var(--border-dark)',
                fontFamily: 'var(--font-retro)', fontSize: '15px', color: 'var(--text-dim)',
              }}>
                <span>👁 {compactNumber(c.view_count)} views</span>
                <span>💬 {c.review_count}</span>
                <span>📅 {shortDate(c.created_at)}</span>
                <Link to={`/category/${c.category}`} style={{ color: 'var(--blue-link)' }}>
                  {c.category_icon} {c.category_name}
                </Link>
                {/* Renders nothing when the creator has not said, which is
                    every creation posted before the question existed. */}
                <WorksOnBadge value={c.works_on} />

                <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {isOwner && (
                    <>
                      {/* Was pointing at the author's profile, so there was no
                          way to fix a typo in your own post. */}
                      <Link
                        to={`/creation/${c.id}/edit`}
                        style={{
                          fontFamily: 'var(--font-retro)', fontSize: '14px',
                          color: 'var(--orange)', border: '1px solid var(--border-dark)',
                          padding: '2px 7px', textDecoration: 'none',
                        }}
                      >
                        ✏️ edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => setConfirmOpen(true)}
                        style={{
                          background: 'none', border: '1px solid var(--border-dark)',
                          color: 'var(--red)', fontFamily: 'var(--font-retro)',
                          fontSize: '14px', padding: '2px 7px', cursor: 'pointer',
                        }}
                      >
                        🗑 delete
                      </button>
                    </>
                  )}
                  {!isOwner && <ReportButton targetType="creation" targetId={c.id} />}
                </span>
              </div>

              {confirmOpen && (
                <div style={{ padding: '12px', borderTop: '2px solid var(--red)', background: '#2a0e0e' }}>
                  <div style={{ fontFamily: 'var(--font-retro)', fontSize: '18px', color: '#ffaaaa' }}>
                    Delete “{c.title}” permanently? Your 10 coins are not refunded.
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '9px' }}>
                    <button
                      type="button" onClick={remove}
                      style={{
                        background: 'var(--red)', color: '#fff', border: '2px solid #881111',
                        fontFamily: 'var(--font-pixel)', fontSize: '9px', padding: '7px 14px', cursor: 'pointer',
                      }}
                    >
                      YES, DELETE IT
                    </button>
                    <button
                      type="button" onClick={() => setConfirmOpen(false)}
                      style={{
                        background: 'transparent', color: 'var(--text-dim)',
                        border: '2px solid var(--border-dark)', fontFamily: 'var(--font-pixel)',
                        fontSize: '9px', padding: '7px 14px', cursor: 'pointer',
                      }}
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* The creator's devlog. Sits between the description and the
                reviews on purpose: what it is, then what changed, then what
                people made of it. Renders nothing at all when there are no
                updates and you are not the owner. */}
            <UpdatesSection creation={c} />

            {/* Phone only. The sidebar copy of this button ends up below the
                reviews once the layout stacks, so it needs one here, above
                the thing it points at. */}
            <div className="vg-only-mobile">
              <ReviewJump count={c.review_count} />
            </div>

            {/* Anchor target for the "write a review" jump below. */}
            <div id="reviews" style={{ marginTop: '14px', scrollMarginTop: '14px' }}>
              <ReviewSection creationId={c.id} />
            </div>

            {/* Ideas sit under reviews, not above: you decide what you think
                of a thing before you start suggesting what it should become. */}
            <IdeasSection creation={c} />
          </div>

          {/* ── sidebar ── */}
          <div>
            <VoteWidget
              creation={c}
              onVoted={(d) => setC((prev) => ({ ...prev, score: d.score, vote_count: d.vote_count }))}
            />

            {/*
              Reviews sat at the very bottom of the page, under the
              description, tags and owner controls — far enough down that
              people wanting to leave one could not find it. A score is a
              number; a review is the thing that actually helps a creator,
              so it gets a real invitation rather than being left to be
              scrolled past.
            */}
            <ReviewJump count={c.review_count} className="vg-only-desktop" />

            <ShareBar creation={c} />

            {/* Author card */}
            {author && (
              <div className="retro-panel" style={{ marginTop: '14px' }}>
                <div className="section-header"><h2>👤 Creator</h2></div>
                <div className="retro-panel-body" style={{ textAlign: 'center' }}>
                  <Link to={`/profile/${author.username}`}>
                    {author.avatar_url
                      ? <img src={author.avatar_url} alt="" style={{ width: '56px', height: '56px', objectFit: 'cover', border: '2px solid var(--border-dark)' }} />
                      : <span style={{ fontSize: '40px' }}>👾</span>}
                  </Link>
                  <div style={{ marginTop: '6px' }}>
                    <Link
                      to={`/profile/${author.username}`}
                      style={{ fontFamily: 'var(--font-retro)', fontSize: '20px', color: 'var(--orange)', fontWeight: 'bold' }}
                    >
                      {author.username}
                    </Link>
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-retro)', fontSize: '16px',
                    color: author.rank_colour || 'var(--text-dim)',
                  }}>
                    {author.rank_title} · level {author.level}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-retro)', fontSize: '15px',
                    color: 'var(--text-dim)', marginTop: '5px',
                  }}>
                    {author.submission_count} submissions · {author.badge_count} badges
                  </div>
                  {author.bio && (
                    <div style={{
                      fontFamily: 'var(--font-retro)', fontSize: '16px',
                      color: 'var(--text-secondary)', marginTop: '7px',
                    }}>
                      {author.bio}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Staff tools */}
            {isStaff && (
              <div className="retro-panel" style={{ marginTop: '14px', borderColor: 'var(--red)' }}>
                <div className="section-header"><h2>🛡️ Staff</h2></div>
                <div className="retro-panel-body" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      const reason = window.prompt('Reason for removal?', 'Breaks the community rules');
                      if (reason === null) return;
                      await supabase.rpc('admin_set_creation_status', {
                        p_creation: c.id, p_status: 'removed', p_reason: reason,
                      });
                      navigate('/admin');
                    }}
                    style={{
                      background: 'var(--red)', color: '#fff', border: '2px solid #881111',
                      fontFamily: 'var(--font-pixel)', fontSize: '8px', padding: '6px 10px', cursor: 'pointer',
                    }}
                  >
                    REMOVE
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await supabase.rpc('admin_set_featured', {
                        p_creation: c.id, p_featured: !c.is_featured,
                      });
                      setC((p) => ({ ...p, is_featured: !p.is_featured }));
                    }}
                    style={{
                      background: 'transparent', color: 'var(--yellow)',
                      border: '2px solid var(--border-dark)', fontFamily: 'var(--font-pixel)',
                      fontSize: '8px', padding: '6px 10px', cursor: 'pointer',
                    }}
                  >
                    {c.is_featured ? 'UNFEATURE' : 'FEATURE'}
                  </button>
                </div>
              </div>
            )}

            {/* More like this */}
            {more.length > 0 && (
              <div className="retro-panel" style={{ marginTop: '14px' }}>
                <div className="section-header"><h2>🎯 More {c.category_name}</h2></div>
                {more.map((m) => <CreationCard key={m.id} creation={m} variant="row" />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
