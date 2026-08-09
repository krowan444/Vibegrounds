import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase, retryOnAbort } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import ReportButton from './ReportButton';
import Notice from './Notice';
import { timeAgo } from '../lib/format';

const REACTIONS = [
  { type: 'fire',   emoji: '🔥', label: 'Fire' },
  { type: 'like',   emoji: '👍', label: 'Like' },
  { type: 'clever', emoji: '🧠', label: 'Clever' },
  { type: 'funny',  emoji: '😂', label: 'Funny' },
  { type: 'cursed', emoji: '💀', label: 'Cursed' },
];

export default function ReviewSection({ creationId }) {
  const { user, profile, canPost, isStaff } = useAuth();

  const [reviews, setReviews] = useState([]);
  const [reactions, setReactions] = useState({});
  const [mine, setMine] = useState(new Set());
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [editBody, setEditBody] = useState('');

  const load = useCallback(async () => {
    // Both wrapped: an unwrapped query here could hang forever, and every
    // action below refreshes through this function. That is what left the
    // review button stuck on "POSTING..." after the review had already saved.
    const [r, re] = await Promise.all([
      retryOnAbort(() => supabase.from('reviews_public').select('*')
        .eq('creation_id', creationId).order('created_at', { ascending: false })),
      retryOnAbort(() => supabase.from('reactions').select('reaction_type, user_id')
        .eq('creation_id', creationId)),
    ]);

    setReviews(r.data || []);

    const tally = {};
    const own = new Set();
    (re.data || []).forEach((row) => {
      tally[row.reaction_type] = (tally[row.reaction_type] || 0) + 1;
      if (user && row.user_id === user.id) own.add(row.reaction_type);
    });
    setReactions(tally);
    setMine(own);
  }, [creationId, user]);

  useEffect(() => { load(); }, [load]);

  const toggleReaction = async (type) => {
    if (!canPost) return;
    const had = mine.has(type);

    // optimistic
    setMine((prev) => {
      const next = new Set(prev);
      had ? next.delete(type) : next.add(type);
      return next;
    });
    setReactions((prev) => ({ ...prev, [type]: Math.max(0, (prev[type] || 0) + (had ? -1 : 1)) }));

    if (had) {
      await supabase.from('reactions').delete()
        .eq('creation_id', creationId).eq('user_id', user.id).eq('reaction_type', type);
    } else {
      const { error: err } = await supabase.from('reactions')
        .insert({ creation_id: creationId, user_id: user.id, reaction_type: type });
      if (err) load(); // revert by reloading truth
    }
  };

  const post = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { error: err } = await retryOnAbort(() => supabase.from('reviews').insert({
        creation_id: creationId,
        author_id: user.id,
        body: body.trim(),
      }));
      if (err) throw new Error(err.message);
      setBody('');
      // Release the button first. Refreshing the list is a nicety — blocking
      // the button on it is what made a successful post look like a failure.
      setBusy(false);
      load().catch(() => {});
    } catch (e2) {
      setError(e2.message);
      setBusy(false);
    }
  };

  const saveEdit = async (id) => {
    setBusy(true);
    try {
      const { error: err } = await retryOnAbort(() => supabase.from('reviews')
        .update({ body: editBody.trim(), updated_at: new Date().toISOString() })
        .eq('id', id).eq('author_id', user.id));
      if (err) throw new Error(err.message);
      setEditing(null);
      setBusy(false);
      load().catch(() => {});
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await retryOnAbort(() => supabase.from('reviews').delete().eq('id', id));
    } catch (e) {
      setError(e.message || 'Could not delete that.');
    }
    load().catch(() => {});
  };

  return (
    <>
      {/* Reactions */}
      <div className="retro-panel" style={{ marginBottom: '14px' }}>
        <div className="section-header"><h2>⚡ Quick Reactions</h2></div>
        <div className="retro-panel-body" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {REACTIONS.map((r) => {
            const on = mine.has(r.type);
            return (
              <button
                key={r.type}
                type="button"
                onClick={() => toggleReaction(r.type)}
                disabled={!canPost}
                title={canPost ? r.label : 'Sign in and verify your email to react'}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: on ? 'rgba(232,163,23,.18)' : 'var(--bg-input)',
                  border: `2px solid ${on ? 'var(--orange)' : 'var(--border-dark)'}`,
                  color: 'var(--text-primary)', fontFamily: 'var(--font-retro)',
                  fontSize: '18px', padding: '5px 11px',
                  cursor: canPost ? 'pointer' : 'not-allowed',
                  opacity: canPost ? 1 : 0.6,
                }}
              >
                <span style={{ fontSize: '20px' }}>{r.emoji}</span>
                <span>{reactions[r.type] || 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Comments */}
      <div className="retro-panel">
        <div className="section-header">
          <h2>💬 Reviews ({reviews.length})</h2>
        </div>

        <div className="retro-panel-body">
          <Notice tone="error">{error}</Notice>

          {!user ? (
            <div style={{ fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-dim)' }}>
              <Link to="/auth" style={{ color: 'var(--orange)' }}>Sign in</Link> to leave a review.
            </div>
          ) : !canPost ? (
            <div style={{ fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-dim)' }}>
              Confirm your email address to leave reviews.
            </div>
          ) : (
            <form onSubmit={post}>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What did you think? Be honest, be useful, don't be a dick."
                maxLength={1000}
                disabled={busy}
                style={{
                  width: '100%', minHeight: '70px', padding: '8px',
                  background: 'var(--bg-input)', border: '2px solid var(--border-dark)',
                  color: 'var(--text-primary)', fontFamily: 'var(--font-retro)',
                  fontSize: '17px', resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <button
                  type="submit"
                  disabled={busy || !body.trim()}
                  style={{
                    background: 'var(--orange)', color: '#000',
                    border: '2px solid var(--orange-dim)', fontFamily: 'var(--font-pixel)',
                    fontSize: '9px', padding: '7px 14px',
                    cursor: busy ? 'wait' : 'pointer', opacity: body.trim() ? 1 : 0.5,
                  }}
                >
                  {busy ? 'POSTING...' : 'POST REVIEW'}
                </button>
                <span style={{ fontFamily: 'var(--font-retro)', fontSize: '14px', color: 'var(--text-dim)' }}>
                  {body.length}/1000
                </span>
                {/* The 80-character threshold is enforced server-side by the
                    reward_review trigger, so this bar mirrors it rather than
                    inventing its own rule. */}
                <span
                  style={{
                    fontFamily: 'var(--font-retro)', fontSize: '14px',
                    color: body.trim().length >= 80 ? '#66bb6a' : 'var(--text-dim)',
                  }}
                >
                  {body.trim().length >= 80
                    ? '🪙 earns 3 coins'
                    : `🪙 ${80 - body.trim().length} more characters to earn 3 coins`}
                </span>
              </div>
            </form>
          )}
        </div>

        {reviews.length === 0 ? (
          <div className="vg-empty" style={{ padding: '22px', fontSize: '17px' }}>
            No reviews yet. Be the first to say something.
          </div>
        ) : (
          reviews.map((r) => {
            const isAuthor = user && r.author_id === user.id;
            return (
              <div key={r.id} style={{ padding: '10px 12px', borderTop: '1px solid var(--border-dark)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {r.author_avatar
                    ? <img src={r.author_avatar} alt="" style={{ width: '22px', height: '22px', objectFit: 'cover', border: '1px solid var(--border-dark)' }} />
                    : <span>👾</span>}
                  <Link
                    to={`/profile/${r.author_username}`}
                    style={{ fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--blue-link)', fontWeight: 'bold' }}
                  >
                    {r.author_username}
                  </Link>
                  {r.author_role !== 'user' && (
                    <span style={{
                      fontFamily: 'var(--font-pixel)', fontSize: '6px', padding: '2px 4px',
                      background: 'var(--orange)', color: '#000',
                    }}>
                      {r.author_role.toUpperCase()}
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--font-retro)', fontSize: '14px', color: 'var(--text-dim)' }}>
                    {timeAgo(r.created_at)}
                  </span>

                  <span style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {isAuthor && editing !== r.id && (
                      <button
                        type="button"
                        onClick={() => { setEditing(r.id); setEditBody(r.body); }}
                        style={ghostBtn}
                      >
                        ✏️ edit
                      </button>
                    )}
                    {(isAuthor || isStaff) && (
                      <button type="button" onClick={() => remove(r.id)} style={ghostBtn}>
                        🗑 delete
                      </button>
                    )}
                    {!isAuthor && <ReportButton targetType="review" targetId={r.id} compact />}
                  </span>
                </div>

                {editing === r.id ? (
                  <div style={{ marginTop: '6px' }}>
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      maxLength={1000}
                      style={{
                        width: '100%', minHeight: '60px', padding: '7px',
                        background: 'var(--bg-input)', border: '2px solid var(--border-dark)',
                        color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '17px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '6px', marginTop: '5px' }}>
                      <button type="button" onClick={() => saveEdit(r.id)} disabled={busy} style={ghostBtn}>
                        💾 save
                      </button>
                      <button type="button" onClick={() => setEditing(null)} style={ghostBtn}>
                        cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    fontFamily: 'var(--font-retro)', fontSize: '18px',
                    color: 'var(--text-primary)', marginTop: '4px',
                    whiteSpace: 'pre-wrap', lineHeight: 1.35,
                  }}>
                    {r.body}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

const ghostBtn = {
  background: 'none', border: '1px solid var(--border-dark)',
  color: 'var(--text-dim)', fontFamily: 'var(--font-retro)',
  fontSize: '14px', padding: '2px 7px', cursor: 'pointer',
};
