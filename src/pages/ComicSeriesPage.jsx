import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase, retryOnAbort, describeError } from '../lib/supabase';
import SiteHeader from '../components/SiteHeader';
import CouldNotLoad from '../components/CouldNotLoad';
import NsfwImage from '../components/NsfwImage';
import { useDocumentTitle } from '../lib/pageMeta';
import { compactNumber, timeAgo } from '../lib/format';

/**
 * A whole run of comics, in order.
 *
 * The thing Kieran asked for: click "Volume 2 of 3" on a comic and land
 * somewhere you can read the rest. Which means this page has one job — get
 * you into an edition — and everything on it is either a way in or a reason
 * to pick one.
 *
 * Readable signed out. A series is the shape of thing somebody links to.
 */
export default function ComicSeriesPage() {
  const { slug } = useParams();
  const [data, setData] = useState(undefined);   // undefined = loading, null = no such series
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setError('');
      setData(undefined);
      const { data: d, error: e } = await retryOnAbort(
        () => supabase.rpc('comic_series_page', { p_slug: slug }),
      );
      if (!alive) return;
      if (e) { setError(describeError(e)); return; }
      setData(d ?? null);
    })();
    return () => { alive = false; };
  }, [slug]);

  useDocumentTitle(data ? `${data.title} — a comic series` : 'Comic series');

  if (error) return <CouldNotLoad what="this series" onRetry={() => window.location.reload()} />;

  if (data === undefined) {
    return (
      <>
        <SiteHeader />
        <div className="vg-page"><div className="vg-empty">Loading the series…</div></div>
      </>
    );
  }

  if (data === null) {
    return (
      <>
        <SiteHeader />
        <div className="vg-page">
          <div className="retro-panel">
            <div className="section-header"><h2>No such series</h2></div>
            <div className="vg-empty">
              <p>There is no series at this address. It may have been renamed or taken down.</p>
              <p style={{ marginTop: 10 }}><Link to="/comics">Back to the comics →</Link></p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const editions = data.editions || [];
  const have = editions.length;
  const planned = data.planned_count;

  /* "3 of 5" only when the artist said there would be five. Otherwise the
     count of what is actually here, which cannot be wrong. Inferring a total
     from the rows would print "1 of 1" on the opening part of a trilogy. */
  const countLine = planned
    ? `${have} of ${planned} posted`
    : `${have} ${have === 1 ? 'edition' : 'editions'}`;

  const pagesTotal = editions.reduce((n, e) => n + (e.page_count || 0), 0);

  return (
    <>
      <SiteHeader />
      <div className="vg-page vg-series-page">

        <div className="retro-panel">
          <div className="section-header">
            <h2>📚 {data.title}</h2>
            <span className="vg-sub">{countLine}</span>
          </div>

          <div className="retro-panel-body">
            <p className="vg-series-by">
              by <Link to={`/profile/${data.creator.username}`}>{data.creator.username}</Link>
              {pagesTotal > 0 && <> · {compactNumber(pagesTotal)} pages in total</>}
            </p>

            {data.description && <p className="vg-series-desc">{data.description}</p>}

            {/* Said plainly rather than left as a gap in the numbering. An
                artist part-way through a run should not look like one who
                abandoned it. */}
            {planned && have < planned && (
              <p className="vg-series-note">
                {planned - have} still to come.
              </p>
            )}

            {have === 0 ? (
              <div className="vg-empty">
                <p>Nothing in this series yet.</p>
              </div>
            ) : (
              <ol className="vg-series-list">
                {editions.map((e) => (
                  <li key={e.id} className="vg-series-item">
                    <Link to={`/comics/${e.id}`} className="vg-series-cover">
                      <NsfwImage
                        src={e.cover_url}
                        alt=""
                        nsfw={e.is_nsfw}
                        className="vg-series-cover-img"
                      />
                      {/* The number badge, on the cover where a real cover
                          carries it. */}
                      {e.edition_number != null && (
                        <span className="vg-series-num">
                          {e.edition_label ? `${e.edition_label} ` : '#'}{e.edition_number}
                        </span>
                      )}
                    </Link>

                    <div className="vg-series-meta">
                      <Link to={`/comics/${e.id}`} className="vg-series-title">{e.title}</Link>
                      <div className="vg-series-sub">
                        {e.page_count} {e.page_count === 1 ? 'page' : 'pages'}
                        {e.vote_count > 0 && <> · ★ {Number(e.score).toFixed(2)}</>}
                        {e.view_count > 0 && <> · {compactNumber(e.view_count)} read</>}
                        {' · '}{timeAgo(e.created_at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <p className="vg-series-back">
          <Link to="/comics">← All comics</Link>
        </p>
      </div>
    </>
  );
}
