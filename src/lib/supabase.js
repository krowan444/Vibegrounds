import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check your .env file.');
}

/**
 * By default supabase-js serialises auth work behind a Navigator LockManager
 * lock, and that lock is shared across every tab on the origin. Open the site
 * in two tabs and they fight over it: one acquires with `steal`, and every
 * request the other tab has in flight is aborted with
 *   "AbortError: Lock broken by another request with the 'steal' option"
 * — which surfaces as a page full of empty sections.
 *
 * We hand it a pass-through lock instead. The trade-off is that two tabs could
 * in principle refresh the token at the same moment; in practice the refresh is
 * idempotent and the retry helper below covers the rare loser. Losing the odd
 * refresh race is far better than routinely cancelling page loads.
 */
const passThroughLock = async (_name, _acquireTimeout, fn) => fn();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: passThroughLock,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Reject a promise that never settles.
 *
 * This is the important one. An aborted request rejects, so the retry below
 * catches it — but a request stalled behind auth work simply never comes back,
 * and `await` on it waits forever. That is what left the home page stuck on
 * "Loading the Portal..." until a manual refresh, and what left the submit
 * button spinning after a post had already gone through.
 *
 * A request that hangs is indistinguishable from one that failed, so we treat
 * it as one.
 */
export function withTimeout(promise, ms, label = 'request') {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const e = new Error(`TIMED_OUT: ${label} took longer than ${ms}ms`);
        e.timedOut = true;
        reject(e);
      }, ms);
    }),
  ]);
}

/**
 * Retry a Supabase query if it was aborted or stalled, rather than genuinely
 * failing. Aborts and hangs are transient (tab contention, token refresh);
 * real errors are not, and are returned unchanged so callers still see them.
 *
 * Never throws on timeout — it returns the usual `{ data, error }` shape so
 * that callers using `.data || []` degrade to an empty section instead of
 * taking the whole page down.
 */
/*
 * 12s proved too tight in practice. A single query against this project
 * answers in well under a second, but the home page fires nine at once and a
 * cold free-tier instance can take far longer to serve that burst — which
 * showed up as "Could not load everything" with empty charts on first load.
 *
 * 22s is long enough to ride out a cold start and short enough that a genuinely
 * dead request still gives up rather than hanging forever, which was the
 * original bug.
 */
/*
 * Errors that mean "try that again", not "that was wrong".
 *
 * The JWT ones need explaining. PostgREST refuses a token whose issued-at time
 * is ahead of its own clock, and it caches its system timestamp for up to a
 * second — so a token that is only milliseconds old can be read as coming from
 * the future and bounced. Page load is exactly when supabase-js renews an
 * expiring token, which is why this only ever showed up on first load and why
 * hitting refresh always "fixed" it: by then the token was old enough to pass.
 *
 * That is the same manual refresh the retry below now does automatically.
 */
const TRANSIENT = /abort|lock broken|issued at future|jwtissuedatfuture|not yet valid|jwt.*(future|not yet)/i;

/*
 * A quarter of a second is the right backoff for a broken lock, but useless
 * against a clock that is a second out — the retry lands inside the same bad
 * window and fails identically. Clock problems get a longer wait so the second
 * attempt is made on the far side of it.
 */
const CLOCK_SKEW = /future|not yet valid/i;

/**
 * Did we fail to reach the server at all?
 *
 * When a connection drops, the browser throws "TypeError: Failed to fetch".
 * That is accurate and useless: it names a JavaScript type at somebody who
 * only wanted to read a comic on a train.
 */
const CANNOT_REACH = /failed to fetch|fetch failed|network ?error|network request failed|load failed|err_internet|err_network|err_connection|timed out|timeout/i;

export function cannotReach(e) {
  if (!e) return false;
  if (e.timedOut) return true;
  return CANNOT_REACH.test(`${e.message || ''} ${e.name || ''}`);
}

/**
 * Is this genuinely "there is no such thing", or did we just not get an answer?
 *
 * PostgREST says "no rows" with the code PGRST116; maybeSingle() says it by
 * returning no error and no row. Everything else — a dropped connection, a
 * paused project, a 500 — means we do not know, and must never be shown to a
 * person as "this does not exist". Telling somebody a username is free
 * because their train went into a tunnel is a lie with consequences.
 */
export function looksMissing(error) {
  return !error || error.code === 'PGRST116';
}

/**
 * Turn whatever a failure hands us into a sentence.
 *
 * Written because the home page did this:
 *
 *     `Could not load everything: ${err.message || err}`
 *
 * and an error object whose `message` happens to be empty falls through to
 * the object itself, which a template literal renders as the immortal
 * "[object Object]". That is worse than no message: it looks like a bug in
 * the site AND says nothing about what broke, so the one report a member
 * bothers to send you is unactionable.
 *
 * Supabase spreads the useful part across message / details / hint / code
 * depending on where the failure happened, so take the first that says
 * something, and fall back to JSON rather than to stringification.
 */
export function describeError(e) {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (cannotReach(e)) {
    return 'Could not reach VibeGrounds — that is almost always the connection rather than anything you did.';
  }

  const parts = [e.message, e.details, e.hint].filter(
    (s) => typeof s === 'string' && s.trim(),
  );
  if (parts.length) return parts[0] + (e.code ? ` (${e.code})` : '');
  if (e.code) return `Error code ${e.code}`;

  // Last resort — still not "[object Object]".
  try {
    const json = JSON.stringify(e);
    if (json && json !== '{}') return json.slice(0, 200);
  } catch { /* circular reference — fall through */ }

  return e.name || 'Unknown error';
}

/**
 * What to put on screen when part of a page did not load.
 *
 * A connection failure already explains itself in full, so prefixing it with
 * which part of the page it was doubles the sentence: "Could not load the
 * catalogue: Could not reach VibeGrounds...". A real database error is the
 * other way round — it says nothing a visitor can place, so it needs the
 * part naming.
 */
export function loadFailure(error, what) {
  if (cannotReach(error)) return describeError(error);
  return `Could not load ${what}: ${describeError(error)}`;
}

export async function retryOnAbort(run, attempts = 2, timeoutMs = 22000) {
  let last;
  for (let i = 0; i < attempts; i++) {
    let msg = '';
    try {
      const res = await withTimeout(run(), timeoutMs);
      msg = res?.error?.message || '';
      if (!TRANSIENT.test(msg)) return res;
      last = res;
    } catch (e) {
      msg = e?.message || '';
      if (!e?.timedOut && !TRANSIENT.test(msg)) throw e;
      last = { data: null, error: e };
    }
    // No point waiting after the last attempt — there is nothing left to wait
    // for, and at 1.5s that delay is long enough to be felt on the page.
    if (i === attempts - 1) break;
    const backoff = CLOCK_SKEW.test(msg) ? 1500 : 250 * (i + 1);
    await new Promise((r) => setTimeout(r, backoff));
  }
  return last;
}
