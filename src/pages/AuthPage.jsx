import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';

export default function AuthPage() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { signUp, signIn, user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect home
  if (user) {
    return (
      <>
        <SiteHeader compact />
        <div className="auth-page">
          <div className="retro-panel">
            <div className="section-header">
              <h2>✅ You're Logged In!</h2>
            </div>
            <div className="retro-panel-body" style={{
              fontFamily: 'var(--font-retro)',
              fontSize: '20px',
              color: 'var(--text-primary)',
              textAlign: 'center',
              padding: '30px'
            }}>
              <p>Welcome back, <strong style={{ color: 'var(--orange)' }}>{user.email?.split('@')[0]}</strong>! 👾</p>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>You're already signed in to VibeGrounds.</p>
              <Link to="/" className="retro-cta" style={{ display: 'inline-block', marginTop: '16px' }}>
                🏠 BACK TO HOMEPAGE
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match!');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        await signUp(email, password);
        setSuccess('🎉 Account created! Check your email to confirm, or you may be logged in automatically.');
        // Auto-redirect after brief delay
        setTimeout(() => navigate('/'), 2000);
      } else {
        await signIn(email, password);
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SiteHeader compact />

      <div className="auth-page">
        <div className="retro-panel">
          <div className="section-header">
            <h2>{mode === 'signin' ? '🔑 Sign In' : '🎉 Join VibeGrounds!'}</h2>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {/* Error message */}
            {error && (
              <div style={{
                background: '#331111',
                border: '2px solid #cc3333',
                padding: '8px 12px',
                marginBottom: '12px',
                fontFamily: 'var(--font-retro)',
                fontSize: '17px',
                color: '#ff6666'
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Success message */}
            {success && (
              <div style={{
                background: '#113311',
                border: '2px solid #33cc33',
                padding: '8px 12px',
                marginBottom: '12px',
                fontFamily: 'var(--font-retro)',
                fontSize: '17px',
                color: '#66ff66'
              }}>
                {success}
              </div>
            )}

            <div className="retro-form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="retro-form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
            </div>

            {mode === 'signup' && (
              <div className="retro-form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            )}

            <button
              type="submit"
              className="retro-submit-btn"
              disabled={loading}
              style={loading ? { opacity: 0.6, cursor: 'wait' } : undefined}
            >
              {loading
                ? '⏳ LOADING...'
                : mode === 'signin'
                  ? '🔓 SIGN IN'
                  : '🚀 CREATE ACCOUNT'
              }
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
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); setMode('signup'); setError(''); setSuccess(''); }}
                  style={{ color: 'var(--orange)', fontWeight: 'bold' }}
                >
                  Join now — it&#39;s free!
                </a>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); setMode('signin'); setError(''); setSuccess(''); }}
                  style={{ color: 'var(--orange)', fontWeight: 'bold' }}
                >
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
