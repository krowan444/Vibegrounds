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
