/**
 * Turning dropped files into comic pages.
 *
 * Shared by the post screen and the edit screen so the two cannot drift
 * apart — the rules about what counts as a page belong in one place.
 */

export const MAX_PAGES = 200;
export const MAX_BYTES = 10 * 1024 * 1024;
export const OK_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

let uid = 0;
export const nextPageId = () => `p${++uid}`;

/**
 * A page on the grid is one of two things and the rest of the code should
 * not have to care which:
 *
 *   staged  — a File the browser is holding, previewed from an object URL,
 *             uploaded when the comic is saved
 *   already — a page that is on the comic now, previewed from its real URL
 *
 * `file` tells them apart. `remoteUrl` is set only on the second kind.
 */
export function pageFromRemote(row) {
  return {
    id: nextPageId(),
    file: null,
    url: row.image_url,
    remoteUrl: row.image_url,
    w: row.width || 0,
    h: row.height || 0,
  };
}

/**
 * Read a file's real dimensions before it goes anywhere. Worth the wait: the
 * reader uses them to hold the right amount of space open while a page
 * downloads, so a comic does not jump about as you scroll it.
 */
function measure(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () =>
      resolve({ id: nextPageId(), file, url, remoteUrl: null, w: img.naturalWidth, h: img.naturalHeight });
    // A file that will not decode is not a picture, whatever its type says.
    // Keep it with unknown dimensions rather than dropping it silently — the
    // artist can see it is broken on the grid and take it out themselves.
    img.onerror = () => resolve({ id: nextPageId(), file, url, remoteUrl: null, w: 0, h: 0 });
    img.src = url;
  });
}

/**
 * Vet a batch of files and turn the good ones into pages.
 *
 * The order they arrive in is the order they come back in. It used to sort
 * by filename here, which quietly overrode whatever the artist intended and
 * was impossible to undo — sorting is now something you ask for, on the
 * grid, and can change your mind about.
 *
 * Returns { pages, problems } — problems is a list of plain sentences, one
 * per rejected file, ready to show as they are.
 */
export async function filesToPages(fileList, existingCount = 0) {
  const incoming = [...(fileList || [])];
  const problems = [];
  if (!incoming.length) return { pages: [], problems };

  const room = MAX_PAGES - existingCount;
  const taken = incoming.slice(0, Math.max(room, 0));
  if (incoming.length > room) {
    problems.push(
      `A comic can hold ${MAX_PAGES} pages, so ${incoming.length - Math.max(room, 0)} of those were left out`,
    );
  }

  const accepted = [];
  for (const file of taken) {
    if (!OK_TYPES.includes(file.type)) {
      problems.push(`${file.name} is not a PNG, JPG, WebP or GIF`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      problems.push(`${file.name} is ${(file.size / 1048576).toFixed(1)}MB — the limit is 10MB a page`);
      continue;
    }
    accepted.push(file);
  }

  // Measured in parallel, but put back in the order they came in. Promise.all
  // preserves order regardless of which image decodes first, which is the
  // whole reason this is not a race.
  const pages = await Promise.all(accepted.map(measure));
  return { pages, problems };
}

/** Natural sort, so page 2 comes before page 10 rather than after page 1. */
export function sortByName(pages) {
  return [...pages].sort((a, b) => {
    const an = a.file?.name ?? a.remoteUrl ?? '';
    const bn = b.file?.name ?? b.remoteUrl ?? '';
    return an.localeCompare(bn, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/** Only the previews we made ourselves are ours to release. */
export function releasePage(page) {
  if (page?.file && page.url?.startsWith('blob:')) URL.revokeObjectURL(page.url);
}
