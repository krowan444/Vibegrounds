import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CreationCard, CATEGORY_ICONS } from '../components/CommunityWidgets';
import SiteHeader from '../components/SiteHeader';

const CATEGORIES = ['games', 'tools', 'art', 'experiments', 'websites', 'other'];

export default function PortalPage() {
  const [latest, setLatest] = useState([]);
  const [top, setTop] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      // Fetch latest 20
      const { data: latestData } = await supabase
        .from('creations')
        .select('*, profiles(username)')
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch all for "Top" ranking (using created_at as temporary score — newest = higher rank)
      // This will be replaced by real votes/scores later
      const { data: topData } = await supabase
        .from('creations')
        .select('*, profiles(username)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (latestData) setLatest(latestData);
      if (topData) setTop(topData);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const top10 = top.slice(0, 10);
  const top100 = top;

  return (
    <>
      <SiteHeader />

      {/* ── Portal Layout ── */}
      <div className="portal-layout">

        {/* ════ LEFT SIDEBAR ════ */}
        <aside className="portal-sidebar-left">

          {/* Latest 5 Submissions */}
          <div className="retro-panel">
            <div className="retro-panel-header">
              <span className="retro-panel-header-icon">🆕</span>
              <h3>Latest 5</h3>
            </div>
            <div className="retro-panel-body">
              {loading ? (
                <div style={{ fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--orange)' }}>Loading...</div>
              ) : latest.length > 0 ? (
                <ol className="retro-list">
                  {latest.slice(0, 5).map((c, i) => (
                    <li key={c.id}>
                      <span className="retro-list-rank">{i + 1}.</span>
                      <Link to={`/creation/${c.id}`}>
                        {c.title.length > 20 ? c.title.slice(0, 20) + '...' : c.title}
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <div style={{ fontFamily: 'var(--font-retro)', fontSize: '15px', color: 'var(--text-dim)' }}>
                  No submissions yet!
                </div>
              )}
            </div>
          </div>

          {/* Categories */}
          <div className="retro-panel">
            <div className="retro-panel-header">
              <span className="retro-panel-header-icon">📂</span>
              <h3>Categories</h3>
            </div>
            <div className="retro-panel-body">
              <ol className="retro-list">
                {CATEGORIES.map(cat => (
                  <li key={cat}>
                    <Link to={`/category/${cat}`}>
                      {CATEGORY_ICONS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Upload CTA */}
          <Link to="/upload" className="retro-cta">
            🚀 SUBMIT YOUR<br />CREATION!
          </Link>

          {/* Quick Links */}
          <div className="retro-panel">
            <div className="retro-panel-header">
              <span className="retro-panel-header-icon">⭐</span>
              <h3>Quick Links</h3>
            </div>
            <div className="retro-panel-body">
              <ol className="retro-list">
                <li><Link to="/">🏠 Home</Link></li>
                <li><Link to="/portal">🌐 Portal</Link></li>
                <li><Link to="/upload">🚀 Upload</Link></li>
                <li><Link to="/auth">🔑 Sign In</Link></li>
              </ol>
            </div>
          </div>
        </aside>

        {/* ════ MAIN CONTENT ════ */}
        <main className="portal-main">

          {/* ── Featured / Latest Creations ── */}
          <div className="retro-panel">
            <div className="section-header">
              <h2>🆕 LATEST CREATIONS</h2>
              <div className="section-header-links">
                {CATEGORIES.map(cat => (
                  <span key={cat}>
                    <Link to={`/category/${cat}`}>{CATEGORY_ICONS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}</Link>
                    {' '}
                  </span>
                ))}
              </div>
            </div>
            {loading ? (
              <div style={{
                fontFamily: 'var(--font-retro)', fontSize: '22px', color: 'var(--orange)',
                textAlign: 'center', padding: '40px'
              }}>
                ⏳ Loading the portal...
              </div>
            ) : latest.length > 0 ? (
              <div className="creations-grid">
                {latest.map(c => <CreationCard key={c.id} creation={c} />)}
              </div>
            ) : (
              <div style={{
                fontFamily: 'var(--font-retro)', fontSize: '20px', color: 'var(--text-dim)',
                textAlign: 'center', padding: '40px'
              }}>
                The portal is empty! Be the first to{' '}
                <Link to="/upload" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>submit your creation →</Link>
              </div>
            )}
          </div>

          {/* ── TOP CREATIONS ── */}
          <div className="retro-panel">
            <div className="section-header">
              <h2>🏆 TOP CREATIONS</h2>
              <div className="section-header-links">
                <span style={{ fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--text-dim)' }}>
                  Ranked by freshness — real scores coming soon!
                </span>
              </div>
            </div>
            {!loading && top10.length > 0 ? (
              <div className="portal-ranked-list">
                {top10.map((c, i) => (
                  <PortalRankedItem key={c.id} creation={c} rank={i + 1} />
                ))}
              </div>
            ) : !loading ? (
              <div style={{
                fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-dim)',
                textAlign: 'center', padding: '30px'
              }}>
                No creations to rank yet!
              </div>
            ) : null}
          </div>

          {/* ── TOP 100 ── */}
          <div className="retro-panel">
            <div className="section-header">
              <h2>💯 TOP 100</h2>
              <div className="section-header-links">
                <span style={{ fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--text-dim)' }}>
                  {top100.length} creations in the portal
                </span>
              </div>
            </div>
            {!loading && top100.length > 0 ? (
              <div className="portal-top100">
                {top100.map((c, i) => (
                  <div key={c.id} className="portal-top100-row">
                    <span className="portal-top100-rank">#{i + 1}</span>
                    <Link to={`/creation/${c.id}`} className="portal-top100-title">
                      {c.title}
                    </Link>
                    <span className="portal-top100-category">
                      {CATEGORY_ICONS[c.category] || '✨'} {c.category}
                    </span>
                    <span className="portal-top100-creator">
                      by{' '}
                      <Link to={`/profile/${encodeURIComponent(c.profiles?.username || 'unknown')}`}>
                        {c.profiles?.username || 'unknown'}
                      </Link>
                    </span>
                    {c.project_url && (
                      <a
                        href={c.project_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="portal-top100-visit"
                      >
                        🔗 Visit
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : !loading ? (
              <div style={{
                fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-dim)',
                textAlign: 'center', padding: '30px'
              }}>
                The Top 100 awaits your submission! 🚀
              </div>
            ) : null}
          </div>

        </main>

        {/* ════ RIGHT SIDEBAR ════ */}
        <aside className="portal-sidebar-right">
          <div className="retro-panel">
            <div className="retro-panel-header">
              <span className="retro-panel-header-icon">📊</span>
              <h3>Portal Stats</h3>
            </div>
            <div className="retro-panel-body" style={{ fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--text-secondary)' }}>
              <div style={{ marginBottom: '4px' }}>
                Total creations: <span style={{ color: 'var(--orange)', fontWeight: 'bold' }}>{top.length}</span>
              </div>
              <div style={{ marginBottom: '4px' }}>
                Categories: <span style={{ color: 'var(--orange)', fontWeight: 'bold' }}>{CATEGORIES.length}</span>
              </div>
              <div>
                Status: <span style={{ color: 'var(--green)' }}>🟢 LIVE</span>
              </div>
            </div>
          </div>

          {/* Category Quick Browse */}
          <div className="retro-panel">
            <div className="retro-panel-header">
              <span className="retro-panel-header-icon">🎯</span>
              <h3>Browse By</h3>
            </div>
            <div className="retro-panel-body">
              {CATEGORIES.map(cat => (
                <Link
                  key={cat}
                  to={`/category/${cat}`}
                  style={{
                    display: 'block',
                    padding: '4px 8px',
                    marginBottom: '2px',
                    fontFamily: 'var(--font-retro)',
                    fontSize: '17px',
                    color: 'var(--text-secondary)',
                    borderBottom: '1px solid #1a1a2e',
                    textDecoration: 'none'
                  }}
                >
                  {CATEGORY_ICONS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Link>
              ))}
            </div>
          </div>

          <div className="retro-ad">
            <div className="retro-ad-text">
              🎨 CREATE SOMETHING<br />
              AMAZING TODAY!<br />
              <span style={{ fontSize: '6px', color: 'var(--text-dim)' }}>
                Submit your project →
              </span>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

// Ranked item row for Top Creations section
function PortalRankedItem({ creation, rank }) {
  const icon = CATEGORY_ICONS[creation.category] || '✨';
  const date = creation.created_at
    ? new Date(creation.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  return (
    <div className="portal-ranked-item">
      <div className="portal-ranked-number">#{rank}</div>
      <div
        className="portal-ranked-thumb"
        style={{
          background: creation.thumbnail_url ? `url(${creation.thumbnail_url}) center/cover` : '#222',
        }}
      >
        {!creation.thumbnail_url && <span>{icon}</span>}
      </div>
      <div className="portal-ranked-info">
        <Link to={`/creation/${creation.id}`} className="portal-ranked-title">
          {creation.title}
        </Link>
        <div className="portal-ranked-desc">
          {creation.description?.slice(0, 100)}{creation.description?.length > 100 ? '...' : ''}
        </div>
        <div className="portal-ranked-meta">
          <span>{icon} {creation.category}</span>
          {creation.profiles?.username && (
            <span>
              by{' '}
              <Link to={`/profile/${encodeURIComponent(creation.profiles.username)}`}>
                {creation.profiles.username}
              </Link>
            </span>
          )}
          {date && <span>{date}</span>}
          {creation.project_url && (
            <a
              href={creation.project_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--green)' }}
            >
              🔗 Visit
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
