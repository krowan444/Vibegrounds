import { useState } from 'react';

/**
 * An image that stays blurred until the viewer asks to see it.
 *
 * Memes are the one part of the site where someone can post something a
 * stranger did not ask to look at. Rather than moderating that after the
 * fact, anything flagged 18+ arrives covered, and revealing it is a
 * deliberate click.
 *
 * The blur is a real CSS filter on the image plus an opaque overlay — not
 * a swapped-out placeholder — so the reveal is instant and there is no
 * second network request. Note that the full image *is* in the page, so
 * this is a courtesy screen rather than a security control; anyone
 * determined can read it out of the DOM. For "don't ambush people with a
 * rude picture" that is the right level.
 *
 * Reveal state is per-image and deliberately not remembered. Erring
 * towards covered is the cheap mistake.
 */
export default function NsfwImage({ src, alt, nsfw, className = '', onError, sizes }) {
  const [shown, setShown] = useState(false);

  if (!nsfw) {
    return (
      <img src={src} alt={alt} className={className} onError={onError} sizes={sizes} loading="lazy" />
    );
  }

  return (
    <span className="vg-nsfw-wrap">
      <img
        src={src}
        alt={shown ? alt : ''}
        className={`${className} ${shown ? '' : 'vg-nsfw-blurred'}`.trim()}
        onError={onError}
        loading="lazy"
        aria-hidden={!shown || undefined}
      />

      {!shown && (
        <button
          type="button"
          className="vg-nsfw-veil"
          onClick={(e) => {
            // These sit inside link cards — revealing must not navigate.
            e.preventDefault();
            e.stopPropagation();
            setShown(true);
          }}
        >
          <span className="vg-nsfw-badge">18+</span>
          <span className="vg-nsfw-hint">Click to reveal</span>
        </button>
      )}

      {shown && (
        <button
          type="button"
          className="vg-nsfw-hide"
          title="Hide again"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShown(false); }}
        >
          Hide
        </button>
      )}
    </span>
  );
}
