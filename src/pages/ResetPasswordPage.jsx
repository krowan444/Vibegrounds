import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, validatePassword } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';

/**
 * Supabase drops the user here from the reset email with a recovery
 * token in the URL fragment. The SDK exchanges it for a temporary
 * session, which is what lets updateUser({ password }) work.
 */
export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && !cancelled) {
        setReady(true);
        setInvalid(false);
      }
    });

    // If the SDK already consumed the token before we subscribed,
    // an existing session is good enough to proceed.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data?.session) setReady(true);
      else setInvalid(true);
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const hint = password ? validatePassword(password) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match!'); return; }
    setLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const body = () => {
    if (done) {
      return (
        <div className="retro-panel-body" style={{ fontFamily: 'var(--font-retro)', fontSize: '19px', padding: '24px' }}>
          <Notice tone="success">Password changed. You&#39;re signed in — taking you home...</Notice>
          <Link to="/" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>🏠 Go to the homepage</Link>
        </div>
      );
    }

    if (invalid && !ready) {
      return (
        <div className="retro-panel-body" style={{ fontFamily: 'var(--font-retro)', fontSize: '19px', padding: '24px', lineHeight: 1.5 }}>
          <Notice tone="warn">This reset link is invalid or has expired.</Notice>
          <p style={{ color: 'var(--text-secondary)' }}>Reset links last one hour and can only be used once.</p>
          <p style={{ marginTop: '12px' }}>
            <Link to="/forgot-password" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>Request a fresh link →</Link>
          </p>
        </div>
      );
    }

    if (!ready) {
      return (
        <div className="retro-panel-body" style={{ fontFamily: 'var(--font-retro)', fontSize: '20px', color: 'var(--orange)', textAlign: 'center', padding: '40px' }}>
          ⏳ Checking your link...
        </div>
      );
    }

    return (
      <form className="auth-form" onSubmit={handleSubmit}>
        <Notice tone="error">{error}</Notice>
        <p style={{ fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Pick something new. Make it a good one this time.
        </p>

        <div className="retro-form-group">
          <label>New Password</label>
          <input
            type="password" autoComplete="new-password" placeholder="••••••••"
            value={password} onChange={(e) => setPassword(e.target.value)}
            required disabled={loading}
          />
          <div style={{
            fontFamily: 'var(--font-retro)', fontSize: '14px', marginTop: '2px',
            color: hint ? '#ff8888' : 'var(--text-dim)',
          }}>
            {hint || 'At least 8 characters, with a letter and a number.'}
          </div>
        </div>

        <div className="retro-form-group">
          <label>Confirm New Password</label>
          <input
            type="password" autoComplete="new-password" placeholder="••••••••"
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
            required disabled={loading}
          />
        </div>

        <button
          type="submit" className="retro-submit-btn" disabled={loading}
          style={loading ? { opacity: 0.6, cursor: 'wait' } : undefined}
        >
          {loading ? '⏳ SAVING...' : '🔒 SET NEW PASSWORD'}
        </button>
      </form>
    );
  };

  return (
    <>
      <SiteHeader compact />
      <div className="auth-page">
        <div className="retro-panel">
          <div className="section-header"><h2>🔑 Choose a New Password</h2></div>
          {body()}
        </div>
      </div>
    </>
  );
}
