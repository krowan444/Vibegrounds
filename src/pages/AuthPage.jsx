import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useAuth, validateUsername, validatePassword } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';

export default function AuthPage() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [form, setForm] = useState({ email: '', username: '', password: '', confirm: '' });
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const { signUp, signIn, user, resendVerification } = useAuth();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const usernameHint = form.username ? validateUsername(form.username) : null;
  const passwordHint = form.password ? validatePassword(form.password) : null;

  if (user) {
    return (
      <>
        <SiteHeader compact />
        <div className="auth-page">
          <div className="retro-panel">
            <div className="section-header"><h2>✅ You're Logged In!</h2></div>
            <div className="retro-panel-body" style={{ textAlign: 'center', padding: '30px', fontFamily: 'var(--font-retro)', fontSize: '20px' }}>
              <p>Welcome back, <strong style={{ color: 'var(--orange)' }}>{user.email?.split('@')[0]}</strong>! 👾</p>
              <Link to="/" className="retro-cta" style={{ display: 'inline-block', marginTop: '16px' }}>
                🏠 BACK TO HOMEPAGE
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── shown straight after a successful signup ───────────────
  if (sent) {
    return (
      <>
        <SiteHeader compact />
        <div className="auth-page">
          <div className="retro-panel">
            <div className="section-header"><h2>📬 Check Your Email</h2></div>
            <div className="retro-panel-body" style={{ fontFamily: 'var(--font-retro)', fontSize: '19px', lineHeight: 1.5, padding: '24px' }}>
              <p>We've sent a confirmation link to <strong style={{ color: 'var(--orange)' }}>{form.email}</strong>.</p>
              <p style={{ marginTop: '10px', color: 'var(--text-secondary)' }}>
                Click it to activate your account and collect your{' '}
                <strong style={{ color: 'var(--yellow)' }}>50 free gold coins</strong> 🪙
              </p>
              <p style={{ marginTop: '10px', color: 'var(--text-dim)', fontSize: '16px' }}>
                Nothing yet? Check your spam folder — it likes to hide there.
              </p>
              <button
                type="button"
                className="retro-submit-btn"
                style={{ marginTop: '16px' }}
                onClick={async () => {
                  try { await resendVerification(form.email); setError(''); }
                  catch (err) { setError(err.message); }
                }}
              >
                ✉️ RESEND EMAIL
              </button>
              <Notice tone="error" style={{ marginTop: '12px', marginBottom: 0 }}>{error}</Notice>
            </div>
          </div>
        </div>
      </>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        if (!agreed) throw new Error('Please agree to the community rules first.');
        if (form.password !== form.confirm) throw new Error('Passwords do not match!');
        await signUp(form.email, form.password, form.username);
        setSent(true);
      } else {
        await signIn(form.email, form.password);
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again!');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next) => (e) => {
    e.preventDefault();
    setMode(next);
    setError('');
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
            <Notice tone="error">{error}</Notice>

            <div className="retro-form-group">
              <label>Email</label>
              <input
                type="email" autoComplete="email" placeholder="you@email.com"
                value={form.email} onChange={set('email')} required disabled={loading}
              />
            </div>

            {mode === 'signup' && (
              <div className="retro-form-group">
                <label>Username</label>
                <input
                  type="text" autoComplete="username" placeholder="pixel_wizard"
                  value={form.username} onChange={set('username')} required disabled={loading}
                  minLength={3} maxLength={20}
                />
                <div style={{
                  fontFamily: 'var(--font-retro)', fontSize: '14px', marginTop: '2px',
                  color: usernameHint ? '#ff8888' : 'var(--text-dim)',
                }}>
                  {usernameHint || '3–20 characters. Letters, numbers, _ and - only.'}
                </div>
              </div>
            )}

            <div className="retro-form-group">
              <label>Password</label>
              <input
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                value={form.password} onChange={set('password')} required disabled={loading}
              />
              {mode === 'signup' && (
                <div style={{
                  fontFamily: 'var(--font-retro)', fontSize: '14px', marginTop: '2px',
                  color: passwordHint ? '#ff8888' : 'var(--text-dim)',
                }}>
                  {passwordHint || 'At least 8 characters, with a letter and a number.'}
                </div>
              )}
            </div>

            {mode === 'signup' && (
              <>
                <div className="retro-form-group">
                  <label>Confirm Password</label>
                  <input
                    type="password" autoComplete="new-password" placeholder="••••••••"
                    value={form.confirm} onChange={set('confirm')} required disabled={loading}
                  />
                </div>

                <label style={{
                  display: 'flex', gap: '8px', alignItems: 'flex-start',
                  fontFamily: 'var(--font-retro)', fontSize: '16px',
                  color: 'var(--text-secondary)', margin: '10px 0', cursor: 'pointer',
                }}>
                  <input
                    type="checkbox" checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    style={{ marginTop: '3px' }}
                  />
                  <span>
                    Be weird, be experimental, be unfinished. Don't be a bigot, a spammer or a
                    thief. I agree to the{' '}
                    <Link to="/rules" style={{ color: 'var(--orange)' }}>community rules</Link>.
                  </span>
                </label>
              </>
            )}

            <button
              type="submit" className="retro-submit-btn" disabled={loading}
              style={loading ? { opacity: 0.6, cursor: 'wait' } : undefined}
            >
              {loading ? '⏳ LOADING...' : mode === 'signin' ? '🔓 SIGN IN' : '🚀 CREATE ACCOUNT'}
            </button>

            {mode === 'signin' && (
              <div style={{ textAlign: 'center', marginTop: '10px' }}>
                <Link to="/forgot-password" style={{ fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--blue-link)' }}>
                  Forgot your password?
                </Link>
              </div>
            )}
          </form>

          <div style={{
            padding: '12px 20px', fontFamily: 'var(--font-retro)', fontSize: '18px',
            color: 'var(--text-secondary)', textAlign: 'center', borderTop: '1px solid var(--border-dark)',
          }}>
            {mode === 'signin' ? (
              <>New to VibeGrounds? <a href="#" onClick={switchMode('signup')} style={{ color: 'var(--orange)', fontWeight: 'bold' }}>Join now — it&#39;s free!</a></>
            ) : (
              <>Already have an account? <a href="#" onClick={switchMode('signin')} style={{ color: 'var(--orange)', fontWeight: 'bold' }}>Sign in here</a></>
            )}
          </div>
        </div>

        <div className="retro-panel" style={{ marginTop: '16px' }}>
          <div className="section-header"><h2>🌟 Why Join VibeGrounds?</h2></div>
          <div className="retro-panel-body" style={{ fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <p>🪙 <strong style={{ color: 'var(--yellow)' }}>50 free gold coins</strong> the moment you verify — that&#39;s 5 submissions</p>
            <p>✦ Post games, AI movies, software, sites and glorious experiments</p>
            <p>✦ Get scored 0–5 and climb the Daily, Weekly and All-Time charts</p>
            <p>✦ Earn badges — including <strong style={{ color: 'var(--orange)' }}>OG Member</strong>, gone forever after Jan 2027</p>
            <p>✦ Be part of the weirdest corner of the internet</p>
          </div>
        </div>
      </div>
    </>
  );
}
