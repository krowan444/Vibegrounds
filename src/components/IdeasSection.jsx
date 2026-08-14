import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase, retryOnAbort } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Notice from './Notice';
import { timeAgo } from '../lib/format';

/**
 * Ideas — what this thing could become next.
 *
 * Kept separate from reviews on purpose. A review is a verdict aimed at
 * other visitors; an idea is a to-do aimed at the creator. Put them in one
 * box and "add a leaderboard" drowns under "3/5, quite fun".
 *
 * Three moving parts:
 *   - anyone verified posts an idea, optionally with a prompt to paste
 *   - anyone verified upvotes, so the best one rises rather than the first
 *   - the creator marks it Planned / Built / Not for me
 *
 * That last one is the whole feature. Without a reply from the creator this
 * is a suggestion box nobody empties, and people stop bothering.
 */

const STATUS = {
  open:     { label: 'Open',        cls: 'is-open' },
  planned:  { label: '📌 Planned',  cls: 'is-planned' },
  built:    { label: '✅ Built',    cls: 'is-built' },
  declined: { label: 'Not for me',  cls: 'is-declined' },
};

// What the creator can set, in the order the buttons appear.
const SETTABLE = ['open', 'planned', 'built', 'declined'];

export default function IdeasSection({ creation }) {
  const { user, canPost, isStaff } = useAuth();
  const creationId = creation?.id;
  const isOwner = !!user && user.id === creation?.creator_id;
  const open = creation?.accepts_ideas !== false;

  const [ideas, setIdeas] = useState([]);
  const [body, setBody] = useState('');
  const [prompt, setPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);
  // Set when the tables are not there yet, i.e. the code shipped before the
  // migration was run. Rendering nothing beats an error box on every page.
  const [absent, setAbsent] = useState(false);

  const load = useCallback(async () => {
    if (!creationId) return;
    // Wrapped, like the reviews list: every action below refreshes through
    // here, so an unwrapped query that hangs would strand the button.
    const { data, error: err } = await retryOnAbort(() => supabase
      .from('creation_ideas_public')
      .select('*')
      .eq('creation_id', creationId)
      .order('vote_count', { ascending: false })
      .order('created_at', { ascending: false }));

    if (err) {
      // 42P01 = undefined_table. Anything else is a real problem worth showing.
      if (err.code === '42P01' || /does not exist/i.test(err.message || '')) {
        setAbsent(true);
        return;
      }
      setError(err.message || 'Could not load the ideas.');
      return;
    }
    setIdeas(data || []);
  }, [creationId]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const post = async (e) => {
    e.preventDefault();
    setError('');
    if (body.trim().length < 4) { setError('Say a little more than that.'); return; }

    setBusy(true);
    try {
      const { error: err } = await retryOnAbort(() => supabase
        .from('creation_ideas')
        .insert({
          creation_id: creationId,
          author_id: user.id,
          body: body.trim(),
          prompt: prompt.trim(),
        }));
      if (err) {
        // The unique index is the only constraint a normal person will hit.
        throw new Error(/duplicate key/i.test(err.message)
          ? 'You have already suggested that one.'
          : err.message);
      }
      setBody(''); setPrompt(''); setShowPrompt(false);
      await load();
    } catch (e2) {
      setError(e2.message || 'Could not post that idea.');
    } finally {
      setBusy(false);
    }
  };

  const toggleVote = async (idea) => {
    if (!user) return;
    // Optimistic: the count and the arrow flip immediately, then reconcile.
    // A vote that takes a round trip to show up feels broken.
    setIdeas((prev) => prev.map((i) => (i.id === idea.id
      ? { ...i, has_voted: !i.has_voted, vote_count: i.vote_count + (i.has_voted ? -1 : 1) }
      : i)));
    const { error: err } = await retryOnAbort(() => (idea.has_voted
      ? supabase.from('idea_votes').delete().eq('idea_id', idea.id).eq('user_id', user.id)
      : supabase.from('idea_votes').insert({ idea_id: idea.id, user_id: user.id })));
    if (err) setError(err.message || 'Could not register that vote.');
    await load();
  };

  const setStatus = async (idea, status) => {
    const { error: err } = await retryOnAbort(() => supabase
      .from('creation_ideas').update({ status }).eq('id', idea.id));
    if (err) { setError(err.message || 'Could not update that.'); return; }
    await load();
  };

  const remove = async (idea) => {
    const { error: err } = await retryOnAbort(() => supabase
      .from('creation_ideas').delete().eq('id', idea.id));
    if (err) { setError(err.message || 'Could not delete that.'); return; }
    await load();
  };

  const copyPrompt = async (idea) => {
    try {
      await navigator.clipboard.writeText(idea.prompt);
      setCopied(idea.id);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setError('Your browser would not let us copy that. Select it and copy manually.');
    }
  };

  const built = ideas.filter((i) => i.status === 'built').length;

  // Nothing to show, and nothing to apologise for — the feature simply is
  // not installed on this database yet.
  if (absent) return null;

  return (
    <div className="retro-panel vg-ideas" id="ideas">
      <div className="section-header">
        <h2>💡 Ideas</h2>
        {ideas.length > 0 && (
          <span className="vg-ideas-count">
            {ideas.length} suggested{built > 0 ? ` · ${built} built` : ''}
          </span>
        )}
      </div>

      <div className="retro-panel-body">
        <p className="vg-ideas-intro">
          What could this become next? Suggest an improvement — and if you can,
          write the prompt the creator could paste straight into their AI.
        </p>

        <Notice tone="error">{error}</Notice>

        {/* Closed is a real state, not a hidden form. Saying so is kinder than
            silently having no box, which just reads as a missing feature. */}
        {!open && (
          <div className="vg-ideas-closed">
            🔒 The creator has ideas switched off for this one.
            {ideas.length > 0 && ' Existing suggestions stay up.'}
          </div>
        )}

        {open && !user && (
          <div className="vg-ideas-closed">
            <Link to="/auth?mode=signup">Join up</Link> to suggest an improvement.
          </div>
        )}

        {open && user && !canPost && (
          <div className="vg-ideas-closed">
            Confirm your email address before posting ideas.
          </div>
        )}

        {open && user && canPost && (
          <form className="vg-idea-form" onSubmit={post}>
            <textarea
              className="vg-idea-input"
              placeholder="Add a leaderboard so people come back to beat their score."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              rows={2}
              disabled={busy}
            />

            {showPrompt ? (
              <textarea
                className="vg-idea-input vg-idea-prompt-input"
                placeholder="Optional — the prompt they could run, word for word."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={2000}
                rows={3}
                disabled={busy}
              />
            ) : (
              <button
                type="button"
                className="vg-idea-addprompt"
                onClick={() => setShowPrompt(true)}
                disabled={busy}
              >
                + add a prompt they can copy
              </button>
            )}

            <div className="vg-idea-form-foot">
              <span className="vg-idea-chars">{body.length}/1000</span>
              <button type="submit" className="retro-cta" disabled={busy || body.trim().length < 4}>
                {busy ? 'POSTING...' : '💡 SUGGEST IT'}
              </button>
            </div>
          </form>
        )}

        {ideas.length === 0 ? (
          <p className="vg-ideas-empty">
            No ideas yet.{open ? ' Be the first to suggest something.' : ''}
          </p>
        ) : (
          <ul className="vg-idea-list">
            {ideas.map((idea) => {
              const s = STATUS[idea.status] || STATUS.open;
              return (
                <li key={idea.id} className={`vg-idea ${s.cls}`}>
                  <button
                    type="button"
                    className={idea.has_voted ? 'vg-idea-vote is-on' : 'vg-idea-vote'}
                    onClick={() => toggleVote(idea)}
                    disabled={!user}
                    title={user ? 'Upvote this idea' : 'Sign in to vote'}
                    aria-pressed={!!idea.has_voted}
                  >
                    <span className="vg-idea-arrow">▲</span>
                    <span className="vg-idea-votes">{idea.vote_count}</span>
                  </button>

                  <div className="vg-idea-main">
                    <div className="vg-idea-head">
                      <Link to={`/profile/${idea.author_username}`} className="vg-idea-author">
                        {idea.author_username}
                      </Link>
                      <span className="vg-idea-age">{timeAgo(idea.created_at)}</span>
                      {idea.status !== 'open' && (
                        <span className={`vg-idea-status ${s.cls}`}>{s.label}</span>
                      )}
                    </div>

                    <p className="vg-idea-body">{idea.body}</p>

                    {idea.prompt && (
                      <div className="vg-idea-prompt">
                        <div className="vg-idea-prompt-head">
                          <span>PROMPT</span>
                          <button type="button" onClick={() => copyPrompt(idea)}>
                            {copied === idea.id ? '✓ copied' : 'copy'}
                          </button>
                        </div>
                        <pre>{idea.prompt}</pre>
                      </div>
                    )}

                    {/* Only the creator sees these. Being able to answer is
                        what makes the board feel like it goes somewhere. */}
                    {isOwner && (
                      <div className="vg-idea-actions">
                        {SETTABLE.map((k) => (
                          <button
                            key={k}
                            type="button"
                            className={idea.status === k ? 'vg-idea-set is-on' : 'vg-idea-set'}
                            onClick={() => setStatus(idea, k)}
                          >
                            {STATUS[k].label}
                          </button>
                        ))}
                      </div>
                    )}

                    {(user?.id === idea.author_id || isStaff) && (
                      <button type="button" className="vg-idea-del" onClick={() => remove(idea)}>
                        delete
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
