import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import CreationCard from '../components/CreationCard';
import ChartRail, { CreatorRail } from '../components/ChartRail';
import AdSlot from '../components/AdSlot';
import DailyCheckIn from '../components/DailyCheckIn';
import Notice from '../components/Notice';
import { compactNumber } from '../lib/format';

export default function HomePage() {
  const { user, profile } = useAuth();
  const [data, setData] = useState(null);
  const [mine, setMine] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      // allSettled, not all: one failing query must never leave the page
      // stuck on the loading spinner forever. Render what we have.
      const settle = (r) => (r.status === 'fulfilled' ? r.value : { data: [], error: r.reason });
      const results = (await Promise.allSettled([
          supabase.from('creations_public').select('*').eq('is_featured', true)
            .order('created_at', { ascending: false }).limit(4),
          supabase.from('creations_public').select('*')
            .order('created_at', { ascending: false }).limit(12),
          supabase.from('chart_daily').select('*').order('rank').limit(5),
          supabase.from('chart_weekly').select('*').order('rank').limit(5),
          supabase.from('chart_monthly').select('*').order('rank').limit(5),
          supabase.from('chart_alltime').select('*').order('rank').limit(5),
          supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
          supabase.from('creator_leaderboard').select('*').order('rank').limit(5),
          supabase.from('creations_public').select('id', { count: 'exact', head: true }),
        ])).map(settle);

      const [featured, latest, daily, weekly, monthly, alltime, cats, creators, counts] = results;

      if (!alive) return;
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) {
        setError(
          `Could not load everything: ${firstError.message || firstError}. ` +
          `If this persists, the site may be pointed at the wrong database.`,
        );
      }

      setData({
        featured: featured.data || [],
        latest: latest.data || [],
        daily: daily.data || [],
        weekly: weekly.data || [],
        monthly: monthly.data || [],
        alltime: alltime.data || [],
        categories: cats.data || [],
        creators: creators.data || [],
        total: counts.count || 0,
      });
    })().catch((e) => {
      // Never leave the spinner up. Show an empty page with the reason.
      if (!alive) return;
      setError(e?.message || 'Something went wrong loading the Portal.');
      setData({
        featured: [], latest: [], daily: [], weekly: [], monthly: [],
        alltime: [], categories: [], creators: [], total: 0,
      });
    });
    return () => { alive = false; };
  }, []);

  // "You're on the front page" — the bit that makes it feel special.
  useEffect(() => {
    if (!user || !data) return;
    const charts = [
      ...data.daily.map((c) => ({ ...c, chart: 'Daily' })),
      ...data.weekly.map((c) => ({ ...c, chart: 'Weekly' })),
      ...data.alltime.map((c) => ({ ...c, chart: 'All-Time' })),
    ];
    setMine(charts.filter((c) => c.creator_id === user.id));
  }, [user, data]);

  if (!data) {
    return (
      <>
        <SiteHeader />
        <div className="vg-page"><div className="vg-loading">⏳ Loading the Portal...</div></div>
      </>
    );
  }

  return (
    <>
      <SiteHeader />

      <div className="vg-page">
        <Notice tone="error">{error}</Notice>
        <DailyCheckIn />

        {mine.length > 0 && (
          <div className="vg-yours">
            🎉 <strong style={{ color: 'var(--yellow)' }}>You&#39;re on the charts!</strong>{' '}
            {mine.slice(0, 2).map((c, i) => (
              <span key={`${c.chart}-${c.id}`}>
                {i > 0 && ' · '}
                <Link to={`/creation/${c.id}`} style={{ color: 'var(--orange)', fontWeight: 'bold' }}>
                  {c.title}
                </Link>{' '}
                is #{c.rank} on {c.chart}
              </span>
            ))}
          </div>
        )}

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
                <span style={{ color: 'var(--text-dim)' }}>
                  {' '}— {profile.rank_title}, level {profile.level}
                </span>
              )}
            </div>
            <Link to="/upload" className="vg-daily-btn" style={{ textDecoration: 'none' }}>
              🚀 SUBMIT SOMETHING
            </Link>
          </div>
        )}

        {/* ── main + rail ── */}
        <div className="vg-layout">
          <div>
            {data.total === 0 && (
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

            <div className="vg-section">
              <div className="vg-section-head">
                <h2>BROWSE THE GROUNDS</h2>
                <span className="vg-sub">{compactNumber(data.total)} submissions and counting</span>
              </div>
              <div className="vg-cats">
                {data.categories.map((c) => (
                  <Link key={c.slug} to={`/category/${c.slug}`} className="vg-cat" style={{ borderColor: c.color }}>
                    <div className="vg-cat-icon">{c.icon}</div>
                    <div className="vg-cat-name" style={{ color: c.color }}>{c.name}</div>
                    <div className="vg-cat-count">{c.tagline}</div>
                  </Link>
                ))}
              </div>
            </div>

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
          </div>

          {/* ── the rail ── */}
          <aside className="vg-rail">
            <AdSlot index={0} />
            <ChartRail title="Top Daily"   icon="☀️" rows={data.daily}   to="/charts?chart=daily" />
            <ChartRail title="Top Weekly"  icon="📅" rows={data.weekly}  to="/charts?chart=weekly" />
            <ChartRail title="Top Monthly" icon="🗓️" rows={data.monthly} to="/charts?chart=monthly" />
            <ChartRail
              title="All-Time 100" icon="👑" rows={data.alltime} to="/charts?chart=alltime"
              emptyText="Needs 5 votes to chart. Go and rate something."
            />
            <CreatorRail rows={data.creators} />
            <AdSlot index={1} sticky />
          </aside>
        </div>
      </div>
    </>
  );
}
