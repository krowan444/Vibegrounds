import { Link, useParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import { renderPostBody } from '../lib/postText';

export default function ForumThreadPage() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  // Thread edit state
  const [editingThread, setEditingThread] = useState(false);
  const [threadEditForm, setThreadEditForm] = useState({ title: '', body: '' });
  const [threadEditLoading, setThreadEditLoading] = useState(false);
  const [threadEditError, setThreadEditError] = useState('');
  const [threadEditSuccess, setThreadEditSuccess] = useState('');

  // Reply edit state
  const [editingPostId, setEditingPostId] = useState(null);
  const [postEditBody, setPostEditBody] = useState('');
  const [postEditLoading, setPostEditLoading] = useState(false);
  const [postEditError, setPostEditError] = useState('');
  const [postEditSuccess, setPostEditSuccess] = useState('');

  useEffect(() => {
    const fetchThread = async () => {
      setLoading(true);

      const { data: threadData } = await supabase
        .from('forum_threads')
        // Foreign key named explicitly - see the note in ForumCategoryPage.
        // Without it PostgREST can find two routes to profiles and returns
        // nothing, which took the thread AND its replies down with it, since
        // this fetch bails out before it ever loads the posts.
        .select('*, profiles!forum_threads_author_id_fkey(username, avatar_url)')
        .eq('id', id)
        .single();

      if (!threadData) { setLoading(false); return; }
      setThread(threadData);

      const { data: catData } = await supabase
        .from('forum_categories')
        .select('name, slug')
        .eq('id', threadData.category_id)
        .single();
      if (catData) setCategory(catData);

      const { data: postData } = await supabase
        .from('forum_posts')
        .select('*, profiles(username, avatar_url)')
        .eq('thread_id', id)
        .order('created_at', { ascending: true });

      if (postData) setPosts(postData);
      setLoading(false);
    };
    fetchThread();
  }, [id]);

  /*
   * Mark it read.
   *
   * Deliberately after the posts have loaded rather than alongside them: if
   * the fetch fails you never actually saw the replies, and clearing the pip
   * anyway would lose them for good.
   *
   * Fire-and-forget. Nothing on this page depends on the result, and a failed
   * write costs you a pip that lingers one visit longer - which is the right
   * way round for this to break.
   */
  useEffect(() => {
    if (!user || loading || !thread) return;
    supabase.rpc('mark_thread_read', { p_thread: id }).then(() => {}, () => {});
  }, [user, loading, thread, id]);

  // ── Reply ──
  const handleReply = async (e) => {
    e.preventDefault();
    setError('');
    if (!replyBody.trim()) { setError('Reply cannot be empty'); return; }
    if (replyBody.length > 5000) { setError('Reply cannot exceed 5000 characters'); return; }

    setSubmitting(true);
    try {
      const { data, error: insertErr } = await supabase
        .from('forum_posts')
        .insert({ thread_id: id, author_id: user.id, body: replyBody.trim() })
        .select('*, profiles(username, avatar_url)')
        .single();
      if (insertErr) throw insertErr;

      setPosts(prev => [...prev, data]);
      setReplyBody('');
      setThread(prev => prev ? { ...prev, reply_count: (prev.reply_count || 0) + 1, last_activity_at: new Date().toISOString() } : prev);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      setError(err.message || 'Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit Thread ──
  const startEditThread = () => {
    setThreadEditForm({ title: thread.title, body: thread.body });
    setThreadEditError('');
    setThreadEditSuccess('');
    setEditingThread(true);
  };

  const saveThreadEdit = async (e) => {
    e.preventDefault();
    setThreadEditError('');
    setThreadEditSuccess('');
    if (!threadEditForm.title.trim()) { setThreadEditError('Title is required'); return; }
    if (!threadEditForm.body.trim()) { setThreadEditError('Post content is required'); return; }

    setThreadEditLoading(true);
    try {
      const { data, error: updateErr } = await supabase
        .from('forum_threads')
        .update({ title: threadEditForm.title.trim(), body: threadEditForm.body.trim() })
        .eq('id', id)
        .eq('author_id', user.id)
        // Named key again - an edit that saved but came back empty would look
        // to the author like it had failed.
        .select('*, profiles!forum_threads_author_id_fkey(username, avatar_url)')
        .single();
      if (updateErr) throw updateErr;

      setThread(data);
      setThreadEditSuccess('✅ Thread updated successfully!');
      setTimeout(() => { setEditingThread(false); setThreadEditSuccess(''); }, 1500);
    } catch (err) {
      setThreadEditError(err.message || 'Failed to update thread');
    } finally {
      setThreadEditLoading(false);
    }
  };

  // ── Edit Reply ──
  const startEditPost = (post) => {
    setEditingPostId(post.id);
    setPostEditBody(post.body);
    setPostEditError('');
    setPostEditSuccess('');
  };

  const savePostEdit = async (postId) => {
    setPostEditError('');
    setPostEditSuccess('');
    if (!postEditBody.trim()) { setPostEditError('Reply cannot be empty'); return; }

    setPostEditLoading(true);
    try {
      const { data, error: updateErr } = await supabase
        .from('forum_posts')
        .update({ body: postEditBody.trim() })
        .eq('id', postId)
        .eq('author_id', user.id)
        .select('*, profiles(username, avatar_url)')
        .single();
      if (updateErr) throw updateErr;

      setPosts(prev => prev.map(p => p.id === postId ? data : p));
      setPostEditSuccess('✅ Reply updated!');
      setTimeout(() => { setEditingPostId(null); setPostEditSuccess(''); }, 1500);
    } catch (err) {
      setPostEditError(err.message || 'Failed to update reply');
    } finally {
      setPostEditLoading(false);
    }
  };

  // Owner checks
  const isThreadOwner = user && thread?.author_id === user.id;

  if (!loading && !thread) {
    return (
      <>
        <SiteHeader />
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-retro)', fontSize: '20px', color: 'var(--text-dim)' }}>
          Thread not found. <Link to="/forum" style={{ color: 'var(--orange)' }}>Back to forums →</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader />

      <div style={{ padding: '8px', maxWidth: '900px', margin: '0 auto' }}>
        {/* Breadcrumb */}
        <div style={{
          fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--text-dim)',
          marginBottom: '8px', padding: '4px 0'
        }}>
          <Link to="/forum" style={{ color: 'var(--orange)' }}>Forum</Link>
          {category && (
            <>
              {' → '}
              <Link to={`/forum/category/${category.slug}`} style={{ color: 'var(--orange)' }}>{category.name}</Link>
            </>
          )}
          {' → '}
          <span style={{ color: 'var(--text-secondary)' }}>Thread</span>
        </div>

        {loading ? (
          <div style={{ fontFamily: 'var(--font-retro)', fontSize: '20px', color: 'var(--orange)', textAlign: 'center', padding: '30px' }}>
            ⏳ Loading thread...
          </div>
        ) : (
          <>
            {/* ── Original Post ── */}
            <div className="retro-panel" style={{ marginBottom: '8px' }}>
              <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>{thread.is_pinned && '📌 '}{thread.is_locked && '🔒 '}{thread.title}</h2>
                {isThreadOwner && !editingThread && !thread.is_locked && (
                  <button
                    onClick={startEditThread}
                    style={{
                      background: 'none', border: '1px solid var(--border-dark)',
                      color: 'var(--orange)', fontFamily: 'var(--font-retro)', fontSize: '13px',
                      padding: '2px 8px', cursor: 'pointer', borderRadius: '2px'
                    }}
                  >
                    ✏️ Edit
                  </button>
                )}
              </div>

              {/* Thread Edit Form */}
              {editingThread && isThreadOwner ? (
                <form onSubmit={saveThreadEdit} style={{ padding: '12px' }}>
                  {threadEditError && (
                    <div style={{ background: '#331111', border: '1px solid #cc3333', padding: '6px 10px', marginBottom: '8px', fontFamily: 'var(--font-retro)', fontSize: '16px', color: '#ff6666' }}>
                      ⚠️ {threadEditError}
                    </div>
                  )}
                  {threadEditSuccess && (
                    <div style={{ background: '#113311', border: '1px solid #33cc33', padding: '6px 10px', marginBottom: '8px', fontFamily: 'var(--font-retro)', fontSize: '16px', color: '#66ff66' }}>
                      {threadEditSuccess}
                    </div>
                  )}
                  <div className="retro-form-group">
                    <label>Title</label>
                    <input
                      type="text" value={threadEditForm.title}
                      onChange={e => setThreadEditForm({ ...threadEditForm, title: e.target.value })}
                      maxLength={200} disabled={threadEditLoading}
                      style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', border: '2px solid var(--border-dark)', color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '16px' }}
                    />
                  </div>
                  <div className="retro-form-group" style={{ marginTop: '8px' }}>
                    <label>Body</label>
                    <textarea
                      value={threadEditForm.body}
                      onChange={e => setThreadEditForm({ ...threadEditForm, body: e.target.value })}
                      maxLength={5000} disabled={threadEditLoading}
                      style={{ width: '100%', minHeight: '100px', padding: '6px 8px', background: 'var(--bg-input)', border: '2px solid var(--border-dark)', color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '16px', resize: 'vertical' }}
                    />
                    <div style={{ fontFamily: 'var(--font-retro)', fontSize: '13px', color: 'var(--text-dim)', marginTop: '2px' }}>
                      {threadEditForm.body.length}/5000
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button type="submit" disabled={threadEditLoading} style={{ background: 'var(--orange)', color: '#000', border: '2px solid var(--orange-dim)', fontFamily: 'var(--font-pixel)', fontSize: '9px', padding: '8px 20px', cursor: threadEditLoading ? 'wait' : 'pointer', textTransform: 'uppercase', fontWeight: 'bold', opacity: threadEditLoading ? 0.6 : 1 }}>
                      {threadEditLoading ? 'SAVING...' : '💾 SAVE'}
                    </button>
                    <button type="button" onClick={() => setEditingThread(false)} disabled={threadEditLoading} style={{ background: 'transparent', color: 'var(--text-dim)', border: '2px solid var(--border-dark)', fontFamily: 'var(--font-pixel)', fontSize: '9px', padding: '8px 20px', cursor: 'pointer', textTransform: 'uppercase' }}>
                      CANCEL
                    </button>
                  </div>
                </form>
              ) : (
                <ForumPost
                  username={thread.profiles?.username || 'unknown'}
                  avatarUrl={thread.profiles?.avatar_url}
                  body={thread.body}
                  createdAt={thread.created_at}
                  isOP
                />
              )}
            </div>

            {/* ── Replies ── */}
            {posts.length > 0 && (
              <div className="retro-panel" style={{ marginBottom: '8px' }}>
                <div style={{
                  background: 'linear-gradient(180deg, #333 0%, #222 100%)',
                  borderBottom: '2px solid var(--orange)',
                  padding: '8px 12px', fontFamily: 'var(--font-pixel)', fontSize: '9px',
                  color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '1px'
                }}>
                  Replies ({posts.length})
                </div>
                {posts.map(post => {
                  const isPostOwner = user && post.author_id === user.id;
                  const isEditingThis = editingPostId === post.id;

                  if (isEditingThis && isPostOwner) {
                    return (
                      <div key={post.id} style={{ padding: '12px', borderBottom: '1px solid var(--border-dark)' }}>
                        {postEditError && (
                          <div style={{ background: '#331111', border: '1px solid #cc3333', padding: '6px 10px', marginBottom: '8px', fontFamily: 'var(--font-retro)', fontSize: '16px', color: '#ff6666' }}>
                            ⚠️ {postEditError}
                          </div>
                        )}
                        {postEditSuccess && (
                          <div style={{ background: '#113311', border: '1px solid #33cc33', padding: '6px 10px', marginBottom: '8px', fontFamily: 'var(--font-retro)', fontSize: '16px', color: '#66ff66' }}>
                            {postEditSuccess}
                          </div>
                        )}
                        <textarea
                          value={postEditBody}
                          onChange={e => setPostEditBody(e.target.value)}
                          maxLength={5000} disabled={postEditLoading}
                          style={{ width: '100%', minHeight: '80px', padding: '6px 8px', background: 'var(--bg-input)', border: '2px solid var(--border-dark)', color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '16px', resize: 'vertical' }}
                        />
                        <div style={{ fontFamily: 'var(--font-retro)', fontSize: '13px', color: 'var(--text-dim)', marginTop: '2px' }}>
                          {postEditBody.length}/5000
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button onClick={() => savePostEdit(post.id)} disabled={postEditLoading} style={{ background: 'var(--orange)', color: '#000', border: '2px solid var(--orange-dim)', fontFamily: 'var(--font-pixel)', fontSize: '9px', padding: '6px 16px', cursor: postEditLoading ? 'wait' : 'pointer', textTransform: 'uppercase', fontWeight: 'bold', opacity: postEditLoading ? 0.6 : 1 }}>
                            {postEditLoading ? 'SAVING...' : '💾 SAVE'}
                          </button>
                          <button onClick={() => setEditingPostId(null)} disabled={postEditLoading} style={{ background: 'transparent', color: 'var(--text-dim)', border: '2px solid var(--border-dark)', fontFamily: 'var(--font-pixel)', fontSize: '9px', padding: '6px 16px', cursor: 'pointer', textTransform: 'uppercase' }}>
                            CANCEL
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <ForumPost
                      key={post.id}
                      username={post.profiles?.username || 'unknown'}
                      avatarUrl={post.profiles?.avatar_url}
                      body={post.body}
                      createdAt={post.created_at}
                      canEdit={isPostOwner && !thread.is_locked}
                      onEdit={() => startEditPost(post)}
                    />
                  );
                })}
              </div>
            )}

            {/* ── Reply Form ── */}
            {!thread.is_locked && (
              <div className="retro-panel" style={{ marginBottom: '8px' }}>
                <div className="section-header">
                  <h2>💬 Post a Reply</h2>
                </div>
                {user ? (
                  <form onSubmit={handleReply} style={{ padding: '12px' }}>
                    {error && (
                      <div style={{ background: '#331111', border: '1px solid #cc3333', padding: '6px 10px', marginBottom: '8px', fontFamily: 'var(--font-retro)', fontSize: '16px', color: '#ff6666' }}>
                        ⚠️ {error}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '40px', height: '40px', flexShrink: 0, borderRadius: '2px',
                        overflow: 'hidden', border: '2px solid var(--border-dark)',
                        background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '20px' }}>👾</span>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <textarea
                          placeholder="Write your reply..."
                          value={replyBody} onChange={e => setReplyBody(e.target.value)}
                          maxLength={5000} disabled={submitting}
                          style={{ width: '100%', minHeight: '80px', padding: '6px 8px', background: 'var(--bg-input)', border: '2px solid var(--border-dark)', color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '16px', resize: 'vertical', outline: 'none' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                          <span style={{ fontFamily: 'var(--font-retro)', fontSize: '13px', color: 'var(--text-dim)' }}>
                            {replyBody.length}/5000
                          </span>
                          <button type="submit" disabled={submitting} style={{ background: 'var(--orange)', color: '#000', border: '2px solid var(--orange-dim)', fontFamily: 'var(--font-pixel)', fontSize: '9px', padding: '8px 20px', cursor: submitting ? 'wait' : 'pointer', textTransform: 'uppercase', fontWeight: 'bold', opacity: submitting ? 0.6 : 1 }}>
                            {submitting ? 'POSTING...' : 'POST REPLY'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div style={{ fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--text-dim)', textAlign: 'center', padding: '20px' }}>
                    <Link to="/auth" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>Sign in</Link>
                    {' to reply to this thread.'}
                  </div>
                )}
              </div>
            )}

            {thread.is_locked && (
              <div style={{ fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--text-dim)', textAlign: 'center', padding: '12px' }}>
                🔒 This thread is locked. No new replies.
              </div>
            )}

            <div ref={bottomRef} />
          </>
        )}
      </div>
    </>
  );
}

// Individual forum post component
function ForumPost({ username, avatarUrl, body, createdAt, isOP, canEdit, onEdit }) {
  const date = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : '';

  return (
    <div style={{
      display: 'flex', gap: '10px', padding: '12px',
      borderBottom: '1px solid var(--border-dark)', alignItems: 'flex-start'
    }}>
      <div style={{ width: '80px', flexShrink: 0, textAlign: 'center' }}>
        <div style={{
          width: '56px', height: '56px', margin: '0 auto 4px', borderRadius: '4px', overflow: 'hidden',
          border: `2px solid ${isOP ? 'var(--orange)' : 'var(--border-dark)'}`,
          background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '28px' }}>👾</span>
          )}
        </div>
        <Link
          to={`/profile/${encodeURIComponent(username)}`}
          style={{
            fontFamily: 'var(--font-pixel)', fontSize: '7px',
            color: isOP ? 'var(--orange)' : 'var(--blue-link)',
            textDecoration: 'none', textTransform: 'uppercase', wordBreak: 'break-all'
          }}
        >
          {username}
        </Link>
        {isOP && (
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--green)', marginTop: '2px' }}>
            OP
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--text-primary)',
          lineHeight: '1.4', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
        }}>
          {renderPostBody(body)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <span style={{ fontFamily: 'var(--font-retro)', fontSize: '13px', color: 'var(--text-dim)' }}>
            {date}
          </span>
          {canEdit && onEdit && (
            <button
              onClick={onEdit}
              style={{
                background: 'none', border: '1px solid var(--border-dark)',
                color: 'var(--orange)', fontFamily: 'var(--font-retro)', fontSize: '12px',
                padding: '1px 6px', cursor: 'pointer', borderRadius: '2px'
              }}
            >
              ✏️ Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
