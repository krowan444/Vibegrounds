import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CreationCard, CATEGORY_ICONS } from '../components/CommunityWidgets';
import SiteHeader from '../components/SiteHeader';

const VALID_CATEGORIES = ['games', 'tools', 'art', 'experiments', 'websites', 'other'];

export default function CategoryPage() {
  const { category } = useParams();
  const [creations, setCreations] = useState([]);
  const [loading, setLoading] = useState(true);

  const isValid = VALID_CATEGORIES.includes(category);
  const icon = CATEGORY_ICONS[category] || '✨';
  const title = category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Unknown';

  useEffect(() => {
    if (!isValid) { setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('creations')
        .select('*, profiles(username)')
        .eq('category', category)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) setCreations(data);
      setLoading(false);
    };
    fetch();
  }, [category]);

  return (
    <>
      <SiteHeader compact />

      <div className="upload-page">
        <div className="retro-panel">
          <div className="section-header">
            <h2>{icon} {title}</h2>
            <div className="section-header-links">
              {VALID_CATEGORIES.map(c => (
                <span key={c}>
                  <Link
                    to={`/category/${c}`}
                    style={{ color: c === category ? 'var(--orange)' : undefined, fontWeight: c === category ? 'bold' : undefined }}
                  >
                    {CATEGORY_ICONS[c]} {c.charAt(0).toUpperCase() + c.slice(1)}
                  </Link>
                  {' '}
                </span>
              ))}
            </div>
          </div>

          {!isValid ? (
            <div className="retro-panel-body" style={{
              fontFamily: 'var(--font-retro)', fontSize: '18px', color: '#ff6666',
              textAlign: 'center', padding: '30px'
            }}>
              ⚠️ Unknown category. Try one of: {VALID_CATEGORIES.join(', ')}
            </div>
          ) : loading ? (
            <div className="retro-panel-body" style={{
              fontFamily: 'var(--font-retro)', fontSize: '20px', color: 'var(--orange)',
              textAlign: 'center', padding: '40px'
            }}>
              ⏳ Loading {title}...
            </div>
          ) : creations.length > 0 ? (
            <div className="creations-grid">
              {creations.map(c => <CreationCard key={c.id} creation={c} />)}
            </div>
          ) : (
            <div className="retro-panel-body" style={{
              fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-dim)',
              textAlign: 'center', padding: '30px'
            }}>
              No {title.toLowerCase()} creations yet. Be the first!{' '}
              <Link to="/upload" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>Upload one →</Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
