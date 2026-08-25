/**
 * Making a comic page small enough to actually read.
 *
 * Measured on the live site before this existed: an eighty page comic was
 * 2.8MB a page as PNG, so reading it once pulled about 220MB down. That is a
 * real chunk of somebody's monthly data on a phone, and against a Supabase
 * free plan's 10GB a month it meant roughly forty-five full reads of one
 * comic could exhaust the bandwidth for the entire site.
 *
 * PNG is the wrong format for this. It is lossless, which is what you want
 * for a screenshot of text or a logo with hard edges, and wasteful for a
 * painted or generated illustration. The same page as WebP is typically
 * seven to ten times smaller with nothing visible lost.
 *
 * Two things come out of here:
 *
 *   the page   — WebP, capped at 2200px on the long edge, quality 0.82
 *   a thumb    — WebP, 200px long edge, for the strip of little pages under
 *                the reader, which until now was downloading the full page
 *                to draw something 44 pixels wide
 *
 * Nothing here throws. If a browser cannot do WebP, or the image will not
 * decode, the original file is handed back untouched — a comic that uploads
 * fat is better than a comic that will not upload.
 */

export const MAX_EDGE = 2200;       // comfortably above the 1400×2100 we recommend
export const PAGE_QUALITY = 0.82;
export const THUMB_EDGE = 200;
export const THUMB_QUALITY = 0.7;

/** Does this browser actually produce WebP from a canvas? Asked once. */
let webpOk = null;
async function canDoWebp() {
  if (webpOk !== null) return webpOk;
  try {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 2;
    const blob = await new Promise((res) => c.toBlob(res, 'image/webp', 0.8));
    webpOk = !!blob && blob.type === 'image/webp';
  } catch {
    webpOk = false;
  }
  return webpOk;
}

function draw(bitmap, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // Comic pages are photographs and paintings, not pixel art, so smoothing
  // on the way down is right here even though the arcade turns it off.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // No background fill: a page with transparency keeps it, and WebP carries
  // alpha. Filling white here would put a white box behind every panel.
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

const toBlob = (canvas, type, quality) =>
  new Promise((res) => canvas.toBlob(res, type, quality));

function fit(w, h, edge) {
  const longest = Math.max(w, h);
  if (longest <= edge) return { w, h };
  const scale = edge / longest;
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/**
 * Shrink one page. Returns the file to upload, a thumbnail, the real
 * dimensions, and what it saved — the caller shows that number to the artist,
 * because "220MB became 24MB" is the sort of thing worth seeing.
 */
export async function shrinkPage(file) {
  const untouched = {
    file, thumb: null, w: 0, h: 0, before: file.size, after: file.size, changed: false,
  };

  // An animated GIF would lose its animation, and a comic page that moves is
  // somebody's deliberate choice. Left alone.
  if (file.type === 'image/gif') return untouched;
  if (!(await canDoWebp())) return untouched;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return untouched;   // not decodable here; let the server have it as-is
  }

  try {
    const full = { w: bitmap.width, h: bitmap.height };
    const size = fit(full.w, full.h, MAX_EDGE);

    const pageCanvas = draw(bitmap, size.w, size.h);
    const pageBlob = await toBlob(pageCanvas, 'image/webp', PAGE_QUALITY);

    const t = fit(full.w, full.h, THUMB_EDGE);
    const thumbCanvas = draw(bitmap, t.w, t.h);
    const thumbBlob = await toBlob(thumbCanvas, 'image/webp', THUMB_QUALITY);

    if (!pageBlob) return { ...untouched, w: full.w, h: full.h };

    // If WebP somehow came out bigger — happens with tiny or already
    // well-compressed images — keep the original. The point is fewer bytes,
    // not the format for its own sake.
    if (pageBlob.size >= file.size) {
      return { ...untouched, w: full.w, h: full.h, thumb: thumbBlob || null };
    }

    const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
    return {
      file: new File([pageBlob], name, { type: 'image/webp' }),
      thumb: thumbBlob || null,
      w: size.w,
      h: size.h,
      before: file.size,
      after: pageBlob.size,
      changed: true,
    };
  } catch {
    return untouched;
  } finally {
    bitmap.close?.();
  }
}

export function describeSaving(before, after) {
  const mb = (n) => (n / 1048576).toFixed(n >= 10485760 ? 0 : 1);
  if (!before || after >= before) return '';
  const pct = Math.round((1 - after / before) * 100);
  return `${mb(before)}MB → ${mb(after)}MB (${pct}% smaller)`;
}

/**
 * Where a page's thumbnail lives.
 *
 * The thumbnail is stored beside the page with ".thumb" before the
 * extension, and worked out from the page's own address rather than kept in
 * a database column. That is a deliberate trade: adding a column would mean
 * changing submit_comic() and update_comic() to carry another array, and the
 * last time this project added an argument to one of those functions it
 * created an ambiguous overload that broke every upload on the site. A
 * naming convention cannot do that.
 *
 * The cost is that comics posted before this existed have no thumbnail, so
 * anything reading this must fall back to the full page when the small one
 * is not there.
 */
export function thumbUrlFor(pageUrl) {
  if (!pageUrl || typeof pageUrl !== 'string') return null;
  const q = pageUrl.indexOf('?');
  const base = q === -1 ? pageUrl : pageUrl.slice(0, q);
  const tail = q === -1 ? '' : pageUrl.slice(q);
  const dot = base.lastIndexOf('.');
  if (dot === -1 || dot < base.lastIndexOf('/')) return null;
  return base.slice(0, dot) + '.thumb' + base.slice(dot) + tail;
}
