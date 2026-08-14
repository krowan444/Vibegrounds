import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, retryOnAbort, withTimeout } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import ShareBar from '../components/ShareBar';
import TagPicker from '../components/TagPicker';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/** Mirrors the storage bucket's own limits so people get a useful message
 *  rather than an opaque 400 from the API. The bucket is what actually
 *  enforces this — these checks are courtesy, not security. */
function checkFile(file) {
  if (!file) return 'Pick an image first.';
  if (!TYPES.includes(file.type)) return 'Images only — PNG, JPG, GIF or WEBP.';
  if (file.size > MAX_BYTES) {
    return `That is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`;
  }
  return null;
}

function translate(msg = '') {
  if (/EMAIL_NOT_VERIFIED/.test(msg)) return 'Confirm your email address first — check your inbox.';
  if (/ACCOUNT_BANNED/.test(msg))     return 'Your account is suspended.';
  if (/ACCOUNT_MUTED/.test(msg))      return 'Your account is muted, so you cannot post right now.';
  if (/ACCOUNT_TOO_NEW/.test(msg))    return 'Brand new accounts wait 10 minutes before posting. Nearly there.';
  if (/DAILY_LIMIT_REACHED/.test(msg))return 'That is 10 memes today — the daily limit. Back tomorrow.';
  if (/DUPLICATE_SUBMISSION/.test(msg))return 'You have already posted that exact image.';
  if (/INVALID_IMAGE/.test(msg))      return 'That image did not upload properly. Try again.';
  if (/TIMED_OUT/.test(msg))          return 'That took too long. Check the Memes page before reposting, so you do not end up with two.';
  return msg || 'Something went wrong. Try again.';
}

/**
 * Post a meme.
 *
 * Free and deliberately short: an image, a title, done. Every extra field
 * here is another reason for someone to give up, and the whole point of
 * memes on this site is to be the cheapest possible first submission.
 */
export default function PostMemePage() {
  const { user, canPost, emailVerified } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isNsfw, setIsNsfw] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  // Object URLs leak if you don't hand them back.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const take = (f) => {
    const problem = checkFile(f);
    if (problem) { setError(problem); return; }
    setError('');
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
    if (!title) setTitle(f.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 80));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const problem = checkFile(file);
    if (problem) { setError(problem); return; }
    if (title.trim().length < 2) { setError('Give it a title.'); return; }

    try {
      setBusy('Uploading the image...');

      // Namespaced by user id because the storage policy requires it —
      // the first folder segment must be your own uid.
      const ext = (file.name.match(/\.[a-z0-9]+$/i) || ['.png'])[0].toLowerCase();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

      const { error: upErr } = await withTimeout(
        supabase.storage.from('memes').upload(path, file, {
          cacheControl: '31536000',
          contentType: file.type,
          upsert: false,
        }),
        45000,
        'upload',
      );
      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase.storage.from('memes').getPublicUrl(path);
      const imageUrl = pub?.publicUrl;
      if (!imageUrl) throw new Error('Could not work out the image address.');

      setBusy('Posting...');
      const { data, error: rpcErr } = await withTimeout(
        retryOnAbort(() => supabase.rpc('submit_meme', {
          p_title: title.trim(),
          p_image_url: imageUrl,
          p_description: description.trim(),
          p_tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8),
          p_is_nsfw: isNsfw,
        })),
        25000,
      );

      if (rpcErr) {
        console.error('submit_meme failed:', rpcErr);
        throw new Error(translate(rpcErr.message));
      }

      setBusy('');
      setDone(Array.isArray(data) ? data[0] : data || {});
    } catch (e2) {
      console.error('meme post failed:', e2);
      setBusy('');
      setError(translate(e2.message));
    }
  };

  const gate = (heading, body) => (
    <>
      <SiteHeader compact />
      <div className="upload-page">
        <div className="retro-panel">
          <div className="section-header"><h2>{heading}</h2></div>
          <div className="vg-gate-body">{body}</div>
        </div>
      </div>
    </>
  );

  if (!user) {
    return gate('🔒 Sign In Required', (
      <>
        <p>You need an account to post a meme. It is free.</p>
        <Link to="/auth?mode=signup" className="retro-cta" style={{ marginTop: '14px' }}>JOIN VIBEGROUNDS</Link>
      </>
    ));
  }

  if (!emailVerified) {
    return gate('📧 Confirm Your Email', (
      <>
        <p>Check your inbox and click the link, then come back and post.</p>
        <Link to="/verify" className="retro-cta" style={{ marginTop: '14px' }}>RESEND THE LINK</Link>
      </>
    ));
  }

  if (!canPost) {
    return gate('🚫 Posting Unavailable', <p>Your account cannot post at the moment.</p>);
  }

  if (done) {
    return (
      <>
        <SiteHeader compact />
        <div className="upload-page">
          <div className="retro-panel">
            <div className="section-header"><h2>✅ Posted!</h2></div>
            <div className="vg-done">
              <div className="vg-done-tick">😂</div>
              <h3>{done.title}</h3>
              <p className="vg-done-sub">It is on the meme board now. Free — no coins spent.</p>
              {preview && <img src={preview} alt="" className="vg-done-shot" />}
              <ShareBar creation={done} compact />
              <div className="vg-done-actions">
                <Link to={`/creation/${done.id}`} className="retro-cta">VIEW IT</Link>
                <Link to="/memes" className="vg-done-alt">MEME BOARD</Link>
                <button
                  type="button"
                  className="vg-done-alt"
                  onClick={() => {
                    setDone(null); setFile(null);
                    if (preview) URL.revokeObjectURL(preview);
                    setPreview(''); setTitle(''); setDescription('');
                    setTags(''); setIsNsfw(false);
                  }}
                >
                  POST ANOTHER
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader compact />

      <div className="upload-page">
        <div className="retro-panel">
          <div className="section-header"><h2>😂 Post a Meme</h2></div>

          <form className="retro-panel-body" onSubmit={submit}>
            <Notice tone="error">{error}</Notice>

            <p className="vg-meme-intro">
              Free to post, no coins. Ten a day. Keep it yours or keep it fair use.
            </p>

            <div
              className={`vg-dropzone ${dragging ? 'is-over' : ''} ${preview ? 'has-image' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                take(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileRef.current?.click()}
            >
              {preview ? (
                <>
                  <img src={preview} alt="Your meme" className="vg-dropzone-preview" />
                  <span className="vg-dropzone-swap">Click to choose a different image</span>
                </>
              ) : (
                <>
                  <span className="vg-dropzone-icon">🖼️</span>
                  <strong>Drop an image here</strong>
                  <span className="vg-dropzone-sub">or click to pick one · PNG, JPG, GIF, WEBP · up to 5 MB</span>
                </>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept={TYPES.join(',')}
              hidden
              onChange={(e) => take(e.target.files?.[0])}
            />

            <div className="retro-form-group">
              <label>Title *</label>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                maxLength={80} required disabled={!!busy}
                placeholder="when the AI writes the tests too"
              />
            </div>

            <div className="retro-form-group">
              <label>Caption <span style={{ color: 'var(--text-dim)' }}>(optional)</span></label>
              <textarea
                value={description} onChange={(e) => setDescription(e.target.value)}
                maxLength={2000} rows={3} disabled={!!busy}
              />
            </div>

            <div className="retro-form-group">
              <label>Tags <span style={{ color: 'var(--text-dim)' }}>(comma separated, up to 8)</span></label>
              <input
                type="text" value={tags} onChange={(e) => setTags(e.target.value)}
                disabled={!!busy} placeholder="relatable, cursed, debugging"
              />
              {/* The board filters by tag now, so an untagged meme is harder to
                  find than a tagged one. Suggestions are the difference between
                  people tagging and people leaving the box empty. */}
              <TagPicker
                value={tags}
                onChange={setTags}
                category="memes"
                disabled={!!busy}
              />
            </div>

            <label className="vg-nsfw-check">
              <input
                type="checkbox" checked={isNsfw}
                onChange={(e) => setIsNsfw(e.target.checked)} disabled={!!busy}
              />
              <span>
                <strong>Mark as 18+</strong>
                <em>Blurred until clicked, and kept off the front page. Mark it if in doubt.</em>
              </span>
            </label>

            <button type="submit" className="retro-cta vg-meme-post" disabled={!!busy || !file}>
              {busy || '😂 POST IT — FREE'}
            </button>

            <p className="vg-edit-note">
              Posting something you did not make, or anything hateful, gets it removed.
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
