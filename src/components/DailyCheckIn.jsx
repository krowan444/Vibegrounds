import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * The retention loop. A fresh account earns 3 coins a day; an
 * established one on a streak earns several times that. Farming new
 * accounts for the 50-coin signup bonus stops paying off quickly.
 */
export default function DailyCheckIn() {
  const { user, profile, canPost, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  if (!user || !canPost || !profile) return null;

  const last = profile.last_daily_claim ? new Date(profile.last_daily_claim) : null;
  const ready = !last || Date.now() - last.getTime() > 20 * 60 * 60 * 1000;
  const streak = profile.daily_streak || 0;

  if (!ready && !result) {
    return (
      <div className="vg-daily">
        <div className="vg-daily-text">
          ✅ Checked in today — <strong style={{ color: 'var(--orange)' }}>{streak} day streak</strong>.
          {streak > 1 && ' Keep it going, the bonus grows.'}
        </div>
        <button type="button" className="vg-daily-btn" disabled>COME BACK TOMORROW</button>
      </div>
    );
  }

  const claim = async () => {
    setBusy(true);
    setError('');
    try {
      const { data, error: err } = await supabase.rpc('claim_daily_bonus');
      if (err) throw new Error(err.message);
      if (!data?.claimed) {
        setError('Already claimed — come back tomorrow.');
      } else {
        setResult(data);
      }
      await refreshProfile();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="vg-daily">
        <div className="vg-daily-text">
          🪙 <strong style={{ color: 'var(--yellow)' }}>+{result.amount} coins</strong> — day{' '}
          <strong style={{ color: 'var(--orange)' }}>{result.streak}</strong> of your streak.
          {result.streak < 11 && ' The multiplier keeps climbing to day 11.'}
        </div>
        <button type="button" className="vg-daily-btn" disabled>CLAIMED</button>
      </div>
    );
  }

  return (
    <div className="vg-daily">
      <div className="vg-daily-text">
        🎁 Your daily coins are waiting.
        {streak > 0 && <> Current streak: <strong style={{ color: 'var(--orange)' }}>{streak}</strong>.</>}
        {error && <span style={{ color: '#ff8888' }}> {error}</span>}
      </div>
      <button type="button" className="vg-daily-btn" onClick={claim} disabled={busy}>
        {busy ? 'CLAIMING...' : 'CLAIM DAILY COINS'}
      </button>
    </div>
  );
}
