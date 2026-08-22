import { supabase, withTimeout, describeError } from './supabase';

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

  for (const p of pages) {
    if (!p.file) {
      urls.push(p.remoteUrl);
      widths.push(p.w || 0);
      heights.push(p.h || 0);
      continue;
    }

    done += 1;
    onProgress?.(`Uploading page ${done} of ${toUpload}...`);

    const ext = (p.file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    // Namespaced by user id because the storage policy insists on it, and
    // stamped so re-posting the same filename never collides.
    const path = `${userId}/${Date.now()}-${urls.length}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await withTimeout(
      supabase.storage.from('comics').upload(path, p.file, {
        cacheControl: '31536000',
        contentType: p.file.type,
        upsert: false,
      }),
      60000,
      `page ${urls.length + 1}`,
    );
    if (upErr) throw new Error(`Page ${urls.length + 1} would not upload: ${describeError(upErr)}`);

    const { data: pub } = supabase.storage.from('comics').getPublicUrl(path);
    if (!pub?.publicUrl) throw new Error(`Could not work out the address for page ${urls.length + 1}.`);

    urls.push(pub.publicUrl);
    widths.push(p.w || 0);
    heights.push(p.h || 0);
  }

  return { urls, widths, heights };
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
