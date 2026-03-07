import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { mockCreations } from '../data/mockCreations';
import SiteHeader from '../components/SiteHeader';

export default function ProfilePage() {
  const { username } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Check if this is the logged-in user's own profile
  const isOwnProfile = user && profile && user.id === profile.id;

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
      } else {
        setProfile(data);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [username]);

  // For now, still use mock creations (real creations table can be added later)
  const userCreations = mockCreations.filter(c => c.creator === username);

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
                <span className="profile-stat-value">{userCreations.length}</span> Uploads
              </span>
              <span>
                <span className="profile-stat-value">
                  {userCreations.reduce((sum, c) => sum + c.views, 0).toLocaleString()}
                </span> Views
              </span>
              <span>
                <span className="profile-stat-value">
                  {userCreations.reduce((sum, c) => sum + c.votes, 0).toLocaleString()}
                </span> Votes
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
          {userCreations.length > 0 ? (
            <div className="creations-grid">
              {userCreations.map((creation) => (
                <Link
                  to={`/creation/${creation.id}`}
                  key={creation.id}
                  className="creation-card"
                >
                  <div
                    className="creation-thumb"
                    style={{ background: creation.color + '22', borderColor: creation.color }}
                  >
                    {creation.creatorAvatar}
                  </div>
                  <div className="creation-info">
                    <div className="creation-title">{creation.title}</div>
                    <div className="creation-desc">{creation.description}</div>
                    <div className="creation-meta">
                      <span>👍 {creation.votes.toLocaleString()}</span>
                      <span>👁 {creation.views.toLocaleString()}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="retro-panel-body" style={{
              fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-dim)',
              textAlign: 'center', padding: '30px'
            }}>
              No creations yet. This creator hasn't uploaded anything... yet! 🔜
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
            {userCreations.length > 0 && <span title="First Upload">🎖️ First Upload</span>}
            {userCreations.reduce((sum, c) => sum + c.views, 0) >= 1000 && <span title="1000 Views">👁 1K Views</span>}
          </div>
        </div>
      </div>
    </>
  );
}
