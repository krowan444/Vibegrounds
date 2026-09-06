import { Link } from 'react-router-dom';

/**
 * The strip under the banner: what is new and where to find it.
 *
 * This used to carry exactly one message, on the argument that two messages
 * on one line is one message too many. That still holds for two *different*
 * kinds of message — an announcement sitting next to an advert is noise.
 *
 * It does not hold for what is here now. The Arcade and Comics are two of the
 * same thing: new places to go. Side by side under one NEW badge they read as
 * a short menu rather than as two things shouting. Add a third unrelated item
 * and it goes back to being noise, so this list is meant to stay short.
 *
 * To change what it promotes, edit PROMO below — nothing else. Set
 * `on: false` and the live ticker comes back in its place.
 */
/*
 * Switched off at Kieran's request. The Arcade and Comics are no longer new
 * enough to be worth the most valuable line on the page, and regulars
 * already know where they are. `on: false` puts the live ticker back in its
 * place — the newest submission and who made it, which changes every day
 * rather than being a fixed menu.
 *
 * Left in place rather than deleted: the next thing worth announcing goes in
 * `places`, and `on: true` brings the strip straight back.
 */
export const PROMO = {
  on: false,
  badge: 'NEW',
  places: [
    // Said as things a person might want, not as announcements. "Comics are
    // now live" tells you what happened to the site; this tells you what you
    // can do with it.
    { icon: '🕹️', text: 'The Arcade — first go free every day', to: '/arcade' },
    { icon: '📖', text: 'Comics — read one, or post your own', to: '/comics' },
  ],
};

export default function PromoBar({ promo = PROMO }) {
  const places = promo?.places || [];
  if (!promo?.on || places.length === 0) return null;

  return (
    <div className="vg-promo vg-promo-multi">
      <span className="vg-promo-badge">{promo.badge}</span>

      <span className="vg-promo-places">
        {places.map((p, i) => (
          <span key={p.to} className="vg-promo-place">
            {/* A divider between items, never after the last one — a trailing
                bar looks like a third thing failed to load. */}
            {i > 0 && <span className="vg-promo-div" aria-hidden="true" />}
            <Link to={p.to}>
              <span className="vg-promo-icon" aria-hidden="true">{p.icon}</span>
              {p.text}
              <span className="vg-promo-go" aria-hidden="true"> →</span>
            </Link>
          </span>
        ))}
      </span>
    </div>
  );
}
