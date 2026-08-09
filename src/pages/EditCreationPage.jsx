import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase, retryOnAbort } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import { normalizeUrl, isValidUrl } from './UploadPage';

/**
 * Edit a submission you already posted.
 *
 * A user pointed out the "edit" button on a creation went to their profile
 * page — because this screen didn't exist. Posting something and then being
 * unable to fix a typo in it is a bad enough experience to lose people over.
 *
 * On security: this writes to the table directly rather than through an RPC,
 * which is safe because two things already stand behind it. Row-level security
 * only permits `auth.uid() = creator_id`, so you cannot touch anyone else's
 * work. And the guard trigger reverts any change to score, vote counts,
 * status, is_featured, creator_id or coins_spent — so even a hand-crafted
 * request cannot promote its own submission or fake a score.
 */
export default function EditCreationPage() {
  const { id } = useParams();
  const { user, canPost } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: cats }, { data: rows, error: err }] = await Promise.all([
        retryOnAbort(() => supabase.from('categories').select('*').eq('is_active', true).order('sort_order')),
        retryOnAbort(() => supabase.from('creations').select('*').eq('id', id).limit(1)),
      ]);
      if (!alive) return;
      if (cats?.length) setCategories(cats);

      const row = rows?.[0];
      if (err || !row) {
        setError('Could not find that submission.');
        return;
      }
      setOriginal(row);
      setForm({
        title: row.title || '',
        description: row.description || '',
        category: row.category || 'other',
        project_url: row.project_url || '',
        thumbnail_url: row.thumbnail_url || '',
        tags: (row.tags || []).join(', '),
        is_nsfw: !!row.is_nsfw,
      });
    })().catch((e) => alive && setError(e?.message || 'Could not load that submission.'));
    return () => { alive = false; };
  }, [id]);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const gate = (title, body) => (
    <>
      <SiteHeader compact />
      <div className="upload-page">
        <div className="retro-panel">
          <div className="section-header"><h2>{title}</h2></div>
          <div className="retro-panel-body" style={{
            fontFamily: 'var(--font-retro)', fontSize: '19px',
            color: 'var(--text-secondary)', textAlign: 'center', padding: '30px', lineHeight: 1.5,
          }}>
            {body}
          </div>
        </div>
      </div>
    </>
  );

  if (!user) return gate('🔒 Sign In Required', <p>You need to be signed in to edit a submission.</p>);
  if (error && !form) return gate('😕 Not Found', <p>{error}</p>);
  if (!form || !original) {
    return (
      <>
        <SiteHeader compact />
        <div className="upload-page"><div className="vg-loading">⏳ Loading...</div></div>
      </>
    );
  }

  // Belt and braces — RLS enforces this too, but showing the form to someone
  // who cannot save it would just waste their time.
  if (original.creator_id !== user.id) {
    return gate('🚫 Not Yours', <p>You can only edit submissions you posted.</p>);
  }

  const save = async (e) => {
    e.preventDefault();
    setError('');

    const url = normalizeUrl(form.project_url);
    if (!isValidUrl(url)) {
      setError('Please enter a valid web address, e.g. my-cool-game.vercel.app');
      return;
    }
    if (form.title.trim().length < 2) {
      setError('Give your creation a title.');
      return;
    }

    setLoading(true);
    try {
      const tags = form.tags
        .split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8);

      const { error: err } = await retryOnAbort(() => supabase
        .from('creations')
        .update({
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          project_url: url,
          thumbnail_url: normalizeUrl(form.thumbnail_url),
          tags,
          is_nsfw: form.is_nsfw,
        })
        .eq('id', id)
        .eq('creator_id', user.id));

      if (err) throw new Error(err.message);
      setSaved(true);
      setLoading(false);
      setTimeout(() => navigate(`/creation/${id}`), 900);
    } catch (e2) {
      console.error('edit failed:', e2);
      setError(e2.message || 'Could not save those changes.');
      setLoading(false);
    }
  };

  return (
    <>
      <SiteHeader compact />

      <div className="upload-page">
        <div className="retro-panel">
          <div className="section-header"><h2>✏️ Edit Your Submission</h2></div>

          <form className="retro-panel-body" onSubmit={save}>
            <Notice tone="error">{error}</Notice>
            {saved && <Notice tone="success">Saved — taking you back to it...</Notice>}

            <div className="retro-form-group">
              <label>1. Title *</label>
              <input
                type="text" value={form.title} onChange={set('title')}
                maxLength={80} disabled={loading} required
              />
            </div>

            <div className="retro-form-group">
              <label>2. Link to it *</label>
              <input
                type="text" value={form.project_url} onChange={set('project_url')}
                disabled={loading} required
              />
              <div className="vg-edit-hint">
                Changing this changes the screenshot too — it may take a few
                minutes to regenerate.
              </div>
            </div>

            <div className="retro-form-group">
              <label>3. Category</label>
              <select value={form.category} onChange={set('category')} disabled={loading}>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            <div className="retro-form-group">
              <label>4. Tell people about it *</label>
              <textarea
                value={form.description} onChange={set('description')}
                required maxLength={2000} disabled={loading}
              />
              <div className="vg-edit-hint">{form.description.length}/2000</div>
            </div>

            <div className="retro-form-group">
              <label>
                5. Custom thumbnail{' '}
                <span style={{ color: 'var(--text-dim)' }}>(optional — blank uses a screenshot)</span>
              </label>
              <input
                type="text" value={form.thumbnail_url} onChange={set('thumbnail_url')}
                disabled={loading}
              />
            </div>

            <div className="retro-form-group">
              <label>6. Tags <span style={{ color: 'var(--text-dim)' }}>(comma separated, up to 8)</span></label>
              <input
                type="text" value={form.tags} onChange={set('tags')} disabled={loading}
              />
            </div>

            <div className="retro-form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={form.is_nsfw} onChange={set('is_nsfw')} disabled={loading}
                  style={{ width: 'auto' }}
                />
                Mark as 18+
              </label>
            </div>

            <div className="vg-edit-actions">
              <button type="submit" className="retro-cta" disabled={loading}>
                {loading ? 'SAVING...' : '💾 SAVE CHANGES'}
              </button>
              <Link to={`/creation/${id}`} className="vg-edit-cancel">CANCEL</Link>
            </div>

            <p className="vg-edit-note">
              Editing is free — no coins. Your score, votes and comments stay exactly as they are.
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
