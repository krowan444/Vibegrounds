import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';

export default function EditProfilePage() {
  const { user, profile, updateProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', bio: '', avatar_url: '', website: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (profile) {
      setForm({
        username: profile.username || '',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url || '',
        website: profile.website || ''
      });
    }
  }, [profile]);

  // Redirect if not logged in
  if (!authLoading && !user) {
    return (
      <>
        <SiteHeader compact />
        <div className="auth-page">
          <div className="retro-panel">
            <div className="section-header">
              <h2>🔒 Sign In Required</h2>
            </div>
            <div className="retro-panel-body" style={{
              fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-secondary)',
              textAlign: 'center', padding: '30px'
            }}>
              <p>You need to be signed in to edit your profile.</p>
              <a href="/auth" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>Sign in here →</a>
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
    setSaving(true);

    try {
      // Basic validation
      if (!form.username.trim()) throw new Error('Username cannot be empty');
      if (form.username.length < 2) throw new Error('Username must be at least 2 characters');
      if (form.username.length > 30) throw new Error('Username cannot exceed 30 characters');
      if (form.bio.length > 300) throw new Error('Bio cannot exceed 300 characters');

      await updateProfile({
        username: form.username.trim(),
        bio: form.bio.trim(),
        avatar_url: form.avatar_url.trim(),
        website: form.website.trim()
      });

      setSuccess('✅ Profile updated! Looking fresh, viber!');
      // Redirect to profile after a brief pause
      setTimeout(() => navigate(`/profile/${encodeURIComponent(form.username.trim())}`), 1500);
    } catch (err) {
      if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
        setError('That username is already taken! Try another one.');
      } else {
        setError(err.message || 'Something went wrong. Try again!');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SiteHeader compact />

      <div className="upload-page">
        <div className="retro-panel">
          <div className="section-header">
            <h2>⚙️ Edit Your Profile</h2>
          </div>

          <form className="retro-panel-body" onSubmit={handleSubmit}>
            {error && (
              <div style={{
                background: '#331111', border: '2px solid #cc3333',
                padding: '8px 12px', marginBottom: '12px',
                fontFamily: 'var(--font-retro)', fontSize: '17px', color: '#ff6666'
              }}>
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div style={{
                background: '#113311', border: '2px solid #33cc33',
                padding: '8px 12px', marginBottom: '12px',
                fontFamily: 'var(--font-retro)', fontSize: '17px', color: '#66ff66'
              }}>
                {success}
              </div>
            )}

            <div className="retro-form-group">
              <label>Username</label>
              <input
                type="text"
                placeholder="CoolViber69"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                minLength={2}
                maxLength={30}
                disabled={saving}
              />
            </div>

            <div className="retro-form-group">
              <label>Bio</label>
              <textarea
                placeholder="Tell the community about yourself..."
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                maxLength={300}
                disabled={saving}
                style={{ minHeight: '80px' }}
              />
              <div style={{ fontFamily: 'var(--font-retro)', fontSize: '14px', color: 'var(--text-dim)', marginTop: '2px' }}>
                {form.bio.length}/300
              </div>
            </div>

            <div className="retro-form-group">
              <label>Avatar URL</label>
              <input
                type="url"
                placeholder="https://example.com/your-avatar.png"
                value={form.avatar_url}
                onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                disabled={saving}
              />
            </div>

            <div className="retro-form-group">
              <label>Website</label>
              <input
                type="url"
                placeholder="https://your-website.com"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                disabled={saving}
              />
            </div>

            <button
              type="submit"
              className="retro-submit-btn"
              disabled={saving}
              style={saving ? { opacity: 0.6, cursor: 'wait' } : undefined}
            >
              {saving ? '⏳ SAVING...' : '💾 SAVE PROFILE'}
            </button>
          </form>
        </div>

        <div className="retro-panel" style={{ marginTop: '16px' }}>
          <div className="section-header">
            <h2>💡 Tips</h2>
          </div>
          <div className="retro-panel-body" style={{
            fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--text-secondary)', lineHeight: '1.4'
          }}>
            <p><strong style={{ color: 'var(--orange)' }}>Username:</strong> This is your public identity on VibeGrounds</p>
            <p><strong style={{ color: 'var(--orange)' }}>Bio:</strong> A short description about yourself (max 300 chars)</p>
            <p><strong style={{ color: 'var(--orange)' }}>Avatar:</strong> Paste a URL to an image for your profile pic</p>
            <p><strong style={{ color: 'var(--orange)' }}>Website:</strong> Link to your portfolio or homepage</p>
          </div>
        </div>
      </div>
    </>
  );
}
