import { useLocation, useNavigate } from 'react-router-dom';

export default function BrowserChrome({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const address = `http://www.vibegrounds.com${location.pathname === '/' ? '/' : location.pathname}`;

  return (
    <div className="xp-window">
      {/* ── Title Bar ── */}
      <div className="xp-titlebar">
        <div className="xp-titlebar-text">
          <span className="xp-titlebar-icon">🌐</span>
          VibeGrounds.com - Microsoft Internet Explorer
        </div>
        <div className="xp-titlebar-buttons">
          <button className="xp-titlebar-btn" title="Minimize">_</button>
          <button className="xp-titlebar-btn" title="Maximize">□</button>
          <button className="xp-titlebar-btn close" title="Close">✕</button>
        </div>
      </div>

      {/* ── Menu Bar ── */}
      <div className="xp-menubar">
        <span className="xp-menu-item">File</span>
        <span className="xp-menu-item">Edit</span>
        <span className="xp-menu-item">View</span>
        <span className="xp-menu-item">Favorites</span>
        <span className="xp-menu-item">Tools</span>
        <span className="xp-menu-item">Help</span>
      </div>

      {/* ── Toolbar ── */}
      <div className="xp-toolbar">
        <button className="xp-toolbar-btn" onClick={() => navigate(-1)} title="Back">
          <span className="btn-icon">⬅</span>
          <span>Back</span>
        </button>
        <button className="xp-toolbar-btn" onClick={() => navigate(1)} title="Forward">
          <span className="btn-icon">➡</span>
        </button>
        <button className="xp-toolbar-btn" title="Stop">
          <span className="btn-icon" style={{ color: '#cc0000' }}>✕</span>
        </button>
        <button className="xp-toolbar-btn" onClick={() => navigate(0)} title="Refresh">
          <span className="btn-icon" style={{ color: '#00aa00' }}>🔄</span>
        </button>
        <button className="xp-toolbar-btn" onClick={() => navigate('/')} title="Home">
          <span className="btn-icon">🏠</span>
        </button>
        <div className="xp-toolbar-separator" />
        <button className="xp-toolbar-btn">
          <span className="btn-icon">🔍</span>
          <span>Search</span>
        </button>
        <button className="xp-toolbar-btn">
          <span className="btn-icon">⭐</span>
          <span>Favorites</span>
        </button>
        <button className="xp-toolbar-btn">
          <span className="btn-icon">🎵</span>
          <span>Media</span>
        </button>
        <div className="xp-toolbar-separator" />
        <button className="xp-toolbar-btn">
          <span className="btn-icon">🖨️</span>
        </button>
        <button className="xp-toolbar-btn">
          <span className="btn-icon">✉️</span>
        </button>
      </div>

      {/* ── Address Bar ── */}
      <div className="xp-addressbar">
        <span className="xp-addressbar-label">Address</span>
        <div className="xp-addressbar-input-wrap">
          <span className="xp-addressbar-icon">📄</span>
          <input
            className="xp-addressbar-input"
            value={address}
            readOnly
          />
        </div>
        <button className="xp-addressbar-go" onClick={() => navigate('/')}>
          ➡ Go
        </button>
      </div>

      {/* ── Content Area ── */}
      <div className="xp-content">
        {children}
      </div>

      {/* ── Status Bar ── */}
      <div className="xp-statusbar">
        <span className="xp-statusbar-section">✅ Done</span>
        <span className="xp-statusbar-section">Internet</span>
        <span style={{ marginLeft: 'auto' }}>🔒 Protected Mode: On</span>
        <span>⚡ 100%</span>
      </div>
    </div>
  );
}
