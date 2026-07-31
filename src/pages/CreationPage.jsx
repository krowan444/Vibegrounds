import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import VoteWidget from '../components/VoteWidget';
import ReviewSection from '../components/ReviewSection';
import ReportButton from '../components/ReportButton';
import CreationCard from '../components/CreationCard';
import Notice from '../components/Notice';
import { compactNumber, shortDate, hostOf } from '../lib/format';

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

      // count the view once per mount
      if (!viewed.current) {
        viewed.current = true;
        supabase.rpc('register_view', { p_creation: id });
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
              <div style={{
                position: 'relative', background: 'var(--bg-dark)',
                borderBottom: '2px solid var(--border-panel)',
                aspectRatio: '16 / 9', display: 'flex',
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
                {c.thumbnail_url
                  ? <img src={c.thumbnail_url} alt={c.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '64px', opacity: 0.4 }}>{c.category_icon}</span>}
              </div>

              {/* Launch */}
              <div style={{ padding: '12px', textAlign: 'center' }}>
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

              {/* Description */}
              <div style={{
                padding: '12px', borderTop: '1px solid var(--border-dark)',
                fontFamily: 'var(--font-retro)', fontSize: '18px',
                color: 'var(--text-primary)', lineHeight: 1.4, whiteSpace: 'pre-wrap',
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

                <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {isOwner && (
                    <>
                      <Link
                        to={`/profile/${c.creator_username}`}
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

            <div style={{ marginTop: '14px' }}>
              <ReviewSection creationId={c.id} />
            </div>
          </div>

          {/* ── sidebar ── */}
          <div>
            <VoteWidget
              creation={c}
              onVoted={(d) => setC((prev) => ({ ...prev, score: d.score, vote_count: d.vote_count }))}
            />

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
