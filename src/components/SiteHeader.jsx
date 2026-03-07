import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function SiteHeader({ compact = false }) {
  const { user, profile, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Use profile username, fall back to email prefix
  const displayName = profile?.username || user?.email?.split('@')[0] || 'Viber';

  return (
    <header className="site-header">
      <div className="site-header-top">
        <Link to="/" className="site-logo">
          <img
            src="/images/logo.png"
            alt="VibeGrounds"
            style={compact ? { height: '50px' } : undefined}
          />
          <div>
            <div className="site-logo-text" style={compact ? { fontSize: '10px' } : undefined}>
              VIBEGROUNDS
            </div>
            {!compact && (
              <div className="site-logo-tagline">THE FUTURE OF AI CREATIVITY, TODAY!</div>
            )}
          </div>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div className="site-auth-links">
            {user ? (
              <>
                <Link
                  to={`/profile/${encodeURIComponent(displayName)}`}
                  style={{ color: 'var(--orange)', fontFamily: 'var(--font-retro)', fontSize: '17px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" style={{ width: '22px', height: '22px', borderRadius: '2px', objectFit: 'cover', border: '1px solid var(--border-dark)' }} />
                  ) : '👾'}
                  {displayName}
                </Link>
                <span style={{ color: '#666' }}>|</span>
                <Link to="/edit-profile" style={{ fontSize: '16px' }}>
                  ⚙️
                </Link>
                <span style={{ color: '#666' }}>|</span>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); handleSignOut(); }}
                  style={{ cursor: 'pointer' }}
                >
                  LOG OUT
                </a>
              </>
            ) : (
              <>
                <Link to="/auth">SIGN IN</Link>
                <span style={{ color: '#666' }}>|</span>
                <Link to="/auth">JOIN VG!</Link>
              </>
            )}
          </div>

          {!compact && (
            <div className="site-search">
              <input type="text" placeholder="Search..." />
              <button>GO!</button>
            </div>
          )}
        </div>
      </div>

      <nav className="site-nav">
        <Link to="/" className="active">Home</Link>
        <Link to="/">AI Tools</Link>
        <Link to="/">Games</Link>
        <Link to="/">Visualisers</Link>
        {!compact && <Link to="/">Audio</Link>}
        <Link to="/portal">Portal</Link>
        <Link to="/forum">Forum</Link>
        {!compact && (
          <>
            <Link to="/">Series</Link>
            <Link to="/">Themes</Link>
            <Link to="/">Features</Link>
          </>
        )}
      </nav>
    </header>
  );
}
