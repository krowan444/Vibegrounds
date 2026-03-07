import { useParams, Link } from 'react-router-dom';
import { mockCreations, mockComments } from '../data/mockCreations';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORY_ICONS } from '../components/CommunityWidgets';
import { normalizeUrl, isValidUrl } from './UploadPage';
import ReviewSection from '../components/ReviewSection';
import SiteHeader from '../components/SiteHeader';

const CATEGORIES = ['games', 'tools', 'art', 'experiments', 'websites', 'other'];

export default function CreationPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [creation, setCreation] = useState(null);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState(0);
  const [voted, setVoted] = useState(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', project_url: '', category: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

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

  // Owner check
  const isOwner = !isMock && user && creation?.creator_id === user.id;

  // Start editing
  const startEdit = () => {
    setEditForm({
      title: creation.title || '',
      description: creation.description || '',
      project_url: creation.project_url || '',
      category: creation.category || 'other'
    });
    setEditError('');
    setEditSuccess('');
    setIsEditing(true);
  };

  // Save edit
  const handleEditSave = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');
    setEditLoading(true);

    try {
      if (!editForm.title.trim()) throw new Error('Title is required');

      const normalizedUrl = normalizeUrl(editForm.project_url);
      if (!normalizedUrl || !isValidUrl(normalizedUrl)) {
        throw new Error('Please enter a valid website address (e.g. customaihoodies.com)');
      }

      const { data, error: updateErr } = await supabase
        .from('creations')
        .update({
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          project_url: normalizedUrl,
          category: editForm.category
        })
        .eq('id', id)
        .eq('creator_id', user.id) // extra safety: only own posts
        .select('*, profiles(username)')
        .single();

      if (updateErr) throw updateErr;

      // Update UI immediately
      setCreation(data);
      setEditSuccess('✅ Post updated successfully!');
      setTimeout(() => {
        setIsEditing(false);
        setEditSuccess('');
      }, 1500);
    } catch (err) {
      setEditError(err.message || 'Failed to save changes');
    } finally {
      setEditLoading(false);
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
            {isOwner && !isEditing && (
              <button
                onClick={startEdit}
                style={{
                  background: 'none', border: '1px solid var(--border-dark)',
                  color: 'var(--orange)', fontFamily: 'var(--font-retro)', fontSize: '14px',
                  padding: '2px 8px', cursor: 'pointer', marginLeft: '10px',
                  borderRadius: '2px'
                }}
              >
                ✏️ Edit
              </button>
            )}
          </div>
        </div>

        {/* EDIT FORM */}
        {isEditing && isOwner && (
          <div className="retro-panel" style={{ marginBottom: '16px' }}>
            <div className="section-header">
              <h2>✏️ Edit Post</h2>
            </div>
            <form onSubmit={handleEditSave} style={{ padding: '12px' }}>
              {editError && (
                <div style={{
                  background: '#331111', border: '2px solid #cc3333',
                  padding: '8px 12px', marginBottom: '12px',
                  fontFamily: 'var(--font-retro)', fontSize: '16px', color: '#ff6666'
                }}>
                  ⚠️ {editError}
                </div>
              )}
              {editSuccess && (
                <div style={{
                  background: '#113311', border: '2px solid #33cc33',
                  padding: '8px 12px', marginBottom: '12px',
                  fontFamily: 'var(--font-retro)', fontSize: '16px', color: '#66ff66'
                }}>
                  {editSuccess}
                </div>
              )}

              <div className="retro-form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  required
                  disabled={editLoading}
                  style={{
                    width: '100%', padding: '6px 8px',
                    background: 'var(--bg-input)', border: '2px solid var(--border-dark)',
                    color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '16px'
                  }}
                />
              </div>

              <div className="retro-form-group" style={{ marginTop: '8px' }}>
                <label>Description</label>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  disabled={editLoading}
                  style={{
                    width: '100%', minHeight: '80px', padding: '6px 8px',
                    background: 'var(--bg-input)', border: '2px solid var(--border-dark)',
                    color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '16px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div className="retro-form-group" style={{ marginTop: '8px' }}>
                <label>Project URL</label>
                <input
                  type="text"
                  value={editForm.project_url}
                  onChange={e => setEditForm({ ...editForm, project_url: e.target.value })}
                  required
                  disabled={editLoading}
                  style={{
                    width: '100%', padding: '6px 8px',
                    background: 'var(--bg-input)', border: '2px solid var(--border-dark)',
                    color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '16px'
                  }}
                />
                <div style={{ fontFamily: 'var(--font-retro)', fontSize: '13px', color: 'var(--text-dim)', marginTop: '2px' }}>
                  https:// will be added automatically if missing
                </div>
              </div>

              <div className="retro-form-group" style={{ marginTop: '8px' }}>
                <label>Category</label>
                <select
                  value={editForm.category}
                  onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                  disabled={editLoading}
                  style={{
                    width: '100%', padding: '6px 8px',
                    background: 'var(--bg-input)', border: '2px solid var(--border-dark)',
                    color: 'var(--text-primary)', fontFamily: 'var(--font-retro)', fontSize: '16px'
                  }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  type="submit"
                  disabled={editLoading}
                  style={{
                    background: 'var(--orange)', color: '#000', border: '2px solid var(--orange-dim)',
                    fontFamily: 'var(--font-pixel)', fontSize: '9px', padding: '8px 20px',
                    cursor: editLoading ? 'wait' : 'pointer', textTransform: 'uppercase',
                    fontWeight: 'bold', opacity: editLoading ? 0.6 : 1
                  }}
                >
                  {editLoading ? 'SAVING...' : '💾 SAVE CHANGES'}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsEditing(false); setEditError(''); setEditSuccess(''); }}
                  disabled={editLoading}
                  style={{
                    background: 'transparent', color: 'var(--text-dim)',
                    border: '2px solid var(--border-dark)',
                    fontFamily: 'var(--font-pixel)', fontSize: '9px', padding: '8px 20px',
                    cursor: 'pointer', textTransform: 'uppercase'
                  }}
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Preview Area — category icon only, no broken thumbnails */}
        <div
          className="creation-detail-preview"
          style={{
            background: isMock ? (creation.color + '11') : '#222',
            borderColor: isMock ? creation.color : '#555'
          }}
        >
          {isMock
            ? <span style={{ fontSize: '80px' }}>{creation.creatorAvatar}</span>
            : <span style={{ fontSize: '80px' }}>{categoryIcon}</span>
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

        {/* Reviews & Reactions */}
        {!isMock && <ReviewSection creationId={id} />}

        {/* Mock Comments fallback for demo creations */}
        {isMock && (
          <div className="retro-panel comments-section">
            <div className="section-header">
              <h2>💬 Comments ({mockComments.length})</h2>
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
        )}
      </div>
    </>
  );
}
