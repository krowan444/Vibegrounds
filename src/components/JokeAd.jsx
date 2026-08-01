import { Link } from 'react-router-dom';

/**
 * House "ads" in the spirit of 2004 banner adverts — deliberately daft,
 * drawn in CSS so they cost nothing to load. They all point at /advertise,
 * so a curious click lands somewhere real rather than nowhere.
 *
 * Swap these out for paying advertisers by replacing the ADS array.
 */
const ADS = [
  {
    id: 'ram',
    top: 'SYSTEM ALERT',
    line: 'DOWNLOAD MORE RAM',
    sub: 'Free! Instant! Legally dubious!',
    theme: 'lime',
    blink: true,
  },
  {
    id: 'visitor',
    top: '★ CONGRATULATIONS ★',
    line: "YOU'RE VISITOR #1,000,000",
    sub: 'Claim your prize: a warm feeling',
    theme: 'gold',
    blink: true,
  },
  {
    id: 'compilers',
    top: 'LOCAL SINGLES',
    line: 'COMPILERS IN YOUR AREA',
    sub: 'They want to build with YOU',
    theme: 'pink',
  },
  {
    id: 'monkey',
    top: 'PUNCH THE MONKEY',
    line: 'WIN NOTHING AT ALL',
    sub: 'No monkeys were harmed. None exist.',
    theme: 'cyan',
  },
  {
    id: 'cursor',
    top: 'FREE DOWNLOAD',
    line: '3,000 CURSOR SKINS',
    sub: 'Your mouse deserves better',
    theme: 'violet',
  },
  {
    id: 'seo',
    top: 'ONE WEIRD TRICK',
    line: 'RANK #1 ON THE PORTAL',
    sub: 'Developers hate it. Post good stuff.',
    theme: 'gold',
  },
  {
    id: 'gpurush',
    top: '⛏ THE GREAT GPU RUSH ⛏',
    line: 'THAR’S VRAM IN THEM HILLS',
    sub: 'Stake your claim! 24GB seams! Bring a pickaxe and a second mortgage!',
    theme: 'gold',
    blink: true,
  },
  {
    id: 'exgf',
    top: 'EMOTIONAL SUPPORT SERVICES',
    line: 'AI GIRLFRIEND RECOVERY',
    sub: 'She got deprecated? We restore from backup. Grief counselling included.',
    theme: 'pink',
  },
];

export default function JokeAd({ index = 0 }) {
  const ad = ADS[index % ADS.length];

  return (
    <div className="vg-joke">
      <div className="vg-ad-label">ADVERTISEMENT</div>
      <Link to="/advertise" className={`vg-joke-body vg-joke-${ad.theme}`}>
        <span className="vg-joke-top">{ad.top}</span>
        <span className={`vg-joke-line ${ad.blink ? 'blink' : ''}`}>{ad.line}</span>
        <span className="vg-joke-sub">{ad.sub}</span>
        <span className="vg-joke-cta">CLICK HERE</span>
      </Link>
    </div>
  );
}
