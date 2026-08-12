/**
 * Minimal inline formatting for forum posts.
 *
 * Forum bodies render with white-space: pre-wrap, so line breaks, bullets
 * and numbered lists already look right. The one thing that did not was
 * emphasis: people type **bold** because every other text box on the
 * internet accepts it, and it came out as literal asterisks.
 *
 * This is deliberately not a Markdown parser. It handles bold and italic
 * and nothing else — no links, no images, no HTML. That is the whole
 * security argument: it returns React elements rather than a string fed
 * to dangerouslySetInnerHTML, so a post containing <script> stays inert
 * text no matter what. Adding link parsing later would mean adding URL
 * scheme checks; today there is nothing to check.
 *
 * Unmatched asterisks are left exactly as typed, so "2 * 3" survives —
 * the pattern requires a non-space immediately after the opening marker,
 * which is what stops arithmetic turning into italics.
 */

// Bold before italic, so ** is never mistaken for two single markers.
const EMPHASIS = /\*\*(\S[^*\n]*?)\*\*|\*(\S[^*\n]*?)\*/g;

export function renderPostBody(text) {
  if (!text) return null;

  const nodes = [];
  let cursor = 0;
  let match;

  EMPHASIS.lastIndex = 0;
  while ((match = EMPHASIS.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));

    if (match[1] !== undefined) {
      nodes.push(<strong key={match.index}>{match[1]}</strong>);
    } else {
      nodes.push(<em key={match.index}>{match[2]}</em>);
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
