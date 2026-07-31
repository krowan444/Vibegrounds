/**
 * Shared retro alert box. Keeps every form on the site speaking
 * the same visual language instead of ad-hoc inline styles.
 */
const TONES = {
  error:   { bg: '#331111', border: '#cc3333', color: '#ff6666', icon: '⚠️' },
  success: { bg: '#113311', border: '#33cc33', color: '#66ff66', icon: '✅' },
  info:    { bg: '#111a33', border: '#4477cc', color: '#88bbff', icon: 'ℹ️' },
  warn:    { bg: '#332a11', border: '#e8a317', color: '#ffcc55', icon: '🔔' },
};

export default function Notice({ tone = 'info', children, icon, style }) {
  if (!children) return null;
  const t = TONES[tone] || TONES.info;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      style={{
        background: t.bg,
        border: `2px solid ${t.border}`,
        color: t.color,
        padding: '8px 12px',
        marginBottom: '12px',
        fontFamily: 'var(--font-retro)',
        fontSize: '17px',
        lineHeight: 1.35,
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-start',
        ...style,
      }}
    >
      <span aria-hidden="true">{icon ?? t.icon}</span>
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  );
}
