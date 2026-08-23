import { Link } from 'react-router-dom';

/**
 * The strip under the banner.
 *
 * One line, one job: point people at the part of the site you want them to
 * find. It replaces the live ticker rather than sitting next to it, because
 * two messages on one line is one message too many and the strip is the
 * first thing anybody reads.
 *
 * To change what it promotes, edit PROMO below — nothing else. To turn it
 * off entirely, set `on: false` and the live ticker comes back in its place.
 */
export const PROMO = {
  on: true,
  badge: 'NEW',
  // Said as a thing a person might want, not as an announcement. "Comics
  // are now live" tells you what happened to the site; this tells you what
  // you can do.
  text: 'The Arcade is open — first go free every day',
  to: '/arcade',
  cta: 'Have a go',
};

export default function PromoBar({ promo = PROMO }) {
  if (!promo?.on) return null;

  return (
    <Link to={promo.to} className="vg-promo">
      <span className="vg-promo-badge">{promo.badge}</span>
      <span className="vg-promo-text">{promo.text}</span>
      <span className="vg-promo-cta">{promo.cta} →</span>
    </Link>
  );
}
