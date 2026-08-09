import { useState } from 'react';

/**
 * Share controls for a submission.
 *
 * The growth loop the site needs: someone posts, tells people, those people
 * arrive, some of them post. So this appears at the two moments a creator is
 * most likely to actually share — on their submission's page, and immediately
 * after posting it, while they're still pleased with themselves.
 *
 * Every share text names VibeGrounds and links to the creation rather than the
 * homepage. A stranger landing on an actual piece of work understands what the
 * site is instantly; a stranger landing on a homepage has to be convinced.
 */
export default function ShareBar({ creation, compact = false }) {
  const [copied, setCopied] = useState(false);

  if (!creation?.id) return null;

  const url = `https://www.vibegrounds.com/creation/${creation.id}`;
  const title = creation.title || 'my latest thing';
  const text = `I posted "${title}" on VibeGrounds — the Newgrounds-style portal for AI-built projects. Come and score it out of 5:`;

  const enc = encodeURIComponent;
  const targets = [
    { id: 'x',  label: '𝕏',  title: 'Share on X',
      href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` },
    { id: 'rd', label: 'reddit', title: 'Share on Reddit',
      href: `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title + ' — on VibeGrounds')}` },
    { id: 'wa', label: 'WhatsApp', title: 'Share on WhatsApp',
      href: `https://api.whatsapp.com/send?text=${enc(text + ' ' + url)}` },
    { id: 'fb', label: 'Facebook', title: 'Share on Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard is blocked in some contexts; fall back to the old trick so
      // the button is never simply dead.
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Phones get the real OS share sheet, which converts far better than icons.
  const nativeShare = async () => {
    try {
      await navigator.share({ title, text, url });
    } catch {
      /* user dismissed it — nothing to do */
    }
  };

  return (
    <div className={`vg-share ${compact ? 'vg-share-compact' : ''}`}>
      {!compact && <div className="vg-share-label">📢 SHARE IT</div>}

      <div className="vg-share-row">
        <button type="button" className="vg-share-btn vg-share-copy" onClick={copy}>
          {copied ? '✅ LINK COPIED' : '🔗 COPY LINK'}
        </button>

        {typeof navigator !== 'undefined' && navigator.share && (
          <button type="button" className="vg-share-btn" onClick={nativeShare}>
            SHARE…
          </button>
        )}

        {targets.map((t) => (
          <a
            key={t.id}
            className={`vg-share-btn vg-share-${t.id}`}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            title={t.title}
          >
            {t.label}
          </a>
        ))}
      </div>

      {!compact && (
        <div className="vg-share-note">
          Sharing your own link is the single biggest thing that helps this place grow.
        </div>
      )}
    </div>
  );
}
