import { useEffect, useState, useCallback } from 'react';
import { supabase, describeError } from '../lib/supabase';
import { timeAgo } from '../lib/format';

/**
 * The feedback inbox.
 *
 * The button worth explaining is "Copy fix brief". A bug report is only
 * useful once it has been turned into something someone can act on, and
 * that means gathering the page, the browser, who hit it and what they
 * expected — which is exactly the tedious retyping that stops small
 * problems from ever getting fixed. This does it in one press, formatted so
 * it can be pasted straight into a conversation with whoever does the
 * fixing.
 */

const KIND = {
  bug:       { icon: '🐞', label: 'Broken' },
  confusing: { icon: '🤔', label: 'Confusing' },
  idea:      { icon: '💡', label: 'Idea' },
  other:     { icon: '💬', label: 'Other' },
};

const STATUS = [
  { id: 'new',     label: 'New' },
  { id: 'reading', label: 'Looking at it' },
  { id: 'done',    label: 'Done' },
  { id: 'wontfix', label: 'Not doing' },
];

function brief(f) {
  const lines = [
    `**${KIND[f.kind]?.label || f.kind}** reported ${timeAgo(f.created_at)}`,
    '',
    f.body,
    '',
    '---',
    `- Page: ${f.page_url || 'not recorded'}`,
    `- Browser: ${f.user_agent || 'not recorded'}`,
    `- From: ${f.reporter_username ? `@${f.reporter_username}` : 'not signed in'}`,
  ];
  if (f.contact_email) lines.push(`- Reply to: ${f.contact_email}`);
  lines.push(`- Reference: ${f.id}`);
  return lines.join('\n');
}

export default function FeedbackInbox({ say, onError }) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('feedback_inbox').select('*').order('created_at', { ascending: false }).limit(200);
    if (filter === 'open') q = q.in('status', ['new', 'reading']);
    else if (filter !== 'all') q = q.eq('status', filter);

    const { data, error } = await q;
    if (error) onError?.(describeError(error));
    setRows(data || []);
    setLoading(false);
  }, [filter, onError]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    const { error } = await supabase.rpc('set_feedback_status', { p_id: id, p_status: status });
    if (error) { onError?.(describeError(error)); return; }
    say?.(`Marked ${STATUS.find((s) => s.id === status)?.label.toLowerCase()}.`);
    load();
  };

  const copy = async (f) => {
    try {
      await navigator.clipboard.writeText(brief(f));
      setCopied(f.id);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      onError?.('The browser would not let me use the clipboard. Select the text and copy it by hand.');
    }
  };

  const counts = rows.reduce((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] || 0) + 1 }), {});

  return (
    <div>
      <div className="vg-fb-filters">
        {[
          ['open', 'Needs looking at'],
          ['done', 'Done'],
          ['wontfix', 'Not doing'],
          ['all', 'Everything'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`vg-tab ${filter === id ? 'is-active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label.toUpperCase()}
          </button>
        ))}
        <span className="vg-fb-tally">
          {loading ? 'loading...' : `${rows.length} shown`}
          {!loading && Object.keys(counts).length > 0 && (
            <> · {Object.entries(counts).map(([k, n]) => `${KIND[k]?.icon || ''}${n}`).join(' ')}</>
          )}
        </span>
      </div>

      {!loading && rows.length === 0 && (
        <div className="vg-rail-empty" style={{ padding: '24px' }}>
          Nothing here. Which is either very good news or nobody has found the
          link yet — it is in the footer of every page.
        </div>
      )}

      {rows.map((f) => (
        <div key={f.id} className={`vg-fb-item is-${f.status}`}>
          <div className="vg-fb-item-head">
            <span className="vg-fb-item-kind">
              {KIND[f.kind]?.icon} {KIND[f.kind]?.label || f.kind}
            </span>
            <span className="vg-fb-item-who">
              {f.reporter_username ? `@${f.reporter_username}` : 'not signed in'}
              {' · '}{timeAgo(f.created_at)}
            </span>
            <span className={`vg-fb-item-status is-${f.status}`}>
              {STATUS.find((s) => s.id === f.status)?.label || f.status}
            </span>
          </div>

          <div className="vg-prose vg-fb-item-body">{f.body}</div>

          <div className="vg-fb-item-facts">
            {f.page_url && <span>📄 {f.page_url}</span>}
            {f.user_agent && <span title={f.user_agent}>🖥 {f.user_agent.slice(0, 60)}…</span>}
            {f.contact_email && (
              <a href={`mailto:${f.contact_email}?subject=VibeGrounds`}>✉ {f.contact_email}</a>
            )}
          </div>

          {f.admin_note && <div className="vg-fb-item-note">Note: {f.admin_note}</div>}

          <div className="vg-fb-item-actions">
            <button type="button" onClick={() => copy(f)}>
              {copied === f.id ? '✓ Copied' : '📋 Copy fix brief'}
            </button>
            {STATUS.filter((s) => s.id !== f.status).map((s) => (
              <button key={s.id} type="button" onClick={() => setStatus(f.id, s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
