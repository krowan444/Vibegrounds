import { useEffect, useState } from 'react';
import { supabase, retryOnAbort } from '../lib/supabase';

/**
 * "Is this part of something bigger?"
 *
 * Shared by the post form and the edit form, because the two have to agree
 * exactly — a series you can create when posting but not change when editing
 * is worse than not having series at all.
 *
 * ONE FIELD, NOT A PICKER
 *
 * The obvious build is a dropdown of your series plus a "new series" button,
 * and it is the wrong one for somebody posting their first comic: on day one
 * the dropdown is empty and the button is the only thing that works, so the
 * control spends its early life as an obstacle.
 *
 * So it is a text box that suggests what you have used before. Type a name
 * you have used and the comic joins that run; type a new one and the run is
 * created. Nobody has to know a series is a thing that gets "made" first.
 * The matching is done in the database, case- and space-insensitively, so
 * "ant saga" finds "Ant Saga" rather than starting a second one.
 *
 * Everything here is optional. A comic that is not part of anything should
 * cost nothing to post, so the fields stay shut until you open them.
 */
export default function SeriesFields({ value, onChange, disabled }) {
  const [mine, setMine] = useState([]);
  // Open if this comic is already in a series — otherwise somebody editing
  // would have to go looking for the panel to find out that it is.
  const [open, setOpen] = useState(!!value.name);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await retryOnAbort(() => supabase.rpc('my_comic_series'));
      if (alive && Array.isArray(data)) setMine(data);
    })();
    return () => { alive = false; };
  }, []);

  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });

  // Suggest the next number in whichever series they have just named, so the
  // common case — posting part four of a run — needs no thinking about.
  const known = mine.find(
    (s) => s.title.trim().toLowerCase() === (value.name || '').trim().toLowerCase(),
  );

  if (!open) {
    return (
      <div className="vg-series-shut">
        <button
          type="button"
          className="vg-series-open"
          onClick={() => setOpen(true)}
          disabled={disabled}
        >
          + Part of a series?
        </button>
        <span className="vg-comic-opt">
          Volumes, chapters, editions — group it with the rest of the run
        </span>
      </div>
    );
  }

  return (
    <fieldset className="vg-series" disabled={disabled}>
      <legend>Part of a series <span className="vg-comic-opt">optional</span></legend>

      <div className="retro-form-group">
        <label htmlFor="series-name">Series name</label>
        <input
          id="series-name"
          className="vg-comic-input"
          list="vg-series-list"
          value={value.name}
          onChange={set('name')}
          maxLength={120}
          placeholder="The Squirrel Chronicles"
        />
        {/* A datalist rather than a select: it suggests without preventing.
            Typing something new is the same gesture as picking something old. */}
        <datalist id="vg-series-list">
          {mine.map((s) => (
            <option key={s.id} value={s.title}>
              {s.count} so far
            </option>
          ))}
        </datalist>
        {known && (
          <p className="vg-series-note">
            Joining your existing <b>{known.title}</b> — {known.count}{' '}
            {known.count === 1 ? 'comic' : 'comics'} in it so far.
          </p>
        )}
        {!known && value.name.trim().length >= 2 && (
          <p className="vg-series-note">
            New series — <b>{value.name.trim()}</b> gets its own page.
          </p>
        )}
      </div>

      <div className="vg-series-row">
        <div className="retro-form-group">
          <label htmlFor="series-label">Called a</label>
          <input
            id="series-label"
            className="vg-comic-input"
            value={value.label}
            onChange={set('label')}
            maxLength={40}
            placeholder="Volume"
          />
        </div>

        <div className="retro-form-group">
          <label htmlFor="series-number">Number</label>
          <input
            id="series-number"
            className="vg-comic-input"
            type="number"
            min="1"
            max="5000"
            value={value.number}
            onChange={set('number')}
            placeholder={known ? String(known.next) : '1'}
          />
        </div>

        <div className="retro-form-group">
          <label htmlFor="series-planned">
            Out of <span className="vg-comic-opt">optional</span>
          </label>
          <input
            id="series-planned"
            className="vg-comic-input"
            type="number"
            min="1"
            max="500"
            value={value.planned}
            onChange={set('planned')}
            placeholder="3"
          />
        </div>
      </div>

      {/* Says why the last box exists. Without it people either leave it empty
          and lose the "of 3" they wanted, or fill it in with the number posted
          so far and have to keep correcting it. */}
      <p className="vg-series-note">
        Fill in <b>Out of</b> only if you know how long the run will be — it is
        what lets the page say <i>Volume 1 of 3</i> before parts two and three
        exist. Leave it blank and the series page just counts what is there.
      </p>

      <button
        type="button"
        className="vg-series-clear"
        onClick={() => { onChange({ name: '', number: '', label: '', planned: '' }); setOpen(false); }}
      >
        Not part of a series
      </button>
    </fieldset>
  );
}

/** The shape the two forms hold, and what the RPC wants. Kept here so the
 *  forms cannot disagree about it. */
export const EMPTY_SERIES = { name: '', number: '', label: '', planned: '' };

export function seriesArgs(comicId, v) {
  return {
    p_comic: comicId,
    p_series: (v.name || '').trim(),
    p_edition: v.number === '' ? null : Number(v.number),
    p_label: (v.label || '').trim() || null,
    p_planned: v.planned === '' ? null : Number(v.planned),
  };
}
