import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';

/**
 * Landing page for the confirmation link in the signup email.
 * By the time this renders the SDK has already exchanged the token,
 * so we just need to confirm state and hand over the free coins.
 */
export default function VerifyEmailPage() {
  const { user, profile, emailVerified, loading, refreshProfile, resendVerification } = useAuth();
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (emailVerified) refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailVerified]);

  const panel = (title, children) => (
    <>
      <SiteHeader compact />
      <div className="auth-page">
        <div className="retro-panel">
          <div className="section-header"><h2>{title}</h2></div>
          <div className="retro-panel-body" style={{ fontFamily: 'var(--font-retro)', fontSize: '19px', lineHeight: 1.5, padding: '24px' }}>
            {children}
          </div>
        </div>
      </div>
    </>
  );

  if (loading) {
    return panel('⏳ Verifying...', <p style={{ color: 'var(--orange)', textAlign: 'center' }}>Checking your link...</p>);
  }

  if (!user) {
    return panel('📬 Almost There', (
      <>
        <p>Your email link has been used — now sign in to finish up.</p>
        <p style={{ marginTop: '14px' }}>
          <Link to="/auth" className="retro-cta" style={{ display: 'inline-block' }}>🔑 SIGN IN</Link>
        </p>
      </>
    ));
  }

  if (!emailVerified) {
    return panel('📭 Not Verified Yet', (
      <>
        <Notice tone="warn">
          We haven&#39;t been able to confirm <strong>{user.email}</strong> yet.
        </Notice>
        <p style={{ color: 'var(--text-secondary)' }}>
          The link may have expired, or it was already used. Send yourself a fresh one:
        </p>
        <button
          type="button"
          className="retro-submit-btn"
          style={{ marginTop: '14px' }}
          onClick={async () => {
            setError('');
            try { await resendVerification(); setResent(true); }
            catch (err) { setError(err.message); }
          }}
        >
          ✉️ RESEND CONFIRMATION
        </button>
        {resent && <Notice tone="success" style={{ marginTop: '12px' }}>Sent — check your inbox.</Notice>}
        <Notice tone="error" style={{ marginTop: '12px', marginBottom: 0 }}>{error}</Notice>
      </>
    ));
  }

  return panel("🎉 You're In!", (
    <>
      <Notice tone="success">
        Email confirmed. Welcome to VibeGrounds, <strong>{profile?.username}</strong>.
      </Notice>

      <div style={{
        border: '2px solid var(--orange)', background: 'var(--bg-panel-alt)',
        padding: '16px', textAlign: 'center', margin: '16px 0',
      }}>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '11px', color: 'var(--text-secondary)' }}>
          YOUR WALLET
        </div>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '24px', color: 'var(--yellow)', margin: '10px 0' }}>
          🪙 {profile?.coins ?? 0}
        </div>
        <div style={{ fontSize: '17px', color: 'var(--text-secondary)' }}>
          That&#39;s {Math.floor((profile?.coins ?? 0) / 10)} submissions on the house.
        </div>
      </div>

      <p style={{ color: 'var(--text-secondary)' }}>
        You&#39;ve also picked up your first badges. Go and have a look.
      </p>

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
        <Link to="/upload" className="retro-cta">🚀 SUBMIT SOMETHING</Link>
        <Link to={`/profile/${profile?.username || ''}`} className="retro-cta">👾 MY PROFILE</Link>
      </div>
    </>
  ));
}
