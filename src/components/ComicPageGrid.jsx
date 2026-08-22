import { useRef, useState, useCallback } from 'react';
import {
  MAX_PAGES, OK_TYPES, filesToPages, sortByName, releasePage,
} from '../lib/comicFiles';

/**
 * The page grid, shared by posting a comic and editing one.
 *
 * The hard part of both screens is the same and it is not the upload, it is
 * the order. A comic read out of order is not a comic, and the mistake is
 * invisible to the person who made it — they know what order it goes in, so
 * their eye slides over it. So the order is the loudest thing here: a big
 * number on every tile, laid out in reading order, five to a row like a
 * contact sheet.
 *
 * Four ways to fix an order, because one is never enough:
 *   - drag a page onto another (fast, on a desktop)
 *   - the ‹ › buttons on each tile (works on a phone, works with a keyboard)
 *   - Sort by name, for people who named their files 01, 02, 03
 *   - Reverse, for the scanner that handed everything over backwards
 */
export default function ComicPageGrid({
  pages,
  onChange,
  disabled = false,
  onProblems,
  perRow = 5,
  minSlots = 20,
}) {
  const fileInput = useRef(null);
  const titleInput = useRef(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [dropOn, setDropOn] = useState(null);
  const [over, setOver] = useState(false);

  /**
   * Where new pages land. Dropping onto the grid appends; the title-page
   * button puts them at the front. Everything else about them is identical.
   */
  const add = useCallback(async (fileList, where = 'end') => {
    const { pages: fresh, problems } = await filesToPages(fileList, pages.length);
    onProblems?.(problems);
    if (!fresh.length) return;
    onChange(where === 'front' ? [...fresh, ...pages] : [...pages, ...fresh]);
  }, [pages, onChange, onProblems]);

  const move = (from, to) => {
    if (to < 0 || to >= pages.length) return;
    const next = [...pages];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const removeAt = (i) => {
    releasePage(pages[i]);
    onChange(pages.filter((_, n) => n !== i));
  };

  const slots = Math.max(minSlots, Math.ceil((pages.length + 1) / perRow) * perRow);
  const empties = Math.max(0, slots - pages.length);
  const cover = pages[0];

  return (
    <>
      {/* ---- the cover, called what it actually is ---- */}
      <div className="vg-comic-cover-pick">
        <div className={`vg-comic-cover-slot ${cover ? '' : 'is-empty'}`}>
          {cover
            ? <img src={cover.url} alt="Page 1" />
            : <span className="vg-comic-plus">+</span>}
        </div>
        <div className="vg-comic-cover-say">
          <b>Title page</b>
          <p>
            {cover
              ? 'Page 1 is your title page — it is what people see on the shelf and the first thing they read.'
              : 'Whatever ends up as page 1 becomes the cover on the shelf. Add a title page here if you drew one.'}
          </p>
          <button
            type="button"
            className="vg-comic-cover-btn"
            onClick={() => titleInput.current?.click()}
            disabled={disabled}
          >
            {cover ? 'Put a title page in front' : 'Add a title page'}
          </button>
        </div>
      </div>

      {/* ---- ordering ---- */}
      <div className="vg-comic-sortbar">
        <span className="vg-comic-count">
          {pages.length === 0
            ? 'No pages yet.'
            : `${pages.length} page${pages.length === 1 ? '' : 's'} · reads left to right, top to bottom`}
        </span>
        <span className="vg-comic-sortbtns">
          <button
            type="button" disabled={disabled || pages.length < 2}
            onClick={() => onChange(sortByName(pages))}
            title="For files named 01, 02, 03 — page 2 lands before page 10, not after page 1"
          >Sort by name</button>
          <button
            type="button" disabled={disabled || pages.length < 2}
            onClick={() => onChange([...pages].reverse())}
            title="Whole comic back to front"
          >Reverse</button>
        </span>
      </div>

      {/* ---- the contact sheet ---- */}
      <div
        className={`vg-comic-grid ${over ? 'is-over' : ''}`}
        onDragOver={(e) => { if (e.dataTransfer.types?.includes('Files')) { e.preventDefault(); setOver(true); } }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          setOver(false);
          if (e.dataTransfer.files?.length) { e.preventDefault(); add(e.dataTransfer.files); }
        }}
      >
        {pages.map((p, i) => (
          <div
            key={p.id}
            className={[
              'vg-comic-tile',
              dropOn === i && dragFrom !== null && dragFrom !== i ? 'is-target' : '',
              dragFrom === i ? 'is-lifting' : '',
              i === 0 ? 'is-cover' : '',
            ].filter(Boolean).join(' ')}
            draggable={!disabled}
            onDragStart={() => setDragFrom(i)}
            onDragEnd={() => { setDragFrom(null); setDropOn(null); }}
            onDragOver={(e) => { e.preventDefault(); setDropOn(i); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragFrom !== null && dragFrom !== i) move(dragFrom, i);
              setDragFrom(null);
              setDropOn(null);
            }}
          >
            <span className="vg-comic-num">{i + 1}</span>
            <img src={p.url} alt={`Page ${i + 1}`} loading="lazy" />

            {p.w === 0 && <span className="vg-comic-bad" title="This file would not open">!</span>}
            {/* A page already on the comic looks no different from one you
                just dropped, so say which is which — it is the difference
                between "nothing happened" and "this uploads when I save". */}
            {!p.file && <span className="vg-comic-onthere" title="Already on the comic">saved</span>}

            <div className="vg-comic-tools">
              <button type="button" aria-label={`Move page ${i + 1} earlier`}
                disabled={disabled || i === 0} onClick={() => move(i, i - 1)}>‹</button>
              <button type="button" aria-label={`Remove page ${i + 1}`}
                className="vg-comic-del" disabled={disabled} onClick={() => removeAt(i)}>✕</button>
              <button type="button" aria-label={`Move page ${i + 1} later`}
                disabled={disabled || i === pages.length - 1} onClick={() => move(i, i + 1)}>›</button>
            </div>

            {p.w > 0 && <span className="vg-comic-dims">{p.w}×{p.h}</span>}
          </div>
        ))}

        {Array.from({ length: empties }).map((_, n) => (
          <button
            key={`empty-${n}`}
            type="button"
            className={`vg-comic-slot ${n === 0 ? 'is-next' : ''}`}
            onClick={() => fileInput.current?.click()}
            disabled={disabled || pages.length >= MAX_PAGES}
            aria-label={n === 0 ? 'Add pages' : `Empty slot ${pages.length + n + 1}`}
          >
            <span className="vg-comic-plus">+</span>
            <span className="vg-comic-slotnum">{pages.length + n + 1}</span>
          </button>
        ))}
      </div>

      <input
        ref={fileInput} type="file" accept={OK_TYPES.join(',')} multiple hidden
        onChange={(e) => { add(e.target.files, 'end'); e.target.value = ''; }}
      />
      <input
        ref={titleInput} type="file" accept={OK_TYPES.join(',')} hidden
        onChange={(e) => { add(e.target.files, 'front'); e.target.value = ''; }}
      />
    </>
  );
}
