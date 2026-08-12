/**
 * Encourages people to share work that is not theirs — with the credit
 * made non-negotiable.
 *
 * The best AI films, tracks and tools are mostly made by people who have
 * never heard of this site. Waiting for them all to turn up and post is a
 * slow way to fill a board. Letting members point at good work is much
 * faster, and it is how forums have always worked.
 *
 * The risk is obvious: someone posts a stranger's film and quietly takes
 * the credit. So the ask is phrased as a shout-out rather than a
 * submission, and it says plainly what happens if you pretend otherwise.
 * Framing matters more than rules here — people who think of it as
 * "putting someone on" behave completely differently to people who think
 * of it as "posting content".
 */
export default function CreditNote({ what = 'work', shoutOut = null }) {
  return (
    <div className="vg-credit-note">
      <div className="vg-credit-head">📣 Seen great {what} by someone else?</div>
      <p className="vg-credit-body">
        Share it. This is not only for your own stuff — if somebody made
        something brilliant, put them on. Just <strong>credit them properly</strong>:
        name the creator in the title or description and link back to them.
      </p>
      <p className="vg-credit-rule">
        Passing off someone else&#39;s work as your own gets it removed and can
        cost you your account. A shout-out is welcome. A land-grab is not.
      </p>
      {shoutOut}
    </div>
  );
}
