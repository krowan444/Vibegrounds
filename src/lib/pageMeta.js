import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Page titles, descriptions and canonical URLs.
 *
 * Every page on the site used to share the one <title> baked into
 * index.html, so a browser with six VibeGrounds tabs open showed six
 * identical labels, and a search result for the Hall of Fame announced
 * itself as "Post What You Vibe Coded".
 *
 * Two ways in, because there are two kinds of page:
 *
 *   Fixed routes (/portal, /charts, /rules...) are listed in ROUTES below
 *   and handled centrally by <RouteMeta />. Adding one is a single line
 *   here rather than an edit to the page itself.
 *
 *   Data-driven routes (a creation, a profile, a thread) cannot know
 *   their own name until the fetch returns, so those pages call
 *   useDocumentTitle() with whatever they loaded.
 *
 * A deliberate omission: this does NOT rewrite the og:/twitter: tags per
 * page. Facebook, X, Discord and the rest read the raw HTML and never run
 * the JavaScript, so anything set here is invisible to them — it would
 * look like it worked in a browser and do nothing where it counts.
 * Per-creation share cards need prerendering or an edge function, which
 * is a separate job. Google does run JavaScript, which is why titles and
 * descriptions are still worth setting.
 */

const SITE = 'VibeGrounds';
const ORIGIN = 'https://www.vibegrounds.com';

const HOME_TITLE = 'VibeGrounds — A Home For Vibe Coders';
const HOME_DESC =
  'VibeGrounds is where vibe coders share what they built — games, AI movies, software, ' +
  'websites and glorious experiments. Get scored 0–5 and climb the Daily, Weekly and All-Time charts.';

/** path → [title before the " | VibeGrounds", description] */
const ROUTES = {
  '/': [null, HOME_DESC],

  '/portal': ['The Portal',
    'Browse everything posted to VibeGrounds — games, apps, websites, AI movies and experiments, newest first or best rated.'],
  '/charts': ['Top 100',
    'The hundred highest-rated things anyone has vibe coded, scored 0–5 by the community.'],
  '/hall-of-fame': ['Hall of Fame',
    'The creations that took the number one spot. Daily, weekly and all-time champions of VibeGrounds.'],
  '/badges': ['Trophy Cabinet',
    'Every badge you can earn on VibeGrounds and how to get it. Nothing hidden — if it is on this page, it is winnable.'],
  '/memes': ['Memes',
    'Vibe coding memes, jokes and the general nonsense of building things with AI.'],
  '/memes/post': ['Post a Meme', 'Share a vibe coding meme with the VibeGrounds community.'],

  '/comics': ['Comics',
    'Comics made by the VibeGrounds community — single pages, one-shots and longer series, free to read.'],
  '/comics/post': ['Post a Comic',
    'Upload your comic to VibeGrounds. Any page size, up to 200 pages, free to read.'],

  '/community': ['Community',
    'Talk to other vibe coders. Ask beginner questions without embarrassment, show off what you made, argue about tools.'],

  '/upload': ['Submit Your Project',
    'Post the game, app, website or experiment you vibe coded and let strangers score it out of 5.'],
  '/coins': ['Vibe Coins', 'What Vibe Coins are, how you earn them, and what they are for.'],
  '/rules': ['Rules', 'The rules of VibeGrounds. Short, human, and mostly about not being unpleasant to beginners.'],
  '/advertise': ['Advertise', 'Advertising on VibeGrounds.'],

  '/auth': ['Sign In', 'Sign in to VibeGrounds, or join and get 50 free Vibe Coins.'],
  '/forgot-password': ['Reset Your Password', 'Reset your VibeGrounds password.'],

  '/category/games': ['Games', 'Games people vibe coded. Browser games, prototypes, first attempts and finished things.'],
  '/category/ai-movies': ['AI Movies', 'Films, animations and moving pictures made with AI by the VibeGrounds community.'],
  '/category/software': ['Software', 'Apps and useful tools built by vibe coders.'],
  '/category/websites': ['Websites', 'Websites people vibe coded, from one-page oddities to full builds.'],
  '/category/art': ['Art', 'Visual work made by the VibeGrounds community.'],
  '/category/audio': ['Audio', 'Music, sound and audio experiments from vibe coders.'],
};

/** "Hall of Fame" → "Hall of Fame | VibeGrounds". Nothing → the home title. */
export function titleFor(name) {
  return name ? `${name} | ${SITE}` : HOME_TITLE;
}

function upsertMeta(name, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * One canonical address per page, so a creation reached through ?cat=,
 * through the non-www host and through a shared link with tracking
 * parameters on it all count as the same page rather than three thin
 * duplicates competing with each other.
 */
function setCanonical(pathname) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', ORIGIN + pathname);
}

/**
 * For pages whose name arrives with the data. Pass undefined or null
 * while loading and it leaves the title alone rather than flashing
 * something wrong.
 */
export function useDocumentTitle(name, description) {
  useEffect(() => {
    if (name == null || name === '') return;
    document.title = titleFor(name);
    if (description) upsertMeta('description', description);
  }, [name, description]);
}

/**
 * Sits inside the router and reacts to every navigation. For a known
 * route it sets the title outright; for a data-driven one it resets to
 * the site default, which the page then overwrites once its fetch lands.
 * Resetting matters — without it you would carry the previous page's
 * title into the next one and sit there looking wrong.
 */
export default function RouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    setCanonical(pathname);
    const entry = ROUTES[pathname];
    document.title = titleFor(entry ? entry[0] : null);
    upsertMeta('description', entry ? entry[1] : HOME_DESC);
  }, [pathname]);

  return null;
}
