import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { supabase, looksMissing } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import CouldNotLoad from '../components/CouldNotLoad';
import CreationCard from '../components/CreationCard';
import BadgeGrid from '../components/BadgeGrid';
import LevelBar from '../components/LevelBar';
import ReportButton from '../components/ReportButton';
import Notice from '../components/Notice';
import { compactNumber, shortDate } from '../lib/format';
import { useDocumentTitle } from '../lib/pageMeta';

const TABS = [
  { id: 'creations', label: 'Creations' },
  { id: 'badges',    label: 'Badges' },
  { id: 'stats',     label: 'Stats' },
];

export default function ProfilePage() {
  const { username } = useParams();
  const { user, isStaff, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState(null);
  const [creations, setCreations] = useState([]);
  const [badges, setBadges] = useState([]);
  const [allBadges, setAllBadges] = useState([]);
  const [tab, setTab] = useState('creations');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const [error] = useState('');

  useDocumentTitle(
    profile?.username ? `${profile.username}'s Profile` : undefined,
    profile?.username
      ? `${profile.username} on VibeGrounds — what they have built, the badges they hold and how far up the charts they have got.`
      : undefined,
  );


  const isOwn = !authLoading && user && profile && user.id === profile.id;

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setUnreachable(false);

    const { data: p, error: perr } = await supabase
      .from('profiles_public').select('*').ilike('username', username).maybeSingle();

    // "Nobody is called that" and "we could not ask" are different answers,
    // and only one of them is safe to tell somebody. Inviting a visitor to
    // claim a name that is in fact taken, because their connection blinked,
    // would be the site lying about another member.
    if (perr && !looksMissing(perr)) {
      setUnreachable(true); setProfile(null); setLoading(false); return;
    }
    if (!p) { setNotFound(true); setProfile(null); setLoading(false); return; }
    setProfile(p);

    const [cre, bad, all] = await Promise.all([
      supabase.from('creations_public').select('*')
        .eq('creator_id', p.id).order('created_at', { ascending: false }),
      supabase.from('user_badges_detailed').select('*')
        .eq('user_id', p.id).order('sort_order'),
      supabase.from('badge_stats').select('*').eq('is_secret', false).order('sort_order'),
    ]);

    setCreations(cre.data || []);
    setBadges(bad.data || []);
    setAllBadges(all.data || []);
    setLoading(false);
  }, [username]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <>
        <SiteHeader compact />
        <div className="vg-page"><div className="vg-loading">⏳ Loading profile...</div></div>
      </>
    );
  }

  if (unreachable) {
    return (
      <CouldNotLoad
        what="This Profile"
        onRetry={load}
        backTo="/portal"
        backLabel="Back to the Portal"
      />
    );
  }

  if (notFound) {
    return (
      <>
        <SiteHeader compact />
        <div className="vg-page">
          <div className="retro-panel">
            <div className="section-header"><h2>👾 Profile Not Found</h2></div>
            <div className="vg-empty">
              <p>Nobody called <strong style={{ color: 'var(--orange)' }}>{username}</strong> here... yet.</p>
              <p style={{ marginTop: '10px' }}>
                <Link to="/auth?mode=signup" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>
                  Claim the name →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const earned = new Set(badges.map((b) => b.slug));
  const locked = allBadges.filter((b) => !earned.has(b.slug));
  const accent = profile.rank_colour || 'var(--orange)';

  return (
    <>
      <SiteHeader compact />

      <div className="vg-page">
        <Notice tone="error">{error}</Notice>

        {profile.is_banned && (
          <Notice tone="error">
            This account is suspended. Its submissions are hidden from the Portal.
          </Notice>
        )}

        {/* ── header ── */}
        <div className="retro-panel" style={{ marginBottom: '14px', borderColor: accent }}>
          {profile.banner_url && (
            <div style={{ height: '110px', overflow: 'hidden', borderBottom: `2px solid ${accent}` }}>
              <img src={profile.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: '14px', padding: '14px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{
              width: '84px', height: '84px', flexShrink: 0,
              background: 'var(--bg-dark)', border: `2px solid ${accent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '44px', overflow: 'hidden',
            }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt={profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : '👾'}
            </div>

            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: '17px', color: 'var(--text-bright)' }}>
                  {profile.username}
                </h1>
                {profile.role !== 'user' && (
                  <span style={{
                    fontFamily: 'var(--font-pixel)', fontSize: '7px', padding: '3px 5px',
                    background: 'var(--orange)', color: '#000',
                  }}>
                    {profile.role.toUpperCase()}
                  </span>
                )}
              </div>

              <div style={{
                fontFamily: 'var(--font-retro)', fontSize: '18px',
                color: 'var(--text-secondary)', marginTop: '5px', lineHeight: 1.35,
              }}>
                {profile.bio || <span style={{ color: 'var(--text-dim)' }}>No bio yet. Mysterious. 🕵️</span>}
              </div>

              <div style={{
                fontFamily: 'var(--font-retro)', fontSize: '15px', color: 'var(--text-dim)',
                marginTop: '6px', display: 'flex', gap: '12px', flexWrap: 'wrap',
              }}>
                <span>📅 Joined {shortDate(profile.created_at)}</span>
                {profile.location && <span>📍 {profile.location}</span>}
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer nofollow" style={{ color: 'var(--orange)' }}>
                    🌐 {profile.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {profile.daily_streak > 0 && <span>🔥 {profile.daily_streak} day streak</span>}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                {isOwn && (
                  <Link
                    to="/edit-profile"
                    style={{
                      fontFamily: 'var(--font-pixel)', fontSize: '9px',
                      background: 'var(--orange)', color: '#000', padding: '6px 12px',
                      border: '2px solid var(--orange-dim)', textDecoration: 'none',
                    }}
                  >
                    ⚙️ EDIT PROFILE
                  </Link>
                )}
                {!isOwn && user && <ReportButton targetType="profile" targetId={profile.id} />}
                {isStaff && !isOwn && (
                  <Link
                    to="/admin"
                    style={{
                      fontFamily: 'var(--font-pixel)', fontSize: '9px', color: 'var(--red)',
                      border: '2px solid var(--border-dark)', padding: '6px 12px', textDecoration: 'none',
                    }}
                  >
                    🛡️ MODERATE
                  </Link>
                )}
              </div>
            </div>

            <div style={{ flex: '0 1 240px' }}>
              <LevelBar profile={profile} />
            </div>
          </div>

          <div className="vg-stats" style={{ padding: '0 14px 14px' }}>
            <div className="vg-stat">
              <div className="vg-stat-value">{profile.submission_count}</div>
              <div className="vg-stat-label">Submissions</div>
            </div>
            <div className="vg-stat">
              <div className="vg-stat-value" style={{ color: 'var(--orange)' }}>
                {Number(profile.avg_score).toFixed(2)}
              </div>
              <div className="vg-stat-label">Avg score</div>
            </div>
            <div className="vg-stat">
              <div className="vg-stat-value">{compactNumber(profile.total_views)}</div>
              <div className="vg-stat-label">Views</div>
            </div>
            <div className="vg-stat">
              <div className="vg-stat-value">{profile.votes_received}</div>
              <div className="vg-stat-label">Votes received</div>
            </div>
            <div className="vg-stat">
              <div className="vg-stat-value" style={{ color: 'var(--yellow)' }}>{profile.badge_count}</div>
              <div className="vg-stat-label">Badges</div>
            </div>
          </div>
        </div>

        {/* ── tabs ── */}
        <div className="vg-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`vg-tab ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label.toUpperCase()}
              {t.id === 'creations' && ` (${creations.length})`}
              {t.id === 'badges' && ` (${badges.length})`}
            </button>
          ))}
        </div>

        {tab === 'creations' && (
          creations.length === 0 ? (
            <div className="vg-empty">
              {isOwn ? (
                <>
                  <p>You haven&#39;t posted anything yet.</p>
                  <p style={{ marginTop: '10px' }}>
                    <Link to="/upload" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>
                      Upload your first creation →
                    </Link>
                  </p>
                </>
              ) : (
                <p>Nothing posted yet.</p>
              )}
            </div>
          ) : (
            <div className="vg-grid">
              {creations.map((c) => <CreationCard key={c.id} creation={c} />)}
            </div>
          )
        )}

        {tab === 'badges' && (
          <>
            <div className="vg-section">
              <div className="vg-section-head">
                <h2>🏆 EARNED</h2>
                <span className="vg-sub">Tap a badge for its rarity</span>
              </div>
              <BadgeGrid
                badges={badges}
                emptyText={isOwn
                  ? 'No badges yet. Post something, vote on things, fill in your profile.'
                  : 'No badges yet.'}
              />
            </div>

            {isOwn && locked.length > 0 && (
              <div className="vg-section">
                <div className="vg-section-head">
                  <h2>🔒 STILL TO EARN</h2>
                  <span className="vg-sub">{locked.length} remaining</span>
                </div>
                <div className="vg-badges">
                  {locked.map((b) => (
                    <div
                      key={b.slug}
                      className="vg-badge"
                      style={{ opacity: 0.45, cursor: 'default' }}
                      title={b.description}
                    >
                      <span className="vg-badge-icon" style={{ filter: 'grayscale(1)' }}>{b.icon}</span>
                      <span className="vg-badge-name">{b.name}</span>
                      <span className="vg-badge-rarity" style={{ color: 'var(--text-dim)' }}>
                        {b.holder_percent}% HAVE IT
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'stats' && (
          <div className="retro-panel">
            <div className="section-header"><h2>📊 Career Stats</h2></div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['Rank', `${profile.rank_title} (level ${profile.level})`],
                  ['Total XP', compactNumber(profile.xp)],
                  ['XP to next level', compactNumber(Math.max(0, profile.xp_level_ceiling - profile.xp))],
                  ['Submissions', profile.submission_count],
                  ['Average score', Number(profile.avg_score).toFixed(2)],
                  ['Total views', compactNumber(profile.total_views)],
                  ['Votes received', profile.votes_received],
                  ['Votes cast', profile.total_votes_cast],
                  ['Badges earned', `${profile.badge_count} of ${allBadges.length}`],
                  ['Current streak', `${profile.daily_streak} day${profile.daily_streak === 1 ? '' : 's'}`],
                  ['Longest streak', `${profile.longest_streak} day${profile.longest_streak === 1 ? '' : 's'}`],
                  ['Member since', shortDate(profile.created_at)],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td style={{
                      padding: '8px 12px', fontFamily: 'var(--font-retro)', fontSize: '17px',
                      color: 'var(--text-dim)', borderBottom: '1px solid var(--border-dark)',
                    }}>
                      {label}
                    </td>
                    <td style={{
                      padding: '8px 12px', fontFamily: 'var(--font-retro)', fontSize: '17px',
                      color: 'var(--text-bright)', textAlign: 'right',
                      borderBottom: '1px solid var(--border-dark)',
                    }}>
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
