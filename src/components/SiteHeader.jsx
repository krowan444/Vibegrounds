import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const NAV = [
  { to: '/',                   label: 'Home' },
  { to: '/portal',             label: 'Portal' },
  { to: '/category/games',     label: 'Games' },
  { to: '/category/ai-movies', label: 'AI Movies' },
  { to: '/category/software',  label: 'Software' },
  { to: '/category/websites',  label: 'Websites' },
  { to: '/category/art',       label: 'Art',   wide: true },
  { to: '/category/audio',     label: 'Audio', wide: true },
  { to: '/charts',             label: 'Top 100' },
  { to: '/forum',              label: 'Forum' },
];

export default function SiteHeader({ compact = false }) {
  const { user, profile, signOut, emailVerified, isStaff, coins, banActive } = useAuth();
  const { pathname } = useLocation();
  const [openReports, setOpenReports] = useState(0);

  // Live count on the shield icon so a report never sits unseen.
  useEffect(() => {
    if (!isStaff) return undefined;
    let alive = true;
    const check = async () => {
      const { count } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open');
      if (alive) setOpenReports(count || 0);
    };
    check();
    const timer = setInterval(check, 60000);
    return () => { alive = false; clearInterval(timer); };
  }, [isStaff]);

  const displayName = profile?.username || user?.email?.split('@')[0] || 'Viber';

  return (
    <header className="site-header">
      <div className="site-header-top">
        <Link to="/" className="site-logo">
          {/* Emblem only — the wordmark lives in type beside it, so the
              full lockup would repeat itself here. */}
          <img
            src="/images/logo.png"
            alt="VibeGrounds"
            style={{ height: compact ? '44px' : '64px', width: 'auto', display: 'block' }}
          />
          <div>
            <div className="site-logo-text" style={compact ? { fontSize: '10px' } : undefined}>VIBEGROUNDS</div>
            {!compact && <div className="site-logo-tagline">THE FUTURE OF AI CREATIVITY, TODAY!</div>}
          </div>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div className="site-auth-links" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {user ? (
              <>
                <Link
                  to="/coins"
                  title="Your gold coins — 10 per submission"
                  style={{
                    fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--yellow)',
                    textDecoration: 'none', border: '1px solid var(--orange-dim)',
                    padding: '1px 8px', background: 'rgba(232,163,23,0.1)', whiteSpace: 'nowrap',
                  }}
                >
                  🪙 {coins}
                </Link>

                <Link
                  to={`/profile/${encodeURIComponent(displayName)}`}
                  style={{
                    color: 'var(--orange)', fontFamily: 'var(--font-retro)', fontSize: '17px',
                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="" style={{ width: '22px', height: '22px', borderRadius: '2px', objectFit: 'cover', border: '1px solid var(--border-dark)' }} />
                    : '👾'}
                  {displayName}
                </Link>

                {isStaff && (
                  <Link to="/admin" title="Control room" style={{ position: 'relative', fontSize: '16px' }}>
                    🛡️
                    {openReports > 0 && (
                      <span style={{
                        position: 'absolute', top: '-6px', right: '-10px',
                        background: 'var(--red)', color: '#fff', borderRadius: '8px',
                        fontFamily: 'var(--font-pixel)', fontSize: '7px', padding: '2px 4px',
                      }}>
                        {openReports}
                      </span>
                    )}
                  </Link>
                )}

                <Link to="/settings" title="Settings" style={{ fontSize: '16px' }}>⚙️</Link>

                <a href="#" onClick={(e) => { e.preventDefault(); signOut(); }} style={{ cursor: 'pointer' }}>
                  LOG OUT
                </a>
              </>
            ) : (
              <>
                <Link to="/auth">SIGN IN</Link>
                <span style={{ color: '#666' }}>|</span>
                <Link to="/auth?mode=signup">JOIN VG!</Link>
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

      {user && banActive && (
        <div style={{
          background: '#3a0d0d', borderTop: '2px solid var(--red)', borderBottom: '2px solid var(--red)',
          padding: '6px 12px', fontFamily: 'var(--font-retro)', fontSize: '17px', color: '#ff8888',
        }}>
          🔨 Your account is suspended{profile?.banned_until ? ` until ${new Date(profile.banned_until).toLocaleDateString('en-GB')}` : ''}.
          {profile?.ban_reason ? ` Reason: ${profile.ban_reason}.` : ''} You can still browse.
        </div>
      )}

      {user && !emailVerified && !banActive && (
        <div style={{
          background: '#3a2f0d', borderTop: '2px solid var(--orange)', borderBottom: '2px solid var(--orange)',
          padding: '6px 12px', fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--yellow)',
        }}>
          📬 Confirm your email to unlock posting and claim your 50 free coins.{' '}
          <Link to="/verify" style={{ color: 'var(--orange-bright)', fontWeight: 'bold' }}>Resend the link →</Link>
        </div>
      )}

      <nav className="site-nav">
        {NAV.filter((n) => !compact || !n.wide).map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={[
              pathname === n.to ? 'active' : '',
              // The Portal is where everything actually lives, so it gets
              // pulled out of the row rather than sitting in the queue.
              n.to === '/portal' && pathname !== '/portal' ? 'vg-nav-portal' : '',
            ].filter(Boolean).join(' ') || undefined}
          >
            {n.label}
          </Link>
        ))}
        {!compact && <Link to="/rules">Rules</Link>}
        {/* Always one obvious way to post, from any page. Signed-out users
            get sent to signup rather than a wall. */}
        <Link
          to={user ? '/upload' : '/auth?mode=signup'}
          className="vg-nav-submit"
          title={user ? 'Post a creation — 10 coins' : 'Join and get 50 free coins'}
        >
          + Submit
        </Link>
      </nav>
    </header>
  );
}
