/**
 * Tidying up a web address somebody typed.
 *
 * These lived in UploadPage.jsx and were imported from there by the two edit
 * pages. That was fine while the whole site arrived in one file. Now that
 * each route is fetched separately it is not: importing one page from
 * another chains their downloads together, so opening the edit-profile form
 * would quietly drag the entire upload page down with it for the sake of
 * four lines.
 *
 * The database sanitises all of this again on the way in — see migration 38.
 * What happens here is so the field shows the person what will actually be
 * saved, rather than silently differing from it.
 */

/** "vibegrounds.com" is what people type. Make it a link rather than refuse it. */
export function normalizeUrl(raw) {
  const url = (raw || '').trim();
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** Good enough to catch a typo. The real check is the one in the database. */
export function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.hostname.includes('.');
  } catch {
    return false;
  }
}
