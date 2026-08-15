import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TIER_COLORS } from '../lib/format';

/**
 * Your three best badges, on a shelf in the header.
 *
 * Badges lived on the profile page, which is a page almost nobody visits —
 * including the person who owns it. So the thing meant to make earning feel
 * worth it was invisible during the entire session in which you earned it.
 *
 * Three, not all of them: a shelf with everything on it is a list, and a list
 * is not a trophy. Scarcity is the whole point of a display case.
 */

// Best first. Ranked by designed tier rather than live rarity, because tier
// is stable — live rarity shifts as members join, and a shelf that silently
// reorders itself is unsettling rather than rewarding.
const TIER_RANK = { mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };

export default function BadgeShelf() {
  const { user, profile } = useAuth();
  const [badges, setBadges] = useState([]);

  useEffect(() => {
    let alive = true;
    if (!user) { setBadges([]); return undefined; }

    (async () => {
      const { data, error } = await supabase
        .from('user_badges_detailed')
        .select('*')
        .eq('user_id', user.id);

      // Silent on failure. This is decoration in a header — an error message
      // up here would be far more disruptive than simply showing nothing.
      if (!alive || error || !data) return;

      const best = [...data]
        .sort((a, b) =>
          (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0)
          || new Date(b.earned_at || 0) - new Date(a.earned_at || 0))
        .slice(0, 3);

      setBadges(best);
    })().catch(() => {});

    return () => { alive = false; };
  }, [user]);

  if (!user || !badges.length) return null;

  return (
    <Link
      to={`/profile/${profile?.username || ''}`}
      className="vg-shelf"
      title="Your best badges — see them all"
    >
      {badges.map((b) => (
        <span
          key={b.slug}
          className="vg-shelf-badge"
          style={{ borderColor: TIER_COLORS[b.tier] || 'var(--border-dark)' }}
          // Native tooltip rather than a styled popup: the header is cramped
          // and a floating panel here would cover the nav underneath it.
          title={`${b.name} — ${b.description}`}
        >
          {b.icon}
        </span>
      ))}
    </Link>
  );
}
