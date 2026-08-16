import { useState } from 'react';
import { TIER_COLORS, RARITY_COLORS, shortDate } from '../lib/format';
import BadgeIcon from './BadgeIcon';

/**
 * Badge showcase. Shows both the *designed* tier (legendary, epic…) and
 * the *live* rarity (what % of members actually hold it) — the second
 * number is the one people actually brag about.
 */
export default function BadgeGrid({ badges = [], emptyText = 'No badges yet.' }) {
  const [open, setOpen] = useState(null);

  if (!badges.length) {
    return <div className="vg-badges-empty">{emptyText}</div>;
  }

  return (
    <div className="vg-badges">
      {badges.map((b) => {
        const tier = TIER_COLORS[b.tier] || '#9e9e9e';
        const rarity = RARITY_COLORS[b.live_rarity] || '#9e9e9e';
        const isOpen = open === b.slug;

        return (
          <button
            type="button"
            key={b.slug}
            className={`vg-badge ${isOpen ? 'is-open' : ''}`}
            style={{ borderColor: tier }}
            onClick={() => setOpen(isOpen ? null : b.slug)}
            aria-expanded={isOpen}
            title={`${b.name} — ${b.description}`}
          >
            <span className="vg-badge-icon"><BadgeIcon slug={b.slug} icon={b.icon} size={30} /></span>
            <span className="vg-badge-name">{b.name}</span>
            <span className="vg-badge-rarity" style={{ color: rarity }}>
              {b.live_rarity}
            </span>

            {/* Always rendered, shown by CSS on hover, focus or click.
                Conditionally rendering it meant hover could never work — you
                cannot :hover something that is not in the DOM — and hover is
                how most people expect to read a badge. Click still works, and
                is the only option on a touchscreen. */}
            <span className="vg-badge-pop">
                <span className="vg-badge-desc">{b.description}</span>
                <span className="vg-badge-stats">
                  <span style={{ color: tier, textTransform: 'uppercase' }}>{b.tier}</span>
                  {' · '}
                  <span style={{ color: rarity }}>{b.live_rarity}</span>
                  {' · '}
                  {b.holder_percent}% of members
                </span>
                {b.earned_at && (
                  <span className="vg-badge-earned">Earned {shortDate(b.earned_at)}</span>
                )}
                {b.is_retired && (
                  <span className="vg-badge-retired">🔒 Can never be earned again</span>
                )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
