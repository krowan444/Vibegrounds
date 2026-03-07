import { useParams, Link } from 'react-router-dom';
import { mockCreations, mockComments } from '../data/mockCreations';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CATEGORY_ICONS } from '../components/CommunityWidgets';
import SiteHeader from '../components/SiteHeader';

export default function CreationPage() {
  const { id } = useParams();
  const [creation, setCreation] = useState(null);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState(0);
  const [voted, setVoted] = useState(null);

  useEffect(() => {
    const fetchCreation = async () => {
      setLoading(true);

      // Check if it's a numeric ID (mock) or UUID (real)
      const numId = parseInt(id);
      if (!isNaN(numId) && numId > 0 && numId <= mockCreations.length) {
        const mock = mockCreations.find(c => c.id === numId) || mockCreations[0];
        setCreation(mock);
        setVotes(mock.votes);
        setIsMock(true);
        setLoading(false);
        return;
      }

      // Try Supabase
      const { data, error } = await supabase
        .from('creations')
        .select('*, profiles(username)')
        .eq('id', id)
        .single();

      if (data && !error) {
        setCreation(data);
        setVotes(0);
        setIsMock(false);
      } else {
        // Fallback to first mock
        setCreation(mockCreations[0]);
        setIsMock(true);
        setVotes(mockCreations[0].votes);
      }
      setLoading(false);
    };
    fetchCreation();
  }, [id]);

  const handleVote = (type) => {
    if (voted === type) {
      setVoted(null);
      setVotes(isMock ? creation.votes : 0);
    } else {
      setVoted(type);
      setVotes(type === 'up' ? (isMock ? creation.votes + 1 : 1) : (isMock ? creation.votes - 1 : -1));
    }
  };

  if (loading || !creation) {
    return (
      <>
        <SiteHeader compact />
        <div className="creation-detail">
          <div className="retro-panel">
            <div className="retro-panel-body" style={{
              fontFamily: 'var(--font-retro)', fontSize: '20px', color: 'var(--orange)',
              textAlign: 'center', padding: '40px'
            }}>
              ⏳ Loading...
            </div>
          </div>
        </div>
      </>
    );
  }

  // Get creator info
  const creatorName = isMock ? creation.creator : (creation.profiles?.username || 'Unknown');
  const category = creation.category || 'other';
  const categoryIcon = CATEGORY_ICONS[category] || '✨';
  const moreBySameCreator = isMock
    ? mockCreations.filter(c => c.creator === creation.creator && c.id !== creation.id)
    : [];

  return (
    <>
      <SiteHeader compact />

      <div className="creation-detail">
        <div className="creation-detail-header">
          <h1 className="creation-detail-title">{creation.title}</h1>
          <div className="creation-detail-creator">
            Created by{' '}
            <Link to={`/profile/${encodeURIComponent(creatorName)}`}>{creatorName}</Link>
            {' '} — <Link to={`/category/${category}`}>{categoryIcon} {category}</Link>
          </div>
        </div>

        {/* Preview Area */}
        <div
          className="creation-detail-preview"
          style={{
            background: isMock ? (creation.color + '11') : (creation.thumbnail_url ? `url(${creation.thumbnail_url}) center/cover no-repeat` : '#222'),
            borderColor: isMock ? creation.color : '#555'
          }}
        >
          {isMock
            ? <span style={{ fontSize: '80px' }}>{creation.creatorAvatar}</span>
            : (!creation.thumbnail_url && <span style={{ fontSize: '80px' }}>{categoryIcon}</span>)
          }
        </div>

        {/* Project Link for real creations */}
        {!isMock && creation.project_url && (
          <div style={{ textAlign: 'center', padding: '8px' }}>
            <a
              href={creation.project_url}
              target="_blank"
              rel="noopener noreferrer"
              className="retro-cta"
              style={{ display: 'inline-block' }}
            >
              🚀 LAUNCH PROJECT
            </a>
          </div>
        )}

        {/* Actions */}
        <div className="creation-detail-actions">
          <button
            className={`vote-btn ${voted === 'up' ? 'active' : ''}`}
            onClick={() => handleVote('up')}
          >
            👍 <span className="vote-count">{votes}</span>
          </button>
          <button
            className={`vote-btn ${voted === 'down' ? 'active' : ''}`}
            onClick={() => handleVote('down')}
          >
            👎
          </button>
          {isMock && (
            <span className="view-count">👁 {creation.views.toLocaleString()} views</span>
          )}
        </div>

        {/* Description */}
        <div className="retro-panel" style={{ marginBottom: '16px' }}>
          <div className="section-header">
            <h2>📝 Description</h2>
          </div>
          <div className="creation-detail-desc">
            {creation.description}
            {isMock && (
              <>
                <br /><br />
                This is an AI-powered creation built with love and pure vibes.
                Try it out, vote it up, and share it with your friends!
              </>
            )}
          </div>
        </div>

        {/* More by Creator (mock only for now) */}
        {moreBySameCreator.length > 0 && (
          <div className="retro-panel" style={{ marginBottom: '16px' }}>
            <div className="section-header">
              <h2>🎨 More by {creatorName}</h2>
            </div>
            <div className="retro-panel-body">
              {moreBySameCreator.map(c => (
                <div key={c.id} className="creator-list-item">
                  <span className="creator-list-avatar">{c.creatorAvatar}</span>
                  <Link to={`/creation/${c.id}`} className="creator-list-name">{c.title}</Link>
                  <span className="creator-list-stats">👍 {c.votes.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="retro-panel comments-section">
          <div className="section-header">
            <h2>💬 Comments ({mockComments.length})</h2>
          </div>

          <div className="comment-form">
            <textarea placeholder="Leave a comment... (Sign in required)" />
            <button>POST</button>
          </div>

          {mockComments.map((comment) => (
            <div key={comment.id} className="comment">
              <div className="comment-avatar">{comment.avatar}</div>
              <div className="comment-body">
                <div className="comment-user">{comment.user}</div>
                <div className="comment-text">{comment.text}</div>
                <div className="comment-date">{comment.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
