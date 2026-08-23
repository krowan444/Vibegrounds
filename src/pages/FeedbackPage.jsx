import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase, retryOnAbort, withTimeout, describeError } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';

/**
 * Tell Kieran something is wrong.
 *
 * Deliberately open to people who are not signed in. Requiring an account
 * is the obvious way to keep spam out and it silently discards the single
 * most valuable message this site can receive — "I tried to join and it did
 * not work" — because the person who most needs to reach him is exactly the
 * one who cannot get an account. The database rate-limits instead.
 *
 * Two fields are filled in without asking: the page they came from and what
 * browser they are on. They are the two things that make a bug report
 * actionable and the two things nobody ever remembers to include. Both are
 * shown before sending rather than collected quietly.
 */

const KINDS = [
  { id: 'bug',       icon: '🐞', label: 'Something is broken', hint: 'It does not work, or it does the wrong thing' },
  { id: 'confusing', icon: '🤔', label: 'Something is confusing', hint: 'It works, but I could not tell how' },
  { id: 'idea',      icon: '💡', label: 'I have an idea',       hint: 'Something you could add' },
  { id: 'other',     icon: '💬', label: 'Something else',       hint: 'Anything that does not fit above' },
];

export default function FeedbackPage() {
  const { user, profile } = useAuth();
  const [params] = useSearchParams();

  const [kind, setKind] = useState(params.get('kind') === 'idea' ? 'idea' : 'bug');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  // Where they came from, if they arrived by the footer link on a page that
  // was misbehaving. document.referrer only carries same-origin here.
  const from = params.get('from') || '';
  const agent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  const send = async (e) => {
    e.preventDefault();
    if (body.trim().length < 10 || busy) return;
    setBusy(true);
    setError('');

    try {
      const { error: err } = await withTimeout(
        retryOnAbort(() => supabase.rpc('submit_feedback', {
          p_kind: kind,
          p_body: body.trim(),
          p_page: from,
          p_agent: agent,
          p_email: user ? '' : email.trim(),
        })),
        20000,
      );
      if (err) {
        throw new Error(
          err.message?.includes('RATE_LIMITED')
            ? 'That is a few messages in a short space of time. Give it an hour, or email kierandrowan@gmail.com if it is urgent.'
            : describeError(err),
        );
      }
      setSent(true);
    } catch (e2) {
      console.error('feedback failed:', e2);
      setError(describeError(e2));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <>
        <SiteHeader compact />
        <div className="vg-page">
          <div className="retro-panel">
            <div className="section-header"><h2>✅ Sent</h2></div>
            <div className="vg-empty">
              <p className="vg-prose" style={{ margin: '0 auto' }}>
                That has gone straight to Kieran — a real person, not a ticket
                queue. If it is something he can fix, it usually gets fixed.
              </p>
              <p style={{ marginTop: '14px' }}>
                <Link to="/" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>← Back to the site</Link>
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader compact />
      <div className="vg-page">
        <div className="retro-panel">
          <div className="section-header"><h2>🐞 Something not right?</h2></div>

          <div className="retro-panel-body">
            <p className="vg-prose vg-prose-soft" style={{ marginBottom: '14px' }}>
              This goes to one person who reads all of it. You do not need an
              account, and you do not need to know what caused it — &ldquo;the
              button did nothing&rdquo; is a genuinely useful bug report.
            </p>

            <Notice tone="error">{error}</Notice>

            <form onSubmit={send}>
              <div className="vg-fb-kinds">
                {KINDS.map((k) => (
                  <label
                    key={k.id}
                    className={`vg-fb-kind ${kind === k.id ? 'is-on' : ''}`}
                    title={k.hint}
                  >
                    <input
                      type="radio" name="kind" value={k.id}
                      checked={kind === k.id}
                      onChange={() => setKind(k.id)} disabled={busy}
                    />
                    <span className="vg-fb-kind-icon" aria-hidden="true">{k.icon}</span>
                    <span className="vg-fb-kind-label">{k.label}</span>
                  </label>
                ))}
              </div>

              <div className="retro-form-group">
                <label htmlFor="fb-body">What happened?</label>
                <textarea
                  id="fb-body"
                  className="vg-comic-input"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={4000}
                  rows={6}
                  disabled={busy}
                  placeholder={
                    kind === 'idea'
                      ? 'It would be good if...'
                      : 'I clicked X and expected Y, but Z happened instead.'
                  }
                />
                <div className="vg-fb-count">
                  {body.trim().length < 10
                    ? 'A sentence is plenty.'
                    : `${body.length} characters`}
                </div>
              </div>

              {!user && (
                <div className="retro-form-group">
                  <label htmlFor="fb-email">
                    Your email <span className="vg-comic-opt">optional — only if you want a reply</span>
                  </label>
                  <input
                    id="fb-email" type="email" className="vg-comic-input"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    maxLength={200} disabled={busy} placeholder="you@example.com"
                  />
                </div>
              )}

              {/* Said out loud rather than collected quietly. It is two lines
                  of detail that make a bug fixable, and nobody should have to
                  guess whether we took it. */}
              <div className="vg-fb-auto">
                <b>Sent with this, to help find it:</b>
                <ul>
                  <li>Your browser and device — <code>{agent.slice(0, 90) || 'unknown'}</code></li>
                  {from && <li>The page you came from — <code>{from}</code></li>}
                  <li>
                    {user
                      ? <>Your username — <code>{profile?.username || 'you'}</code></>
                      : 'Nothing that identifies you. No account, no name.'}
                  </li>
                </ul>
              </div>

              <div className="vg-comic-actions">
                <button
                  type="submit" className="retro-cta"
                  disabled={busy || body.trim().length < 10}
                >
                  {busy ? 'SENDING...' : '📨 SEND IT'}
                </button>
              </div>
            </form>

            <p className="vg-prose vg-prose-soft" style={{ marginTop: '16px', fontSize: '15px' }}>
              Would rather email? <a href="mailto:kierandrowan@gmail.com?subject=VibeGrounds">kierandrowan@gmail.com</a>.
              Reporting a person or a post instead? Use the ⚑ Report button on the thing itself —
              that goes to the moderators.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
