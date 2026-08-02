import { Link } from 'react-router-dom';

/**
 * The front-page banner — the cheerful 2004 prize advert, not the scary one.
 *
 * The other great banner format of that era wasn't the fake virus warning, it
 * was the sparkling gold "CONGRATULATIONS, YOU'RE THE 1,000,000th VISITOR!"
 * one. Warm, ridiculous, and everyone clicked it once.
 *
 * The gag here is a compliment rather than a threat: your thing compiled, and
 * that's genuinely worth a small celebration. It flatters the audience instead
 * of poking them, which suits a site trying to get people to post.
 *
 * All CSS, so it costs nothing to load and stays sharp at any size.
 */
export default function HeroAd() {
  return (
    <div className="vg-hero-ad">
      <div className="vg-ad-label">ADVERTISEMENT</div>

      <Link to="/advertise" className="vg-prize" aria-label="Joke advert — click to learn about advertising here">
        <span className="vg-prize-corner vg-prize-tl">✦</span>
        <span className="vg-prize-corner vg-prize-tr">✦</span>
        <span className="vg-prize-corner vg-prize-bl">✦</span>
        <span className="vg-prize-corner vg-prize-br">✦</span>

        <div className="vg-prize-top blink">★ ★ ★ CONGRATULATIONS ★ ★ ★</div>

        <div className="vg-prize-headline">IT COMPILED</div>

        <div className="vg-prize-sub">
          You are the <b>1,000,000th</b> person today to run it and quietly hope.
        </div>

        <div className="vg-prize-btn">🏆 CLAIM YOUR PRIZE 🏆</div>

        <div className="vg-prize-small">
          The prize is the feeling. The feeling is the prize. No prize will be posted.
        </div>
      </Link>

      <a href="/advertise" className="vg-ad-pitch">
        📣 This is the slot every visitor sees first.{' '}
        <strong>Put something real here →</strong>
      </a>
    </div>
  );
}
