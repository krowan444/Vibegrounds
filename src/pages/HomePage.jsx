import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import CreationCard from '../components/CreationCard';
import DailyCheckIn from '../components/DailyCheckIn';
import Notice from '../components/Notice';
import { compactNumber } from '../lib/format';

export default function HomePage() {
  const { user, profile } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const [featured, latest, daily, weekly, alltime, cats, creators, counts] = await Promise.all([
        supabase.from('creations_public').select('*').eq('is_featured', true)
          .order('created_at', { ascending: false }).limit(4),
        supabase.from('creations_public').select('*')
          .order('created_at', { ascending: false }).limit(12),
        supabase.from('chart_daily').select('*').order('rank').limit(5),
        supabase.from('chart_weekly').select('*').order('rank').limit(5),
        supabase.from('chart_alltime').select('*').order('rank').limit(5),
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('creator_leaderboard').select('*').order('rank').limit(5),
        supabase.from('creations_public').select('id', { count: 'exact', head: true }),
      ]);

      if (!alive) return;
      const firstError = [featured, latest, daily, weekly, alltime, cats, creators]
        .find((r) => r.error)?.error;
      if (firstError) setError(firstError.message);

      setData({
        featured: featured.data || [],
        latest: latest.data || [],
        daily: daily.data || [],
        weekly: weekly.data || [],
        alltime: alltime.data || [],
        categories: cats.data || [],
        creators: creators.data || [],
        total: counts.count || 0,
      });
    })();
    return () => { alive = false; };
  }, []);

  if (!data) {
    return (
      <>
        <SiteHeader />
        <div className="vg-page"><div className="vg-loading">⏳ Loading the Portal...</div></div>
      </>
    );
  }

  const isEmpty = data.total === 0;

  return (
    <>
      <SiteHeader />

      <div className="vg-page">
        <Notice tone="error">{error}</Notice>

        <DailyCheckIn />

        {/* Welcome / call to action */}
        {!user ? (
          <div className="vg-strip" style={{ borderColor: 'var(--orange)' }}>
            <div style={{ fontFamily: 'var(--font-retro)', fontSize: '19px' }}>
              <strong style={{ color: 'var(--orange)' }}>Made something weird?</strong>{' '}
              <span style={{ color: 'var(--text-secondary)' }}>
                Post it. 50 free coins when you join — that&#39;s 5 submissions.
              </span>
            </div>
            <Link to="/auth?mode=signup" className="vg-daily-btn" style={{ textDecoration: 'none' }}>
              JOIN VIBEGROUNDS
            </Link>
          </div>
        ) : (
          <div className="vg-strip">
            <div style={{ fontFamily: 'var(--font-retro)', fontSize: '19px' }}>
              Welcome back, <strong style={{ color: 'var(--orange)' }}>{profile?.username}</strong>
              {profile?.rank_title && (
                <span style={{ color: 'var(--text-dim)' }}> — {profile.rank_title}, level {profile.level}</span>
              )}
            </div>
            <Link to="/upload" className="vg-daily-btn" style={{ textDecoration: 'none' }}>
              🚀 SUBMIT SOMETHING
            </Link>
          </div>
        )}

        {isEmpty && (
          <div className="retro-panel" style={{ marginBottom: '20px' }}>
            <div className="section-header"><h2>🌱 The Grounds Are Brand New</h2></div>
            <div className="vg-empty">
              <p>Nothing has been posted yet. Someone has to go first.</p>
              <p style={{ marginTop: '10px' }}>
                <Link to="/upload" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>
                  Be the first submission →
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Categories */}
        <div className="vg-section">
          <div className="vg-section-head">
            <h2>BROWSE THE GROUNDS</h2>
            <span className="vg-sub">{compactNumber(data.total)} submissions and counting</span>
          </div>
          <div className="vg-cats">
            {data.categories.map((c) => (
              <Link
                key={c.slug}
                to={`/category/${c.slug}`}
                className="vg-cat"
                style={{ borderColor: c.color }}
              >
                <div className="vg-cat-icon">{c.icon}</div>
                <div className="vg-cat-name" style={{ color: c.color }}>{c.name}</div>
                <div className="vg-cat-count">{c.tagline}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Featured */}
        {data.featured.length > 0 && (
          <div className="vg-section">
            <div className="vg-section-head">
              <h2>⭐ STAFF PICKS</h2>
              <span className="vg-sub">Hand-chosen by the crew</span>
            </div>
            <div className="vg-grid">
              {data.featured.map((c) => <CreationCard key={c.id} creation={c} />)}
            </div>
          </div>
        )}

        {/* Charts */}
        {(data.daily.length || data.weekly.length || data.alltime.length) > 0 && (
          <div className="vg-section">
            <div className="vg-section-head">
              <h2>📈 THE CHARTS</h2>
              <Link to="/charts">See the full Top 100 →</Link>
            </div>

            <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
              <ChartBox title="☀️ Top Daily" to="/charts?chart=daily" rows={data.daily} />
              <ChartBox title="📅 Top Weekly" to="/charts?chart=weekly" rows={data.weekly} />
              <ChartBox title="👑 All-Time" to="/charts?chart=alltime" rows={data.alltime} />
            </div>
          </div>
        )}

        {/* Latest */}
        {data.latest.length > 0 && (
          <div className="vg-section">
            <div className="vg-section-head">
              <h2>🆕 FRESH OUT THE PORTAL</h2>
              <Link to="/portal">Browse everything →</Link>
            </div>
            <div className="vg-grid">
              {data.latest.map((c) => <CreationCard key={c.id} creation={c} />)}
            </div>
          </div>
        )}

        {/* Top creators */}
        {data.creators.length > 0 && (
          <div className="vg-section">
            <div className="vg-section-head">
              <h2>🏆 TOP CREATORS</h2>
              <span className="vg-sub">Ranked by XP</span>
            </div>
            <div className="retro-panel">
              {data.creators.map((c) => (
                <Link
                  key={c.id}
                  to={`/profile/${c.username}`}
                  className="vg-row"
                >
                  <div className="vg-rank">{c.rank}</div>
                  <div className="vg-row-thumb">
                    {c.avatar_url
                      ? <img src={c.avatar_url} alt="" />
                      : <span className="vg-thumb-fallback">👾</span>}
                  </div>
                  <div className="vg-row-body">
                    <div className="vg-row-title">{c.username}</div>
                    <div className="vg-row-meta">
                      {c.rank_title} · level {c.level} · {c.submission_count} submission
                      {c.submission_count === 1 ? '' : 's'} · {c.badge_count} badges
                    </div>
                  </div>
                  <div className="vg-row-score">
                    <div style={{ color: 'var(--orange)' }}>{compactNumber(c.xp)}</div>
                    <span>XP</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ChartBox({ title, to, rows }) {
  return (
    <div className="retro-panel">
      <div className="section-header"><h2>{title}</h2></div>
      {rows.length === 0 ? (
        <div className="vg-empty" style={{ padding: '20px', fontSize: '17px' }}>
          Nothing has charted yet.
        </div>
      ) : (
        rows.map((c) => <CreationCard key={c.id} creation={c} variant="rank" rank={c.rank} />)
      )}
      <div style={{ padding: '7px 10px', textAlign: 'right' }}>
        <Link to={to} style={{ fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--blue-link)' }}>
          full chart →
        </Link>
      </div>
    </div>
  );
}
