import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { scoreColor } from '../lib/format';

const VOTE_ERRORS = {
  SELF_VOTE:          "You can't vote on your own work. Nice try.",
  EMAIL_NOT_VERIFIED: 'Confirm your email address before voting.',
  ACCOUNT_BANNED:     'Your account is suspended.',
};

const LABELS = ['Blam it', 'Poor', 'Meh', 'Decent', 'Great', 'Perfect'];

function translate(msg = '') {
  const key = Object.keys(VOTE_ERRORS).find((k) => msg.includes(k));
  return key ? VOTE_ERRORS[key] : msg;
}

/**
 * Newgrounds-style 0–5 voting. Shows the weighted score prominently,
 * because that number is the whole point of the Portal.
 */
export default function VoteWidget({ creation, onVoted }) {
  const { user, canPost } = useAuth();
  const [score, setScore] = useState(Number(creation.score) || 0);
  const [count, setCount] = useState(creation.vote_count || 0);
  const [mine, setMine] = useState(null);
  const [hover, setHover] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const isOwn = user && creation.creator_id === user.id;

  useEffect(() => {
    if (!user) { setMine(null); return; }
    let alive = true;
    supabase
      .from('votes')
      .select('value')
      .eq('creation_id', creation.id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (alive) setMine(data?.value ?? null); });
    return () => { alive = false; };
  }, [user, creation.id]);

  const submit = async (value) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: err } = await supabase.rpc('cast_vote', {
        p_creation: creation.id,
        p_value: value,
      });
      if (err) throw new Error(translate(err.message));
      setScore(Number(data.score));
      setCount(data.vote_count);
      setMine(value);
      setFlash(mine === null ? 'Vote counted!' : 'Vote updated');
      setTimeout(() => setFlash(''), 2500);
      onVoted?.(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const display = hover ?? mine;

  return (
    <div className="vote-widget">
      <div className="vote-score" style={{ color: scoreColor(score) }}>
        {score.toFixed(2)}
      </div>
      <div className="vote-score-meta">
        out of 5 · {count} vote{count === 1 ? '' : 's'}
      </div>

      {isOwn ? (
        <div className="vote-note">Your submission — sit back and watch.</div>
      ) : !user ? (
        <div className="vote-note">
          <Link to="/auth">Sign in</Link> to vote on this.
        </div>
      ) : !canPost ? (
        <div className="vote-note">Confirm your email to vote.</div>
      ) : (
        <>
          <div
            className="vote-stars"
            onMouseLeave={() => setHover(null)}
            role="radiogroup"
            aria-label="Rate this submission from 0 to 5"
          >
            {[0, 1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={mine === v}
                aria-label={`${v} — ${LABELS[v]}`}
                disabled={busy}
                onMouseEnter={() => setHover(v)}
                onFocus={() => setHover(v)}
                onClick={() => submit(v)}
                className={`vote-star ${display !== null && v <= display ? 'on' : ''} ${v === 0 ? 'zero' : ''}`}
              >
                {v === 0 ? '💀' : '★'}
              </button>
            ))}
          </div>

          <div className="vote-label">
            {display !== null
              ? `${display} — ${LABELS[display]}`
              : mine !== null ? `You voted ${mine}` : 'Pick a score'}
          </div>
        </>
      )}

      {flash && <div className="vote-flash">{flash}</div>}
      {error && <div className="vote-error">{error}</div>}
    </div>
  );
}
