import { supabase, withTimeout, describeError } from './supabase';
import { shrinkPage, describeSaving } from './imageShrink';

// What the storage bucket itself will accept. Kept here so the message a
// person sees comes from the same number the server enforces.
const STORAGE_LIMIT = 10 * 1024 * 1024;

/**
 * Push the staged pages to storage and hand back the finished lists.
 *
 * Pages already on the comic are passed straight through — editing a comic
 * to move page 9 in front of page 8 should not re-upload nine pictures.
 *
 * Shared by posting and editing so both produce exactly the same shape for
 * the database function, which is the thing that actually guarantees a comic
 * is written whole or not at all.
 */
export async function uploadPages(pages, userId, onProgress) {
  const urls = [];
  const widths = [];
  const heights = [];

  const toUpload = pages.filter((p) => p.file).length;
  let done = 0;
  // Reported back so the artist can see what happened to their pictures.
  let bytesBefore = 0;
  let bytesAfter = 0;

  for (const p of pages) {
    if (!p.file) {
      urls.push(p.remoteUrl);
      widths.push(p.w || 0);
      heights.push(p.h || 0);
      continue;
    }

    done += 1;

    // Shrink before anything leaves the machine. A comic page as PNG was
    // running about 2.8MB; the same page as WebP is nearer 200KB, and the
    // strip of little pages under the reader was downloading the full
    // article to draw something 44 pixels across.
    onProgress?.(`Shrinking page ${done} of ${toUpload}...`);
    const small = await shrinkPage(p.file);
    bytesBefore += small.before;
    bytesAfter += small.after;

    // The storage bucket refuses anything over 10MB, and shrinking is a
    // browser feature that can be absent — an old browser with no WebP hands
    // the original straight back. Rather than let that surface as a raw
    // storage error, say what actually happened and what to do about it.
    if (small.file.size > STORAGE_LIMIT) {
      throw new Error(
        `Page ${urls.length + 1} is ${(small.file.size / 1048576).toFixed(1)}MB and could not be `
        + 'made smaller in this browser. Save it as a JPEG or WebP first, or try a newer browser.',
      );
    }

    onProgress?.(`Uploading page ${done} of ${toUpload}...`);

    const ext = (small.file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    // Namespaced by user id because the storage policy insists on it, and
    // stamped so re-posting the same filename never collides.
    const stem = `${userId}/${Date.now()}-${urls.length}-${Math.random().toString(36).slice(2, 8)}`;
    const path = `${stem}.${ext}`;

    const { error: upErr } = await withTimeout(
      supabase.storage.from('comics').upload(path, small.file, {
        cacheControl: '31536000',
        contentType: small.file.type,
        upsert: false,
      }),
      60000,
      `page ${urls.length + 1}`,
    );
    if (upErr) throw new Error(`Page ${urls.length + 1} would not upload: ${describeError(upErr)}`);

    // The thumbnail is a nicety, so a failure here is swallowed: the reader
    // falls back to the full page, which is exactly what it did before.
    if (small.thumb) {
      try {
        await withTimeout(
          supabase.storage.from('comics').upload(`${stem}.thumb.${ext}`, small.thumb, {
            cacheControl: '31536000',
            contentType: 'image/webp',
            upsert: false,
          }),
          30000,
          `thumbnail ${urls.length + 1}`,
        );
      } catch { /* no thumbnail is not a failed page */ }
    }

    const { data: pub } = supabase.storage.from('comics').getPublicUrl(path);
    if (!pub?.publicUrl) throw new Error(`Could not work out the address for page ${urls.length + 1}.`);

    urls.push(pub.publicUrl);
    // The shrunk dimensions, not the original ones — the reader uses these to
    // hold the right amount of space open while a page downloads, and an
    // oversized upload is scaled down on the way through.
    widths.push(small.w || p.w || 0);
    heights.push(small.h || p.h || 0);
  }

  return {
    urls, widths, heights,
    saved: describeSaving(bytesBefore, bytesAfter),
  };
}

/**
 * Tidy up pages an edit dropped.
 *
 * Best effort on purpose: the comic is already saved by the time this runs,
 * and a storage bucket holding a few pictures nobody points at is a much
 * smaller problem than an error message over a save that actually worked.
 * Only files in this user's own folder are touched.
 */
export async function forgetRemovedPages(removedUrls, userId) {
  const prefix = `${userId}/`;
  const paths = [];

  for (const url of removedUrls) {
    try {
      const marker = '/storage/v1/object/public/comics/';
      const at = url.indexOf(marker);
      if (at === -1) continue;
      const path = decodeURIComponent(url.slice(at + marker.length).split('?')[0]);
      if (path.startsWith(prefix) && !path.includes('..')) paths.push(path);
    } catch {
      /* a URL we cannot read is a URL we leave alone */
    }
  }

  if (!paths.length) return;
  try {
    await supabase.storage.from('comics').remove(paths);
  } catch (e) {
    console.warn('old comic pages left in storage:', e);
  }
}

/**
 * Squash the pages of a comic that is already posted.
 *
 * Comics posted before pages were shrunk on the way in are still whole PNGs —
 * one measured at 2.8MB a page, which made an eighty page comic 220MB to
 * read once. This fetches each page back, runs it through the same shrinker
 * new uploads use, and puts the smaller version alongside.
 *
 * The originals are NOT overwritten. New files go to new addresses and the
 * comic is pointed at them, so if anything looks wrong the old pages are
 * still sitting in storage exactly where they were.
 *
 * Anything that will not fetch or will not shrink is passed through
 * unchanged. A comic that ends up half-shrunk is fine; a comic that loses a
 * page is not.
 */
export async function recompressExisting(pages, userId, onProgress) {
  const urls = [];
  const widths = [];
  const heights = [];
  let bytesBefore = 0;
  let bytesAfter = 0;
  let changed = 0;
  let skipped = 0;
  // The first real reason something failed. Without this a permissions error
  // looked exactly like "nothing needed doing", which is how a staff member
  // pressing this on somebody else's comic got silence instead of an answer.
  let firstProblem = '';

  const total = pages.length;

  for (let i = 0; i < pages.length; i += 1) {
    const p = pages[i];
    onProgress?.(`Shrinking page ${i + 1} of ${total}...`);

    // A page staged in this edit but not yet uploaded is left for the normal
    // upload path, which shrinks it anyway.
    if (!p.remoteUrl) {
      urls.push(p.remoteUrl);
      widths.push(p.w || 0);
      heights.push(p.h || 0);
      skipped += 1;
      continue;
    }

    let blob = null;
    try {
      const res = await withTimeout(fetch(p.remoteUrl, { cache: 'no-store' }), 45000, `page ${i + 1}`);
      if (res.ok) blob = await res.blob();
    } catch { /* leave it as it is */ }

    if (!blob) {
      urls.push(p.remoteUrl); widths.push(p.w || 0); heights.push(p.h || 0); skipped += 1;
      continue;
    }

    const name = (p.remoteUrl.split('/').pop() || 'page.png').split('?')[0];
    const small = await shrinkPage(new File([blob], name, { type: blob.type || 'image/png' }));
    bytesBefore += small.before;

    if (!small.changed || small.file.size > STORAGE_LIMIT) {
      bytesAfter += small.before;
      urls.push(p.remoteUrl); widths.push(p.w || 0); heights.push(p.h || 0); skipped += 1;
      continue;
    }

    const ext = (small.file.name.split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '');
    const stem = `${userId}/${Date.now()}-r${i}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const { error: upErr } = await withTimeout(
        supabase.storage.from('comics').upload(`${stem}.${ext}`, small.file, {
          cacheControl: '31536000', contentType: small.file.type, upsert: false,
        }),
        60000,
        `page ${i + 1}`,
      );
      if (upErr) throw new Error(describeError(upErr));

      if (small.thumb) {
        try {
          await withTimeout(
            supabase.storage.from('comics').upload(`${stem}.thumb.${ext}`, small.thumb, {
              cacheControl: '31536000', contentType: 'image/webp', upsert: false,
            }),
            30000,
            `thumbnail ${i + 1}`,
          );
        } catch { /* a missing thumbnail falls back to the page */ }
      }

      const { data: pub } = supabase.storage.from('comics').getPublicUrl(`${stem}.${ext}`);
      if (!pub?.publicUrl) throw new Error('no address for the new page');

      urls.push(pub.publicUrl);
      widths.push(small.w || p.w || 0);
      heights.push(small.h || p.h || 0);
      bytesAfter += small.after;
      changed += 1;
    } catch (e) {
      // Could not store the smaller one, so keep pointing at the original —
      // but remember why, and say so at the end rather than reporting a
      // silent skip.
      if (!firstProblem) firstProblem = describeError(e);
      urls.push(p.remoteUrl); widths.push(p.w || 0); heights.push(p.h || 0);
      bytesAfter += small.before;
      skipped += 1;
    }
  }

  return {
    urls, widths, heights, changed, skipped,
    saved: describeSaving(bytesBefore, bytesAfter),
    before: bytesBefore,
    after: bytesAfter,
    problem: firstProblem,
  };
}
