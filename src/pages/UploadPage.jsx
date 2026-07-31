import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';

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
  INSUFFICIENT_COINS:   'Not enough gold coins for this submission.',
  DUPLICATE_SUBMISSION: 'You have already posted that exact link.',
  INVALID_URL:          'That does not look like a working web address.',
};

function translate(message = '') {
  const key = Object.keys(SUBMIT_ERRORS).find((k) => message.includes(k));
  return key ? SUBMIT_ERRORS[key] : message;
}

const BLANK = {
  title: '', description: '', category: 'games',
  project_url: '', thumbnail_url: '', tags: '', is_nsfw: false,
};

export default function UploadPage() {
  const { user, profile, coins, emailVerified, canPost, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [cost, setCost] = useState(10);
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  if (!user) {
    return gate('🔒 Sign In Required', (
      <>
        <p>You need an account to post to the Portal.</p>
        <p style={{ marginTop: '12px' }}>
          <Link to="/auth?mode=signup" className="retro-cta" style={{ display: 'inline-block' }}>
            🚀 JOIN — GET 50 FREE COINS
          </Link>
        </p>
      </>
    ));
  }

  if (!emailVerified) {
    return gate('📬 Confirm Your Email', (
      <>
        <p>One quick step before you can post.</p>
        <p style={{ marginTop: '8px' }}>Confirming your email keeps the trolls out and unlocks your 50 free coins.</p>
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
        .split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8);

      const { data, error: rpcError } = await supabase.rpc('submit_creation', {
        p_title: form.title.trim(),
        p_description: form.description.trim(),
        p_category: form.category,
        p_project_url: url,
        p_thumbnail: normalizeUrl(form.thumbnail_url),
        p_tags: tags,
        p_is_nsfw: form.is_nsfw,
      });

      if (rpcError) throw new Error(translate(rpcError.message));

      await refreshProfile();
      const created = Array.isArray(data) ? data[0] : data;
      navigate(created?.id ? `/creation/${created.id}` : '/portal');
    } catch (err) {
      setError(err.message || 'Something went wrong.');
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
              <label>5. Thumbnail image URL <span style={{ color: 'var(--text-dim)' }}>(optional)</span></label>
              <input
                type="text" placeholder="link to a screenshot — makes a big difference"
                value={form.thumbnail_url} onChange={set('thumbnail_url')} disabled={loading}
              />
            </div>

            <div className="retro-form-group">
              <label>6. Tags <span style={{ color: 'var(--text-dim)' }}>(optional)</span></label>
              <input
                type="text" placeholder="retro, pixel-art, multiplayer"
                value={form.tags} onChange={set('tags')} disabled={loading}
              />
              <div style={{ fontFamily: 'var(--font-retro)', fontSize: '14px', color: 'var(--text-dim)' }}>
                Comma separated, up to 8.
              </div>
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
              Coins are spent on submission and are not refunded if you delete the post.
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
