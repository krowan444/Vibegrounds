import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const REACTION_TYPES = [
  { key: 'fire', emoji: '🔥', label: 'Fire' },
  { key: 'like', emoji: '👍', label: 'Like' },
  { key: 'clever', emoji: '🧠', label: 'Clever' },
  { key: 'funny', emoji: '😂', label: 'Funny' }
];

// Simple profanity filter placeholder
const BLOCKED_WORDS = ['spam', 'scam'];
function filterComment(text) {
  let filtered = text;
  BLOCKED_WORDS.forEach(word => {
    const re = new RegExp(word, 'gi');
    filtered = filtered.replace(re, '***');
  });
  return filtered;
}

// Get or create a session ID for anonymous reaction tracking
function getSessionId() {
  let sid = sessionStorage.getItem('vg_session_id');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('vg_session_id', sid);
  }
  return sid;
}

export default function ReviewSection({ creationId }) {
  const { profile } = useAuth();
  const [reactionCounts, setReactionCounts] = useState({ fire: 0, like: 0, clever: 0, funny: 0 });
  const [myReactions, setMyReactions] = useState(new Set());
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({ name: '', comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const sessionId = getSessionId();

  // Fetch reactions and reviews
  useEffect(() => {
    if (!creationId) return;

    const fetchData = async () => {
      // Fetch reaction counts
      const { data: allReactions } = await supabase
        .from('reactions')
        .select('reaction_type, session_id')
        .eq('creation_id', creationId);

      if (allReactions) {
        const counts = { fire: 0, like: 0, clever: 0, funny: 0 };
        const mine = new Set();
        allReactions.forEach(r => {
          counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
          if (r.session_id === sessionId) mine.add(r.reaction_type);
        });
        setReactionCounts(counts);
        setMyReactions(mine);
      }

      // Fetch reviews
      const { data: reviewData } = await supabase
        .from('reviews')
        .select('*')
        .eq('creation_id', creationId)
        .eq('reported', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (reviewData) setReviews(reviewData);
    };
    fetchData();
  }, [creationId]);

  // Pre-fill name from profile
  useEffect(() => {
    if (profile?.username && !reviewForm.name) {
      setReviewForm(prev => ({ ...prev, name: profile.username }));
    }
  }, [profile]);

  const handleReaction = async (type) => {
    if (myReactions.has(type)) return; // Already reacted

    const { error: insertErr } = await supabase.from('reactions').insert({
      creation_id: creationId,
      reaction_type: type,
      session_id: sessionId
    });

    if (!insertErr) {
      setReactionCounts(prev => ({ ...prev, [type]: prev[type] + 1 }));
      setMyReactions(prev => new Set([...prev, type]));
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const name = reviewForm.name.trim();
    const comment = reviewForm.comment.trim();

    if (!name) { setError('Please enter your name'); return; }
    if (!comment) { setError('Please enter a comment'); return; }
    if (comment.length > 500) { setError('Comment cannot exceed 500 characters'); return; }

    setSubmitting(true);
    try {
      const filtered = filterComment(comment);
      const { data, error: insertErr } = await supabase
        .from('reviews')
        .insert({
          creation_id: creationId,
          reviewer_name: name,
          reviewer_avatar: profile?.avatar_url || '',
          comment: filtered
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      setReviews(prev => [data, ...prev]);
      setReviewForm(prev => ({ ...prev, comment: '' }));
      setSuccess('Review posted! 🎉');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to post review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReport = async (reviewId) => {
    if (!confirm('Report this comment?')) return;
    await supabase.from('reviews').update({ reported: true }).eq('id', reviewId);
    setReviews(prev => prev.filter(r => r.id !== reviewId));
    console.log('Reported review:', reviewId);
  };

  return (
    <div className="retro-panel" style={{ marginBottom: '16px' }}>
      <div className="section-header">
        <h2>📝 PROJECT REVIEWS</h2>
      </div>

      {/* ── REACTIONS ── */}
      <div style={{ padding: '12px', borderBottom: '1px solid var(--border-dark)' }}>
        <div style={{
          fontFamily: 'var(--font-pixel)', fontSize: '9px', color: 'var(--text-secondary)',
          textTransform: 'uppercase', marginBottom: '8px'
        }}>
          Reactions
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {REACTION_TYPES.map(r => {
            const isReacted = myReactions.has(r.key);
            return (
              <button
                key={r.key}
                onClick={() => handleReaction(r.key)}
                disabled={isReacted}
                title={isReacted ? `You already ${r.label}d this!` : r.label}
                style={{
                  background: isReacted ? 'rgba(232,163,23,0.15)' : 'var(--bg-dark)',
                  border: isReacted ? '2px solid var(--orange)' : '2px solid var(--border-dark)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-retro)',
                  fontSize: '18px',
                  padding: '6px 12px',
                  cursor: isReacted ? 'default' : 'pointer',
                  borderRadius: '2px',
                  transition: 'all 0.15s',
                  opacity: isReacted ? 1 : 0.85,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span style={{ fontSize: '20px' }}>{r.emoji}</span>
                <span style={{ color: 'var(--orange)', fontWeight: 'bold' }}>{reactionCounts[r.key]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── REVIEW FORM ── */}
      <div style={{ padding: '12px', borderBottom: '1px solid var(--border-dark)' }}>
        <div style={{
          fontFamily: 'var(--font-pixel)', fontSize: '9px', color: 'var(--text-secondary)',
          textTransform: 'uppercase', marginBottom: '8px'
        }}>
          Leave a Review
        </div>

        {error && (
          <div style={{
            background: '#331111', border: '1px solid #cc3333',
            padding: '6px 10px', marginBottom: '8px',
            fontFamily: 'var(--font-retro)', fontSize: '16px', color: '#ff6666'
          }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{
            background: '#113311', border: '1px solid #33cc33',
            padding: '6px 10px', marginBottom: '8px',
            fontFamily: 'var(--font-retro)', fontSize: '16px', color: '#66ff66'
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleReviewSubmit}>
          <div style={{ marginBottom: '6px' }}>
            <input
              type="text"
              placeholder="Your name"
              value={reviewForm.name}
              onChange={e => setReviewForm({ ...reviewForm, name: e.target.value })}
              maxLength={30}
              disabled={submitting}
              style={{
                width: '100%', padding: '6px 8px',
                background: 'var(--bg-input)', border: '2px solid var(--border-dark)',
                color: 'var(--text-primary)', fontFamily: 'var(--font-retro)',
                fontSize: '16px', outline: 'none'
              }}
            />
          </div>
          <div style={{ marginBottom: '6px' }}>
            <textarea
              placeholder="Write your review..."
              value={reviewForm.comment}
              onChange={e => setReviewForm({ ...reviewForm, comment: e.target.value })}
              maxLength={500}
              disabled={submitting}
              style={{
                width: '100%', minHeight: '60px', padding: '6px 8px',
                background: 'var(--bg-input)', border: '2px solid var(--border-dark)',
                color: 'var(--text-primary)', fontFamily: 'var(--font-retro)',
                fontSize: '16px', outline: 'none', resize: 'vertical'
              }}
            />
            <div style={{ fontFamily: 'var(--font-retro)', fontSize: '13px', color: 'var(--text-dim)', marginTop: '2px' }}>
              {reviewForm.comment.length}/500
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: 'var(--orange)', color: '#000', border: '2px solid var(--orange-dim)',
              fontFamily: 'var(--font-pixel)', fontSize: '9px', padding: '8px 16px',
              cursor: submitting ? 'wait' : 'pointer', textTransform: 'uppercase',
              fontWeight: 'bold', opacity: submitting ? 0.6 : 1
            }}
          >
            {submitting ? 'POSTING...' : 'SUBMIT REVIEW'}
          </button>
        </form>
      </div>

      {/* ── REVIEW LIST ── */}
      <div>
        <div style={{
          fontFamily: 'var(--font-pixel)', fontSize: '9px', color: 'var(--text-secondary)',
          textTransform: 'uppercase', padding: '10px 12px 6px',
          borderBottom: '1px solid var(--border-dark)'
        }}>
          Recent Reviews ({reviews.length})
        </div>

        {reviews.length > 0 ? (
          reviews.map(review => {
            const timeAgo = getTimeAgo(review.created_at);
            return (
              <div key={review.id} style={{
                display: 'flex', gap: '10px', padding: '10px 12px',
                borderBottom: '1px solid var(--border-dark)',
                alignItems: 'flex-start'
              }}>
                <div style={{
                  width: '32px', height: '32px', flexShrink: 0,
                  borderRadius: '2px', overflow: 'hidden',
                  border: '1px solid var(--border-dark)',
                  background: 'var(--bg-dark)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {review.reviewer_avatar ? (
                    <img src={review.reviewer_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '16px' }}>👾</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--orange)',
                      textTransform: 'uppercase'
                    }}>
                      {review.reviewer_name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-retro)', fontSize: '13px', color: 'var(--text-dim)' }}>
                      {timeAgo}
                    </span>
                    <button
                      onClick={() => handleReport(review.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-retro)', fontSize: '12px', color: 'var(--text-dim)',
                        padding: '0', marginLeft: 'auto'
                      }}
                      title="Report comment"
                    >
                      🚩
                    </button>
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--text-secondary)',
                    lineHeight: '1.3', marginTop: '2px', wordBreak: 'break-word'
                  }}>
                    {review.comment}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{
            fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--text-dim)',
            textAlign: 'center', padding: '20px'
          }}>
            No reviews yet. Be the first to share your thoughts! 💭
          </div>
        )}
      </div>
    </div>
  );
}

// Simple relative time
function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
