import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, retryOnAbort } from '../lib/supabase';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import SubmitCta from '../components/SubmitCta';
import { thumbFor, onThumbError, LOGO_FALLBACK } from '../lib/thumbnail';
import { hostOf } from '../lib/format';

/**
 * The Hall of Fame — the answer to "a scoring site with nothing to score".
 *
 * These are other people's projects, credited to them, linking out to them.
 * They are deliberately NOT submissions: they carry no score, they cannot be
 * voted on, and they never touch the member charts. The page says so plainly
 * at the top, because the moment a visitor suspects the numbers are padded,
 * every real number on the site loses its meaning too.
 */
export default function HallOfFamePage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    retryOnAbort(() =>
      supabase.from('hall_of_fame').select('*').eq('is_active', true).order('rank'),
    )
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) setError(err.message);
        setRows(data || []);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || 'Could not load the Hall of Fame.');
        setRows([]);
      });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <SiteHeader />

      <div className="vg-page" style={{ maxWidth: '900px' }}>
        <div className="vg-section-head">
          <h2>🏛️ HALL OF FAME</h2>
          <span className="vg-sub">The AI-built things worth knowing about</span>
        </div>

        <div className="vg-hof-intro">
          <p>
            These aren&#39;t VibeGrounds submissions. They&#39;re other people&#39;s
            projects — things built with AI that made enough noise to be worth
            recording. Every one links to its maker, and every one cites where we
            got the story from.
          </p>
          <p style={{ marginTop: '8px' }}>
            They carry no score and they never appear on the member charts. Those
            are earned by people who post here.{' '}
            <Link to="/portal">Go and rate those instead →</Link>
          </p>
        </div>

        <Notice tone="error">{error}</Notice>

        {rows === null ? (
          <div className="vg-loading">⏳ Loading the Hall...</div>
        ) : rows.length === 0 ? (
          <div className="vg-empty">
            <p>The Hall is still being written.</p>
            <p style={{ marginTop: '8px', color: 'var(--text-dim)' }}>
              Nothing goes up here without a citable source, so it fills slowly
              and on purpose.
            </p>
          </div>
        ) : (
          <div className="vg-hof-list">
            {rows.map((r) => (
              <div key={r.id} className="vg-hof-row">
                <div className="vg-hof-rank">{r.rank}</div>

                <a
                  className="vg-hof-thumb"
                  href={r.project_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  <img
                    src={thumbFor({ project_url: r.project_url }, 200)}
                    alt=""
                    loading="lazy"
                    onError={onThumbError}
                    className={
                      thumbFor({ project_url: r.project_url }, 200) === LOGO_FALLBACK
                        ? 'vg-thumb-placeholder'
                        : undefined
                    }
                  />
                </a>

                <div className="vg-hof-body">
                  <a
                    className="vg-hof-title"
                    href={r.project_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    {r.title}
                  </a>

                  <div className="vg-hof-by">
                    by{' '}
                    {r.creator_url ? (
                      <a href={r.creator_url} target="_blank" rel="noopener noreferrer nofollow">
                        {r.creator}
                      </a>
                    ) : (
                      r.creator
                    )}
                    {r.built_with && <span className="vg-hof-tool"> · built with {r.built_with}</span>}
                  </div>

                  <div className="vg-hof-blurb">{r.blurb}</div>

                  <div className="vg-hof-meta">
                    <span className="vg-hof-host">{hostOf(r.project_url)}</span>
                    <a
                      className="vg-hof-source"
                      href={r.source_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      title="Where we got this from"
                    >
                      source: {r.source_label || hostOf(r.source_url)}
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <SubmitCta text="Think yours belongs up here? Start by posting it." />
      </div>
    </>
  );
}
