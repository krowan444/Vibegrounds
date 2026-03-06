import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function AuthPage() {
  const [mode, setMode] = useState('signin');

  return (
    <>
      <header className="site-header">
        <div className="site-header-top">
          <Link to="/" className="site-logo">
            <img src="/images/logo.png" alt="VibeGrounds" style={{ height: '50px' }} />
            <div className="site-logo-text" style={{ fontSize: '10px' }}>VIBEGROUNDS</div>
          </Link>
        </div>
        <nav className="site-nav">
          <Link to="/">Home</Link>
          <Link to="/">AI Tools</Link>
          <Link to="/">Games</Link>
          <Link to="/">Visualisers</Link>
          <Link to="/">Portal</Link>
        </nav>
      </header>

      <div className="auth-page">
        <div className="retro-panel">
          <div className="section-header">
            <h2>{mode === 'signin' ? '🔑 Sign In' : '🎉 Join VibeGrounds!'}</h2>
          </div>
          <form className="auth-form" onSubmit={(e) => {
            e.preventDefault();
            alert(mode === 'signin' ? '✅ Signed in! (Demo mode)' : '🎉 Account created! Welcome to VibeGrounds! (Demo mode)');
          }}>
            {mode === 'signup' && (
              <div className="retro-form-group">
                <label>Email</label>
                <input type="email" placeholder="you@email.com" required />
              </div>
            )}
            <div className="retro-form-group">
              <label>Username</label>
              <input type="text" placeholder="CoolViber69" required />
            </div>
            <div className="retro-form-group">
              <label>Password</label>
              <input type="password" placeholder="••••••••" required />
            </div>
            {mode === 'signup' && (
              <div className="retro-form-group">
                <label>Confirm Password</label>
                <input type="password" placeholder="••••••••" required />
              </div>
            )}
            <button type="submit" className="retro-submit-btn">
              {mode === 'signin' ? '🔓 SIGN IN' : '🚀 CREATE ACCOUNT'}
            </button>
          </form>
          <div style={{
            padding: '12px 20px',
            fontFamily: 'var(--font-retro)',
            fontSize: '18px',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            borderTop: '1px solid var(--border-dark)'
          }}>
            {mode === 'signin' ? (
              <>
                New to VibeGrounds?{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); setMode('signup'); }} style={{ color: 'var(--orange)', fontWeight: 'bold' }}>
                  Join now — it&#39;s free!
                </a>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); setMode('signin'); }} style={{ color: 'var(--orange)', fontWeight: 'bold' }}>
                  Sign in here
                </a>
              </>
            )}
          </div>
        </div>

        <div className="retro-panel" style={{ marginTop: '16px' }}>
          <div className="section-header">
            <h2>🌟 Why Join VibeGrounds?</h2>
          </div>
          <div className="retro-panel-body" style={{ fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <p>✦ Upload your AI creations and get discovered</p>
            <p>✦ Vote on epic community projects</p>
            <p>✦ Comment and connect with other builders</p>
            <p>✦ Climb the leaderboards</p>
            <p>✦ Win contests and earn badges</p>
            <p>✦ Be part of the weirdest community on the internet</p>
          </div>
        </div>
      </div>
    </>
  );
}
