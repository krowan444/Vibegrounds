import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import { REPORT_REASONS } from '../components/ReportButton';
import { timeAgo } from '../lib/format';
import { LOGO_FALLBACK, onThumbError } from '../lib/thumbnail';
import FeedbackInbox from '../components/FeedbackInbox';

const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'reports',  label: 'Reports',  icon: '🚩' },
  { id: 'feedback', label: 'Feedback', icon: '🐞' },
  { id: 'users',    label: 'Users',    icon: '👥' },
  { id: 'content',  label: 'Content',  icon: '🎨' },
  { id: 'shots',    label: 'Screenshots', icon: '🖼️' },
  { id: 'log',      label: 'Mod Log',  icon: '📜' },
];

const reasonLabel = (v) => REPORT_REASONS.find((r) => r.value === v)?.label || v;

// ── shared bits ──────────────────────────────────────────────
const btn = (bg, fg = '#000') => ({
  background: bg, color: fg, border: '2px solid rgba(0,0,0,0.4)',
  fontFamily: 'var(--font-pixel)', fontSize: '8px', padding: '5px 9px',
  cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap',
});

const cell = {
  padding: '7px 9px', fontFamily: 'var(--font-retro)', fontSize: '16px',
  borderBottom: '1px solid var(--border-dark)', verticalAlign: 'middle',
};

const th = {
  ...cell, fontFamily: 'var(--font-pixel)', fontSize: '8px',
  color: 'var(--orange)', textAlign: 'left', background: 'var(--bg-panel-header)',
  borderBottom: '2px solid var(--border-dark)',
};

function StatCard({ label, value, accent }) {
  return (
    <div style={{
      background: 'var(--bg-panel-alt)', border: '2px solid var(--border-panel)',
      padding: '12px', minWidth: '130px', flex: '1 1 130px',
    }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--text-dim)' }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-pixel)', fontSize: '16px', marginTop: '8px',
        color: accent || 'var(--text-bright)',
      }}>
        {value}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
export default function AdminPage() {
  const { user, profile, isStaff, isAdmin, loading: authLoading } = useAuth();
  const [tab, setTab] = useState('overview');
  const [flash, setFlash] = useState('');
  const [error, setError] = useState('');

  const say = (msg) => { setFlash(msg); setError(''); setTimeout(() => setFlash(''), 4000); };
  const oops = (e) => { setError(e?.message || String(e)); setFlash(''); };

  if (authLoading) {
    return (
      <>
        <SiteHeader compact />
        <div className="profile-page">
          <div className="retro-panel">
            <div className="retro-panel-body" style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-retro)', fontSize: '20px', color: 'var(--orange)' }}>
              ⏳ Checking your credentials...
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!user || !isStaff) {
    return (
      <>
        <SiteHeader compact />
        <div className="profile-page">
          <div className="retro-panel">
            <div className="section-header"><h2>🚫 Restricted Area</h2></div>
            <div className="retro-panel-body" style={{ padding: '30px', textAlign: 'center', fontFamily: 'var(--font-retro)', fontSize: '19px', color: 'var(--text-secondary)' }}>
              <p>This is the moderator control room. Nothing to see here.</p>
              <p style={{ marginTop: '12px' }}>
                <Link to="/" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>← Back to the Portal</Link>
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
      <div className="profile-page" style={{ paddingBottom: '40px' }}>
        <div className="retro-panel">
          <div className="section-header">
            <h2>🛡️ Control Room — signed in as {profile?.username} ({profile?.role})</h2>
          </div>

          <div style={{ display: 'flex', gap: '2px', padding: '8px', background: 'var(--bg-panel-header)', flexWrap: 'wrap' }}>
            {TABS.map((t) => (
              <button
                key={t.id} type="button" onClick={() => setTab(t.id)}
                style={{
                  ...btn(tab === t.id ? 'var(--orange)' : 'transparent',
                         tab === t.id ? '#000' : 'var(--text-secondary)'),
                  border: tab === t.id ? '2px solid var(--orange-dim)' : '2px solid var(--border-dark)',
                  fontSize: '9px', padding: '7px 12px',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: '12px' }}>
            <Notice tone="success">{flash}</Notice>
            <Notice tone="error">{error}</Notice>

            {tab === 'overview' && <Overview onError={oops} />}
            {tab === 'reports'  && <Reports say={say} onError={oops} />}
            {tab === 'feedback' && <FeedbackInbox say={say} onError={oops} />}
            {tab === 'users'    && <Users say={say} onError={oops} isAdmin={isAdmin} />}
            {tab === 'content'  && <Content say={say} onError={oops} />}
            {tab === 'shots'    && <Screenshots say={say} onError={oops} />}
            {tab === 'log'      && <ModLog onError={oops} />}
          </div>
        </div>
      </div>
    </>
  );
}

// ── OVERVIEW ─────────────────────────────────────────────────
function Overview({ onError }) {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    (async () => {
      const [{ data: s, error: e1 }, { data: a, error: e2 }] = await Promise.all([
        supabase.rpc('admin_stats'),
        supabase.rpc('admin_recent_activity', { p_limit: 25 }),
      ]);
      if (e1) return onError(e1);
      if (e2) return onError(e2);
      setStats(s);
      setActivity(a || []);
    })();
  }, [onError]);

  if (!stats) {
    return <div style={{ fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--orange)' }}>⏳ Loading stats...</div>;
  }

  const money = (stats.revenue_pence / 100).toFixed(2);

  return (
    <>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <StatCard label="OPEN REPORTS" value={stats.reports_open} accent={stats.reports_open > 0 ? 'var(--red)' : 'var(--green)'} />
        <StatCard label="MEMBERS" value={stats.members_total} />
        <StatCard label="NEW THIS WEEK" value={stats.members_new_7d} accent="var(--green)" />
        <StatCard label="BANNED" value={stats.members_banned} accent="var(--red)" />
        <StatCard label="SUBMISSIONS" value={stats.creations_total} />
        <StatCard label="LAST 24H" value={stats.creations_new_24h} accent="var(--green)" />
        <StatCard label="VOTES CAST" value={stats.votes_total} />
        <StatCard label="COINS OUT THERE" value={`🪙 ${stats.coins_in_circulation}`} accent="var(--yellow)" />
        <StatCard label="REVENUE" value={`£${money}`} accent="var(--yellow)" />
      </div>

      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '10px', color: 'var(--orange)', margin: '18px 0 8px' }}>
        RECENT ACTIVITY
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {activity.map((row) => (
            <tr key={`${row.kind}-${row.id}`}>
              <td style={{ ...cell, width: '90px' }}>
                {row.kind === 'creation' ? '🎨' : row.kind === 'signup' ? '👋' : '🚩'} {row.kind}
              </td>
              <td style={cell}>{row.label}</td>
              <td style={{ ...cell, color: 'var(--blue-link)' }}>{row.actor}</td>
              <td style={{ ...cell, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                {new Date(row.created_at).toLocaleString('en-GB')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ── REPORTS ──────────────────────────────────────────────────
function Reports({ say, onError }) {
  const [status, setStatus] = useState('open');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_report_queue', { p_status: status, p_limit: 100 });
    if (error) return onError(error);
    setRows(data || []);
  }, [status, onError]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn) => {
    setBusy(true);
    try { await fn(); await load(); }
    catch (e) { onError(e); }
    finally { setBusy(false); }
  };

  const removeContent = (r) => act(async () => {
    if (r.target_type === 'creation') {
      const { error } = await supabase.rpc('admin_set_creation_status', {
        p_creation: r.target_id, p_status: 'removed', p_reason: reasonLabel(r.reason),
      });
      if (error) throw error;
    } else if (r.target_type !== 'profile') {
      const { error } = await supabase.rpc('admin_set_content_status', {
        p_type: r.target_type, p_id: r.target_id, p_status: 'removed', p_reason: reasonLabel(r.reason),
      });
      if (error) throw error;
    }
    const { error: e2 } = await supabase.rpc('admin_resolve_report', {
      p_report: r.report_id, p_status: 'actioned', p_note: 'Content removed',
    });
    if (e2) throw e2;
    say('Content removed and report closed.');
  });

  const banOwner = (r, days) => act(async () => {
    if (!r.owner_id) throw new Error('No account attached to this report.');
    const label = days ? `${days}-day ban` : 'Permanent ban';
    const { error } = await supabase.rpc('admin_ban_user', {
      p_user: r.owner_id, p_reason: reasonLabel(r.reason), p_days: days,
    });
    if (error) throw error;
    await supabase.rpc('admin_resolve_report', {
      p_report: r.report_id, p_status: 'actioned', p_note: label,
    });
    say(`${r.owner_name} banned. ${label}.`);
  });

  const purge = (r) => act(async () => {
    if (!r.owner_id) throw new Error('No account attached to this report.');
    if (!window.confirm(`Ban ${r.owner_name} permanently AND remove every post they have ever made?`)) return;
    const { error } = await supabase.rpc('admin_purge_user', {
      p_user: r.owner_id, p_reason: reasonLabel(r.reason),
    });
    if (error) throw error;
    await supabase.rpc('admin_resolve_report', {
      p_report: r.report_id, p_status: 'actioned', p_note: 'Account purged',
    });
    say(`${r.owner_name} purged — banned and all content removed.`);
  });

  const dismiss = (r) => act(async () => {
    const { error } = await supabase.rpc('admin_resolve_report', {
      p_report: r.report_id, p_status: 'dismissed', p_note: 'No action needed',
    });
    if (error) throw error;
    say('Report dismissed.');
  });

  return (
    <>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {['open', 'reviewing', 'actioned', 'dismissed', 'all'].map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)}
            style={btn(status === s ? 'var(--orange)' : 'transparent', status === s ? '#000' : 'var(--text-secondary)')}>
            {s}
          </button>
        ))}
        <button type="button" onClick={load} style={btn('transparent', 'var(--blue-link)')}>↻ refresh</button>
      </div>

      {rows.length === 0 && (
        <div style={{ fontFamily: 'var(--font-retro)', fontSize: '19px', color: 'var(--green)', padding: '24px', textAlign: 'center' }}>
          ✨ Nothing in the queue. The Grounds are peaceful.
        </div>
      )}

      {rows.map((r) => (
        <div key={r.report_id} style={{
          border: `2px solid ${r.status === 'open' ? 'var(--red)' : 'var(--border-panel)'}`,
          background: 'var(--bg-panel-alt)', padding: '12px', marginBottom: '10px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '9px', color: 'var(--red)' }}>
              {reasonLabel(r.reason).toUpperCase()}
              {r.duplicate_count > 1 && (
                <span style={{ color: 'var(--yellow)' }}> · ×{r.duplicate_count} REPORTS</span>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-retro)', fontSize: '15px', color: 'var(--text-dim)' }}>
              {new Date(r.created_at).toLocaleString('en-GB')} · status: {r.status}
            </div>
          </div>

          <div style={{ fontFamily: 'var(--font-retro)', fontSize: '17px', marginTop: '8px' }}>
            <div style={{ color: 'var(--text-dim)' }}>
              {r.target_type} by{' '}
              <Link to={`/profile/${r.owner_name}`} style={{ color: 'var(--blue-link)' }}>
                {r.owner_name || 'unknown'}
              </Link>
              {r.owner_strikes > 0 && (
                <span style={{ color: 'var(--red)' }}> · {r.owner_strikes} previous strike{r.owner_strikes > 1 ? 's' : ''}</span>
              )}
              {r.owner_banned && <span style={{ color: 'var(--red)' }}> · ALREADY BANNED</span>}
              {' · reported by '}
              <span style={{ color: 'var(--text-secondary)' }}>{r.reporter_name || 'deleted user'}</span>
            </div>

            {r.content_title && (
              <div style={{ color: 'var(--text-bright)', fontWeight: 'bold', marginTop: '6px' }}>
                {r.content_title}
              </div>
            )}
            {r.content_body && (
              <div style={{
                marginTop: '4px', padding: '8px', background: 'var(--bg-input)',
                border: '1px solid var(--border-dark)', color: 'var(--text-secondary)',
                maxHeight: '120px', overflow: 'auto', whiteSpace: 'pre-wrap',
              }}>
                {r.content_body}
              </div>
            )}
            {r.content_url && (
              <div style={{ marginTop: '4px', fontSize: '15px', color: 'var(--text-dim)', wordBreak: 'break-all' }}>
                🔗 {r.content_url}
              </div>
            )}
            {r.details && (
              <div style={{ marginTop: '6px', color: 'var(--yellow)' }}>
                Reporter says: “{r.details}”
              </div>
            )}
          </div>

          {r.status !== 'actioned' && r.status !== 'dismissed' && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
              {r.target_type === 'creation' && (
                <Link to={`/creation/${r.target_id}`} style={{ ...btn('transparent', 'var(--blue-link)'), textDecoration: 'none' }}>
                  👁 view
                </Link>
              )}
              <button type="button" disabled={busy} onClick={() => removeContent(r)} style={btn('var(--orange)')}>
                🗑 remove content
              </button>
              <button type="button" disabled={busy} onClick={() => banOwner(r, 7)} style={btn('#cc7722')}>
                ⏳ ban 7 days
              </button>
              <button type="button" disabled={busy} onClick={() => banOwner(r, null)} style={btn('var(--red)', '#fff')}>
                🔨 ban forever
              </button>
              <button type="button" disabled={busy} onClick={() => purge(r)} style={btn('#7a1111', '#fff')}>
                ☢ purge everything
              </button>
              <button type="button" disabled={busy} onClick={() => dismiss(r)} style={btn('transparent', 'var(--text-secondary)')}>
                ✓ no action
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

// ── USERS ────────────────────────────────────────────────────
function Users({ say, onError, isAdmin }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_users', {
      p_query: query.trim(), p_filter: filter, p_limit: 100, p_offset: 0,
    });
    if (error) return onError(error);
    setRows(data || []);
  }, [query, filter, onError]);

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn, msg) => {
    setBusy(true);
    try { const { error } = await fn(); if (error) throw error; say(msg); await load(); }
    catch (e) { onError(e); }
    finally { setBusy(false); }
  };

  const ban = (u) => {
    const reason = window.prompt(`Why are you banning ${u.username}?`, 'Breaking the community rules');
    if (reason === null) return;
    const days = window.prompt('Ban length in days? Leave blank for permanent.', '');
    if (days === null) return;
    act(
      () => supabase.rpc('admin_ban_user', {
        p_user: u.id, p_reason: reason, p_days: days.trim() ? Number(days) : null,
      }),
      `${u.username} banned.`,
    );
  };

  const grantCoins = (u) => {
    const amount = window.prompt(`Adjust ${u.username}'s coins by how much? (negative to take away)`, '50');
    if (!amount) return;
    const note = window.prompt('Note for the ledger:', 'Goodwill');
    act(
      () => supabase.rpc('admin_adjust_coins', { p_user: u.id, p_amount: Number(amount), p_note: note || '' }),
      `${u.username}'s balance adjusted.`,
    );
  };

  return (
    <>
      <form
        onSubmit={(e) => { e.preventDefault(); load(); }}
        style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}
      >
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search username or email..."
          style={{
            flex: '1 1 220px', padding: '6px 8px', background: 'var(--bg-input)',
            border: '2px solid var(--border-dark)', color: 'var(--text-primary)',
            fontFamily: 'var(--font-retro)', fontSize: '16px',
          }}
        />
        <button type="submit" style={btn('var(--orange)')}>search</button>
        {['all', 'banned', 'unverified', 'staff', 'new'].map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            style={btn(filter === f ? 'var(--orange)' : 'transparent', filter === f ? '#000' : 'var(--text-secondary)')}>
            {f}
          </button>
        ))}
      </form>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
          <thead>
            <tr>
              <th style={th}>User</th>
              <th style={th}>Email</th>
              <th style={th}>Joined</th>
              <th style={th}>Coins</th>
              <th style={th}>Posts</th>
              <th style={th}>Standing</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} style={u.is_banned ? { background: 'rgba(204,51,51,0.09)' } : undefined}>
                <td style={cell}>
                  <Link to={`/profile/${u.username}`} style={{ color: 'var(--blue-link)' }}>{u.username}</Link>
                  {u.role !== 'user' && (
                    <span style={{ color: 'var(--orange)', fontSize: '14px' }}> · {u.role}</span>
                  )}
                </td>
                <td style={{ ...cell, color: 'var(--text-dim)', fontSize: '15px' }}>
                  {u.email}{!u.email_verified && <span style={{ color: 'var(--red)' }}> (unverified)</span>}
                </td>
                <td style={{ ...cell, color: 'var(--text-dim)', fontSize: '15px', whiteSpace: 'nowrap' }}>
                  {new Date(u.created_at).toLocaleDateString('en-GB')}
                </td>
                <td style={{ ...cell, color: 'var(--yellow)' }}>🪙 {u.coins}</td>
                <td style={cell}>{u.submission_count}</td>
                <td style={cell}>
                  {u.is_banned
                    ? <span style={{ color: 'var(--red)' }}>BANNED{u.banned_until ? ` → ${new Date(u.banned_until).toLocaleDateString('en-GB')}` : ' (perm)'}</span>
                    : u.is_muted
                      ? <span style={{ color: 'var(--orange)' }}>muted</span>
                      : <span style={{ color: 'var(--green)' }}>ok</span>}
                  {u.strike_count > 0 && <span style={{ color: 'var(--text-dim)' }}> · {u.strike_count}⚡</span>}
                </td>
                <td style={cell}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {u.is_banned ? (
                      <button type="button" disabled={busy} style={btn('var(--green)')}
                        onClick={() => act(() => supabase.rpc('admin_unban_user', { p_user: u.id, p_note: 'Appeal accepted' }), `${u.username} unbanned.`)}>
                        unban
                      </button>
                    ) : (
                      <button type="button" disabled={busy} style={btn('var(--red)', '#fff')} onClick={() => ban(u)}>ban</button>
                    )}
                    <button type="button" disabled={busy} style={btn('transparent', 'var(--orange)')}
                      onClick={() => act(() => supabase.rpc('admin_set_mute', { p_user: u.id, p_muted: !u.is_muted, p_reason: '' }), `${u.username} ${u.is_muted ? 'unmuted' : 'muted'}.`)}>
                      {u.is_muted ? 'unmute' : 'mute'}
                    </button>
                    <button type="button" disabled={busy} style={btn('transparent', 'var(--yellow)')} onClick={() => grantCoins(u)}>
                      coins
                    </button>
                    {isAdmin && (
                      <>
                        <button type="button" disabled={busy} style={btn('transparent', 'var(--blue-link)')}
                          onClick={() => {
                            const role = window.prompt(`Role for ${u.username}: user, mod or admin`, u.role);
                            if (role) act(() => supabase.rpc('admin_set_role', { p_user: u.id, p_role: role }), `${u.username} is now ${role}.`);
                          }}>
                          role
                        </button>
                        <button type="button" disabled={busy} style={btn('#7a1111', '#fff')}
                          onClick={() => {
                            if (!window.confirm(`Purge ${u.username}? Permanent ban + every post removed.`)) return;
                            const reason = window.prompt('Reason:', 'Terms of service violation') || 'Terms of service violation';
                            act(() => supabase.rpc('admin_purge_user', { p_user: u.id, p_reason: reason }), `${u.username} purged.`);
                          }}>
                          purge
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── CONTENT ──────────────────────────────────────────────────
function Content({ say, onError }) {
  const [rows, setRows] = useState([]);
  const [showRemoved, setShowRemoved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('creations')
      .select('id,title,category,status,score,vote_count,view_count,created_at,project_url,is_featured,creator_id,profiles!creations_creator_id_fkey(username)')
      .eq('status', showRemoved ? 'removed' : 'published')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return onError(error);
    setRows(data || []);
  }, [showRemoved, onError]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, msg) => {
    setBusy(true);
    try { const { error } = await fn(); if (error) throw error; say(msg); await load(); }
    catch (e) { onError(e); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        <button type="button" onClick={() => setShowRemoved(false)}
          style={btn(!showRemoved ? 'var(--orange)' : 'transparent', !showRemoved ? '#000' : 'var(--text-secondary)')}>
          published
        </button>
        <button type="button" onClick={() => setShowRemoved(true)}
          style={btn(showRemoved ? 'var(--orange)' : 'transparent', showRemoved ? '#000' : 'var(--text-secondary)')}>
          removed
        </button>
        <button type="button" onClick={load} style={btn('transparent', 'var(--blue-link)')}>↻ refresh</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
          <thead>
            <tr>
              <th style={th}>Title</th>
              <th style={th}>By</th>
              <th style={th}>Category</th>
              <th style={th}>Score</th>
              <th style={th}>Views</th>
              <th style={th}>Posted</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td style={cell}>
                  <Link to={`/creation/${c.id}`} style={{ color: 'var(--blue-link)' }}>{c.title}</Link>
                  {c.is_featured && <span style={{ color: 'var(--yellow)' }}> ★</span>}
                </td>
                <td style={cell}>{c.profiles?.username || '—'}</td>
                <td style={{ ...cell, color: 'var(--text-dim)' }}>{c.category}</td>
                <td style={{ ...cell, color: 'var(--orange)' }}>{Number(c.score).toFixed(2)} ({c.vote_count})</td>
                <td style={cell}>{c.view_count}</td>
                <td style={{ ...cell, color: 'var(--text-dim)', fontSize: '15px', whiteSpace: 'nowrap' }}>
                  {new Date(c.created_at).toLocaleDateString('en-GB')}
                </td>
                <td style={cell}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {showRemoved ? (
                      <button type="button" disabled={busy} style={btn('var(--green)')}
                        onClick={() => act(() => supabase.rpc('admin_set_creation_status', { p_creation: c.id, p_status: 'published', p_reason: '' }), 'Restored.')}>
                        restore
                      </button>
                    ) : (
                      <>
                        <button type="button" disabled={busy} style={btn('var(--red)', '#fff')}
                          onClick={() => {
                            const reason = window.prompt('Why is this being removed?', 'Breaks the community rules');
                            if (reason === null) return;
                            act(() => supabase.rpc('admin_set_creation_status', { p_creation: c.id, p_status: 'removed', p_reason: reason }), 'Removed.');
                          }}>
                          remove
                        </button>
                        <button type="button" disabled={busy} style={btn('transparent', 'var(--yellow)')}
                          onClick={() => act(() => supabase.rpc('admin_set_featured', { p_creation: c.id, p_featured: !c.is_featured }), c.is_featured ? 'Unfeatured.' : 'Featured!')}>
                          {c.is_featured ? 'unfeature' : 'feature'}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── SCREENSHOT APPROVALS ─────────────────────────────────────
/**
 * Members can upload their own screenshot instead of the automatic one,
 * but it does not go live until it has been looked at. This is that queue.
 *
 * The two images are shown side by side deliberately — the question is not
 * "is this image acceptable" in isolation, it is "is this a better picture
 * of the same thing", and you can only answer that by comparing.
 */
function Screenshots({ say, onError }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('pending_thumbnails').select('*');
    if (error) return onError(error);
    setRows(data || []);
  }, [onError]);

  useEffect(() => { load(); }, [load]);

  const decide = async (id, approve) => {
    const note = approve
      ? null
      : window.prompt('Reason for rejecting (shown to the poster, optional):') || null;
    setBusy(id);
    const { error } = await supabase.rpc('review_thumbnail', {
      p_creation: id, p_approve: approve, p_note: note,
    });
    setBusy(null);
    if (error) return onError(error);
    say(approve ? 'Screenshot approved and now live.' : 'Screenshot rejected.');
    load();
  };

  if (rows === null) return <div className="vg-loading">⏳ Loading...</div>;

  if (!rows.length) {
    return (
      <div className="vg-empty" style={{ padding: '30px', fontFamily: 'var(--font-retro)', fontSize: '17px' }}>
        Nothing waiting. Custom screenshots appear here when members upload them.
      </div>
    );
  }

  return (
    <div className="vg-shot-queue">
      {rows.map((r) => (
        <div key={r.id} className="vg-shot-item">
          <div className="vg-shot-item-head">
            <Link to={`/creation/${r.id}`} className="vg-shot-item-title">{r.title}</Link>
            <span className="vg-shot-item-by">
              by <Link to={`/profile/${r.creator_username}`}>{r.creator_username}</Link>
              {' · '}{timeAgo(r.submitted_at)}
            </span>
          </div>

          <div className="vg-shot-compare">
            <div>
              <div className="vg-shot-label">Currently showing</div>
              <img src={r.current_thumbnail || LOGO_FALLBACK} alt="" onError={onThumbError} />
            </div>
            <div>
              <div className="vg-shot-label vg-shot-label-new">Proposed</div>
              <img src={r.proposed_thumbnail} alt="" />
            </div>
          </div>

          <div className="vg-shot-buttons">
            <button
              type="button"
              onClick={() => decide(r.id, true)}
              disabled={busy === r.id}
              style={btn('#33cc33')}
            >
              ✔ Approve
            </button>
            <button
              type="button"
              onClick={() => decide(r.id, false)}
              disabled={busy === r.id}
              style={btn('#cc3333', '#fff')}
            >
              ✖ Reject
            </button>
            <a href={r.project_url} target="_blank" rel="noreferrer noopener" style={btn('#555', '#fff')}>
              Visit site
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── MOD LOG ──────────────────────────────────────────────────
function ModLog({ onError }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('moderation_actions')
        .select('*, profiles!moderation_actions_actor_id_fkey(username)')
        .order('created_at', { ascending: false })
        .limit(150);
      if (error) return onError(error);
      setRows(data || []);
    })();
  }, [onError]);

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={th}>When</th>
          <th style={th}>Who</th>
          <th style={th}>Action</th>
          <th style={th}>Target</th>
          <th style={th}>Reason</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id}>
            <td style={{ ...cell, color: 'var(--text-dim)', fontSize: '15px', whiteSpace: 'nowrap' }}>
              {new Date(a.created_at).toLocaleString('en-GB')}
            </td>
            <td style={{ ...cell, color: 'var(--blue-link)' }}>{a.profiles?.username || 'system'}</td>
            <td style={{ ...cell, color: 'var(--orange)' }}>{a.action}</td>
            <td style={{ ...cell, color: 'var(--text-dim)', fontSize: '15px' }}>{a.target_type}</td>
            <td style={cell}>{a.reason}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
