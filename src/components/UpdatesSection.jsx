import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { timeAgo } from '../lib/format';
import Notice from './Notice';

/**
 * The creator's devlog for one creation.
 *
 * Reviews are what visitors think, Ideas are what visitors want, and this
 * is the maker answering: "v1.1 is up, the squirrel can jump now."
 *
 * Only the creation's owner can post here — enforced by the policy in
 * migration 23, not by hiding the form. Everyone can read it, including
 * signed-out visitors, because the whole point is that a stranger
 * deciding whether to click Launch can see the thing is still alive.
 *
 * Deliberately renders NOTHING when there are no updates and you are not
 * the owner. An empty "Updates (0)" panel on every submission would be
 * furniture that makes the page longer and says nothing.
 */
export default function UpdatesSection({ creation }) {
  const { user, emailVerified } = useAuth();
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const isOwner = !!user && user.id === creation?.creator_id;
  const canPost = isOwner && emailVerified;

  const load = useCallback(async () => {
    if (!creation?.id) return;
    const { data, error: err } = await supabase
      .from('creation_updates_public')
      .select('*')
      .eq('creation_id', creation.id)
      .order('created_at', { ascending: false });

    if (err) setError(err.message);
    else setUpdates(data || []);
    setLoading(false);
  }, [creation?.id]);

  useEffect(() => { load(); }, [load]);

  const post = async (e) => {
    e.preventDefault();
    setError('');
    if (title.trim().length < 3 || body.trim().length < 4) return;

    setBusy(true);
    const { error: err } = await supabase.from('creation_updates').insert({
      creation_id: creation.id,
      author_id: user.id,
      title: title.trim(),
      body: body.trim(),
    });
    setBusy(false);

    if (err) { setError(err.message); return; }
    setTitle('');
    setBody('');
    setOpen(false);
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this update? It cannot be undone.')) return;
    const { error: err } = await supabase.from('creation_updates').delete().eq('id', id);
    if (err) setError(err.message);
    else load();
  };

  // Nothing to show and nobody who could add anything: render nothing at all
  // rather than an empty box.
  if (loading) return null;
  if (updates.length === 0 && !isOwner) return null;

  return (
    <div className="retro-panel vg-updates" id="updates" style={{ marginTop: '14px' }}>
      <div className="section-header">
        <h2>🛠️ Updates</h2>
        {updates.length > 0 && (
          <span className="vg-updates-count">
            {updates.length} · latest {timeAgo(updates[0].created_at)}
          </span>
        )}
      </div>

      <div className="retro-panel-body">
        <Notice tone="error">{error}</Notice>

        {isOwner && !open && (
          <button
            type="button"
            className="vg-updates-add"
            onClick={() => setOpen(true)}
            disabled={!canPost}
            title={canPost ? undefined : 'Confirm your email address first'}
          >
            + post an update
          </button>
        )}

        {isOwner && !canPost && (
          <p className="vg-updates-empty">
            Confirm your email address to post updates.
          </p>
        )}

        {isOwner && open && (
          <form className="vg-update-form" onSubmit={post}>
            <input
              className="vg-update-input"
              placeholder="v1.1 — the squirrel can jump"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              disabled={busy}
            />
            <textarea
              className="vg-update-input vg-update-body-input"
              placeholder="What changed? Two sentences is plenty."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
              rows={4}
              disabled={busy}
            />
            <div className="vg-update-form-foot">
              <span className="vg-update-chars">{body.length}/4000</span>
              <button
                type="button"
                className="vg-update-cancel"
                onClick={() => { setOpen(false); setTitle(''); setBody(''); setError(''); }}
                disabled={busy}
              >
                cancel
              </button>
              <button
                type="submit"
                className="retro-cta"
                disabled={busy || title.trim().length < 3 || body.trim().length < 4}
              >
                {busy ? 'POSTING...' : '🛠️ POST IT'}
              </button>
            </div>
          </form>
        )}

        {updates.length === 0 ? (
          <p className="vg-updates-empty">
            No updates yet. When you change something, say so here — a project
            that is visibly still being worked on gets tried far more often
            than one that looks abandoned.
          </p>
        ) : (
          <ol className="vg-update-list">
            {updates.map((u) => (
              <li key={u.id} className="vg-update">
                <div className="vg-update-head">
                  <h3 className="vg-update-title">{u.title}</h3>
                  <span className="vg-update-when">{timeAgo(u.created_at)}</span>
                </div>
                {/* white-space: pre-wrap in the CSS, so the line breaks the
                    creator typed survive without needing a markdown parser. */}
                <div className="vg-update-body">{u.body}</div>
                {isOwner && (
                  <button
                    type="button"
                    className="vg-update-delete"
                    onClick={() => remove(u.id)}
                  >
                    delete
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}

        {!user && updates.length > 0 && (
          <p className="vg-updates-foot">
            Made something yourself?{' '}
            <Link to="/auth?mode=signup">Post it</Link> and keep your own log like this.
          </p>
        )}
      </div>
    </div>
  );
}
