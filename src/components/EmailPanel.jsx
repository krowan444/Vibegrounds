import { useEffect, useState, useCallback } from 'react';
import { supabase, describeError } from '../lib/supabase';
import { timeAgo } from '../lib/format';

/**
 * The nudge controls.
 *
 * This exists so that turning on email to real people is a decision made
 * while looking at the actual list of who would receive it, rather than a
 * setting flipped in a database console with no idea what happens next.
 *
 * The dry run is the point. It works out exactly who qualifies, writes them
 * down, and sends nothing.
 */
export default function EmailPanel({ say, onError }) {
  const [due, setDue] = useState(null);
  const [log, setLog] = useState([]);
  const [settings, setSettings] = useState({});
  const [busy, setBusy] = useState(false);

  /**
   * One call, not three.
   *
   * This used to read the nudge_due view directly to get its count. That
   * view joins auth.users for the email address, and nobody — admin
   * included — may read auth.users, so every load failed with an empty
   * message that reached the screen as {"message":""}.
   *
   * nudge_status() is the fix and the better shape anyway: it is staff
   * gated, it returns the number and the settings, and it never returns an
   * address. The panel needs to know how many people, not who they are.
   */
  const load = useCallback(async () => {
    const [st, l] = await Promise.all([
      supabase.rpc('nudge_status'),
      supabase.from('email_log').select('*').order('created_at', { ascending: false }).limit(30),
    ]);

    if (st.error) onError?.(describeError(st.error));
    const s = Array.isArray(st.data) ? st.data[0] : st.data;
    setDue(s?.due ?? null);
    setSettings(s ? { nudge_enabled: s.enabled, nudge_dry_run: s.dry_run } : {});

    if (l.error) onError?.(describeError(l.error));
    setLog(l.data || []);
  }, [onError]);

  useEffect(() => { load(); }, [load]);

  const enabled = settings.nudge_enabled === true || settings.nudge_enabled === 'true';
  const dry = settings.nudge_dry_run === true || settings.nudge_dry_run === 'true';

  const setMode = async (on, dryRun) => {
    setBusy(true);
    const { error } = await supabase.rpc('set_nudge_mode', { p_enabled: on, p_dry: dryRun });
    if (error) onError?.(describeError(error));
    else say?.('Saved.');
    await load();
    setBusy(false);
  };

  const run = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('send_signup_nudges');
    if (error) onError?.(describeError(error));
    else {
      const r = Array.isArray(data) ? data[0] : data;
      say?.(`${r?.mode || 'ran'}: ${r?.considered ?? 0} considered, ${r?.sent ?? 0} sent.`);
    }
    await load();
    setBusy(false);
  };

  return (
    <div className="vg-email-panel">
      <div className="vg-email-state">
        <div>
          <span className="vg-email-num">{due === null ? '—' : due}</span>
          <span className="vg-email-cap">
            people joined over a week ago, confirmed their address, and have
            never posted anything
          </span>
        </div>
        <div className={`vg-email-mode ${enabled ? (dry ? 'is-dry' : 'is-live') : 'is-off'}`}>
          {!enabled ? 'OFF — nothing will be sent'
            : dry ? 'DRY RUN — works out who, sends nothing'
              : 'LIVE — real email to real people'}
        </div>
      </div>

      <div className="vg-email-actions">
        <button type="button" disabled={busy} onClick={() => setMode(true, true)}>
          Set to dry run
        </button>
        <button type="button" disabled={busy} onClick={run}>
          ▶ Run it now
        </button>
        <button type="button" disabled={busy} onClick={() => setMode(false, true)}>
          Turn off
        </button>
        <button
          type="button"
          className="vg-email-golive"
          disabled={busy}
          onClick={() => {
            // The only genuinely irreversible button on this screen. An
            // email that has been sent cannot be recalled, so this one asks.
            if (window.confirm(
              `Send real email to ${due ?? 'these'} people?\n\n`
              + 'Each person gets this once and it cannot be unsent. '
              + 'Run a dry run first and read the list below if you have not.',
            )) setMode(true, false);
          }}
        >
          Go live
        </button>
      </div>

      <p className="vg-email-note">
        Everyone gets this at most once — sending stamps the account, and the
        query skips anyone already stamped. Every message carries a one-click
        unsubscribe that works without signing in. It runs itself daily at
        10am UTC once it is on.
      </p>

      <div className="vg-email-log">
        <b>Last 30 entries</b>
        {log.length === 0 && <div className="vg-rail-empty">Nothing yet.</div>}
        {log.map((e) => (
          <div key={e.id} className="vg-email-row">
            <span className={`vg-email-tag ${e.dry_run ? 'is-dry' : 'is-live'}`}>
              {e.kind === 'setting' ? 'setting' : e.dry_run ? 'dry' : 'SENT'}
            </span>
            <span className="vg-email-to">{e.to_email || e.note}</span>
            <span className="vg-email-when">{timeAgo(e.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
