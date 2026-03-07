import { useParams, Link } from 'react-router-dom';
import { mockCreations, mockComments } from '../data/mockCreations';
import { useState } from 'react';
import SiteHeader from '../components/SiteHeader';

export default function CreationPage() {
  const { id } = useParams();
  const creation = mockCreations.find(c => c.id === parseInt(id)) || mockCreations[0];
  const [votes, setVotes] = useState(creation.votes);
  const [voted, setVoted] = useState(null);
  const moreBySameCreator = mockCreations.filter(
    c => c.creator === creation.creator && c.id !== creation.id
  );

  const handleVote = (type) => {
    if (voted === type) {
      setVoted(null);
      setVotes(creation.votes);
    } else {
      setVoted(type);
      setVotes(type === 'up' ? creation.votes + 1 : creation.votes - 1);
    }
  };

  return (
    <>
      <SiteHeader compact />

      <div className="creation-detail">
        <div className="creation-detail-header">
          <h1 className="creation-detail-title">{creation.title}</h1>
          <div className="creation-detail-creator">
            by <Link to={`/profile/${creation.creator}`}>{creation.creator}</Link>
            {' '} — {creation.category}
          </div>
        </div>

        {/* Preview Area */}
        <div
          className="creation-detail-preview"
          style={{ background: creation.color + '11', borderColor: creation.color }}
        >
          <span style={{ fontSize: '80px' }}>{creation.creatorAvatar}</span>
        </div>

        {/* Actions */}
        <div className="creation-detail-actions">
          <button
            className={`vote-btn ${voted === 'up' ? 'active' : ''}`}
            onClick={() => handleVote('up')}
          >
            👍 <span className="vote-count">{voted === 'up' ? votes : creation.votes}</span>
          </button>
          <button
            className={`vote-btn ${voted === 'down' ? 'active' : ''}`}
            onClick={() => handleVote('down')}
          >
            👎
          </button>
          <span className="view-count">👁 {creation.views.toLocaleString()} views</span>
        </div>

        {/* Description */}
        <div className="retro-panel" style={{ marginBottom: '16px' }}>
          <div className="section-header">
            <h2>📝 Description</h2>
          </div>
          <div className="creation-detail-desc">
            {creation.description}
            <br /><br />
            This is an AI-powered creation built with love and pure vibes.
            Try it out, vote it up, and share it with your friends!
          </div>
        </div>

        {/* More by Creator */}
        {moreBySameCreator.length > 0 && (
          <div className="retro-panel" style={{ marginBottom: '16px' }}>
            <div className="section-header">
              <h2>🎨 More by {creation.creator}</h2>
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
