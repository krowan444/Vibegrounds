/**
 * Thumbnails without an upload flow.
 *
 * Rather than asking people to make a cover image (and then policing what they
 * upload), we render a live screenshot of whatever they submitted. WordPress's
 * mShots service does this for free with no API key and no account.
 *
 * Caveats worth knowing:
 *  - The very first request for a URL returns a grey "generating" placeholder
 *    while it renders. It fills in on a later view, which is why nothing here
 *    treats a miss as an error.
 *  - It can only see publicly reachable pages. Anything behind a login gets
 *    the logo instead, which is the honest outcome.
 *  - An explicit thumbnail_url in the database always wins, so a staff pick can
 *    be given proper artwork later without touching this file.
 */

const MSHOTS = 'https://s.wordpress.com/mshots/v1/';

export const LOGO_FALLBACK = '/images/logo.png';

/** Screenshot URL for an arbitrary page, or null if it can't be shot. */
export function screenshotUrl(pageUrl, width = 400) {
  if (!pageUrl) return null;

  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(pageUrl) ? pageUrl : `https://${pageUrl}`);
  } catch {
    return null;
  }

  // Only public web pages can be screenshotted. Anything pointing inward is
  // both pointless to shoot and a small SSRF-shaped foot-gun, so skip it.
  if (!/^https?:$/.test(parsed.protocol)) return null;
  if (/^(localhost$|127\.|10\.|192\.168\.|169\.254\.|\[?::1)/i.test(parsed.hostname)) return null;

  return `${MSHOTS}${encodeURIComponent(parsed.href)}?w=${width}`;
}

/**
 * What a card should actually show, in priority order:
 * explicit artwork → live screenshot → logo placeholder.
 */
export function thumbFor(creation, width = 400) {
  if (!creation) return LOGO_FALLBACK;
  if (creation.thumbnail_url) return creation.thumbnail_url;
  return screenshotUrl(creation.project_url, width) || LOGO_FALLBACK;
}

/** Drop-in onError handler so a failed shot degrades to the logo silently. */
export function onThumbError(e) {
  if (e.currentTarget.dataset.fellBack) return;
  e.currentTarget.dataset.fellBack = '1';
  e.currentTarget.src = LOGO_FALLBACK;
  e.currentTarget.classList.add('vg-thumb-placeholder');
}
