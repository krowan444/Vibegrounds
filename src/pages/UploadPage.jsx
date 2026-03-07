import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import SiteHeader from '../components/SiteHeader';

const CATEGORIES = ['games', 'tools', 'art', 'experiments', 'websites', 'other'];

export default function UploadPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'tools',
    project_url: '',
    thumbnail_url: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Must be logged in
  if (!user) {
    return (
      <>
        <SiteHeader compact />
        <div className="upload-page">
          <div className="retro-panel">
            <div className="section-header">
              <h2>🔒 Sign In Required</h2>
            </div>
            <div className="retro-panel-body" style={{
              fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-secondary)',
              textAlign: 'center', padding: '30px'
            }}>
              <p>You need to be signed in to upload creations.</p>
              <a href="/auth" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>Sign in here →</a>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Normalize a URL: auto-prepend https:// if missing
  const normalizeUrl = (raw) => {
    let url = raw.trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return url;
  };

  // Validate that a string is a proper URL after normalization
  const isValidUrl = (str) => {
    try {
      const u = new URL(str);
      return u.hostname.includes('.');
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!form.title.trim()) throw new Error('Title is required');

      // Normalize and validate project URL
      const normalizedProjectUrl = normalizeUrl(form.project_url);
      if (!normalizedProjectUrl || !isValidUrl(normalizedProjectUrl)) {
        throw new Error('Please enter a valid website address (e.g. customaihoodies.com)');
      }

      // Normalize thumbnail URL if provided
      const normalizedThumbUrl = form.thumbnail_url.trim()
        ? normalizeUrl(form.thumbnail_url)
        : '';

      const { error: insertError } = await supabase.from('creations').insert({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        project_url: normalizedProjectUrl,
        thumbnail_url: normalizedThumbUrl,
        creator_id: user.id
      });

      if (insertError) throw insertError;
      navigate('/');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SiteHeader compact />

      <div className="upload-page">
        <div className="retro-panel">
          <div className="section-header">
            <h2>🚀 Upload Your Creation!</h2>
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

            <div className="retro-form-group">
              <label>Project Title</label>
              <input
                type="text"
                placeholder="MY AWESOME AI THING"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="retro-form-group">
              <label>Description</label>
              <textarea
                placeholder="Tell the community about your creation..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="retro-form-group">
              <label>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                disabled={loading}
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="retro-form-group">
              <label>Preview Image URL</label>
              <input
                type="url"
                placeholder="https://example.com/preview.png"
                value={form.thumbnail_url}
                onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                disabled={loading}
              />
            </div>

            <div className="retro-form-group">
              <label>Project URL / Embed Link</label>
              <input
                type="text"
                placeholder="your-project.com"
                value={form.project_url}
                onChange={(e) => setForm({ ...form, project_url: e.target.value })}
                required
                disabled={loading}
              />
              <div style={{ fontFamily: 'var(--font-retro)', fontSize: '13px', color: 'var(--text-dim)', marginTop: '2px' }}>
                https:// will be added automatically if missing
              </div>
            </div>

            <button
              type="submit"
              className="retro-submit-btn"
              disabled={loading}
              style={loading ? { opacity: 0.6, cursor: 'wait' } : undefined}
            >
              {loading ? '⏳ SUBMITTING...' : '🎯 SUBMIT TO VIBEGROUNDS'}
            </button>
          </form>
        </div>

        <div className="retro-panel" style={{ marginTop: '16px' }}>
          <div className="section-header">
            <h2>📋 Submission Guidelines</h2>
          </div>
          <div className="retro-panel-body" style={{ fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            <p><strong style={{ color: 'var(--orange)' }}>✓</strong> AI-powered tools, games, visualisers, and experiments welcome</p>
            <p><strong style={{ color: 'var(--orange)' }}>✓</strong> Creative coding projects and demos</p>
            <p><strong style={{ color: 'var(--orange)' }}>✓</strong> Weird, experimental, and unfinished stuff is fine!</p>
            <p><strong style={{ color: 'var(--orange)' }}>✓</strong> Include a working link or embed</p>
            <p><strong style={{ color: 'var(--red)' }}>✕</strong> No spam, malware, or stolen content</p>
            <p><strong style={{ color: 'var(--red)' }}>✕</strong> No NSFW content (yet...)</p>
          </div>
        </div>
      </div>
    </>
  );
}
