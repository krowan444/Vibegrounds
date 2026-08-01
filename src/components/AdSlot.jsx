/**
 * House ad slot — the old-internet furniture.
 *
 * These are placeholders using our own artwork. When real ad income
 * arrives, swap the `house` array for your ad network's script or an
 * <ins> tag; everything else (the label, the sizing, the border) stays,
 * so the layout will not jump when real ads appear.
 *
 * The "ADVERTISEMENT" label stays either way — labelling ads is both
 * required by most networks and the honest thing to do.
 */

const HOUSE_ADS = [
  {
    img: '/images/ads/ad-ai-game.png',
    alt: 'Make your own AI game',
    href: '/upload',
    caption: 'Build something. Post it here.',
  },
  {
    img: '/images/ads/ad-waifu.png',
    alt: 'AI character generator',
    href: '/portal',
    caption: 'See what the community made.',
  },
];

export default function AdSlot({ index = 0, sticky = false }) {
  const ad = HOUSE_ADS[index % HOUSE_ADS.length];

  return (
    <div className={`vg-ad ${sticky ? 'vg-ad-sticky' : ''}`}>
      <div className="vg-ad-label">ADVERTISEMENT</div>
      <a href={ad.href} className="vg-ad-body">
        <img src={ad.img} alt={ad.alt} loading="lazy" />
      </a>
      <div className="vg-ad-caption">{ad.caption}</div>
    </div>
  );
}
