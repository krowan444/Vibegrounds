import { Link } from 'react-router-dom';

/**
 * Site footer.
 *
 * Mostly here so there is one obvious, permanent place to find a human. A site
 * asking people to sign up and spend money needs a visible way to contact
 * someone, or it reads as fly-by-night — which is the same instinct that made
 * visitors call the joke ads scammy.
 */
export default function SiteFooter() {
  const year = new Date().getFullYear();

  // Carried into the feedback form, so a bug report arrives already knowing
  // which page it happened on — the one detail nobody ever remembers to
  // include and the one that makes a report fixable.
  const here = typeof window !== 'undefined'
    ? window.location.pathname + window.location.search
    : '';

  return (
    <footer className="vg-footer">
      <div className="vg-footer-inner">
        <div className="vg-footer-col">
          <div className="vg-footer-brand">VIBEGROUNDS</div>
          <p className="vg-footer-blurb">
            Post what you vibe coded. Get scored out of 5 by strangers. Climb the charts.
          </p>
        </div>

        <div className="vg-footer-col">
          <div className="vg-footer-head">EXPLORE</div>
          <Link to="/portal">The Portal</Link>
          <Link to="/charts">Top 100</Link>
          <Link to="/hall-of-fame">Hall of Fame</Link>
            <Link to="/badges">Trophy Cabinet</Link>
          <Link to="/community">Community</Link>
          <Link to="/comics">Comics</Link>
          <Link to="/arcade">Arcade</Link>
        </div>

        <div className="vg-footer-col">
          <div className="vg-footer-head">THE BORING BITS</div>
          <Link to="/rules">Rules</Link>
          <Link to="/advertise">Advertise</Link>
          <Link to="/upload">Submit something</Link>
        </div>

        <div className="vg-footer-col">
          <div className="vg-footer-head">GET IN TOUCH</div>
          {/* Underlined and orange. It was already a real mailto link, but it
              was styled like the copy around it, so it read as a line of text
              rather than something you press — which is why it got reported
              as not clickable. */}
          {/* The form first, the address second. Email works and always
              will, but it asks somebody to open another app, invent a
              subject line and describe where they were — three chances to
              give up. The form is one box and already knows the page. */}
          <Link className="vg-footer-report" to={`/feedback?from=${encodeURIComponent(here)}`}>
            🐞 Something not right? Tell me
          </Link>
          <a className="vg-footer-email" href="mailto:kierandrowan@gmail.com?subject=VibeGrounds">
            ✉ kierandrowan@gmail.com
          </a>
          <p className="vg-footer-small">
            Bugs, ideas, complaints — it all comes to me, and I actually read it.
            No account needed.
          </p>
        </div>
      </div>

      <div className="vg-footer-bar">
        © {year} VibeGrounds · Made by one bloke and a lot of prompting
      </div>
    </footer>
  );
}
