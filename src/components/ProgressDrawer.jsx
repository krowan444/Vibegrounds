import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import LevelBar from './LevelBar';
import DailyCheckIn from './DailyCheckIn';
import RatingQuest from './RatingQuest';

/**
 * Your progress, in a drawer off the right-hand edge.
 *
 * These used to be two strips stacked at the top of the home page. They did
 * their job, but they pushed the actual content — the thing people came for —
 * below the fold, and they only existed on one page.
 *
 * Moving them behind a tab costs one click, and a claim prompt you have to
 * click is a claim prompt fewer people act on. Two things pay that back:
 *
 *   - it is on every page now, not just home, so the daily bonus is always
 *     one click away rather than "go back to the home page and scroll"
 *   - the tab carries a light when something is actually claimable, which is
 *     the bit that has to work. A silent drawer would quietly kill the daily
 *     loop, and nobody would notice for weeks.
 */
export default function ProgressDrawer() {
  const { user, profile, canPost, coins } = useAuth();
  const [open, setOpen] = useState(false);
  const [quest, setQuest] = useState(null);
  const [charting, setCharting] = useState([]);

  /**
   * "You're on the charts!" — moved here from the top of the home page.
   *
   * On the home page it could read the chart data the page had already
   * fetched. This drawer is on every page, so it has to ask for itself.
   * Three narrow queries filtered to this member rather than pulling the
   * charts down and filtering here: the answer is nearly always nought
   * rows, and asking the database "is this person on it" is a great deal
   * cheaper than fetching 210 rows to find out they are not.
   *
   * Only when the drawer is actually opened. This is good news, not an
   * alert — it does not need to cost every page load on the site.
   */
  const loadCharting = useCallback(async () => {
    if (!user) return;
    // A failed chart is simply a chart you are not on today. One of these
    // going down should never take the whole drawer with it.
    const mine = (label, q) =>
      q.then(({ data, error }) =>
        error ? [] : (data || []).map((c) => ({ ...c, chart: label })));

    const rows = (await Promise.all([
      mine('Daily',
        supabase.from('chart_daily').select('id,title,rank').eq('creator_id', user.id)),
      mine('Weekly',
        supabase.from('chart_weekly').select('id,title,rank').eq('creator_id', user.id)),
      // The home page only ever counted the top 100 as "on the all-time
      // chart", and the announcement should not start claiming #340.
      mine('All-Time',
        supabase.from('chart_alltime').select('id,title,rank').eq('creator_id', user.id).lte('rank', 100)),
    ])).flat();

    setCharting(rows.sort((a, b) => a.rank - b.rank));
  }, [user]);

  useEffect(() => { if (open) loadCharting(); }, [open, loadCharting]);

  // Same source of truth the quest widget uses, so the light on the tab and
  // the panel behind it can never disagree.
  const loadQuest = useCallback(async () => {
    if (!user || !canPost) return;
    const { data, error } = await supabase.rpc('rating_quest_status');
    if (!error && data) setQuest(data);
  }, [user, canPost]);

  useEffect(() => { loadQuest(); }, [loadQuest]);

  // Refresh when the drawer is opened, so a claim made in another tab does
  // not leave a stale light burning here.
  useEffect(() => { if (open) loadQuest(); }, [open, loadQuest]);

  // Escape closes it, like any other overlay.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!user || !canPost || !profile) return null;

  const last = profile.last_daily_claim ? new Date(profile.last_daily_claim) : null;
  const dailyReady = !last || Date.now() - last.getTime() > 20 * 60 * 60 * 1000;
  const questReady = !!quest?.claimable && !quest?.claimed;
  const waiting = (dailyReady ? 1 : 0) + (questReady ? 1 : 0);

  return (
    <>
      {/* The tab itself. Vertical text so it takes almost no width — the
          point of this exercise was to give the page its space back. */}
      <button
        type="button"
        className={`vg-drawer-tab ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="vg-progress-drawer"
        title={waiting ? `${waiting} thing${waiting > 1 ? 's' : ''} to claim` : 'Your progress'}
      >
        <span className="vg-drawer-tab-label">PROGRESS</span>
        {waiting > 0 && <span className="vg-drawer-pip" aria-label={`${waiting} to claim`} />}
      </button>

      {/* Click-catcher. Rendered only when open so it never eats clicks. */}
      {open && (
        <button
          type="button"
          className="vg-drawer-scrim"
          onClick={() => setOpen(false)}
          aria-label="Close progress panel"
          tabIndex={-1}
        />
      )}

      <aside
        id="vg-progress-drawer"
        className={`vg-drawer ${open ? 'is-open' : ''}`}
        aria-hidden={!open}
      >
        <div className="vg-drawer-head">
          <h2>📊 Your Progress</h2>
          <button type="button" className="vg-drawer-close" onClick={() => setOpen(false)} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="vg-drawer-body">
          {/* Above the balance, because it is the only thing in here that is
              news. Coins and level are the same numbers as last time; this
              is the one line that might have changed since you last looked,
              and burying good news under a wallet wastes it.

              Capped at two. The point is "something of yours is charting",
              and a member with eight entries does not need the drawer to
              become a chart of its own — that is what the profile is for. */}
          {charting.length > 0 && (
            <div className="vg-yours vg-drawer-yours">
              🎉 <strong style={{ color: 'var(--yellow)' }}>You&#39;re on the charts!</strong>{' '}
              {charting.slice(0, 2).map((c, i) => (
                <span key={`${c.chart}-${c.id}`}>
                  {i > 0 && ' · '}
                  <Link
                    to={`/creation/${c.id}`}
                    onClick={() => setOpen(false)}
                    style={{ color: 'var(--orange)', fontWeight: 'bold' }}
                  >
                    {c.title}
                  </Link>{' '}
                  is #{c.rank} on {c.chart}
                </span>
              ))}
              {charting.length > 2 && (
                <span style={{ color: 'var(--text-dim)' }}>
                  {' '}· and {charting.length - 2} more
                </span>
              )}
            </div>
          )}

          {/* Balance first: it is the number people open this for. */}
          <Link to="/coins" className="vg-drawer-coins">
            <span className="vg-drawer-coins-n">🪙 {coins}</span>
            <span className="vg-drawer-coins-label">Vibe Coins · top up →</span>
          </Link>

          <LevelBar profile={profile} />

          <div className="vg-drawer-sep">EARN MORE</div>

          {/* The originals, unchanged — they already handle their own claimed
              and not-ready states, so there is nothing to duplicate here. */}
          <DailyCheckIn />
          <RatingQuest />

          <div className="vg-drawer-foot">
            <Link to={`/profile/${profile.username}`} onClick={() => setOpen(false)}>
              Badges and full profile →
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
