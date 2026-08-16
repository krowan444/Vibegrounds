import { useState } from 'react';

/**
 * A badge's artwork.
 *
 * Every badge carries an emoji in the database and, once the artwork exists,
 * a matching image at /images/badges/<slug>.webp. This tries the image and
 * quietly drops back to the emoji if it is not there.
 *
 * That fallback is the whole point: art can land one sheet at a time without
 * ever leaving a broken square on someone's profile, and a badge invented
 * later works on the day it is added rather than the day someone draws it.
 */
export default function BadgeIcon({ slug, icon, size = 32, dim = false }) {
  const [failed, setFailed] = useState(false);

  const common = {
    width: size,
    height: size,
    // Locked badges are shown as a dark silhouette. Still recognisable in
    // outline, so it reads as "that one, not yet" rather than a blank.
    filter: dim ? 'grayscale(1) brightness(0.45)' : undefined,
    opacity: dim ? 0.75 : 1,
  };

  if (failed || !slug) {
    return (
      <span
        aria-hidden="true"
        style={{ ...common, fontSize: size * 0.8, lineHeight: size + 'px', display: 'inline-block', textAlign: 'center' }}
      >
        {icon || '🏅'}
      </span>
    );
  }

  return (
    <img
      src={'/images/badges/' + slug + '.webp'}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ ...common, objectFit: 'contain', display: 'block' }}
    />
  );
}
