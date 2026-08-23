import { Link } from 'react-router-dom';
import SiteHeader from './SiteHeader';

/**
 * The honest version of a page that did not load.
 *
 * Before this existed, a dropped connection was reported to the visitor as
 * "not found" — the profile page went as far as telling them the username
 * was free and inviting them to claim it. Someone reading a comic on a train
 * that went into a tunnel would be told the comic had been removed by a
 * moderator. Both are lies, and the second one is a lie about a person's
 * work.
 *
 * So: absence is only ever claimed when the database actually said "no rows".
 * Everything else lands here, says so plainly, and offers another go.
 */
export default function CouldNotLoad({
  what = 'this',
  onRetry,
  backTo = '/',
  backLabel = 'Back to the home page',
  compact = true,
}) {
  return (
    <>
      <SiteHeader compact={compact} />
      <div className="vg-page">
        <div className="retro-panel">
          <div className="section-header"><h2>📡 Could Not Load {what}</h2></div>
          <div className="vg-empty">
            <p>
              Something got between you and VibeGrounds. Nine times out of ten
              that is a wobbly connection rather than anything you did, and
              nothing has been lost.
            </p>
            <div className="vg-cnl-actions">
              {onRetry && (
                <button type="button" className="retro-cta" onClick={onRetry}>
                  ↻ TRY AGAIN
                </button>
              )}
              <Link to={backTo}>{backLabel} →</Link>
            </div>
            <p className="vg-cnl-aside">
              Keeps happening? <Link to="/feedback">Tell us about it</Link> — it
              is two boxes and you do not need an account.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
