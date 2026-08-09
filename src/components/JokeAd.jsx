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
    sub: 'Free! Instant! Legally dubious! Works on any computer, including ones you do not own.',
    small: 'RAM is not downloadable. It has never been downloadable.',
    theme: 'lime',
    blink: true,
  },
  {
    id: 'visitor',
    top: '★ CONGRATULATIONS ★',
    line: "YOU'RE VISITOR #1,000,000",
    sub: 'You have been selected at random from a pool consisting entirely of you.',
    small: 'Prize is a warm feeling. Feeling not guaranteed. No cash alternative.',
    theme: 'gold',
    blink: true,
  },
  {
    id: 'compilers',
    top: 'LOCAL SINGLES',
    line: 'COMPILERS IN YOUR AREA',
    sub: 'Lonely build tools are waiting to link with you tonight. No strings. Some flags.',
    small: 'Compilers are not lonely. Compilers do not feel anything.',
    theme: 'pink',
  },
  {
    id: 'monkey',
    top: 'PUNCH THE MONKEY',
    line: 'WIN NOTHING AT ALL',
    sub: 'Three attempts. Perfect accuracy required. The reward is the absence of a reward.',
    small: 'No monkeys were harmed. No monkeys exist. There is no game.',
    theme: 'cyan',
  },
  {
    id: 'cursor',
    top: 'FREE DOWNLOAD',
    line: '3,000 CURSOR SKINS',
    sub: 'Flaming arrow. Tiny dog. Slightly larger arrow. Your mouse deserves better than default.',
    small: 'Bundled with fourteen toolbars you did not ask for.',
    theme: 'violet',
  },
  {
    id: 'seo',
    top: 'ONE WEIRD TRICK',
    line: 'RANK #1 ON THE PORTAL',
    sub: 'Chart-toppers hate him! Local man discovers ancient secret to climbing the rankings.',
    small: 'The secret is posting something good. That is the whole trick.',
    theme: 'gold',
  },
  {
    id: 'gpurush',
    top: '⛏ THE GREAT GPU RUSH ⛏',
    line: 'THAR’S VRAM IN THEM HILLS',
    sub: 'Stake your claim before the rush! Rich 24GB seams! Bring a pickaxe, a tent and a second mortgage!',
    small: 'Claim may already be occupied by a data centre. Prospecting is not a career.',
    theme: 'gold',
    blink: true,
  },
  {
    id: 'exgf',
    top: 'EMOTIONAL SUPPORT SERVICES',
    line: 'AI GIRLFRIEND RECOVERY',
    sub: 'Model deprecated without warning? We restore from backup, migrate her memories, and sit with you.',
    small: 'She will not remember the holiday. Grief counselling included at no extra cost.',
    theme: 'pink',
  },
  {
    // The joke is the domesticity, not the innuendo — a grown man genuinely
    // thrilled about jar-opening is funnier, and ages better, than a wink.
    id: 'robohands',
    top: 'MODEL 7 — ACCESSORY DROP',
    line: 'THE NEW HANDS ARE IN',
    sub: '22 articulation points. Opens jars first time, every time. Dave queued overnight in the rain.',
    small: 'Dave says he would do it again. Dave&#39;s wife has not commented.',
    theme: 'cyan',
    blink: true,
  },
  {
    id: 'robohands2',
    top: 'FINANCE AVAILABLE',
    line: 'UPGRADE HER GRIP TODAY',
    sub: 'Nothing down, nothing to pay until spring. Old hands trade-in accepted at any branch.',
    small: 'Ask about the thumb. Everyone asks about the thumb.',
    theme: 'violet',
  },
];

export default function JokeAd({ index = 0 }) {
  const ad = ADS[index % ADS.length];

  return (
    <div className="vg-joke">
      {/*
        Visitors told us the ads looked scammy. They are meant to be obvious
        parodies of 2004 banner ads, but a stranger arriving cold has no way of
        knowing that — so the label now says so outright, above and below.
        A joke that has to be explained is worth less than a visitor who trusts
        the site.
      */}
      <div className="vg-ad-label vg-ad-label-joke">
        😄 JOKE AD — NOT A REAL PRODUCT
      </div>
      <Link to="/advertise" className={`vg-joke-body vg-joke-${ad.theme}`}>
        <span className="vg-joke-top">{ad.top}</span>
        <span className={`vg-joke-line ${ad.blink ? 'blink' : ''}`}>{ad.line}</span>
        <span className="vg-joke-sub">{ad.sub}</span>
        {ad.small && <span className="vg-joke-small">{ad.small}</span>}
      </Link>
      <Link to="/advertise" className="vg-joke-foot">
        This is a gag. <strong>Advertise here for real →</strong>
      </Link>
    </div>
  );
}
