import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * "Rate five things today" — the habit a small site can actually build.
 *
 * Submissions need people with finished projects; ratings need nothing but a
 * few minutes, so this is the one daily loop that works when the site is new.
 * It also happens to be the thing creators most want: a real score instead of
 * a dash.
 *
 * Progress comes from rating_quest_status() rather than being counted in the
 * browser, so what the bar shows and what the server will pay out can never
 * drift apart.
 */
export default function RatingQuest() {
  const { user, canPost, refreshProfile } = useAuth();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justWon, setJustWon] = useState(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('rating_quest_status');
    if (!err && data) setStatus(data);
  }, []);

  useEffect(() => { if (user && canPost) load(); }, [user, canPost, load]);

  if (!user || !canPost || !status?.signed_in) return null;

  const { votes_today: done = 0, target = 5, reward = 5, claimed, claimable } = status;
  const pct = Math.min(100, Math.round((done / target) * 100));

  const claim = async () => {
    setBusy(true);
    setError('');
    try {
      const { data, error: err } = await supabase.rpc('claim_rating_quest');
      if (err) throw new Error(err.message);
      setJustWon(data?.awarded ?? reward);
      await Promise.all([refreshProfile(), load()]);
    } catch (e) {
      setError(e.message.replace(/^.*?:\s*/, ''));
    } finally {
      setBusy(false);
    }
  };

  if (claimed || justWon) {
    return (
      <div className="vg-quest vg-quest-done">
        <div className="vg-quest-text">
          {justWon
            ? <>🪙 <strong style={{ color: 'var(--yellow)' }}>+{justWon} coins</strong> for rating {target} today. Nice one.</>
            : <>✅ Today&#39;s rating bounty is claimed. Back tomorrow.</>}
        </div>
        <Link to="/portal" className="vg-quest-btn vg-quest-btn-quiet">RATE MORE ANYWAY</Link>
      </div>
    );
  }

  return (
    <div className="vg-quest">
      <div className="vg-quest-text">
        <div>
          ⭐ <strong style={{ color: 'var(--orange)' }}>Rate {target} submissions today</strong>
          {' '}for <strong style={{ color: 'var(--yellow)' }}>{reward} coins</strong>.
          {done === 0 && ' Unrated work is why people stop posting.'}
          {error && <span style={{ color: '#ff8888' }}> {error}</span>}
        </div>
        <div className="vg-quest-bar" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={target}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="vg-quest-count">{done} of {target} rated</div>
      </div>

      {claimable ? (
        <button type="button" className="vg-quest-btn" onClick={claim} disabled={busy}>
          {busy ? 'CLAIMING...' : `CLAIM ${reward} COINS`}
        </button>
      ) : (
        <Link to="/portal" className="vg-quest-btn">
          {done === 0 ? 'START RATING' : `${target - done} TO GO`}
        </Link>
      )}
    </div>
  );
}
