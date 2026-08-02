import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';

const SLOTS = [
  {
    name: 'Featured Banner',
    where: 'Middle of the front page, above everything',
    detail: 'The first thing every visitor sees. One advertiser at a time.',
    icon: '🏆',
  },
  {
    name: 'Sidebar Square',
    where: 'Right rail, beside the All-Time Top 100',
    detail: 'Sits next to the charts people actually come here to read.',
    icon: '📐',
  },
  {
    name: 'Portal Slot',
    where: 'Alongside the browse and category pages',
    detail: 'Reaches people already digging through submissions.',
    icon: '🌀',
  },
];

export default function AdvertisePage() {
  return (
    <>
      <SiteHeader compact />

      <div className="vg-page" style={{ maxWidth: '860px' }}>
        <div className="retro-panel">
          <div className="section-header"><h2>📣 Advertise on VibeGrounds</h2></div>
          <div className="retro-panel-body" style={{
            fontFamily: 'var(--font-retro)', fontSize: '19px',
            color: 'var(--text-primary)', lineHeight: 1.55,
          }}>
            <p>
              <strong style={{ color: 'var(--orange)' }}>Straight with you:</strong> it&#39;s
              far too early to sell you anything. VibeGrounds launched days ago and
              the audience is tiny. Anyone quoting you a rate at this size is
              selling you nothing.
            </p>
            <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
              This page exists so you know the slots are here, and so you can put your
              name down early. When there&#39;s an audience worth advertising to,
              the people who asked first get told first — and get it cheap.
            </p>
          </div>
        </div>

        <div className="vg-section" style={{ marginTop: '16px' }}>
          <div className="vg-section-head">
            <h2>WHERE YOUR AD WILL GO</h2>
            <span className="vg-sub">Three slots, clearly labelled — not yet for sale</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {SLOTS.map((s) => (
              <div key={s.name} className="vg-stat" style={{ flex: '1 1 220px', textAlign: 'left', padding: '12px' }}>
                <div style={{ fontSize: '24px' }}>{s.icon}</div>
                <div style={{
                  fontFamily: 'var(--font-pixel)', fontSize: '10px',
                  color: 'var(--orange)', margin: '7px 0',
                }}>
                  {s.name}
                </div>
                <div style={{ fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--text-primary)' }}>
                  {s.where}
                </div>
                <div style={{
                  fontFamily: 'var(--font-retro)', fontSize: '15px',
                  color: 'var(--text-dim)', marginTop: '5px',
                }}>
                  {s.detail}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="retro-panel" style={{ marginTop: '16px' }}>
          <div className="section-header"><h2>📬 Get In Touch</h2></div>
          <div className="retro-panel-body" style={{
            fontFamily: 'var(--font-retro)', fontSize: '18px',
            color: 'var(--text-secondary)', lineHeight: 1.55,
          }}>
            <p>
              No rate card, because there shouldn&#39;t be one yet. Tell us what
              you&#39;ve built and we&#39;ll be honest about whether we can do anything
              useful for you — including saying &quot;not yet, come back in a few
              months&quot;.
            </p>
            <p style={{ marginTop: '10px' }}>
              Email{' '}
              {/* Personal address for now — swap to hello@vibegrounds.com once
                  the domain transfer lands and forwarding is set up. */}
              <a
                href="mailto:kierandrowan@gmail.com?subject=Advertising%20on%20VibeGrounds"
                style={{ color: 'var(--orange)', fontWeight: 'bold' }}
              >
                kierandrowan@gmail.com
              </a>
            </p>
            <p style={{ marginTop: '14px', fontSize: '16px', color: 'var(--text-dim)' }}>
              What we won&#39;t run: anything misleading, adult content, crypto pump
              schemes, or ads dressed up to look like community submissions. Every ad
              on this site is labelled as one.
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link to="/" className="retro-cta" style={{ display: 'inline-block' }}>
            ← BACK TO THE PORTAL
          </Link>
        </div>
      </div>
    </>
  );
}
