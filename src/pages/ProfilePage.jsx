import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORY_ICONS } from '../components/CommunityWidgets';
import { normalizeUrl, isValidUrl } from './UploadPage';
import SiteHeader from '../components/SiteHeader';

const CATEGORIES = ['games', 'tools', 'art', 'experiments', 'websites', 'other'];

export default function ProfilePage() {
  const { username } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [creations, setCreations] = useState([]);

  // Edit state for inline editing
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', project_url: '', category: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // Check if own profile — use auth user id, not username
  const isOwnProfile = !authLoading && user && profile && user.id === profile.id;

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setNotFound(false);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (error || !data) {
        setNotFound(true);
        setProfile(null);
        setCreations([]);
      } else {
        setProfile(data);

        // Fetch real creations for this profile
        const { data: creationData } = await supabase
          .from('creations')
          .select('*')
          .eq('creator_id', data.id)
          .order('created_at', { ascending: false });

        setCreations(creationData || []);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [username]);

  // Start editing a creation
  const startEdit = (creation) => {
    setEditForm({
      title: creation.title || '',
      description: creation.description || '',
      project_url: creation.project_url || '',
      category: creation.category || 'other'
    });
    setEditError('');
    setEditSuccess('');
    setEditingId(creation.id);
  };

  // Save edit
  const saveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');
    setEditLoading(true);

    try {
      if (!editForm.title.trim()) throw new Error('Title is required');

      const normalizedUrl = normalizeUrl(editForm.project_url);
      if (!normalizedUrl || !isValidUrl(normalizedUrl)) {
        throw new Error('Please enter a valid website address (e.g. customaihoodies.com)');
      }

      const { data, error: updateErr } = await supabase
        .from('creations')
        .update({
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          project_url: normalizedUrl,
          category: editForm.category
        })
        .eq('id', editingId)
        .eq('creator_id', user.id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Update in local state
      setCreations(prev => prev.map(c => c.id === editingId ? data : c));
      setEditSuccess('✅ Post updated successfully!');
      setTimeout(() => { setEditingId(null); setEditSuccess(''); }, 1500);
    } catch (err) {
      setEditError(err.message || 'Failed to save changes');
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <SiteHeader compact />
        <div className="profile-page">
          <div className="retro-panel">
            <div className="retro-panel-body" style={{
              fontFamily: 'var(--font-retro)', fontSize: '20px', color: 'var(--orange)',
              textAlign: 'center', padding: '40px'
            }}>
              ⏳ Loading profile...
            </div>
          </div>
        </div>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <SiteHeader compact />
        <div className="profile-page">
          <div className="retro-panel">
            <div className="section-header">
              <h2>👾 Profile Not Found</h2>
            </div>
            <div className="retro-panel-body" style={{
              fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-secondary)',
              textAlign: 'center', padding: '30px'
            }}>
              <p>User "<strong style={{ color: 'var(--orange)' }}>{username}</strong>" doesn't exist... yet!</p>
              <p style={{ marginTop: '12px' }}>
                <Link to="/auth" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>Join VibeGrounds</Link>
                {' '}and claim this username! 🚀
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const joinDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '2026';

  return (
    <>
      <SiteHeader compact />

      <div className="profile-page">
        <div className="profile-header">
          <div className="profile-avatar">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={profile.username} style={{ width: '80px', height: '80px', borderRadius: '4px', objectFit: 'cover' }} />
              : '👾'
            }
          </div>
          <div className="profile-info">
            <h1>{profile.username}</h1>
            <div className="profile-bio">
              {profile.bio || 'No bio yet. This creator is mysterious... 🕵️'}
            </div>
            {profile.website && (
              <div style={{ fontFamily: 'var(--font-retro)', fontSize: '16px', marginTop: '4px' }}>
                🌐 <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)' }}>
                  {profile.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            <div className="profile-stats">
              <span>
                <span className="profile-stat-value">{creations.length}</span> Uploads
              </span>
              <span>Member since <span className="profile-stat-value">{joinDate}</span></span>
            </div>
            {isOwnProfile && (
              <Link
                to="/edit-profile"
                style={{
                  display: 'inline-block', marginTop: '8px',
                  fontFamily: 'var(--font-pixel)', fontSize: '11px',
                  background: 'var(--orange)', color: '#000', padding: '4px 12px',
                  border: '2px solid #333', textDecoration: 'none'
                }}
              >
                ⚙️ EDIT PROFILE
              </Link>
            )}
          </div>
        </div>

        <div className="retro-panel">
          <div className="section-header">
            <h2>🎨 Creations by {profile.username}</h2>
          </div>
          {creations.length > 0 ? (
            <div>
              {creations.map((creation) => {
                const catIcon = CATEGORY_ICONS[creation.category] || '✨';
                const isEditingThis = editingId === creation.id;

                return (
                  <div key={creation.id} style={{ borderBottom: '1px solid var(--border-dark)' }}>
                    {/* Inline edit form */}
                    {isEditingThis && isOwnProfile ? (
                      <form onSubmit={saveEdit} style={{ padding: '12px' }}>
                        {editError && (
                          <div style={{ background: '#331111', border: '1px solid #cc3333', padding: '6px 10px', marginBottom: '8px', fontFamily: 'var(--font-retro)', fontSize: '16px', color: '#ff6666' }}>
                            ⚠️ {editError}
                          </div>
                        )}
                        {editSuccess && (
                          <div style={{ background: '#113311', border: '1px solid #33cc33', padding: '6px 10px', marginBottom: '8px', fontFamily: 'var(--font-retro)', fontSize: '16px', color: '#66ff66' }}>
                            {editSuccess}
                          </div>
                        )}
                        <div className="retro-form-group">
                          <label>Title</label>
                          <input type="text" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} required disabled={editLoading}
                            style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', border: '2px solid var(--border-dark)', color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '16px' }} />
                        </div>
                        <div className="retro-form-group" style={{ marginTop: '6px' }}>
                          <label>Description</label>
                          <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} disabled={editLoading}
                            style={{ width: '100%', minHeight: '60px', padding: '6px 8px', background: 'var(--bg-input)', border: '2px solid var(--border-dark)', color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '16px', resize: 'vertical' }} />
                        </div>
                        <div className="retro-form-group" style={{ marginTop: '6px' }}>
                          <label>Project URL</label>
                          <input type="text" value={editForm.project_url} onChange={e => setEditForm({ ...editForm, project_url: e.target.value })} required disabled={editLoading}
                            style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', border: '2px solid var(--border-dark)', color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '16px' }} />
                          <div style={{ fontFamily: 'var(--font-retro)', fontSize: '13px', color: 'var(--text-dim)', marginTop: '2px' }}>
                            https:// added automatically if missing
                          </div>
                        </div>
                        <div className="retro-form-group" style={{ marginTop: '6px' }}>
                          <label>Category</label>
                          <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} disabled={editLoading}
                            style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', border: '2px solid var(--border-dark)', color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '16px' }}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                          <button type="submit" disabled={editLoading} style={{ background: 'var(--orange)', color: '#000', border: '2px solid var(--orange-dim)', fontFamily: 'var(--font-pixel)', fontSize: '9px', padding: '6px 16px', cursor: editLoading ? 'wait' : 'pointer', textTransform: 'uppercase', fontWeight: 'bold', opacity: editLoading ? 0.6 : 1 }}>
                            {editLoading ? 'SAVING...' : '💾 SAVE'}
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} disabled={editLoading} style={{ background: 'transparent', color: 'var(--text-dim)', border: '2px solid var(--border-dark)', fontFamily: 'var(--font-pixel)', fontSize: '9px', padding: '6px 16px', cursor: 'pointer', textTransform: 'uppercase' }}>
                            CANCEL
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Normal creation row */
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px' }}>
                        <div style={{
                          width: '48px', height: '48px', flexShrink: 0,
                          background: 'var(--bg-dark)', border: '2px solid var(--border-dark)',
                          borderRadius: '4px', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '24px'
                        }}>
                          {catIcon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link to={`/creation/${creation.id}`} style={{
                            fontFamily: 'var(--font-retro)', fontSize: '17px',
                            color: 'var(--blue-link)', textDecoration: 'none', fontWeight: 'bold'
                          }}>
                            {creation.title}
                          </Link>
                          <div style={{ fontFamily: 'var(--font-retro)', fontSize: '14px', color: 'var(--text-dim)', marginTop: '2px' }}>
                            {catIcon} {creation.category || 'other'}
                            {creation.created_at && (
                              <> — {new Date(creation.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                            )}
                          </div>
                        </div>
                        {isOwnProfile && (
                          <button
                            onClick={() => startEdit(creation)}
                            style={{
                              background: 'none', border: '1px solid var(--border-dark)',
                              color: 'var(--orange)', fontFamily: 'var(--font-retro)', fontSize: '13px',
                              padding: '2px 8px', cursor: 'pointer', borderRadius: '2px', flexShrink: 0
                            }}
                          >
                            ✏️ Edit
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="retro-panel-body" style={{
              fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-dim)',
              textAlign: 'center', padding: '30px'
            }}>
              {isOwnProfile
                ? <>No creations yet. <Link to="/upload" style={{ color: 'var(--orange)' }}>Upload your first creation! 🚀</Link></>
                : "No creations yet. This creator hasn't uploaded anything... yet! 🔜"
              }
            </div>
          )}
        </div>

        <div className="retro-panel" style={{ marginTop: '16px' }}>
          <div className="section-header">
            <h2>🏆 Achievements</h2>
          </div>
          <div className="retro-panel-body" style={{
            fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-secondary)',
            display: 'flex', gap: '16px', flexWrap: 'wrap'
          }}>
            <span title="Beta Tester">🧪 Beta Tester</span>
            {creations.length > 0 && <span title="First Upload">🎖️ First Upload</span>}
            {creations.length >= 5 && <span title="5 Uploads">🔥 Prolific Creator</span>}
          </div>
        </div>
      </div>
    </>
  );
}
