/**
 * Share cards.
 *
 * The site is a single-page app: React writes the title and the og: tags
 * after it boots. Every scraper that builds a link preview — Discord, X,
 * WhatsApp, Slack, Facebook, iMessage — reads the HTML and never runs the
 * JavaScript, so all of them saw the same generic card from index.html no
 * matter which page was shared. Post your game, get VibeGrounds' logo.
 *
 * So: vercel.json spots a scraper by its user agent and sends it here
 * instead of to the app. This returns a small page whose only job is to
 * carry the right tags. A person never sees it — but if one somehow lands
 * here (a scraper posting the link on, a stripped user agent) the meta
 * refresh and the link put them on the real page immediately.
 *
 * Search engines are deliberately NOT routed here. Google and Bing run the
 * JavaScript and index the real thing; handing them a stub with a redirect
 * in it would be worse than what they already get.
 *
 * Nothing in here is allowed to break a link. Missing environment, a
 * database that will not answer, an id that does not exist — every one of
 * them falls through to the generic card rather than an error page.
 */

const SITE = 'https://www.vibegrounds.com';
const FALLBACK_IMAGE = `${SITE}/images/og-cover.png`;
const FALLBACK_TITLE = 'VibeGrounds — A Home For Vibe Coders';
const FALLBACK_DESC =
  'Games, AI movies, software, websites and experiments. Get scored 0–5 and climb the charts.';

/* How long a card may be reused. Ten minutes is long enough that a link
   posted into a busy channel is fetched once, short enough that fixing a
   typo in your title shows up the same afternoon. */
const CACHE = 'public, max-age=600, s-maxage=600, stale-while-revalidate=86400';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Trim to a whole word. A description cut mid-word reads like a fault. */
function clamp(text, max = 200) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + '…';
}

/**
 * Only http(s) URLs on a real host become the card image. A scraper
 * following whatever string happens to sit in the database is not something
 * to leave open, and a broken image URL costs the card its picture — the
 * fallback is better than that.
 */
function safeImage(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

async function fromSupabase(path) {
  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!base || !key) return null;

  // A scraper that waits is a scraper that gives up and shows nothing, so
  // this gets three seconds and then we serve the generic card.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 3000);
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: abort.signal,
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------------- cards */

async function creationCard(id) {
  const cols = 'title,description,thumbnail_url,is_nsfw,score,vote_count,creator_username,category_name';
  const row = await fromSupabase(
    `creations_public?id=eq.${encodeURIComponent(id)}&select=${cols}&limit=1`,
  );
  if (!row) return null;

  const scored =
    row.vote_count > 0
      ? `★ ${Number(row.score).toFixed(2)} from ${row.vote_count} ${row.vote_count === 1 ? 'vote' : 'votes'}`
      : 'Not scored yet — first vote decides';

  return {
    url: `${SITE}/creation/${id}`,
    title: `${row.title} by ${row.creator_username}`,
    description: clamp(row.description) || `${row.category_name || 'A creation'} on VibeGrounds. ${scored}.`,
    // A thumbnail marked not-for-children does not go into an unclickable
    // preview on somebody's work chat. The title still travels; the picture
    // does not.
    image: row.is_nsfw ? null : safeImage(row.thumbnail_url),
    type: 'article',
  };
}

async function comicCard(id) {
  const cols = 'title,description,cover_url,is_nsfw,page_count,creator_username';
  const row = await fromSupabase(
    `comics_public?id=eq.${encodeURIComponent(id)}&select=${cols}&limit=1`,
  );
  if (!row) return null;

  const pages = `${row.page_count} page${row.page_count === 1 ? '' : 's'}`;
  return {
    url: `${SITE}/comics/${id}`,
    title: `${row.title} — a comic by ${row.creator_username}`,
    description: clamp(row.description) || `${pages}, free to read on VibeGrounds.`,
    image: row.is_nsfw ? null : safeImage(row.cover_url),
    type: 'article',
  };
}

async function profileCard(username) {
  const cols = 'username,display_name,bio,avatar_url,rank_title,level,submission_count';
  const row = await fromSupabase(
    `profiles_public?username=eq.${encodeURIComponent(username)}&select=${cols}&limit=1`,
  );
  if (!row) return null;

  const name = row.display_name || row.username;
  const made =
    row.submission_count > 0
      ? `${row.submission_count} thing${row.submission_count === 1 ? '' : 's'} posted`
      : 'Just joined';

  return {
    url: `${SITE}/profile/${encodeURIComponent(row.username)}`,
    title: `${name} on VibeGrounds`,
    description: clamp(row.bio) || `${row.rank_title || 'Viber'} · level ${row.level} · ${made}.`,
    image: safeImage(row.avatar_url),
    // An avatar is square, so it gets the small card. Forcing it into a
    // 1.91:1 banner would crop somebody's face in half.
    card: 'summary',
    type: 'profile',
  };
}

/* ----------------------------------------------------------------- page */

function render(c) {
  const image = c.image || FALLBACK_IMAGE;
  const isFallbackImage = image === FALLBACK_IMAGE;
  const card = c.card || 'summary_large_image';

  // Width and height are only declared for our own artwork, where they are
  // known. Declaring a guess for somebody's uploaded thumbnail would lay the
  // card out to the wrong shape.
  const size = isFallbackImage
    ? '<meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${esc(c.title)}</title>
    <meta name="description" content="${esc(c.description)}" />
    <link rel="canonical" href="${esc(c.url)}" />

    <meta property="og:site_name" content="VibeGrounds" />
    <meta property="og:type" content="${esc(c.type || 'website')}" />
    <meta property="og:url" content="${esc(c.url)}" />
    <meta property="og:title" content="${esc(c.title)}" />
    <meta property="og:description" content="${esc(c.description)}" />
    <meta property="og:image" content="${esc(image)}" />
    <meta property="og:image:alt" content="${esc(c.title)}" />
    ${size}

    <meta name="twitter:card" content="${esc(card)}" />
    <meta name="twitter:title" content="${esc(c.title)}" />
    <meta name="twitter:description" content="${esc(c.description)}" />
    <meta name="twitter:image" content="${esc(image)}" />

    <meta http-equiv="refresh" content="0; url=${esc(c.url)}" />
  </head>
  <body style="background:#0a0a12;color:#e8a317;font-family:system-ui,sans-serif;padding:40px">
    <p>Taking you to <a href="${esc(c.url)}" style="color:#e8a317">${esc(c.title)}</a>…</p>
  </body>
</html>
`;
}

/**
 * Where the link was actually going.
 *
 * This matters more than it looks. When the lookup fails we still fall back
 * to the generic card — but the card must keep pointing at the page that was
 * shared, not at the home page. Otherwise one slow database call turns
 * somebody's link to their game into a link to the front door, and the meta
 * refresh drops whoever clicked it somewhere they did not ask to go.
 */
function originalUrl(type, key) {
  if (!key) return SITE;
  if (type === 'creation') return `${SITE}/creation/${encodeURIComponent(key)}`;
  if (type === 'comic') return `${SITE}/comics/${encodeURIComponent(key)}`;
  if (type === 'profile') return `${SITE}/profile/${encodeURIComponent(key)}`;
  return SITE;
}

export default async function handler(req, res) {
  const { type, id } = req.query || {};
  let key = '';
  try {
    key = decodeURIComponent(String(id ?? '')).trim();
  } catch {
    key = String(id ?? '').trim();
  }

  const generic = {
    url: originalUrl(type, key),
    title: FALLBACK_TITLE,
    description: FALLBACK_DESC,
    image: FALLBACK_IMAGE,
    type: 'website',
  };

  let card = generic;
  try {
    if (key) {
      if (type === 'creation') card = (await creationCard(key)) || generic;
      else if (type === 'comic') card = (await comicCard(key)) || generic;
      else if (type === 'profile') card = (await profileCard(key)) || generic;
    }
  } catch {
    card = generic;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', CACHE);
  res.status(200).send(render(card));
}
