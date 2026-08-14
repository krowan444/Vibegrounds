import { Link } from 'react-router-dom';

/**
 * House ad slot — the old-internet furniture.
 *
 * These are placeholders using our own artwork. When real ad income
 * arrives, swap the `HOUSE_ADS` array for your ad network's script or an
 * <ins> tag; everything else (the label, the sizing, the border) stays,
 * so the layout will not jump when real ads appear.
 *
 * The "ADVERTISEMENT" label stays either way — labelling ads is both
 * required by most networks and the honest thing to do.
 *
 * Clicking the banner goes to /advertise rather than the thing being
 * advertised. Someone who clicks an ad on a site this small is usually
 * asking "what is this, and can I buy one?" — so answer that. The original
 * call to action is kept as a second link underneath, because it was still
 * sending people to the portal and the upload form and there is no reason
 * to throw that away.
 */

const HOUSE_ADS = [
  {
    img: '/images/ads/ad-ram-mining.webp',
    alt: 'RAM prices got you mining? Stop digging, start coding.',
    href: '/upload',
    caption: 'Build something. Post it here.',
  },
  {
    img: '/images/ads/ad-cowboy-builders.webp',
    alt: 'Prompt & Sons Cowboy Builders — we can build your app by Friday',
    href: '/portal',
    caption: 'See what the community made.',
  },
  {
    img: '/images/ads/ad-context-storage.webp',
    alt: 'Running out of context? Context Window Storage Solutions.',
    href: '/upload',
    caption: 'Got something built? Show it off.',
  },
  {
    img: '/images/ads/ad-ai-counselling.webp',
    alt: 'AI Girlfriend Counselling for AI-binary couples',
    href: '/portal',
    caption: 'Browse the weirder end of the portal.',
  },
];

/*
 * Which ad each slot shows is offset by a number drawn once, when the module
 * first loads — so a refresh reshuffles the whole set, but nothing changes
 * underneath you while you are reading the page.
 *
 * Deliberately not random per render: that would swap the picture on every
 * re-render, which reads as a flicker. Deliberately not random per slot
 * either, because two slots could then land on the same ad. An offset applied
 * to the existing index keeps every slot on the page showing a different ad,
 * exactly as before — only which one moves.
 *
 * There are only two call sites in use (index 0 and 1), so without this the
 * third and fourth ads would simply never be seen by anyone.
 */
const OFFSET = Math.floor(Math.random() * HOUSE_ADS.length);

export default function AdSlot({ index = 0, sticky = false }) {
  const ad = HOUSE_ADS[(OFFSET + index) % HOUSE_ADS.length];

  return (
    <div className={`vg-ad ${sticky ? 'vg-ad-sticky' : ''}`}>
      <div className="vg-ad-label">ADVERTISEMENT</div>

      {/* Router Link, not a bare <a>. The old anchor threw away the whole
          single-page app and reloaded from scratch on every ad click. */}
      <Link to="/advertise" className="vg-ad-body">
        {/* width/height are the real pixel dimensions of the file. They cost
            nothing and stop the page shuffling downwards as each ad loads,
            which is the whole point of reserving the space up front. */}
        <img src={ad.img} alt={ad.alt} width="1200" height="1200" loading="lazy" />
      </Link>

      <Link to={ad.href} className="vg-ad-caption">{ad.caption}</Link>

      <Link to="/advertise" className="vg-ad-foot">
        House ad. <strong>Advertise here for real →</strong>
      </Link>
    </div>
  );
}
