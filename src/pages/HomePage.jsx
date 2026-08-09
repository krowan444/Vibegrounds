import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase, retryOnAbort } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import CreationCard from '../components/CreationCard';
import ChartRail, { CreatorRail } from '../components/ChartRail';
import AdSlot from '../components/AdSlot';
import JokeAd from '../components/JokeAd';
import HeroAd from '../components/HeroAd';
import DailyCheckIn from '../components/DailyCheckIn';
import RatingQuest from '../components/RatingQuest';
import Notice from '../components/Notice';
import { compactNumber, timeAgo, scoreLabel, scoreLabelColor } from '../lib/format';
import { thumbFor, onThumbError, LOGO_FALLBACK } from '../lib/thumbnail';

export default function HomePage() {
  const { user, profile } = useAuth();
  const [d, setD] = useState(null);
  const [mine, setMine] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const settle = (r) => (r.status === 'fulfilled' ? r.value : { data: [], error: r.reason });
      const R = (await Promise.allSettled([
        retryOnAbort(() => supabase.from('creations_public').select('*').eq('is_featured', true)
          .order('created_at', { ascending: false }).limit(4)),
        retryOnAbort(() => supabase.from('creations_public').select('*')
          .order('created_at', { ascending: false }).limit(12)),
        retryOnAbort(() => supabase.from('chart_daily').select('*').order('rank').limit(10)),
        retryOnAbort(() => supabase.from('chart_weekly').select('*').order('rank').limit(10)),
        retryOnAbort(() => supabase.from('chart_alltime').select('*').order('rank').limit(100)),
        retryOnAbort(() => supabase.from('categories').select('*').eq('is_active', true).order('sort_order')),
        retryOnAbort(() => supabase.from('creator_leaderboard').select('*').order('rank').limit(5)),
        retryOnAbort(() => supabase.from('creations_public').select('id', { count: 'exact', head: true })),
        retryOnAbort(() => supabase.from('profiles_public').select('id', { count: 'exact', head: true })),
      ])).map(settle);

      const [featured, latest, daily, weekly, alltime, cats, creators, cCount, uCount] = R;
      if (!alive) return;

      const firstError = R.find((r) => r.error)?.error;
      if (firstError) setError(`Could not load everything: ${firstError.message || firstError}`);

      setD({
        featured: featured.data || [],
        latest: latest.data || [],
        daily: daily.data || [],
        weekly: weekly.data || [],
        alltime: alltime.data || [],
        categories: cats.data || [],
        creators: creators.data || [],
        total: cCount.count || 0,
        members: uCount.count || 0,
      });
    })().catch((e) => {
      if (!alive) return;
      setError(e?.message || 'Something went wrong loading the Portal.');
      setD({ featured: [], latest: [], daily: [], weekly: [], alltime: [],
             categories: [], creators: [], total: 0, members: 0 });
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user || !d) return;
    const all = [
      ...d.daily.map((c) => ({ ...c, chart: 'Daily' })),
      ...d.weekly.map((c) => ({ ...c, chart: 'Weekly' })),
      ...d.alltime.slice(0, 100).map((c) => ({ ...c, chart: 'All-Time' })),
    ];
    setMine(all.filter((c) => c.creator_id === user.id));
  }, [user, d]);

  if (!d) {
    return (
      <>
        <SiteHeader />
        <div className="vg-page"><div className="vg-loading">⏳ Loading the Portal...</div></div>
      </>
    );
  }

  const newest = d.latest[0];

  return (
    <>
      <SiteHeader />

      <div className="vg-page">
        <Notice tone="error">{error}</Notice>
        <DailyCheckIn />
        <RatingQuest />

        {/* live activity strip */}
        {newest && (
          <div className="vg-ticker">
            <span className="vg-ticker-label">LIVE</span>
            <span>
              <b>{compactNumber(d.total)}</b> submissions ·{' '}
              <b>{compactNumber(d.members)}</b> members · newest:{' '}
              <Link to={`/creation/${newest.id}`} style={{ color: 'var(--blue-link)' }}>
                {newest.title}
              </Link>{' '}
              by {newest.creator_username} — {timeAgo(newest.created_at)}
            </span>
          </div>
        )}

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

        {/* ── three columns ── */}
        <div className="vg-3col">

          {/* LEFT — today and this week */}
          <div className="vg-col vg-col-left">
            <ChartRail
              title="Top 10 Today" icon="☀️" rows={d.daily} to="/charts?chart=daily"
              emptyText="Nothing charted today yet."
            />
            <ChartRail
              title="Top 10 This Week" icon="📅" rows={d.weekly} to="/charts?chart=weekly"
              emptyText="Nothing charted this week yet."
            />
            <JokeAd index={6} />
            <CreatorRail rows={d.creators} />
            <JokeAd index={7} />
            <JokeAd index={0} />
            <JokeAd index={1} />
          </div>

          {/* MIDDLE — featured ad, then the sections */}
          <div className="vg-col">
            <HeroAd creation={d.featured[0]} />

            {!user ? (
              <div className="vg-strip" style={{ borderColor: 'var(--orange)', margin: 0 }}>
                <div style={{ fontFamily: 'var(--font-retro)', fontSize: '19px' }}>
                  <strong style={{ color: 'var(--orange)' }}>Made something weird?</strong>{' '}
                  <span style={{ color: 'var(--text-secondary)' }}>50 free coins when you join.</span>
                </div>
                <Link to="/auth?mode=signup" className="vg-daily-btn" style={{ textDecoration: 'none' }}>
                  JOIN VIBEGROUNDS
                </Link>
              </div>
            ) : (
              <div className="vg-strip" style={{ margin: 0 }}>
                <div style={{ fontFamily: 'var(--font-retro)', fontSize: '19px' }}>
                  Welcome back, <strong style={{ color: 'var(--orange)' }}>{profile?.username}</strong>
                  {profile?.rank_title && (
                    <span style={{ color: 'var(--text-dim)' }}> — {profile.rank_title}, lv {profile.level}</span>
                  )}
                </div>
                <Link to="/upload" className="vg-daily-btn" style={{ textDecoration: 'none' }}>
                  🚀 SUBMIT
                </Link>
              </div>
            )}

            <div className="vg-section" style={{ marginBottom: 0 }}>
              <div className="vg-section-head">
                <h2>BROWSE THE GROUNDS</h2>
                <span className="vg-sub">{compactNumber(d.total)} submissions</span>
              </div>
              <div className="vg-cats">
                {d.categories.map((c) => (
                  <Link key={c.slug} to={`/category/${c.slug}`} className="vg-cat" style={{ borderColor: c.color }}>
                    <div className="vg-cat-icon">{c.icon}</div>
                    <div className="vg-cat-name" style={{ color: c.color }}>{c.name}</div>
                    <div className="vg-cat-count">{c.tagline}</div>
                  </Link>
                ))}
              </div>
            </div>

            {/* The first pick is already the hero above, so skip it here
                rather than showing the same submission twice. */}
            {d.featured.length > 1 && (
              <div className="vg-section" style={{ marginBottom: 0 }}>
                <div className="vg-section-head">
                  <h2>⭐ MORE STAFF PICKS</h2>
                  <span className="vg-sub">Hand-chosen</span>
                </div>
                <div className="vg-grid vg-grid-tight">
                  {d.featured.slice(1).map((c) => <CreationCard key={c.id} creation={c} />)}
                </div>
              </div>
            )}

            {d.latest.length > 0 ? (
              <div className="vg-section" style={{ marginBottom: 0 }}>
                <div className="vg-section-head">
                  <h2>🆕 FRESH OUT THE PORTAL</h2>
                  <Link to="/portal">Browse everything →</Link>
                </div>
                <div className="vg-grid vg-grid-tight">
                  {d.latest.map((c) => <CreationCard key={c.id} creation={c} />)}
                </div>
              </div>
            ) : (
              <div className="retro-panel">
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

            <AdSlot index={1} />
          </div>

          {/* RIGHT — the All-Time 100, straight away */}
          <div className="vg-col vg-col-right">
            <div className="vg-rail-box vg-rail-scroll">
              <div className="vg-rail-head" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <span>👑 ALL-TIME TOP 100</span>
                <Link to="/charts?chart=alltime">full</Link>
              </div>
              {d.alltime.length === 0 ? (
                <div className="vg-rail-empty">
                  Needs 5 votes to chart.<br />Go and rate something.
                </div>
              ) : (
                d.alltime.map((c) => (
                  <Link key={c.id} to={`/creation/${c.id}`} className="vg-rail-row">
                    <span className={`vg-rail-rank ${c.rank <= 3 ? 'medal' : ''}`}>
                      {c.rank === 1 ? '🥇' : c.rank === 2 ? '🥈' : c.rank === 3 ? '🥉' : c.rank}
                    </span>
                    <span className="vg-rail-thumb">
                      <img
                        src={thumbFor(c, 120)}
                        alt=""
                        loading="lazy"
                        onError={onThumbError}
                        className={thumbFor(c, 120) === LOGO_FALLBACK ? 'vg-thumb-placeholder' : undefined}
                      />
                    </span>
                    <span className="vg-rail-body">
                      <span className="vg-rail-title">{c.title}</span>
                      <span className="vg-rail-by">by {c.creator_username}</span>
                    </span>
                    <span className="vg-rail-score" style={{ color: scoreLabelColor(c) }}>
                      {scoreLabel(c)}
                    </span>
                  </Link>
                ))
              )}
            </div>
            <AdSlot index={0} />
          </div>
        </div>
      </div>
    </>
  );
}
