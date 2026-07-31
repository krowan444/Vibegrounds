import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Notice from '../components/Notice';

export const REPORT_REASONS = [
  { value: 'hate_speech',    label: 'Hate speech or slurs' },
  { value: 'harassment',     label: 'Harassment or targeted abuse' },
  { value: 'nsfw',           label: 'Sexual or adult content' },
  { value: 'spam',           label: 'Spam or advertising' },
  { value: 'malware',        label: 'Malware, scam or phishing link' },
  { value: 'stolen_content', label: "Stolen — this isn't their work" },
  { value: 'illegal',        label: 'Illegal content' },
  { value: 'broken_link',    label: "Broken link / doesn't load" },
  { value: 'other',          label: 'Something else' },
];

/**
 * Drop this next to any user-generated content.
 *   <ReportButton targetType="creation" targetId={c.id} />
 */
export default function ReportButton({ targetType, targetId, compact = false }) {
  const { user, canPost } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('hate_speech');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { error: err } = await supabase.from('reports').insert({
        reporter_id: user.id,
        target_type: targetType,
        target_id: targetId,
        reason,
        details: details.trim().slice(0, 1000),
      });
      if (err) {
        if (err.code === '23505') throw new Error("You've already reported this. We're on it.");
        throw new Error(err.message);
      }
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); setDetails(''); }, 2200);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      title="Report this to the moderators"
      style={{
        background: 'none',
        border: compact ? 'none' : '1px solid var(--border-dark)',
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-retro)',
        fontSize: compact ? '14px' : '15px',
        padding: compact ? '0 4px' : '2px 8px',
        cursor: 'pointer',
        borderRadius: '2px',
      }}
    >
      🚩 {compact ? '' : 'Report'}
    </button>
  );

  if (!open) return trigger;

  return (
    <div style={{ display: 'inline-block', position: 'relative' }}>
      {trigger}
      <div style={{
        position: 'absolute', right: 0, top: '100%', zIndex: 50, marginTop: '6px',
        width: '300px', background: 'var(--bg-panel)',
        border: '2px solid var(--orange)', boxShadow: '4px 4px 0 rgba(0,0,0,0.5)',
        padding: '12px', textAlign: 'left',
      }}>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '10px', color: 'var(--orange)', marginBottom: '10px' }}>
          REPORT THIS
        </div>

        {!user ? (
          <div style={{ fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--text-secondary)' }}>
            <Link to="/auth" style={{ color: 'var(--orange)' }}>Sign in</Link> to report content.
          </div>
        ) : !canPost ? (
          <div style={{ fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--text-secondary)' }}>
            Verify your email address before reporting.
          </div>
        ) : done ? (
          <Notice tone="success" style={{ marginBottom: 0 }}>
            Thanks — a moderator will take a look.
          </Notice>
        ) : (
          <form onSubmit={submit}>
            <Notice tone="error">{error}</Notice>

            <label style={{ fontFamily: 'var(--font-retro)', fontSize: '15px', color: 'var(--text-secondary)' }}>
              What&#39;s wrong?
            </label>
            <select
              value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy}
              style={{
                width: '100%', margin: '4px 0 10px', padding: '5px',
                background: 'var(--bg-input)', border: '2px solid var(--border-dark)',
                color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '16px',
              }}
            >
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            <textarea
              value={details} onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything else we should know? (optional)"
              maxLength={1000} disabled={busy}
              style={{
                width: '100%', minHeight: '60px', padding: '5px',
                background: 'var(--bg-input)', border: '2px solid var(--border-dark)',
                color: 'var(--text-primary)', fontFamily: 'var(--font-retro)',
                fontSize: '16px', resize: 'vertical',
              }}
            />

            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
              <button
                type="submit" disabled={busy}
                style={{
                  flex: 1, background: 'var(--red)', color: '#fff',
                  border: '2px solid #881111', fontFamily: 'var(--font-pixel)',
                  fontSize: '9px', padding: '7px', cursor: busy ? 'wait' : 'pointer',
                }}
              >
                {busy ? 'SENDING...' : 'SEND REPORT'}
              </button>
              <button
                type="button" onClick={() => setOpen(false)} disabled={busy}
                style={{
                  background: 'transparent', color: 'var(--text-dim)',
                  border: '2px solid var(--border-dark)', fontFamily: 'var(--font-pixel)',
                  fontSize: '9px', padding: '7px 12px', cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
