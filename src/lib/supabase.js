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
export async function retryOnAbort(run, attempts = 2, timeoutMs = 22000) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await withTimeout(run(), timeoutMs);
      const msg = res?.error?.message || '';
      if (!/abort|lock broken/i.test(msg)) return res;
      last = res;
    } catch (e) {
      const transient = e?.timedOut || /abort|lock broken/i.test(e?.message || '');
      if (!transient) throw e;
      last = { data: null, error: e };
    }
    await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  return last;
}
