import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function UploadPage() {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'AI Tool',
    url: '',
    image: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('🚀 Your creation has been submitted to VibeGrounds! (Demo mode)');
  };

  return (
    <>
      <header className="site-header">
        <div className="site-header-top">
          <Link to="/" className="site-logo">
            <img src="/images/logo.png" alt="VibeGrounds" style={{ height: '50px' }} />
            <div className="site-logo-text" style={{ fontSize: '10px' }}>VIBEGROUNDS</div>
          </Link>
          <div className="site-auth-links">
            <Link to="/auth">SIGN IN</Link>
            <span style={{ color: '#666' }}>|</span>
            <Link to="/auth">JOIN VG!</Link>
          </div>
        </div>
        <nav className="site-nav">
          <Link to="/">Home</Link>
          <Link to="/">AI Tools</Link>
          <Link to="/">Games</Link>
          <Link to="/">Visualisers</Link>
          <Link to="/">Portal</Link>
        </nav>
      </header>

      <div className="upload-page">
        <div className="retro-panel">
          <div className="section-header">
            <h2>🚀 Upload Your Creation!</h2>
          </div>
          <form className="retro-panel-body" onSubmit={handleSubmit}>
            <div className="retro-form-group">
              <label>Project Title</label>
              <input
                type="text"
                placeholder="MY AWESOME AI THING"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div className="retro-form-group">
              <label>Description</label>
              <textarea
                placeholder="Tell the community about your creation..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />
            </div>

            <div className="retro-form-group">
              <label>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option>AI Tool</option>
                <option>Game</option>
                <option>Visualiser</option>
                <option>Experiment</option>
                <option>Creative Code</option>
                <option>Audio</option>
                <option>Other</option>
              </select>
            </div>

            <div className="retro-form-group">
              <label>Preview Image URL</label>
              <input
                type="url"
                placeholder="https://example.com/preview.png"
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
              />
            </div>

            <div className="retro-form-group">
              <label>Project URL / Embed Link</label>
              <input
                type="url"
                placeholder="https://your-project.com"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="retro-submit-btn">
              🎯 SUBMIT TO VIBEGROUNDS
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
