import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TIER_COLORS } from '../lib/format';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import BadgeIcon from '../components/BadgeIcon';

/**
 * Every badge on the site, and which of them you hold.
 *
 * Badges previously appeared only on profiles, which meant you could see what
 * you had and never what you were missing. A trophy cabinet is only motivating
 * next to the empty shelves - so this shows the whole board, locked ones
 * included, with the exact bar for each.
 *
 * Nothing is hidden. Secrets are fun once and then they are just a list of
 * things nobody knows how to get.
 */

const CATEGORY_LABELS = {
  event:     'Rare and retiring',
  creator:   'Making things',
  critic:    'Rating and reviewing',
  community: 'Taking part',
  economy:   'Vibe Coins',
  general:   'Getting set up',
  staff:     'Staff',
};

// Rarest first. The board should open on the things worth wanting.
const CATEGORY_ORDER = ['event', 'creator', 'critic', 'community', 'economy', 'general', 'staff'];
const TIER_RANK = { mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };

export default function BadgesPage() {
  const { user } = useAuth();
  const [all, setAll] = useState([]);
  const [mine, setMine] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: badges } = await supabase
        .from('badge_stats')
        .select('*')
        .order('sort_order', { ascending: true });

      let earned = new Map();
      if (user) {
        const { data: ub } = await supabase
          .from('user_badges')
          .select('badge_slug, earned_at')
          .eq('user_id', user.id);
        earned = new Map((ub || []).map((r) => [r.badge_slug, r.earned_at]));
      }

      if (!alive) return;
      setAll(badges || []);
      setMine(earned);
      setLoading(false);
    })().catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user]);

  const held = all.filter((b) => mine.has(b.slug));
  const locked = all.filter((b) => !mine.has(b.slug));

  const shown = filter === 'earned' ? held : filter === 'locked' ? locked : all;

  const byCategory = CATEGORY_ORDER
    .map((cat) => ({
      cat,
      items: shown
        .filter((b) => b.category === cat)
        // Within a section, rarest first - the aspirational ones at the top.
        .sort((a, b) => (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0)
                      || a.sort_order - b.sort_order),
    }))
    .filter((g) => g.items.length);

  return (
    <>
      <SiteHeader />
      <div className="vg-page">

        <div className="retro-panel" style={{ marginBottom: '12px' }}>
          <div className="section-header"><h2>🏅 Trophy Cabinet</h2></div>
          <div className="retro-panel-body" style={{ padding: '12px' }}>
            <p style={{
              fontFamily: 'var(--font-retro)', fontSize: '18px',
              color: 'var(--text-secondary)', margin: 0,
            }}>
              Everything you can earn on VibeGrounds, and how. Nothing is hidden -
              if it is on this page, it is winnable.
            </p>

            {user && (
              <div style={{
                display: 'flex', gap: '14px', flexWrap: 'wrap',
                marginTop: '10px', fontFamily: 'var(--font-pixel)', fontSize: '8px',
              }}>
                <span style={{ color: 'var(--orange)' }}>{held.length} EARNED</span>
                <span style={{ color: 'var(--text-dim)' }}>{locked.length} TO GO</span>
                <span style={{ color: 'var(--text-dim)' }}>
                  {Math.round((held.length / Math.max(all.length, 1)) * 100)}% COMPLETE
                </span>
              </div>
            )}

            {!user && (
              <div style={{ marginTop: '10px', fontFamily: 'var(--font-retro)', fontSize: '17px' }}>
                <Link to="/auth?mode=signup" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>
                  Join up
                </Link>
                <span style={{ color: 'var(--text-dim)' }}> to start collecting.</span>
              </div>
            )}
          </div>
        </div>

        {user && (
          <div className="vg-badge-filters">
            {[['all', 'Everything'], ['earned', 'Earned'], ['locked', 'Still to earn']].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={'vg-badge-filter ' + (filter === k ? 'is-on' : '')}
                onClick={() => setFilter(k)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="vg-loading">⏳ Loading the cabinet...</div>
        ) : (
          byCategory.map(({ cat, items }) => (
            <div className="retro-panel" key={cat} style={{ marginBottom: '12px' }}>
              <div className="section-header">
                <h2>{CATEGORY_LABELS[cat] || cat}</h2>
              </div>
              <div className="vg-badge-board">
                {items.map((b) => {
                  const got = mine.has(b.slug);
                  const colour = TIER_COLORS[b.tier] || '#9e9e9e';
                  return (
                    <div
                      key={b.slug}
                      className={'vg-badge-card ' + (got ? 'is-earned' : '')}
                      style={{ borderColor: got ? colour : 'var(--border-dark)' }}
                    >
                      <BadgeIcon slug={b.slug} icon={b.icon} size={44} dim={!got} />

                      <div className="vg-badge-card-body">
                        <div className="vg-badge-card-name" style={{ color: got ? colour : 'var(--text-secondary)' }}>
                          {b.name}
                        </div>
                        <div className="vg-badge-card-desc">{b.description}</div>
                        <div className="vg-badge-card-meta">
                          <span style={{ color: colour }}>{b.tier}</span>
                          {' · '}
                          {/* Live rarity, not just the designed tier: "3 people
                              have this" is a far stronger pull than "epic". */}
                          <span>{b.holders === 0 ? 'nobody has this yet' : b.holders + (b.holders === 1 ? ' holder' : ' holders')}</span>
                          {b.is_manual && <span> · awarded by hand</span>}
                        </div>
                        {got && (
                          <div className="vg-badge-card-got">
                            ✓ Earned {new Date(mine.get(b.slug)).toLocaleDateString('en-GB')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      <SiteFooter />
    </>
  );
}
