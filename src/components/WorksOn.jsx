/**
 * Where a creation works, said once, in one place.
 *
 * Used as a badge on the creation page and as the filter on the Portal, so
 * the two can never drift into describing the same thing differently.
 *
 * 'unknown' renders nothing at all. A badge reading "Unknown" would take up
 * the same room as a real answer while telling the reader nothing, and would
 * make the gap look like a fault rather than simply a question the creator
 * has not been asked yet.
 */
export const WORKS_ON = {
  both:    { icon: '💻 📱', label: 'Computer & phone', short: 'Both' },
  desktop: { icon: '💻',    label: 'Computer',          short: 'Computer' },
  mobile:  { icon: '📱',    label: 'Phone',             short: 'Phone' },
};

/** The set of values that satisfy a filter — 'both' answers either way. */
export function matchesDevice(worksOn, want) {
  if (!want) return true;
  return worksOn === want || worksOn === 'both';
}

export default function WorksOnBadge({ value, className = '' }) {
  const w = WORKS_ON[value];
  if (!w) return null;
  return (
    <span className={`vg-works-badge ${className}`} title={`Works on: ${w.label}`}>
      <span aria-hidden="true">{w.icon}</span>
      <span>{w.short}</span>
    </span>
  );
}
