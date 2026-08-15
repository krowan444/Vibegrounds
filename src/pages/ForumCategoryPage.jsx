import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import { useThreadUnread, ThreadPip } from '../components/ForumUnread';

export default function ForumCategoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [category, setCategory] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '' });

  // One lookup for the whole page rather than one per row. Runs after the
  // threads land, so the list paints immediately and pips arrive a beat later.
  const unread = useThreadUnread(threads.map((t) => t.id));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Get category
      const { data: cat } = await supabase
        .from('forum_categories')
        .select('*')
        .eq('slug', slug)
        .single();

      if (!cat) { setLoading(false); return; }
      setCategory(cat);

      // Get threads in this category
      const { data: threadData } = await supabase
        .from('forum_threads')
        // The foreign key is named explicitly. Left as plain profiles(...),
        // PostgREST has to guess which relationship is meant - and the moment
        // any new table references both forum_threads and profiles it sees a
        // second candidate, refuses to choose, and returns nothing. That is
        // exactly how the thread lists silently emptied. Naming the key makes
        // it unguessable and immune to whatever gets added later.
        .select('*, profiles!forum_threads_author_id_fkey(username, avatar_url)')
        .eq('category_id', cat.id)
        .order('is_pinned', { ascending: false })
        .order('last_activity_at', { ascending: false })
        .limit(50);

      if (threadData) setThreads(threadData);
      setLoading(false);
    };
    fetchData();
  }, [slug]);

  const handleCreateThread = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.body.trim()) { setError('Post content is required'); return; }
    if (form.title.length > 200) { setError('Title cannot exceed 200 characters'); return; }
    if (form.body.length > 5000) { setError('Post cannot exceed 5000 characters'); return; }

    setSubmitting(true);
    try {
      const { data, error: insertErr } = await supabase
        .from('forum_threads')
        .insert({
          category_id: category.id,
          author_id: user.id,
          title: form.title.trim(),
          body: form.body.trim()
        })
        // The foreign key is named explicitly. Left as plain profiles(...),
        // PostgREST has to guess which relationship is meant - and the moment
        // any new table references both forum_threads and profiles it sees a
        // second candidate, refuses to choose, and returns nothing. That is
        // exactly how the thread lists silently emptied. Naming the key makes
        // it unguessable and immune to whatever gets added later.
        .select('*, profiles!forum_threads_author_id_fkey(username, avatar_url)')
        .single();

      if (insertErr) throw insertErr;

      setThreads(prev => [data, ...prev]);
      setForm({ title: '', body: '' });
      setShowForm(false);
    } catch (err) {
      setError(err.message || 'Failed to create thread');
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && !category) {
    return (
      <>
        <SiteHeader />
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-retro)', fontSize: '20px', color: 'var(--text-dim)' }}>
          Category not found. <Link to="/forum" style={{ color: 'var(--orange)' }}>Back to forums →</Link>
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
          {' → '}
          <span style={{ color: 'var(--text-secondary)' }}>{category?.name || 'Loading...'}</span>
        </div>

        {/* Category Header */}
        <div className="retro-panel" style={{ marginBottom: '8px' }}>
          <div className="section-header">
            <h2>{category?.name || 'Loading...'}</h2>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 12px', borderBottom: '1px solid var(--border-dark)'
          }}>
            <span style={{ fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--text-dim)' }}>
              {category?.description}
            </span>
            {user && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="retro-cta"
                style={{ padding: '8px 16px', fontSize: '9px', width: 'auto', whiteSpace: 'nowrap' }}
              >
                {showForm ? '✕ CANCEL' : '✏️ NEW THREAD'}
              </button>
            )}
          </div>
        </div>

        {/* New Thread Form */}
        {showForm && user && (
          <div className="retro-panel" style={{ marginBottom: '8px' }}>
            <div className="section-header">
              <h2>✏️ New Thread</h2>
            </div>
            <form onSubmit={handleCreateThread} style={{ padding: '12px' }}>
              {error && (
                <div style={{
                  background: '#331111', border: '1px solid #cc3333',
                  padding: '6px 10px', marginBottom: '8px',
                  fontFamily: 'var(--font-retro)', fontSize: '16px', color: '#ff6666'
                }}>
                  ⚠️ {error}
                </div>
              )}
              <div className="retro-form-group">
                <label>Thread Title</label>
                <input
                  type="text"
                  placeholder="What's on your mind?"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  maxLength={200}
                  disabled={submitting}
                  style={{
                    width: '100%', padding: '6px 8px',
                    background: 'var(--bg-input)', border: '2px solid var(--border-dark)',
                    color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '16px'
                  }}
                />
              </div>
              <div className="retro-form-group" style={{ marginTop: '8px' }}>
                <label>Post Content</label>
                <textarea
                  placeholder="Write your post..."
                  value={form.body}
                  onChange={e => setForm({ ...form, body: e.target.value })}
                  maxLength={5000}
                  disabled={submitting}
                  style={{
                    width: '100%', minHeight: '100px', padding: '6px 8px',
                    background: 'var(--bg-input)', border: '2px solid var(--border-dark)',
                    color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '16px',
                    resize: 'vertical'
                  }}
                />
                <div style={{ fontFamily: 'var(--font-retro)', fontSize: '13px', color: 'var(--text-dim)', marginTop: '2px' }}>
                  {form.body.length}/5000
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: 'var(--orange)', color: '#000', border: '2px solid var(--orange-dim)',
                  fontFamily: 'var(--font-pixel)', fontSize: '9px', padding: '8px 20px',
                  cursor: submitting ? 'wait' : 'pointer', textTransform: 'uppercase',
                  fontWeight: 'bold', marginTop: '8px', opacity: submitting ? 0.6 : 1
                }}
              >
                {submitting ? 'POSTING...' : 'POST THREAD'}
              </button>
            </form>
          </div>
        )}

        {/* Thread List */}
        <div className="retro-panel">
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 80px 120px',
            gap: '0',
            background: 'linear-gradient(180deg, #333 0%, #222 100%)',
            borderBottom: '2px solid var(--orange)',
            padding: '8px 12px',
            fontFamily: 'var(--font-pixel)',
            fontSize: '8px',
            color: 'var(--orange)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            <span>Thread</span>
            <span style={{ textAlign: 'center' }}>Replies</span>
            <span style={{ textAlign: 'right' }}>Latest</span>
          </div>

          {loading ? (
            <div style={{
              fontFamily: 'var(--font-retro)', fontSize: '20px', color: 'var(--orange)',
              textAlign: 'center', padding: '30px'
            }}>
              ⏳ Loading threads...
            </div>
          ) : threads.length > 0 ? (
            threads.map(thread => (
              <Link
                key={thread.id}
                to={`/forum/thread/${thread.id}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 120px',
                  gap: '0',
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border-dark)',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.15s',
                  alignItems: 'center'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(232,163,23,0.05)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    {thread.is_pinned && <span title="Pinned">📌</span>}
                    {thread.is_locked && <span title="Locked">🔒</span>}
                    <span style={{
                      fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--blue-link)',
                      fontWeight: 'bold'
                    }}>
                      {thread.title}
                    </span>
                    {/* After the title, not before it. The title is what you
                        scan for; the pip is what makes you stop. */}
                    <ThreadPip info={unread.get(thread.id)} />
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-retro)', fontSize: '13px', color: 'var(--text-dim)',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    {thread.profiles?.avatar_url && (
                      <img src={thread.profiles.avatar_url} alt="" style={{
                        width: '14px', height: '14px', borderRadius: '2px', objectFit: 'cover'
                      }} />
                    )}
                    by {thread.profiles?.username || 'unknown'}
                    {' • '}
                    {getTimeAgo(thread.created_at)}
                  </div>
                </div>
                <div style={{
                  textAlign: 'center', fontFamily: 'var(--font-retro)', fontSize: '18px',
                  color: 'var(--text-secondary)'
                }}>
                  {thread.reply_count || 0}
                </div>
                <div style={{
                  textAlign: 'right', fontFamily: 'var(--font-retro)', fontSize: '13px',
                  color: 'var(--text-dim)'
                }}>
                  {getTimeAgo(thread.last_activity_at)}
                </div>
              </Link>
            ))
          ) : (
            <div style={{
              fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-dim)',
              textAlign: 'center', padding: '30px'
            }}>
              No threads yet.{' '}
              {user ? (
                <button
                  onClick={() => setShowForm(true)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--orange)', fontFamily: 'var(--font-retro)', fontSize: '18px', fontWeight: 'bold'
                  }}
                >
                  Start one! →
                </button>
              ) : (
                <Link to="/auth" style={{ color: 'var(--orange)' }}>Sign in to start one! →</Link>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
