import { Link } from 'react-router-dom';

// Category emoji map
const CATEGORY_ICONS = {
  games: '🎮',
  tools: '🔧',
  art: '🎨',
  experiments: '🧪',
  websites: '🌐',
  other: '✨'
};

// OG Viber badge — shown for first 100 users
export function OGBadge({ small = false }) {
  return (
    <span
      title="OG Viber — One of the first 100 members!"
      style={{
        display: 'inline-block',
        background: 'linear-gradient(135deg, #e8a317, #ff6600)',
        color: '#000',
        fontFamily: 'var(--font-pixel, "Press Start 2P", monospace)',
        fontSize: small ? '8px' : '10px',
        padding: small ? '1px 4px' : '2px 6px',
        border: '1px solid #333',
        borderRadius: '2px',
        marginLeft: '4px',
        verticalAlign: 'middle',
        cursor: 'default',
        letterSpacing: '0.5px'
      }}
    >
      ⭐ OG
    </span>
  );
}

// Reusable creation card for feeds/grids
export function CreationCard({ creation, showCreator = true }) {
  const icon = CATEGORY_ICONS[creation.category] || '✨';
  const date = creation.created_at
    ? new Date(creation.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  return (
    <Link to={`/creation/${creation.id}`} className="creation-card">
      <div
        className="creation-thumb"
        style={{
          background: creation.thumbnail_url ? `url(${creation.thumbnail_url}) center/cover` : '#222',
          borderColor: '#555'
        }}
      >
        {!creation.thumbnail_url && <span style={{ fontSize: '36px' }}>{icon}</span>}
      </div>
      <div className="creation-info">
        <div className="creation-title">{creation.title}</div>
        <div className="creation-desc">
          {creation.description?.slice(0, 80)}{creation.description?.length > 80 ? '...' : ''}
        </div>
        <div className="creation-meta">
          <span>{icon} {creation.category}</span>
          {showCreator && creation.profiles?.username && (
            <span>by {creation.profiles.username}</span>
          )}
          {date && <span>{date}</span>}
        </div>
      </div>
    </Link>
  );
}

// Category label with icon
export function CategoryLabel({ category }) {
  const icon = CATEGORY_ICONS[category] || '✨';
  return (
    <Link
      to={`/category/${category}`}
      style={{
        color: 'var(--orange)',
        fontFamily: 'var(--font-retro)',
        textDecoration: 'none',
        fontSize: '16px'
      }}
    >
      {icon} {category.charAt(0).toUpperCase() + category.slice(1)}
    </Link>
  );
}

export { CATEGORY_ICONS };
