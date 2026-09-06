import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, retryOnAbort, loadFailure } from '../lib/supabase';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import SubmitCta from '../components/SubmitCta';
import { compactNumber } from '../lib/format';

/**
 * Every creator, ranked.
 *
 * The "more" link on the Top Creators rail pointed at
 * /charts?chart=creators. There is no such chart: ChartsPage looks the id up
 * in its CHARTS list and falls back to CHARTS[0] when it misses, so the link
 * quietly delivered people to the daily submissions chart instead. It looked
 * like it worked, which is why it survived — the page that loaded was a real
 * page, just the wrong one.
 *
 * A tab on ChartsPage would have been the smaller diff and the worse page.
 * That page is built around submissions all the way down: it filters by
 * category, it explains that scores are an average out of five, its rows
 * carry a thumbnail and a score, and it closes by inviting you to submit
 * something. A creator has no category and no score out of five, so four
 * separate branches would have had to run through it to make one tab behave
 * differently from the other five.
 *
 * Ranked by merit — the sum of score × vote_count across everything somebody
 * has published, which is what creator_leaderboard already orders by. That is
 * deliberately not the same as "who posted most": twenty things nobody rated
 * should not outrank three that people thought were good. The column is shown
 * rather than hidden so the order is checkable rather than mysterious.
 */
export default function CreatorsPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    retryOnAbort(() =>
      supabase.from('creator_leaderboard').select('*').order('rank').limit(100),
    )
      .then(({ data, error: err }) => {
        if (!alive) return;
        setError(err ? loadFailure(err, 'the creator list') : '');
        setRows(data || []);
      })
      .catch((e) => {
        if (!alive) return;
        setError(loadFailure(e, 'the creator list'));
        setRows([]);
      });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <SiteHeader compact />

      <div className="vg-page" style={{ maxWidth: '900px' }}>
        <div className="vg-section-head">
          <h2>👑 TOP CREATORS</h2>
          <span className="vg-sub">Ranked by what people thought of the work</span>
        </div>

        <div style={{
          padding: '9px 12px', fontFamily: 'var(--font-retro)', fontSize: '17px',
          color: 'var(--text-dim)', borderBottom: '1px solid var(--border-dark)',
          lineHeight: 1.5,
        }}>
          Merit is every submission&#39;s score multiplied by the number of
          people who voted on it, added up. Posting more does not move you up
          on its own — a lot of work nobody rated counts for less than a little
          that people liked.
        </div>

        <Notice tone="error" style={{ margin: '12px 0' }}>{error}</Notice>

        {rows === null ? (
          <div style={{
            padding: '40px', textAlign: 'center',
            fontFamily: 'var(--font-retro)', fontSize: '20px', color: 'var(--orange)',
          }}>
            ⏳ Counting the votes...
          </div>
        ) : rows.length === 0 ? (
          <div style={{
            padding: '40px', textAlign: 'center', fontFamily: 'var(--font-retro)',
            fontSize: '19px', color: 'var(--text-dim)', lineHeight: 1.5,
          }}>
            <p>Nobody has charted yet.</p>
            <p style={{ marginTop: '8px' }}>
              A creator appears here once their work has been rated —{' '}
              <Link to="/portal" style={{ color: 'var(--orange)' }}>go and rate some</Link>.
            </p>
          </div>
        ) : (
          <div className="vg-rail-box">
            {rows.map((u) => (
              <Link key={u.id} to={`/profile/${u.username}`} className="vg-rail-row">
                <span className={`vg-rail-rank ${u.rank <= 3 ? 'medal' : ''}`}>
                  {u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : u.rank === 3 ? '🥉' : u.rank}
                </span>
                <span className="vg-rail-thumb">
                  {/* Avatars are guarded at the table now (migration 40), so
                      whatever is here is a site asset or one of our uploads. */}
                  {u.avatar_url ? <img src={u.avatar_url} alt="" loading="lazy" /> : <span>👾</span>}
                </span>
                <span className="vg-rail-body">
                  <span className="vg-rail-title">{u.username}</span>
                  <span className="vg-rail-by">
                    {u.rank_title} · lv {u.level} ·{' '}
                    {u.submission_count} {u.submission_count === 1 ? 'post' : 'posts'}
                    {/* A creator with no rated work yet has an avg_score of 0,
                        and printing "0.00" next to their name reads as a bad
                        score rather than as no score. */}
                    {u.avg_score > 0 && <> · {u.avg_score} avg</>}
                  </span>
                </span>
                <span className="vg-rail-score" style={{ color: 'var(--orange)' }}>
                  {compactNumber(Math.round(u.merit))}
                </span>
              </Link>
            ))}
          </div>
        )}

        <SubmitCta text="Fancy your name up here?" />
      </div>
    </>
  );
}
