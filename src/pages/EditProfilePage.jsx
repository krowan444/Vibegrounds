import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AVATARS, AVATAR_GROUPS, DEFAULT_AVATAR } from '../data/avatars';
import SiteHeader from '../components/SiteHeader';
import { normalizeUrl } from '../lib/url';

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
        avatar_url: profile.avatar_url || DEFAULT_AVATAR.path,
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
      if (!form.username.trim()) throw new Error('Username cannot be empty');
      if (form.username.length < 2) throw new Error('Username must be at least 2 characters');
      if (form.username.length > 30) throw new Error('Username cannot exceed 30 characters');
      if (form.bio.length > 300) throw new Error('Bio cannot exceed 300 characters');

      await updateProfile({
        username: form.username.trim(),
        bio: form.bio.trim(),
        avatar_url: form.avatar_url,
        // Typing "mysite.com" should save a working link, the same as it
        // does on the upload form. The database sanitises this again on
        // the way in — doing it here as well is so the field shows what
        // was actually saved rather than quietly differing from it.
        website: normalizeUrl(form.website)
      });

      setSuccess('✅ Profile updated! Looking fresh, viber!');
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

            {/* ── AVATAR PICKER ── */}
            <div className="retro-form-group">
              <label style={{ marginBottom: '8px', display: 'block' }}>Choose Your Avatar</label>

              {/* Current selection preview */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <img
                  src={form.avatar_url || DEFAULT_AVATAR.path}
                  alt="Current avatar"
                  style={{
                    width: '64px', height: '64px', borderRadius: '4px',
                    border: '3px solid var(--orange)', objectFit: 'cover'
                  }}
                />
                <div style={{ fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--text-secondary)' }}>
                  {AVATARS.find(a => a.path === form.avatar_url)?.name || 'Custom'} — Selected ✓
                </div>
              </div>

              {/* Avatar grid, in sections.
                  132 options in one undifferentiated grid is a wall, not a
                  choice - people scroll two rows and take whatever is nearest.
                  Headings turn it into "I want a dog" and a short scan. */}
              <div style={{
                maxHeight: '420px',
                overflowY: 'auto',
                padding: '8px',
                background: 'var(--bg-dark)',
                border: '2px solid var(--border-dark)',
                borderRadius: '2px'
              }}>
              {AVATAR_GROUPS.map(group => (
                <div key={group} style={{ marginBottom: '10px' }}>
                  <div style={{
                    fontFamily: 'var(--font-pixel)', fontSize: '7px',
                    color: 'var(--orange)', letterSpacing: '1px',
                    padding: '4px 2px 6px',
                    position: 'sticky', top: 0, background: 'var(--bg-dark)', zIndex: 1,
                  }}>
                    {group.toUpperCase()}
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(10, 1fr)',
                    gap: '6px',
                  }}>
                {AVATARS.filter(a => a.group === group).map(avatar => {
                  const isSelected = form.avatar_url === avatar.path;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => setForm({ ...form, avatar_url: avatar.path })}
                      title={avatar.name}
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        padding: '2px',
                        cursor: 'pointer',
                        border: isSelected ? '3px solid var(--orange)' : '2px solid var(--border-dark)',
                        borderRadius: '4px',
                        background: isSelected ? 'rgba(232,163,23,0.15)' : 'transparent',
                        outline: 'none',
                        transition: 'all 0.15s',
                        opacity: isSelected ? 1 : 0.8
                      }}
                    >
                      <img
                        src={avatar.path}
                        alt={avatar.name}
                        loading="lazy"
                        style={{
                          width: '100%', height: '100%', objectFit: 'cover',
                          borderRadius: '2px', display: 'block'
                        }}
                      />
                    </button>
                  );
                })}
                  </div>
                </div>
              ))}
              </div>
            </div>

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
            <p><strong style={{ color: 'var(--orange)' }}>Avatar:</strong> Click any character to select your profile picture</p>
            <p><strong style={{ color: 'var(--orange)' }}>Username:</strong> This is your public identity on VibeGrounds</p>
            <p><strong style={{ color: 'var(--orange)' }}>Bio:</strong> A short description about yourself (max 300 chars)</p>
            <p><strong style={{ color: 'var(--orange)' }}>Website:</strong> Link to your portfolio or homepage</p>
          </div>
        </div>
      </div>
    </>
  );
}
