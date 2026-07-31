import { compactNumber } from '../lib/format';

/**
 * XP / level display. The visible progress bar is the retention hook:
 * you can see how close the next level (and its coin payout) is.
 */
export default function LevelBar({ profile, compact = false }) {
  if (!profile) return null;

  const xp      = profile.xp ?? 0;
  const level   = profile.level ?? 1;
  const floor   = profile.xp_level_floor   ?? (level - 1) * (level - 1) * 50;
  const ceiling = profile.xp_level_ceiling ?? level * level * 50;
  const span    = Math.max(1, ceiling - floor);
  const into    = Math.max(0, xp - floor);
  const pct     = Math.min(100, Math.round((into / span) * 100));
  const colour  = profile.rank_colour || 'var(--orange)';

  if (compact) {
    return (
      <span className="vg-level-chip" style={{ borderColor: colour, color: colour }}>
        LV {level}
      </span>
    );
  }

  return (
    <div className="vg-level">
      <div className="vg-level-head">
        <span className="vg-level-num" style={{ color: colour }}>
          LEVEL {level}
        </span>
        <span className="vg-level-rank" style={{ color: colour }}>
          {profile.rank_title || 'Lurker'}
        </span>
      </div>

      <div className="vg-level-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="vg-level-fill" style={{ width: `${pct}%`, background: colour }} />
      </div>

      <div className="vg-level-foot">
        <span>{compactNumber(into)} / {compactNumber(span)} XP</span>
        <span>{compactNumber(Math.max(0, ceiling - xp))} to level {level + 1}</span>
      </div>
    </div>
  );
}
