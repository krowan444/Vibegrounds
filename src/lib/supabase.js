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
 * Retry a Supabase query once if it was aborted rather than genuinely failing.
 * Aborts are transient (tab contention, navigation); real errors are not, and
 * are returned unchanged so callers still see them.
 */
export async function retryOnAbort(run, attempts = 2) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await run();
      const msg = res?.error?.message || '';
      if (!/abort|lock broken/i.test(msg)) return res;
      last = res;
    } catch (e) {
      if (!/abort|lock broken/i.test(e?.message || '')) throw e;
      last = { data: null, error: e };
    }
    await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  return last;
}
