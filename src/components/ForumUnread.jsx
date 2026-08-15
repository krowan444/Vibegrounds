import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * "I never know if someone has replied or not."
 *
 * The forum sorts by last activity, which says a thread moved but not whether
 * it moved since you looked, and not whether it moved because of you. These
 * two things close that gap:
 *
 *   useThreadUnread(ids) - what is new in these threads, for you
 *   <ThreadPip info />   - the marker itself
 *
 * Everything here fails quiet. Unread state is a convenience laid over a
 * forum that worked fine without it, so a missing view or a dropped request
 * should cost you a pip, never a page.
 */

// Thrown by Postgres/PostgREST when the view or function is not there yet -
// i.e. the code deployed before the migration ran. Renders nothing until the
// database catches up, rather than an error on every forum page.
const ABSENT = /42P01|PGRST202|does not exist|schema cache/i;

/**
 * Unread info for a set of threads, keyed by thread id.
 * Returns an empty Map for signed-out visitors: unread is meaningless
 * without a "you" to be unread for.
 */
export function useThreadUnread(threadIds) {
  const { user } = useAuth();
  const [map, setMap] = useState(new Map());

  // Join the ids into a stable primitive so the effect does not re-run on
  // every render just because the caller rebuilt the array.
  const key = (threadIds || []).join(',');

  useEffect(() => {
    let alive = true;
    if (!user || !key) { setMap(new Map()); return undefined; }

    (async () => {
      const { data, error } = await supabase
        .from('forum_thread_unread')
        .select('thread_id, new_count, is_new_thread, is_participant')
        .in('thread_id', key.split(','));

      if (!alive) return;
      if (error) {
        if (!ABSENT.test(error.message || '')) console.warn('unread lookup failed', error.message);
        setMap(new Map());
        return;
      }
      setMap(new Map((data || []).map((r) => [r.thread_id, r])));
    })().catch(() => {});

    return () => { alive = false; };
  }, [user, key]);

  return map;
}

/**
 * The marker on a thread row.
 *
 * Two strengths on purpose. A reply in a thread you are part of is the thing
 * you actually came to check; a reply in someone else's thread is news but
 * not yours. One pip for both, with the participant case in gold, keeps the
 * difference readable without inventing a second visual language.
 */
export function ThreadPip({ info }) {
  if (!info) return null;

  const count = info.new_count || 0;
  const brandNew = info.is_new_thread && count === 0;
  if (!count && !brandNew) return null;

  const mine = info.is_participant;
  const label = brandNew ? 'New' : count + ' new';

  return (
    <span
      className={'vg-unread ' + (mine ? 'is-mine' : '')}
      title={
        mine
          ? 'New replies in a thread you posted in'
          : brandNew ? 'Posted since you last looked' : count + ' new since you last looked'
      }
    >
      <span className="vg-unread-pip" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * How many threads have something in them for you - for the header.
 * Polls rather than subscribes: a forum this size does not justify a realtime
 * channel held open on every page, and a minute of staleness costs nothing.
 */
export function useForumUnreadCount() {
  const { user } = useAuth();
  const [n, setN] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!user) { setN(0); return undefined; }

    const check = async () => {
      const { data, error } = await supabase.rpc('forum_unread_count');
      if (!alive) return;
      if (error) { setN(0); return; }
      setN(data || 0);
    };

    check();
    const t = setInterval(check, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [user]);

  return n;
}
