import { useParams, Link } from 'react-router-dom';
import { mockCreations, featuredCreators } from '../data/mockCreations';
import SiteHeader from '../components/SiteHeader';

export default function ProfilePage() {
  const { username } = useParams();
  const creator = featuredCreators.find(c => c.username === username) || {
    username: username || 'Unknown',
    avatar: '👾',
    uploads: 0,
    views: 0
  };
  const userCreations = mockCreations.filter(c => c.creator === creator.username);

  return (
    <>
      <SiteHeader compact />

      <div className="profile-page">
        <div className="profile-header">
          <div className="profile-avatar">{creator.avatar}</div>
          <div className="profile-info">
            <h1>{creator.username}</h1>
            <div className="profile-bio">
              Vibe coder and AI enthusiast. Building weird stuff on the internet since forever.
              Fueled by creativity and caffeine. ☕
            </div>
            <div className="profile-stats">
              <span>
                <span className="profile-stat-value">{creator.uploads}</span> Uploads
              </span>
              <span>
                <span className="profile-stat-value">{creator.views.toLocaleString()}</span> Views
              </span>
              <span>
                <span className="profile-stat-value">{userCreations.reduce((sum, c) => sum + c.votes, 0).toLocaleString()}</span> Votes
              </span>
              <span>Member since <span className="profile-stat-value">2026</span></span>
            </div>
          </div>
        </div>

        <div className="retro-panel">
          <div className="section-header">
            <h2>🎨 Creations by {creator.username}</h2>
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
            <div className="retro-panel-body" style={{ fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-dim)', textAlign: 'center', padding: '30px' }}>
              No creations yet. This creator hasn't uploaded anything... yet! 🔜
            </div>
          )}
        </div>

        <div className="retro-panel" style={{ marginTop: '16px' }}>
          <div className="section-header">
            <h2>🏆 Achievements</h2>
          </div>
          <div className="retro-panel-body" style={{ fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-secondary)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span title="First Upload">🎖️ First Upload</span>
            <span title="Top 5 Creator">⭐ Top 5 Creator</span>
            <span title="1000 Views">👁 1K Views</span>
            <span title="Community Favorite">❤️ Community Fav</span>
            <span title="Beta Tester">🧪 Beta Tester</span>
          </div>
        </div>
      </div>
    </>
  );
}
