import { Link, useParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';

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

  useEffect(() => {
    const fetchThread = async () => {
      setLoading(true);

      // Get thread
      const { data: threadData } = await supabase
        .from('forum_threads')
        .select('*, profiles(username, avatar_url)')
        .eq('id', id)
        .single();

      if (!threadData) { setLoading(false); return; }
      setThread(threadData);

      // Get category for breadcrumb
      const { data: catData } = await supabase
        .from('forum_categories')
        .select('name, slug')
        .eq('id', threadData.category_id)
        .single();
      if (catData) setCategory(catData);

      // Get replies
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

  const handleReply = async (e) => {
    e.preventDefault();
    setError('');
    if (!replyBody.trim()) { setError('Reply cannot be empty'); return; }
    if (replyBody.length > 5000) { setError('Reply cannot exceed 5000 characters'); return; }

    setSubmitting(true);
    try {
      const { data, error: insertErr } = await supabase
        .from('forum_posts')
        .insert({
          thread_id: id,
          author_id: user.id,
          body: replyBody.trim()
        })
        .select('*, profiles(username, avatar_url)')
        .single();

      if (insertErr) throw insertErr;

      setPosts(prev => [...prev, data]);
      setReplyBody('');

      // Update thread's reply count locally
      setThread(prev => prev ? {
        ...prev,
        reply_count: (prev.reply_count || 0) + 1,
        last_activity_at: new Date().toISOString()
      } : prev);

      // Scroll to bottom
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      setError(err.message || 'Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  };

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
          <div style={{
            fontFamily: 'var(--font-retro)', fontSize: '20px', color: 'var(--orange)',
            textAlign: 'center', padding: '30px'
          }}>
            ⏳ Loading thread...
          </div>
        ) : (
          <>
            {/* Original Post */}
            <div className="retro-panel" style={{ marginBottom: '8px' }}>
              <div className="section-header">
                <h2>{thread.is_pinned && '📌 '}{thread.is_locked && '🔒 '}{thread.title}</h2>
              </div>
              <ForumPost
                username={thread.profiles?.username || 'unknown'}
                avatarUrl={thread.profiles?.avatar_url}
                body={thread.body}
                createdAt={thread.created_at}
                isOP
              />
            </div>

            {/* Replies */}
            {posts.length > 0 && (
              <div className="retro-panel" style={{ marginBottom: '8px' }}>
                <div style={{
                  background: 'linear-gradient(180deg, #333 0%, #222 100%)',
                  borderBottom: '2px solid var(--orange)',
                  padding: '8px 12px',
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '9px',
                  color: 'var(--orange)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  Replies ({posts.length})
                </div>
                {posts.map(post => (
                  <ForumPost
                    key={post.id}
                    username={post.profiles?.username || 'unknown'}
                    avatarUrl={post.profiles?.avatar_url}
                    body={post.body}
                    createdAt={post.created_at}
                  />
                ))}
              </div>
            )}

            {/* Reply Form */}
            {!thread.is_locked && (
              <div className="retro-panel" style={{ marginBottom: '8px' }}>
                <div className="section-header">
                  <h2>💬 Post a Reply</h2>
                </div>
                {user ? (
                  <form onSubmit={handleReply} style={{ padding: '12px' }}>
                    {error && (
                      <div style={{
                        background: '#331111', border: '1px solid #cc3333',
                        padding: '6px 10px', marginBottom: '8px',
                        fontFamily: 'var(--font-retro)', fontSize: '16px', color: '#ff6666'
                      }}>
                        ⚠️ {error}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '40px', height: '40px', flexShrink: 0, borderRadius: '2px',
                        overflow: 'hidden', border: '2px solid var(--border-dark)',
                        background: 'var(--bg-dark)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center'
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
                          value={replyBody}
                          onChange={e => setReplyBody(e.target.value)}
                          maxLength={5000}
                          disabled={submitting}
                          style={{
                            width: '100%', minHeight: '80px', padding: '6px 8px',
                            background: 'var(--bg-input)', border: '2px solid var(--border-dark)',
                            color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '16px',
                            resize: 'vertical', outline: 'none'
                          }}
                        />
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          marginTop: '6px'
                        }}>
                          <span style={{ fontFamily: 'var(--font-retro)', fontSize: '13px', color: 'var(--text-dim)' }}>
                            {replyBody.length}/5000
                          </span>
                          <button
                            type="submit"
                            disabled={submitting}
                            style={{
                              background: 'var(--orange)', color: '#000', border: '2px solid var(--orange-dim)',
                              fontFamily: 'var(--font-pixel)', fontSize: '9px', padding: '8px 20px',
                              cursor: submitting ? 'wait' : 'pointer', textTransform: 'uppercase',
                              fontWeight: 'bold', opacity: submitting ? 0.6 : 1
                            }}
                          >
                            {submitting ? 'POSTING...' : 'POST REPLY'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div style={{
                    fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--text-dim)',
                    textAlign: 'center', padding: '20px'
                  }}>
                    <Link to="/auth" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>Sign in</Link>
                    {' to reply to this thread.'}
                  </div>
                )}
              </div>
            )}

            {thread.is_locked && (
              <div style={{
                fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--text-dim)',
                textAlign: 'center', padding: '12px'
              }}>
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

// Individual forum post (used for OP and replies)
function ForumPost({ username, avatarUrl, body, createdAt, isOP }) {
  const date = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : '';

  return (
    <div style={{
      display: 'flex', gap: '10px', padding: '12px',
      borderBottom: '1px solid var(--border-dark)',
      alignItems: 'flex-start'
    }}>
      {/* Avatar + user info column */}
      <div style={{
        width: '80px', flexShrink: 0, textAlign: 'center'
      }}>
        <div style={{
          width: '56px', height: '56px', margin: '0 auto 4px',
          borderRadius: '4px', overflow: 'hidden',
          border: `2px solid ${isOP ? 'var(--orange)' : 'var(--border-dark)'}`,
          background: 'var(--bg-dark)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
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
            textDecoration: 'none', textTransform: 'uppercase',
            wordBreak: 'break-all'
          }}
        >
          {username}
        </Link>
        {isOP && (
          <div style={{
            fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--green)',
            marginTop: '2px'
          }}>
            OP
          </div>
        )}
      </div>

      {/* Post body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--text-primary)',
          lineHeight: '1.4', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
        }}>
          {body}
        </div>
        <div style={{
          fontFamily: 'var(--font-retro)', fontSize: '13px', color: 'var(--text-dim)',
          marginTop: '8px'
        }}>
          {date}
        </div>
      </div>
    </div>
  );
}
