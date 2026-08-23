import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase, retryOnAbort, withTimeout } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import TagPicker from '../components/TagPicker';
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

  // Custom screenshot, submitted for approval rather than applied directly.
  const shotRef = useRef(null);
  const [shotFile, setShotFile] = useState(null);
  const [shotPreview, setShotPreview] = useState('');
  const [shotBusy, setShotBusy] = useState('');
  const [shotError, setShotError] = useState('');
  const [shotDone, setShotDone] = useState(false);

  useEffect(() => () => { if (shotPreview) URL.revokeObjectURL(shotPreview); }, [shotPreview]);

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
        // 'unknown' is a real answer here, not a missing one: it means
        // nobody has said yet, which is true of everything posted before
        // the column existed. The form shows it as nothing selected.
        works_on: row.works_on || 'unknown',
        // Older rows pre-date the column, so treat a missing value as open.
        accepts_ideas: row.accepts_ideas !== false,
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

  const SHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  const SHOT_MAX = 3 * 1024 * 1024;

  const takeShot = (f) => {
    if (!f) return;
    if (!SHOT_TYPES.includes(f.type)) { setShotError('PNG, JPG or WEBP only.'); return; }
    if (f.size > SHOT_MAX) {
      setShotError(`That is ${(f.size / 1024 / 1024).toFixed(1)} MB. The limit is 3 MB.`);
      return;
    }
    setShotError('');
    setShotFile(f);
    if (shotPreview) URL.revokeObjectURL(shotPreview);
    setShotPreview(URL.createObjectURL(f));
  };

  const sendShot = async () => {
    if (!shotFile) return;
    setShotError('');
    try {
      setShotBusy('Uploading...');
      const ext = (shotFile.name.match(/\.[a-z0-9]+$/i) || ['.png'])[0].toLowerCase();
      const path = `${user.id}/${id}-${Date.now()}${ext}`;

      const { error: upErr } = await withTimeout(
        supabase.storage.from('thumbnails').upload(path, shotFile, {
          cacheControl: '31536000', contentType: shotFile.type, upsert: false,
        }),
        45000, 'thumbUpload',
      );
      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase.storage.from('thumbnails').getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error('Could not work out the image address.');

      setShotBusy('Submitting for approval...');
      const { error: rpcErr } = await withTimeout(
        retryOnAbort(() => supabase.rpc('submit_thumbnail', {
          p_creation: id,
          p_url: pub.publicUrl,
        })),
        25000,
      );
      if (rpcErr) {
        if (/ALREADY_PENDING/.test(rpcErr.message)) throw new Error('You already have an image waiting for review.');
        if (/NOT_YOURS/.test(rpcErr.message)) throw new Error('That is not your submission.');
        throw new Error(rpcErr.message);
      }

      setShotBusy('');
      setShotDone(true);
      setOriginal((o) => ({ ...o, pending_thumbnail_status: 'pending' }));
    } catch (e) {
      console.error('thumbnail submit failed:', e);
      setShotBusy('');
      setShotError(e.message || 'Could not send that for approval.');
    }
  };

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
        .split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 12);

      const { error: err } = await retryOnAbort(() => supabase
        .from('creations')
        .update({
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          project_url: url,
          // thumbnail_url is deliberately not written here. It is owned by
          // the approval flow now, and saving the form would push back
          // whatever was loaded when the page opened — silently undoing an
          // approval that landed in between.
          tags,
          is_nsfw: form.is_nsfw,
          // Same guard as accepts_ideas below: only written if the column
          // was actually on the row we loaded, so editing still works if
          // this deploys before its migration has run.
          ...(original && 'works_on' in original ? { works_on: form.works_on } : {}),
          // Only sent if the column actually exists on the row we loaded.
          // Writing a column that has not been migrated yet fails the whole
          // update, which would break editing entirely for anyone who
          // deployed this before running 19_ideas.sql. Deploy order should
          // not be able to break saving a typo.
          ...(original && 'accepts_ideas' in original
            ? { accepts_ideas: form.accepts_ideas }
            : {}),
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
                5. Cover image{' '}
                <span style={{ color: 'var(--text-dim)' }}>(optional — blank uses an automatic screenshot)</span>
              </label>

              {/* Uploads are reviewed before they go live. The auto-generated
                  screenshot keeps showing until then, so the card is never
                  blank while it waits. */}
              {original.pending_thumbnail_status === 'pending' || shotDone ? (
                <div className="vg-shot-state vg-shot-pending">
                  ⏳ <strong>Waiting for approval.</strong> Your image will
                  appear once it has been checked. The automatic one shows until then.
                </div>
              ) : (
                <>
                  {original.pending_thumbnail_status === 'rejected' && (
                    <div className="vg-shot-state vg-shot-rejected">
                      ✖ Your last image was not approved
                      {original.pending_thumbnail_note ? `: ${original.pending_thumbnail_note}` : '.'}
                      {' '}You can try another.
                    </div>
                  )}
                  {original.pending_thumbnail_status === 'approved' && (
                    <div className="vg-shot-state vg-shot-approved">
                      ✔ Your custom image is live.
                    </div>
                  )}

                  {shotError && <div className="vg-shot-state vg-shot-rejected">{shotError}</div>}

                  <div
                    className={`vg-dropzone ${shotPreview ? 'has-image' : ''}`}
                    onClick={() => shotRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); takeShot(e.dataTransfer.files?.[0]); }}
                  >
                    {shotPreview ? (
                      <>
                        <img src={shotPreview} alt="Your cover" className="vg-dropzone-preview" />
                        <span className="vg-dropzone-swap">Click to choose a different image</span>
                      </>
                    ) : (
                      <>
                        <span className="vg-dropzone-icon">🖼️</span>
                        <strong>Upload your own image</strong>
                        <span className="vg-dropzone-sub">PNG, JPG or WEBP · up to 3 MB · checked before it goes live</span>
                      </>
                    )}
                  </div>

                  <input
                    ref={shotRef} type="file" accept={SHOT_TYPES.join(',')} hidden
                    onChange={(e) => takeShot(e.target.files?.[0])}
                  />

                  {shotFile && (
                    <button
                      type="button"
                      className="retro-cta"
                      style={{ marginTop: '8px' }}
                      onClick={sendShot}
                      disabled={!!shotBusy}
                    >
                      {shotBusy || '📤 SEND FOR APPROVAL'}
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="retro-form-group">
              <label>6. Tags <span style={{ color: 'var(--text-dim)' }}>(comma separated, up to 12)</span></label>
              <input
                type="text" value={form.tags} onChange={set('tags')} disabled={loading}
              />
              <TagPicker
                value={form.tags}
                onChange={(tags) => setForm((f) => ({ ...f, tags }))}
                category={form.category}
                disabled={loading}
                sourceText={`${form.title} ${form.description}`}
              />
            </div>

            {/* Every creation posted before this existed says 'unknown',
                because inventing an answer on the creator's behalf would
                have filled the filter with claims nobody made. This is
                where the real answer gets added. */}
            <div className="vg-works">
              <span className="vg-works-q">Where does it work?</span>
              <div className="vg-works-opts">
                {[
                  ['both', '\ud83d\udcbb \ud83d\udcf1 Both'],
                  ['desktop', '\ud83d\udcbb Computer'],
                  ['mobile', '\ud83d\udcf1 Phone'],
                ].map(([value, label]) => (
                  <label key={value} className={`vg-works-opt ${form.works_on === value ? 'is-on' : ''}`}>
                    <input
                      type="radio" name="works_on" value={value}
                      checked={form.works_on === value}
                      onChange={set('works_on')} disabled={loading}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <span className="vg-works-note">
                {form.works_on === 'unknown'
                  ? 'Not set yet — people filtering for phone or computer will not see this.'
                  : 'People filter by this.'}
              </span>
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

            {/* Opt-out, not opt-in — but stated plainly, because being open to
                suggestions should be a choice you know you are making rather
                than something that happened to you.

                Hidden until the column exists, so this does not appear as a
                toggle that silently does nothing before the migration runs. */}
            {original && 'accepts_ideas' in original && (
            <div className="retro-form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={form.accepts_ideas} onChange={set('accepts_ideas')}
                  disabled={loading} style={{ width: 'auto' }}
                />
                💡 Open to ideas
              </label>
              <div className="vg-edit-hint">
                Lets people suggest improvements — and prompts you can paste
                straight into your AI — underneath your submission. You decide
                what gets marked Planned or Built. Untick to switch it off; any
                ideas already posted stay visible but nobody can add more.
              </div>
            </div>
            )}

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
