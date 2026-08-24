import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import CouldNotLoad from '../components/CouldNotLoad';
import { useBoardUnread, BoardPip } from '../components/ForumUnread';
import SiteHeader from '../components/SiteHeader';

const CATEGORY_ICONS = {
  'general': '💬',
  'vibe-coding': '⚡',
  'show-project': '🚀',
  'help-feedback': '🆘',
  'retro-internet': '🕹️'
};

export default function ForumPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  // Bumped by the Try again button, which is all the reload the effect needs.
  const [attempt, setAttempt] = useState(0);
  // Which boards have moved since you last looked.
  const boardUnread = useBoardUnread();

  useEffect(() => {
    const fetchCategories = async () => {
      // Get categories
      setUnreachable(false);
      const { data: cats, error: catsErr } = await supabase
        .from('forum_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      // The boards are fixed rows that always exist, so an empty result here
      // never means "there are no boards" — it means the request did not get
      // through. This page used to sit on "Boards are loading..." forever and
      // tell the visitor to run a SQL script.
      if (catsErr) { setUnreachable(true); setLoading(false); return; }

      if (cats) {
        // Get thread counts and latest activity per category
        const enriched = await Promise.all(cats.map(async (cat) => {
          const { count: threadCount } = await supabase
            .from('forum_threads')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', cat.id);

          // Get latest thread for "last activity"
          const { data: latestThread } = await supabase
            .from('forum_threads')
            .select('title, last_activity_at')
            .eq('category_id', cat.id)
            .order('last_activity_at', { ascending: false })
            .limit(1);

          // Get total reply count across all threads in category
          const { data: threads } = await supabase
            .from('forum_threads')
            .select('reply_count')
            .eq('category_id', cat.id);
          const totalReplies = threads ? threads.reduce((sum, t) => sum + (t.reply_count || 0), 0) : 0;

          return {
            ...cat,
            threadCount: threadCount || 0,
            totalReplies,
            latestThread: latestThread?.[0] || null
          };
        }));

        setCategories(enriched);
      }
      setLoading(false);
    };
    fetchCategories();
  }, [attempt]);

  if (unreachable) {
    return (
      <CouldNotLoad
        what="The Community"
        onRetry={() => setAttempt((n) => n + 1)}
        backTo="/"
        backLabel="Back to the home page"
        compact={false}
      />
    );
  }

  return (
    <>
      <SiteHeader />

      <div style={{ padding: '8px', maxWidth: '900px', margin: '0 auto' }}>
        {/* Forum Header */}
        <div className="retro-panel" style={{ marginBottom: '8px' }}>
          <div className="section-header">
            <h2>💬 VIBEGROUNDS COMMUNITY</h2>
          </div>
          <div style={{
            padding: '10px 12px', fontFamily: 'var(--font-retro)', fontSize: '17px',
            color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-dark)'
          }}>
            Welcome in. Discuss projects, share tips, ask the daft questions, and find other people building things.
          </div>
        </div>

        {/* Category List */}
        <div className="retro-panel">
          {/* The grid lives in CSS, not here. Column widths have to change on
              a phone and a media query cannot reach an inline style — which
              is exactly why this table ran off the right edge of every
              narrow screen. See .vg-forum-head / .vg-forum-row. */}
          <div className="vg-forum-head" style={{
            background: 'linear-gradient(180deg, #333 0%, #222 100%)',
            borderBottom: '2px solid var(--orange)',
            padding: '8px 12px',
            fontFamily: 'var(--font-pixel)',
            fontSize: '8px',
            color: 'var(--orange)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            <span>Board</span>
            <span style={{ textAlign: 'center' }}>Threads</span>
            <span style={{ textAlign: 'center' }}>Replies</span>
            <span style={{ textAlign: 'right' }}>Latest</span>
          </div>

          {loading ? (
            <div style={{
              fontFamily: 'var(--font-retro)', fontSize: '20px', color: 'var(--orange)',
              textAlign: 'center', padding: '30px'
            }}>
              ⏳ Loading boards...
            </div>
          ) : categories.length > 0 ? (
            categories.map(cat => (
              <Link
                key={cat.id}
                to={`/community/category/${cat.slug}`}
                className="vg-forum-row"
                style={{
                  padding: '12px',
                  borderBottom: '1px solid var(--border-dark)',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(232,163,23,0.05)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{
                    fontFamily: 'var(--font-pixel)', fontSize: '10px', color: 'var(--orange)',
                    textTransform: 'uppercase', marginBottom: '3px'
                  }}>
                    {CATEGORY_ICONS[cat.slug] || '📁'} {cat.name}
                    {/* After the name, not before it: the name is what you
                        scan for, the pip is what makes you stop. */}
                    <BoardPip info={boardUnread.get(cat.id)} />
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-retro)', fontSize: '15px', color: 'var(--text-dim)'
                  }}>
                    {cat.description}
                  </div>
                </div>
                <div style={{
                  textAlign: 'center', fontFamily: 'var(--font-retro)', fontSize: '18px',
                  color: 'var(--text-secondary)', fontWeight: 'bold'
                }}>
                  {cat.threadCount}
                </div>
                <div style={{
                  textAlign: 'center', fontFamily: 'var(--font-retro)', fontSize: '18px',
                  color: 'var(--text-secondary)'
                }}>
                  {cat.totalReplies}
                </div>
                <div style={{
                  textAlign: 'right', fontFamily: 'var(--font-retro)', fontSize: '13px',
                  color: 'var(--text-dim)'
                }}>
                  {cat.latestThread ? (
                    <>
                      <div style={{ color: 'var(--blue-link)', fontSize: '13px', marginBottom: '2px' }}>
                        {cat.latestThread.title.length > 18
                          ? cat.latestThread.title.slice(0, 18) + '…'
                          : cat.latestThread.title}
                      </div>
                      <div>{getTimeAgo(cat.latestThread.last_activity_at)}</div>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-dim)' }}>No threads yet</span>
                  )}
                </div>
              </Link>
            ))
          ) : (
            <div style={{
              fontFamily: 'var(--font-retro)', fontSize: '18px', color: 'var(--text-dim)',
              textAlign: 'center', padding: '30px'
            }}>
              No boards yet.
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
