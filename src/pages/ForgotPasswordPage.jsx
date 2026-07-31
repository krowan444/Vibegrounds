import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email);
      // Always report success: never reveal whether an email is registered.
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SiteHeader compact />
      <div className="auth-page">
        <div className="retro-panel">
          <div className="section-header"><h2>🔐 Forgot Your Password?</h2></div>

          {sent ? (
            <div className="retro-panel-body" style={{ fontFamily: 'var(--font-retro)', fontSize: '19px', lineHeight: 1.5, padding: '24px' }}>
              <p>If an account exists for <strong style={{ color: 'var(--orange)' }}>{email}</strong>, a reset link is on its way.</p>
              <p style={{ marginTop: '10px', color: 'var(--text-secondary)' }}>
                The link is good for one hour. Check spam if it hasn&#39;t landed in a couple of minutes.
              </p>
              <p style={{ marginTop: '16px' }}>
                <Link to="/auth" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>← Back to sign in</Link>
              </p>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <Notice tone="error">{error}</Notice>
              <p style={{ fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Happens to everyone. Pop your email in and we&#39;ll send you a reset link.
              </p>

              <div className="retro-form-group">
                <label>Email</label>
                <input
                  type="email" autoComplete="email" placeholder="you@email.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  required disabled={loading}
                />
              </div>

              <button
                type="submit" className="retro-submit-btn" disabled={loading}
                style={loading ? { opacity: 0.6, cursor: 'wait' } : undefined}
              >
                {loading ? '⏳ SENDING...' : '📧 SEND RESET LINK'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <Link to="/auth" style={{ fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--blue-link)' }}>
                  ← Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
