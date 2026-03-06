import { Link } from 'react-router-dom';
import { mockCreations, dailyTop5, latestSubmissions, featuredCreators } from '../data/mockCreations';

export default function HomePage() {
  const featured = mockCreations.slice(0, 10);
  const latestGames = mockCreations.filter(c => c.category === 'Game');
  const topToday = [...mockCreations].sort((a, b) => b.votes - a.votes).slice(0, 5);

  return (
    <>
      {/* ── SITE HEADER ── */}
      <header className="site-header">
        <div className="site-header-top">
          <Link to="/" className="site-logo">
            <img src="/images/logo.png" alt="VibeGrounds" />
            <div>
              <div className="site-logo-text">VIBEGROUNDS</div>
              <div className="site-logo-tagline">THE FUTURE OF AI CREATIVITY, TODAY!</div>
            </div>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div className="site-auth-links">
              <Link to="/auth">SIGN IN</Link>
              <span style={{ color: '#666' }}>|</span>
              <Link to="/auth">JOIN VG!</Link>
            </div>

            <div className="site-search">
              <input type="text" placeholder="Search..." />
              <button>GO!</button>
            </div>
          </div>
        </div>

        {/* Nav Tabs */}
        <nav className="site-nav">
          <Link to="/" className="active">Home</Link>
          <Link to="/">AI Tools</Link>
          <Link to="/">Games</Link>
          <Link to="/">Visualisers</Link>
          <Link to="/">Audio</Link>
          <Link to="/">Portal</Link>
          <Link to="/">Series</Link>
          <Link to="/">Themes</Link>
          <Link to="/">Features</Link>
        </nav>
      </header>

      {/* ── NEWS TICKER ── */}
      <div className="news-ticker">
        <span className="news-ticker-date">March 6, 2026</span>
        <span className="news-ticker-text">🎉 VibeGrounds Beta Launch! Upload your AI creations and join the community! 🎉</span>
        <span className="news-ticker-posted">Posted by <a href="#">Admin</a></span>
      </div>

      {/* ── PORTAL 3-COLUMN LAYOUT ── */}
      <div className="portal-layout">

        {/* ════ LEFT SIDEBAR ════ */}
        <aside className="portal-sidebar-left">

          {/* Latest Submissions */}
          <div className="retro-panel">
            <div className="retro-panel-header">
              <span className="retro-panel-header-icon">⚡</span>
              <h3>Latest Submissions</h3>
            </div>
            <div className="retro-panel-body">
              <ol className="retro-list">
                {latestSubmissions.map((title, i) => (
                  <li key={i}>
                    <span className="retro-list-rank">{i + 1}.</span>
                    <Link to={`/creation/${i + 1}`} className="retro-list-link">{title}</Link>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Daily Top 5 */}
          <div className="retro-panel">
            <div className="retro-panel-header">
              <span className="retro-panel-header-icon">🏆</span>
              <h3>Daily Top 5</h3>
            </div>
            <div className="retro-panel-body">
              <ol className="retro-list">
                {dailyTop5.map((item) => (
                  <li key={item.rank}>
                    <span className="retro-list-rank">{item.rank}.</span>
                    <Link to={`/creation/${item.rank}`}>{item.title}</Link>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Community Poll */}
          <div className="retro-panel">
            <div className="retro-panel-header">
              <span className="retro-panel-header-icon">🗳️</span>
              <h3>VG Poll / Vote!</h3>
            </div>
            <div className="retro-panel-body">
              <div className="retro-poll">
                <div className="retro-poll-question">What's the coolest AI creation type?</div>
                <label><input type="radio" name="poll" /> AI Tools</label>
                <label><input type="radio" name="poll" /> Games</label>
                <label><input type="radio" name="poll" /> Visualisers</label>
                <label><input type="radio" name="poll" /> Experiments</label>
                <label><input type="radio" name="poll" /> All of them!</label>
                <button className="retro-poll-vote">Vote!</button>
              </div>
            </div>
          </div>

          {/* Featured Creators */}
          <div className="retro-panel">
            <div className="retro-panel-header">
              <span className="retro-panel-header-icon">👑</span>
              <h3>Featured Creators</h3>
            </div>
            <div className="retro-panel-body">
              {featuredCreators.map((c) => (
                <div key={c.username} className="creator-list-item">
                  <span className="creator-list-avatar">{c.avatar}</span>
                  <Link to={`/profile/${c.username}`} className="creator-list-name">{c.username}</Link>
                  <span className="creator-list-stats">{c.uploads} ups</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upload CTA */}
          <Link to="/upload" className="retro-cta">
            🚀 Upload Your Creation!
          </Link>

          {/* Retro Ad 1 */}
          <div className="retro-ad">
            <span className="retro-ad-label">AD</span>
            <img src="/images/ads/ad-ai-game.png" alt="Ad" />
          </div>

          {/* Retro Ad - Text Only */}
          <div className="retro-ad">
            <span className="retro-ad-label">AD</span>
            <div className="retro-ad-text">
              🤑 Make $1000<br/>With AI Tools<br/>★ Click Here ★
            </div>
          </div>

          {/* Retro Ad 2 */}
          <div className="retro-ad">
            <span className="retro-ad-label">AD</span>
            <img src="/images/ads/ad-waifu.png" alt="Ad" />
          </div>

          {/* Retro Ad - Text Only */}
          <div className="retro-ad">
            <span className="retro-ad-label">AD</span>
            <div className="retro-ad-text">
              ⚡ Free Retro<br/>Game Assets<br/>★ Download Now ★
            </div>
          </div>

        </aside>

        {/* ════ CENTER COLUMN (MAIN CONTENT) ════ */}
        <main className="portal-main">

          {/* Featured VG Creations */}
          <div className="retro-panel">
            <div className="section-header">
              <h2>⭐ Featured VG Creations!</h2>
              <div className="section-header-links">
                <a href="#">AI Tools</a>
                <span style={{ color: '#666' }}>|</span>
                <a href="#">Games</a>
                <span style={{ color: '#666' }}>|</span>
                <a href="#">Visual</a>
                <span style={{ color: '#666' }}>|</span>
                <a href="#">More...</a>
              </div>
            </div>
            <div className="creations-grid">
              {featured.map((creation) => (
                <Link
                  to={`/creation/${creation.id}`}
                  key={creation.id}
                  className="creation-card"
                >
                  <div
                    className="creation-thumb"
                    style={{ background: creation.color + '22', borderColor: creation.color }}
                  >
                    {creation.creatorAvatar}
                  </div>
                  <div className="creation-info">
                    <div className="creation-title">{creation.title}</div>
                    <div className="creation-desc">
                      {creation.description}
                    </div>
                    <div className="creation-meta">
                      <span>👍 {creation.votes.toLocaleString()}</span>
                      <span>👁 {creation.views.toLocaleString()}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Featured AI Games */}
          <div className="retro-panel">
            <div className="section-header">
              <h2>🎮 Featured AI Games!</h2>
              <div className="section-header-links">
                <a href="#">Action</a>
                <span style={{ color: '#666' }}>|</span>
                <a href="#">Puzzle</a>
                <span style={{ color: '#666' }}>|</span>
                <a href="#">Adventure</a>
                <span style={{ color: '#666' }}>|</span>
                <a href="#">More...</a>
              </div>
            </div>
            <div className="creations-grid">
              {latestGames.map((creation) => (
                <Link
                  to={`/creation/${creation.id}`}
                  key={creation.id}
                  className="creation-card"
                >
                  <div
                    className="creation-thumb"
                    style={{ background: creation.color + '22', borderColor: creation.color }}
                  >
                    {creation.creatorAvatar}
                  </div>
                  <div className="creation-info">
                    <div className="creation-title">{creation.title}</div>
                    <div className="creation-desc">{creation.description}</div>
                    <div className="creation-meta">
                      <span>👍 {creation.votes.toLocaleString()}</span>
                      <span>👁 {creation.views.toLocaleString()}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Site News */}
          <div className="retro-panel">
            <div className="section-header">
              <h2>ℹ️ Site News</h2>
              <div className="section-header-links">
                <a href="#">All News</a>
              </div>
            </div>
            <div className="site-news-item">
              <div className="site-news-avatar">🤖</div>
              <div className="site-news-text">
                <span className="news-author">VG-Bot</span>{' '}
                <span className="news-title">"Welcome to VibeGrounds Beta!"</span>
                <br />
                We're officially live! Upload your AI creations, vote on your favorites,
                and help us build the internet's weirdest creative community.
              </div>
            </div>
            <div className="site-news-item">
              <div className="site-news-avatar">👾</div>
              <div className="site-news-text">
                <span className="news-author">Admin</span>{' '}
                <span className="news-title">"First Contest Announcement!"</span>
                <br />
                Build the most creative AI tool this week and win the first ever
                VibeGrounds Creator Award! Submit now in the portal.
              </div>
            </div>
            <div className="site-news-item">
              <div className="site-news-avatar">🔥</div>
              <div className="site-news-text">
                <span className="news-author">P-Bot</span>{' '}
                <span className="news-title">"Come check out this week's top 5!"</span>
                <br />
                The community has spoken. These AI creations are absolute fire.
                Check out the Daily Top 5 in the sidebar!
              </div>
            </div>
          </div>

          {/* Top Creations Today */}
          <div className="retro-panel">
            <div className="section-header">
              <h2>🔥 Top Creations Today</h2>
            </div>
            <div className="creations-grid">
              {topToday.map((creation) => (
                <Link
                  to={`/creation/${creation.id}`}
                  key={creation.id}
                  className="creation-card"
                >
                  <div
                    className="creation-thumb"
                    style={{ background: creation.color + '22', borderColor: creation.color }}
                  >
                    {creation.creatorAvatar}
                  </div>
                  <div className="creation-info">
                    <div className="creation-title">{creation.title}</div>
                    <div className="creation-desc">{creation.description}</div>
                    <div className="creation-meta">
                      <span>👍 {creation.votes.toLocaleString()}</span>
                      <span>👁 {creation.views.toLocaleString()}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

        </main>

        {/* ════ RIGHT SIDEBAR ════ */}
        <aside className="portal-sidebar-right">

          {/* Top Creators This Week */}
          <div className="retro-panel">
            <div className="retro-panel-header">
              <span className="retro-panel-header-icon">🌟</span>
              <h3>Top Creators</h3>
            </div>
            <div className="retro-panel-body">
              {featuredCreators.slice(0, 5).map((c, i) => (
                <div key={c.username} className="creator-list-item">
                  <span className="retro-list-rank">{i + 1}.</span>
                  <span className="creator-list-avatar">{c.avatar}</span>
                  <Link to={`/profile/${c.username}`} className="creator-list-name">{c.username}</Link>
                </div>
              ))}
            </div>
          </div>

          {/* VG Contests */}
          <div className="retro-panel">
            <div className="retro-panel-header">
              <span className="retro-panel-header-icon">🏅</span>
              <h3>VG Contests!</h3>
            </div>
            <div className="retro-panel-body">
              <ol className="retro-list">
                <li>
                  <span className="retro-list-rank">1.</span>
                  <a href="#">Best AI Tool 2026</a>
                </li>
                <li>
                  <span className="retro-list-rank">2.</span>
                  <a href="#">Weirdest Experiment</a>
                </li>
                <li>
                  <span className="retro-list-rank">3.</span>
                  <a href="#">Retro Game Jam</a>
                </li>
              </ol>
            </div>
          </div>

          {/* VG Features */}
          <div className="retro-panel">
            <div className="retro-panel-header">
              <span className="retro-panel-header-icon">⚡</span>
              <h3>VG Features!</h3>
            </div>
            <div className="retro-panel-body">
              <ol className="retro-list">
                <li><a href="#">AI Art Gallery</a></li>
                <li><a href="#">Code Playground</a></li>
                <li><a href="#">Shader Demos</a></li>
                <li><a href="#">Music Gen</a></li>
                <li><a href="#">Game Builder</a></li>
                <li><a href="#">Weird Stuff</a></li>
              </ol>
            </div>
          </div>

          {/* Retro Ad */}
          <div className="retro-ad">
            <span className="retro-ad-label">AD</span>
            <div className="retro-ad-text">
              💀 Create AI<br/>Girlfriends<br/>Instantly<br/>★ Click Here ★
            </div>
          </div>

          {/* To-Do List (like NG) */}
          <div className="retro-panel">
            <div className="retro-panel-header">
              <span className="retro-panel-header-icon">✅</span>
              <h3>To-Do List</h3>
            </div>
            <div className="retro-panel-body" style={{ fontFamily: 'var(--font-retro)', fontSize: '16px' }}>
              <div style={{ marginBottom: '4px' }}>Follow us! <a href="#">Twitter</a>, <a href="#">Discord</a></div>
              <div style={{ marginBottom: '4px' }}>Join the <a href="#">Community</a></div>
              <div style={{ marginBottom: '4px' }}>Earn some <a href="#">Badges</a></div>
              <div>Try out <a href="#">AI Tools</a></div>
            </div>
          </div>

          {/* Retro Ad - Text Only */}
          <div className="retro-ad">
            <span className="retro-ad-label">AD</span>
            <div className="retro-ad-text">
              🎮 Hot AI Waifu<br/>Generator<br/>★ Try Free ★
            </div>
          </div>

        </aside>
      </div>

      {/* ── SITE FOOTER ── */}
      <footer className="site-footer">
        <div className="site-footer-links">
          <a href="#">About</a>
          <a href="#">Contact</a>
          <a href="#">Terms</a>
          <a href="#">Privacy</a>
          <a href="#">API</a>
          <a href="#">Discord</a>
        </div>
        <div className="site-footer-copyright">
          © 2026 VibeGrounds.com — The Future of AI Creativity
        </div>
      </footer>
    </>
  );
}
