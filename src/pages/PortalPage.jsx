import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CreationCard, CATEGORY_ICONS } from '../components/CommunityWidgets';
import SiteHeader from '../components/SiteHeader';

const CATEGORIES = ['games', 'tools', 'art', 'experiments', 'websites', 'other'];

export default function PortalPage() {
  const navigate = useNavigate();
  const [latest, setLatest] = useState([]);
  const [bestWeek, setBestWeek] = useState([]);
  const [bestAllTime, setBestAllTime] = useState([]);
  const [categoryPreviews, setCategoryPreviews] = useState({});
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [randomLoading, setRandomLoading] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      // Latest 20
      const { data: latestData } = await supabase
        .from('creations')
        .select('*, profiles(username)')
        .order('created_at', { ascending: false })
        .limit(20);

      // Best This Week — creations from the last 7 days, newest first
      // (will be replaced by real scores later)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const { data: weekData } = await supabase
        .from('creations')
        .select('*, profiles(username)')
        .gte('created_at', oneWeekAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      // Best of All Time — oldest first (earliest surviving creations)
      // (will be replaced by real rating scores later)
      const { data: allTimeData } = await supabase
        .from('creations')
        .select('*, profiles(username)')
        .order('created_at', { ascending: true })
        .limit(10);

      // Category previews — latest 3 from each category
      const previews = {};
      for (const cat of CATEGORIES) {
        const { data: catData } = await supabase
          .from('creations')
          .select('*, profiles(username)')
          .eq('category', cat)
          .order('created_at', { ascending: false })
          .limit(3);
        previews[cat] = catData || [];
      }

      // Total count
      const { count } = await supabase
        .from('creations')
        .select('*', { count: 'exact', head: true });

      if (latestData) setLatest(latestData);
      if (weekData) setBestWeek(weekData);
      if (allTimeData) setBestAllTime(allTimeData);
      setCategoryPreviews(previews);
      setTotalCount(count || 0);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // Random discovery
  const handleRandom = async () => {
    setRandomLoading(true);
    try {
      // Get total count then pick random offset
      const { count } = await supabase
        .from('creations')
        .select('*', { count: 'exact', head: true });

      if (count && count > 0) {
        const randomOffset = Math.floor(Math.random() * count);
        const { data } = await supabase
          .from('creations')
          .select('id')
          .range(randomOffset, randomOffset)
          .limit(1);

        if (data && data.length > 0) {
          navigate(`/creation/${data[0].id}`);
          return;
        }
      }
      alert('No creations to discover yet! Be the first to upload one! 🚀');
    } catch {
      alert('Portal glitch! Try again.');
    } finally {
      setRandomLoading(false);
    }
  };

  return (
    <>
      <SiteHeader />

      <div className="portal-layout">

        {/* ════ LEFT SIDEBAR ════ */}
        <aside className="portal-sidebar-left">

          {/* Latest 5 */}
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
                        {c.title.length > 18 ? c.title.slice(0, 18) + '…' : c.title}
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

          {/* Random Discovery */}
          <button
            onClick={handleRandom}
            disabled={randomLoading}
            className="retro-cta"
            style={{
              width: '100%',
              cursor: randomLoading ? 'wait' : 'pointer',
              opacity: randomLoading ? 0.6 : 1,
              border: '2px solid #ffaa00'
            }}
          >
            {randomLoading ? '⏳ LOADING...' : '🎲 RANDOM\nDISCOVERY!'}
          </button>

          {/* Upload CTA */}
          <Link to="/upload" className="retro-cta">
            🚀 SUBMIT YOUR<br />CREATION!
          </Link>

          {/* Portal Stats */}
          <div className="retro-panel">
            <div className="retro-panel-header">
              <span className="retro-panel-header-icon">📊</span>
              <h3>Portal Stats</h3>
            </div>
            <div className="retro-panel-body" style={{ fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--text-secondary)' }}>
              <div style={{ marginBottom: '4px' }}>
                Total: <span style={{ color: 'var(--orange)', fontWeight: 'bold' }}>{totalCount}</span> creations
              </div>
              <div style={{ marginBottom: '4px' }}>
                Categories: <span style={{ color: 'var(--orange)', fontWeight: 'bold' }}>{CATEGORIES.length}</span>
              </div>
              <div>
                Status: <span style={{ color: 'var(--green)' }}>🟢 LIVE</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ════ MAIN CONTENT ════ */}
        <main className="portal-main">

          {/* ── LATEST CREATIONS ── */}
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
              <PortalLoading text="Loading the portal..." />
            ) : latest.length > 0 ? (
              <div className="creations-grid">
                {latest.map(c => <CreationCard key={c.id} creation={c} />)}
              </div>
            ) : (
              <PortalEmpty />
            )}
          </div>

          {/* ── BEST THIS WEEK ── */}
          <div className="retro-panel">
            <div className="section-header">
              <h2>🔥 BEST THIS WEEK</h2>
              <div className="section-header-links">
                <span style={{ fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--text-dim)' }}>
                  Trending this week — real scores coming soon!
                </span>
              </div>
            </div>
            {!loading && bestWeek.length > 0 ? (
              <div className="portal-ranked-list">
                {bestWeek.map((c, i) => (
                  <PortalRankedItem key={c.id} creation={c} rank={i + 1} />
                ))}
              </div>
            ) : !loading ? (
              <div style={{
                fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-dim)',
                textAlign: 'center', padding: '30px'
              }}>
                No creations this week yet. Be the first! <Link to="/upload" style={{ color: 'var(--orange)' }}>Upload →</Link>
              </div>
            ) : null}
          </div>

          {/* ── BEST OF ALL TIME ── */}
          <div className="retro-panel">
            <div className="section-header">
              <h2>🏆 BEST OF ALL TIME</h2>
              <div className="section-header-links">
                <span style={{ fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--text-dim)' }}>
                  Legendary creations — rating system coming soon!
                </span>
              </div>
            </div>
            {!loading && bestAllTime.length > 0 ? (
              <div className="portal-ranked-list">
                {bestAllTime.map((c, i) => (
                  <PortalRankedItem key={c.id} creation={c} rank={i + 1} />
                ))}
              </div>
            ) : !loading ? (
              <div style={{
                fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-dim)',
                textAlign: 'center', padding: '30px'
              }}>
                The hall of fame awaits your creation! 🏅
              </div>
            ) : null}
          </div>

          {/* ── BROWSE CATEGORIES ── */}
          <div className="retro-panel">
            <div className="section-header">
              <h2>📂 BROWSE BY CATEGORY</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
              {CATEGORIES.map(cat => {
                const items = categoryPreviews[cat] || [];
                const icon = CATEGORY_ICONS[cat] || '✨';
                return (
                  <div key={cat} style={{
                    borderRight: '1px solid var(--border-dark)',
                    borderBottom: '1px solid var(--border-dark)',
                    padding: '10px 12px'
                  }}>
                    <Link
                      to={`/category/${cat}`}
                      style={{
                        fontFamily: 'var(--font-pixel)', fontSize: '10px',
                        color: 'var(--orange)', textTransform: 'uppercase',
                        textDecoration: 'none', display: 'block', marginBottom: '6px'
                      }}
                    >
                      {icon} {cat}
                    </Link>
                    {items.length > 0 ? (
                      <ol className="retro-list" style={{ fontSize: '14px' }}>
                        {items.map((c, i) => (
                          <li key={c.id} style={{ padding: '2px 0', borderBottom: 'none' }}>
                            <span className="retro-list-rank" style={{ fontSize: '12px' }}>{i + 1}.</span>
                            <Link to={`/creation/${c.id}`} style={{ fontSize: '14px' }}>
                              {c.title.length > 22 ? c.title.slice(0, 22) + '…' : c.title}
                            </Link>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div style={{ fontFamily: 'var(--font-retro)', fontSize: '14px', color: 'var(--text-dim)' }}>
                        Empty — <Link to="/upload" style={{ color: 'var(--orange)', fontSize: '13px' }}>add one!</Link>
                      </div>
                    )}
                    <Link
                      to={`/category/${cat}`}
                      style={{
                        fontFamily: 'var(--font-retro)', fontSize: '13px',
                        color: 'var(--blue-link)', display: 'block', marginTop: '4px'
                      }}
                    >
                      Browse all {cat} →
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── RANDOM DISCOVERY (Main area button) ── */}
          <div className="retro-panel">
            <div className="section-header">
              <h2>🎲 FEELING LUCKY?</h2>
            </div>
            <div style={{
              textAlign: 'center', padding: '20px',
              fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-secondary)'
            }}>
              <p style={{ marginBottom: '12px' }}>
                Don't know what to explore? Let the portal choose for you!
              </p>
              <button
                onClick={handleRandom}
                disabled={randomLoading}
                className="retro-cta"
                style={{
                  display: 'inline-block', width: 'auto', padding: '12px 30px',
                  cursor: randomLoading ? 'wait' : 'pointer',
                  opacity: randomLoading ? 0.6 : 1
                }}
              >
                {randomLoading ? '⏳ PORTAL IS THINKING...' : '🎲 DISCOVER SOMETHING RANDOM!'}
              </button>
              <p style={{ marginTop: '10px', fontSize: '14px', color: 'var(--text-dim)' }}>
                There are <span style={{ color: 'var(--orange)' }}>{totalCount}</span> creations waiting to be discovered!
              </p>
            </div>
          </div>

        </main>

        {/* ════ RIGHT SIDEBAR ════ */}
        <aside className="portal-sidebar-right">

          {/* Top 5 This Week */}
          <div className="retro-panel">
            <div className="retro-panel-header">
              <span className="retro-panel-header-icon">🔥</span>
              <h3>Top 5 Week</h3>
            </div>
            <div className="retro-panel-body">
              {bestWeek.length > 0 ? (
                <ol className="retro-list">
                  {bestWeek.slice(0, 5).map((c, i) => (
                    <li key={c.id}>
                      <span className="retro-list-rank">{i + 1}.</span>
                      <Link to={`/creation/${c.id}`}>
                        {c.title.length > 18 ? c.title.slice(0, 18) + '…' : c.title}
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <div style={{ fontFamily: 'var(--font-retro)', fontSize: '15px', color: 'var(--text-dim)' }}>
                  Nothing yet this week!
                </div>
              )}
            </div>
          </div>

          {/* Browse By */}
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
                    display: 'block', padding: '4px 8px', marginBottom: '2px',
                    fontFamily: 'var(--font-retro)', fontSize: '17px',
                    color: 'var(--text-secondary)', borderBottom: '1px solid #1a1a2e',
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
              🎮 VIBEGROUNDS<br />
              PORTAL IS LIVE!<br />
              <span style={{ fontSize: '6px', color: 'var(--text-dim)' }}>
                Submit your creation today →
              </span>
            </div>
          </div>

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
      </div>
    </>
  );
}

// ── Shared sub-components ──

function PortalLoading({ text = 'Loading...' }) {
  return (
    <div style={{
      fontFamily: 'var(--font-retro)', fontSize: '22px', color: 'var(--orange)',
      textAlign: 'center', padding: '40px'
    }}>
      ⏳ {text}
    </div>
  );
}

function PortalEmpty() {
  return (
    <div style={{
      fontFamily: 'var(--font-retro)', fontSize: '20px', color: 'var(--text-dim)',
      textAlign: 'center', padding: '40px'
    }}>
      The portal is empty! Be the first to{' '}
      <Link to="/upload" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>submit your creation →</Link>
    </div>
  );
}

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
          {creation.description?.slice(0, 100)}{creation.description?.length > 100 ? '…' : ''}
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
            <a href={creation.project_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)' }}>
              🔗 Visit
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
