/**
 * The dice the cabinet rolls.
 *
 * Every game used to call Math.random() directly, which is fine for playing
 * and useless for anything else: two people handed the same game get two
 * different games, and a go can never be played back to see whether it really
 * happened. That is exactly the problem a leaderboard has to solve. A chart
 * nobody can check is a chart nobody should trust.
 *
 * So the machine is handed a seed at the start of a go — by the database, not
 * by the browser, because a player who picks their own seed picks their own
 * easy layout — and every random number in every game comes from here.
 *
 * The algorithm is mulberry32. It is small, it is fast enough to call a few
 * thousand times a second, and it produces the same sequence from the same
 * seed on every machine. That last part is the only property that matters
 * here. It is NOT cryptographically secure and must never be used for
 * anything where that matters.
 */
export default function makeRng(seed) {
  // A seed of 0 is a legitimate number and a terrible one for this generator,
  // so it is nudged. Non-numbers become a fixed seed rather than NaN, which
  // would poison every number that followed it and silently break the game.
  let a = Number.isFinite(seed) ? (seed >>> 0) || 0x9e3779b9 : 0x9e3779b9;

  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A seed to fall back on when there isn't one — playing offline, or a game
 * opened outside the cabinet in a test. Random on purpose: the alternative is
 * every unseeded go being identical, which would look like a bug.
 */
export function looseSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}
