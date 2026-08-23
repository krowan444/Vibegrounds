import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, retryOnAbort, withTimeout } from '../lib/supabase';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import ShareBar from '../components/ShareBar';
import TagPicker from '../components/TagPicker';

/** Normalise a URL: add https:// when the user leaves it off. */
export function normalizeUrl(raw) {
  const url = (raw || '').trim();
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Map the database's shouty error codes to something human. */
const SUBMIT_ERRORS = {
  EMAIL_NOT_VERIFIED:   'Confirm your email address before submitting. Check your inbox.',
  ACCOUNT_BANNED:       'Your account is suspended, so you cannot submit right now.',
  ACCOUNT_MUTED:        'Your account is muted. Contact a moderator if you think that is a mistake.',
  ACCOUNT_TOO_NEW:      'Brand new accounts wait 10 minutes before their first post. Grab a coffee.',
  DAILY_LIMIT_REACHED:  'You have hit today’s submission limit. Come back tomorrow.',
  INSUFFICIENT_COINS:   'Not enough Vibe Coins for this submission.',
  DUPLICATE_SUBMISSION: 'You have already posted that exact link.',
  INVALID_URL:          'That does not look like a working web address.',
};

function translate(message = '') {
  const key = Object.keys(SUBMIT_ERRORS).find((k) => message.includes(k));
  return key ? SUBMIT_ERRORS[key] : message;
}

const BLANK = {
  title: '', description: '', category: 'games',
  project_url: '', thumbnail_url: '', tags: '', is_nsfw: false, works_on: 'both',
};

// Mirrors the thumbnails bucket. The bucket is what actually enforces this;
// checking here just means a useful message instead of an opaque 400.
const COVER_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const COVER_MAX = 3 * 1024 * 1024;


export default function UploadPage() {
  const { user, profile, coins, emailVerified, canPost, refreshProfile } = useAuth();

  const [categories, setCategories] = useState([]);
  const [cost, setCost] = useState(10);
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  // Optional cover image. Held locally until the creation exists, because
  // submit_thumbnail needs an id to attach the approval request to — there is
  // nothing to approve against until the submission has been created.
  const coverRef = useRef(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [coverError, setCoverError] = useState('');
  const [coverSent, setCoverSent] = useState(false);

  useEffect(() => () => { if (coverPreview) URL.revokeObjectURL(coverPreview); }, [coverPreview]);

  const takeCover = (f) => {
    if (!f) return;
    if (!COVER_TYPES.includes(f.type)) { setCoverError('PNG, JPG or WEBP only.'); return; }
    if (f.size > COVER_MAX) {
      setCoverError(`That is ${(f.size / 1024 / 1024).toFixed(1)} MB. The limit is 3 MB.`);
      return;
    }
    setCoverError('');
    setCoverFile(f);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(URL.createObjectURL(f));
  };

  /*
   * Runs after the creation exists. Deliberately does not throw into the
   * submit flow: the submission has already succeeded and been paid for by
   * this point, so a failure here must not read as "your post failed". It
   * reports itself in the confirmation instead, where it can be retried.
   */
  const sendCover = async (creationId) => {
    if (!coverFile || !creationId) return;
    try {
      const ext = (coverFile.name.match(/\.[a-z0-9]+$/i) || ['.png'])[0].toLowerCase();
      const path = `${user.id}/${creationId}-${Date.now()}${ext}`;

      const { error: upErr } = await withTimeout(
        supabase.storage.from('thumbnails').upload(path, coverFile, {
          cacheControl: '31536000', contentType: coverFile.type, upsert: false,
        }),
        45000, 'coverUpload',
      );
      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase.storage.from('thumbnails').getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error('Could not work out the image address.');

      const { error: rpcErr } = await withTimeout(
        retryOnAbort(() => supabase.rpc('submit_thumbnail', {
          p_creation: creationId, p_url: pub.publicUrl,
        })),
        25000,
      );
      if (rpcErr) throw new Error(rpcErr.message);
      setCoverSent(true);
    } catch (e) {
      console.error('cover submit failed:', e);
      setCoverError('Your submission posted fine, but the image did not upload. You can add it from the edit page.');
    }
  };

  useEffect(() => {
    (async () => {
      const [{ data: cats }, { data: setting }] = await Promise.all([
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('site_settings').select('value').eq('key', 'submission_cost').maybeSingle(),
      ]);
      if (cats?.length) setCategories(cats);
      if (setting?.value != null) setCost(Number(setting.value));
    })();
  }, []);

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

  /*
   * The old flow redirected straight to the new creation page. That works when
   * everything is fast, but gives no moment of "yes, that worked" — and if the
   * redirect is slow, the user is left wondering whether anything happened at
   * all. An explicit confirmation costs one click and removes the doubt.
   */
  if (done) {
    return (
      <>
        <SiteHeader compact />
        <div className="upload-page">
          <div className="vg-posted">
            <div className="vg-posted-tick">✅</div>
            <h2>That&#39;s live on the Portal</h2>
            <p className="vg-posted-title">{done.title || form.title}</p>
            <p className="vg-posted-sub">
              It&#39;s published and can be rated right now — no approval queue, nothing
              pending. {cost} coins have come off your balance.
            </p>
            <p className="vg-posted-note">
              Your thumbnail is a live screenshot of your link, so it may show the
              VibeGrounds logo for a few minutes until it&#39;s generated. That&#39;s normal.
            </p>

            {coverFile && (
              <p className="vg-posted-note">
                {coverSent
                  ? '🖼️ Your cover image has been sent for approval. The screenshot stays up until a moderator approves it.'
                  : coverError
                    ? `⚠️ ${coverError}`
                    : '🖼️ Uploading your cover image...'}
              </p>
            )}

            {/* The best moment anyone will ever have for sharing this is right
                now, seconds after posting. Not buried on a page they might
                revisit later. */}
            {done.id && (
              <div className="vg-posted-share">
                <div className="vg-posted-share-head">
                  Tell someone — nobody can rate it if nobody sees it
                </div>
                <ShareBar creation={done} compact />
              </div>
            )}
            <div className="vg-posted-actions">
              {done.id && (
                <Link to={`/creation/${done.id}`} className="vg-posted-btn">
                  VIEW YOUR SUBMISSION
                </Link>
              )}
              <Link to="/portal" className="vg-posted-btn vg-posted-btn-quiet">
                BACK TO THE PORTAL
              </Link>
              <button
                type="button"
                className="vg-posted-btn vg-posted-btn-quiet"
                onClick={() => {
                  setDone(null); setForm(BLANK);
                  if (coverPreview) URL.revokeObjectURL(coverPreview);
                  setCoverFile(null); setCoverPreview('');
                  setCoverError(''); setCoverSent(false);
                }}
              >
                POST ANOTHER
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!user) {
    return gate('🔒 Sign In Required', (
      <>
        <p>You need an account to post to the Portal.</p>
        <p style={{ marginTop: '12px' }}>
          <Link to="/auth?mode=signup" className="retro-cta" style={{ display: 'inline-block' }}>
            🚀 JOIN — GET 50 FREE VIBE COINS
          </Link>
        </p>
      </>
    ));
  }

  if (!emailVerified) {
    return gate('📬 Confirm Your Email', (
      <>
        <p>One quick step before you can post.</p>
        <p style={{ marginTop: '8px' }}>Confirming your email keeps the trolls out and unlocks your 50 free Vibe Coins.</p>
        <p style={{ marginTop: '14px' }}>
          <Link to="/verify" className="retro-cta" style={{ display: 'inline-block' }}>✉️ RESEND THE LINK</Link>
        </p>
      </>
    ));
  }

  if (!canPost) {
    return gate('🚫 Posting Disabled', (
      <>
        <p>Your account cannot submit at the moment.</p>
        {profile?.ban_reason && <p style={{ marginTop: '8px', color: 'var(--red)' }}>Reason: {profile.ban_reason}</p>}
        <p style={{ marginTop: '12px', fontSize: '17px' }}>
          Think this is a mistake? Reply to your ban email and we will take another look.
        </p>
      </>
    ));
  }

  const broke = coins < cost;

  const handleSubmit = async (e) => {
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

      // A user reported the button spinning forever. The submission itself is
      // fine — it's the network call that can stall on a broken auth lock. So:
      // retry once on that specific failure, and hard-stop after 25s rather
      // than leaving someone staring at "SUBMITTING..." with no idea what
      // happened. An honest error beats an infinite spinner every time.
      const { data, error: rpcError } = await withTimeout(
        retryOnAbort(() => supabase.rpc('submit_creation', {
          p_title: form.title.trim(),
          p_description: form.description.trim(),
          p_category: form.category,
          p_project_url: url,
          p_thumbnail: normalizeUrl(form.thumbnail_url),
          p_tags: tags,
          p_is_nsfw: form.is_nsfw,
          p_works_on: form.works_on,
        })),
        25000,
      );

      if (rpcError) {
        // Keep the raw message in the console so a bug report is diagnosable.
        console.error('submit_creation failed:', rpcError);
        throw new Error(translate(rpcError.message));
      }

      const created = Array.isArray(data) ? data[0] : data;
      setDone(created || {});

      // Not awaited: the confirmation screen should not wait on an optional
      // extra. It reports itself when it lands.
      if (coverFile && created?.id) sendCover(created.id);

      // Deliberately NOT awaited. Refreshing the wallet is a nicety; blocking
      // the confirmation screen on it was how the original hang happened.
      Promise.resolve(refreshProfile()).catch(() => {});
    } catch (err) {
      console.error('submission error:', err);
      setError(
        err?.timedOut
          ? 'That took too long to respond. Your submission may still have gone through — '
            + 'check your profile before trying again, so you are not charged twice.'
          : (err.message || 'Something went wrong. Nothing was charged.'),
      );
    } finally {
      setLoading(false);
    }
  };

  const activeCategory = categories.find((c) => c.slug === form.category);

  return (
    <>
      <SiteHeader compact />

      <div className="upload-page">
        {/* Wallet strip — the cost is never a surprise */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '12px', flexWrap: 'wrap', padding: '10px 14px', marginBottom: '12px',
          background: 'var(--bg-panel-alt)', border: `2px solid ${broke ? 'var(--red)' : 'var(--orange)'}`,
        }}>
          <div style={{ fontFamily: 'var(--font-retro)', fontSize: '19px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Your balance: </span>
            <strong style={{ color: 'var(--yellow)' }}>🪙 {coins}</strong>
            <span style={{ color: 'var(--text-dim)' }}> · this submission costs </span>
            <strong style={{ color: 'var(--orange)' }}>{cost}</strong>
          </div>
          <Link to="/coins" style={{
            fontFamily: 'var(--font-pixel)', fontSize: '9px',
            background: broke ? 'var(--red)' : 'transparent',
            color: broke ? '#fff' : 'var(--orange)',
            border: '2px solid var(--orange-dim)', padding: '6px 12px', textDecoration: 'none',
          }}>
            {broke ? 'TOP UP NOW' : '+ GET MORE'}
          </Link>
        </div>

        <div className="retro-panel">
          <div className="section-header"><h2>🚀 Submit Your Creation</h2></div>

          <form className="retro-panel-body" onSubmit={handleSubmit}>
            <Notice tone="error">{error}</Notice>

            {broke && (
              <Notice tone="warn">
                You need {cost - coins} more coin{cost - coins === 1 ? '' : 's'} to post this.{' '}
                <Link to="/coins" style={{ color: 'var(--orange-bright)', fontWeight: 'bold' }}>Top up →</Link>
              </Notice>
            )}

            <div className="retro-form-group">
              <label>1. What did you make? *</label>
              <input
                type="text" placeholder="Neon Skate Simulator"
                value={form.title} onChange={set('title')}
                required maxLength={80} disabled={loading}
              />
              <div style={{ fontFamily: 'var(--font-retro)', fontSize: '14px', color: 'var(--text-dim)' }}>
                {form.title.length}/80
              </div>
            </div>

            <div className="retro-form-group">
              <label>2. Where can we try it? *</label>
              <input
                type="text" placeholder="my-cool-game.vercel.app"
                value={form.project_url} onChange={set('project_url')}
                required disabled={loading}
              />
              <div style={{ fontFamily: 'var(--font-retro)', fontSize: '14px', color: 'var(--text-dim)' }}>
                A live, working link. https:// is added for you. Make sure it loads for strangers.
              </div>
            </div>

            <div className="retro-form-group">
              <label>3. Which section? *</label>
              <select value={form.category} onChange={set('category')} disabled={loading}>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.icon} {c.name}</option>
                ))}
              </select>
              {activeCategory && (
                <div style={{ fontFamily: 'var(--font-retro)', fontSize: '14px', color: 'var(--text-dim)' }}>
                  {activeCategory.tagline}
                </div>
              )}
            </div>

            <div className="retro-form-group">
              <label>4. Tell people about it *</label>
              <textarea
                placeholder="What is it, what did you build it with, and what should people try first?"
                value={form.description} onChange={set('description')}
                required maxLength={2000} disabled={loading}
              />
              <div style={{ fontFamily: 'var(--font-retro)', fontSize: '14px', color: 'var(--text-dim)' }}>
                {form.description.length}/2000
              </div>
            </div>

            <div className="retro-form-group">
              <label>
                5. Cover image{' '}
                <span style={{ color: 'var(--text-dim)' }}>(optional)</span>
              </label>

              {/* Says what happens if you do nothing, first. Most people should
                  do nothing here, and the old wording made it sound like a
                  field you were supposed to fill in. */}
              <div className="vg-shot-explain">
                <strong>Leave this blank and we handle it.</strong> We take a live
                screenshot of your link automatically — it can take a few minutes
                to appear the first time.
              </div>

              <div
                className={`vg-dropzone ${coverPreview ? 'has-image' : ''}`}
                onClick={() => coverRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); takeCover(e.dataTransfer.files?.[0]); }}
              >
                {coverPreview ? (
                  <>
                    <img src={coverPreview} alt="Your cover" className="vg-dropzone-preview" />
                    <span className="vg-dropzone-swap">Click to choose a different image</span>
                  </>
                ) : (
                  <>
                    <span className="vg-dropzone-icon">🖼️</span>
                    <strong>Or upload your own image</strong>
                    <span className="vg-dropzone-sub">PNG, JPG or WEBP · up to 3 MB</span>
                  </>
                )}
              </div>

              <input
                ref={coverRef} type="file" accept={COVER_TYPES.join(',')} hidden
                onChange={(e) => takeCover(e.target.files?.[0])}
              />

              {coverError && <Notice tone="error">{coverError}</Notice>}

              {/* The honest bit. Better said here than discovered later when
                  their artwork does not appear. */}
              {coverFile && (
                <div className="vg-shot-explain vg-shot-explain-warn">
                  ⏳ <strong>This needs approving before it goes live.</strong> Your
                  submission posts straight away with the automatic screenshot, and
                  your image replaces it once a moderator has looked at it.
                </div>
              )}
            </div>

            <div className="retro-form-group">
              <label>6. Tags <span style={{ color: 'var(--text-dim)' }}>(optional)</span></label>
              <input
                type="text" placeholder="retro, pixel-art, multiplayer"
                value={form.tags} onChange={set('tags')} disabled={loading}
              />
              <div style={{ fontFamily: 'var(--font-retro)', fontSize: '14px', color: 'var(--text-dim)' }}>
                Comma separated, up to 12. Type your own, or tap the ones below.
              </div>
              <TagPicker
                value={form.tags}
                onChange={(tags) => setForm((f) => ({ ...f, tags }))}
                category={form.category}
                disabled={loading}
                sourceText={`${form.title} ${form.description}`}
              />
            </div>

            {/* Where it works. Asked here because the creator is the only
                person who knows, and because somebody who opens a
                keyboard-only thing on a phone does not leave a review saying
                so — they just leave, and the creator never finds out why
                nobody scored it. */}
            <div className="vg-works">
              <span className="vg-works-q">Where does it work?</span>
              <div className="vg-works-opts">
                {[
                  ['both', '💻 📱 Both', 'Works on a computer and on a phone'],
                  ['desktop', '💻 Computer', 'Needs a keyboard, a mouse, or a big screen'],
                  ['mobile', '📱 Phone', 'Built for a phone or a tablet'],
                ].map(([value, label, hint]) => (
                  <label
                    key={value}
                    title={hint}
                    className={`vg-works-opt ${form.works_on === value ? 'is-on' : ''}`}
                  >
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
                People filter by this, so it is worth getting right. Not sure? Leave it on Both.
              </span>
            </div>

            <label style={{
              display: 'flex', gap: '8px', alignItems: 'center',
              fontFamily: 'var(--font-retro)', fontSize: '17px',
              color: 'var(--text-secondary)', margin: '12px 0', cursor: 'pointer',
            }}>
              <input type="checkbox" checked={form.is_nsfw} onChange={set('is_nsfw')} disabled={loading} />
              <span>This contains mature content (flag it — do not make us find out)</span>
            </label>

            <button
              type="submit"
              className="retro-submit-btn"
              disabled={loading || broke}
              style={(loading || broke) ? { opacity: 0.5, cursor: broke ? 'not-allowed' : 'wait' } : undefined}
            >
              {loading ? '⏳ SUBMITTING...' : `🎯 SUBMIT — SPEND ${cost} COINS`}
            </button>

            <div style={{
              fontFamily: 'var(--font-retro)', fontSize: '15px',
              color: 'var(--text-dim)', textAlign: 'center', marginTop: '8px',
            }}>
              Vibe Coins are spent on submission and are not refunded if you delete the post.
            </div>
          </form>
        </div>

        <div className="retro-panel" style={{ marginTop: '16px' }}>
          <div className="section-header"><h2>📋 What Flies Here</h2></div>
          <div className="retro-panel-body" style={{
            fontFamily: 'var(--font-retro)', fontSize: '17px',
            color: 'var(--text-secondary)', lineHeight: 1.5,
          }}>
            <p><strong style={{ color: 'var(--green)' }}>✓</strong> Games, AI movies, software, sites, art, audio — anything you vibe-coded</p>
            <p><strong style={{ color: 'var(--green)' }}>✓</strong> Weird, experimental, gloriously unfinished stuff is actively encouraged</p>
            <p><strong style={{ color: 'var(--green)' }}>✓</strong> Prototypes and one-nighters count. Ship it.</p>
            <p style={{ marginTop: '8px' }}><strong style={{ color: 'var(--red)' }}>✕</strong> Hate speech, harassment or bigotry — instant permanent ban</p>
            <p><strong style={{ color: 'var(--red)' }}>✕</strong> Spam, malware, phishing or dead links</p>
            <p><strong style={{ color: 'var(--red)' }}>✕</strong> Passing off someone else&#39;s work as yours</p>
          </div>
        </div>
      </div>
    </>
  );
}
