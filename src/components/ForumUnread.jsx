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
 * Which boards have something in them for you.
 *
 * One small query for the whole Community page rather than one per board.
 * Boards with nothing new are absent from the result, so "no entry" means
 * "nothing here" without having to read any numbers.
 */
export function useBoardUnread() {
  const { user } = useAuth();
  const [map, setMap] = useState(new Map());

  useEffect(() => {
    let alive = true;
    if (!user) { setMap(new Map()); return undefined; }

    (async () => {
      const { data, error } = await supabase
        .from('forum_board_unread')
        .select('category_id, new_threads, new_posts, mine');

      if (!alive) return;
      if (error) {
        // Same rule as the thread pips: a missing view costs a badge, never
        // the page. This happens for a minute or two whenever the code
        // deploys ahead of the migration.
        if (!ABSENT.test(error.message || '')) console.warn('board unread lookup failed', error.message);
        setMap(new Map());
        return;
      }
      setMap(new Map((data || []).map((r) => [r.category_id, r])));
    })().catch(() => {});

    return () => { alive = false; };
  }, [user]);

  return map;
}

/**
 * The marker on a board row.
 *
 * Says what is actually new rather than just "NEW": three replies and one
 * new thread are different errands, and the number is what decides whether
 * you click now or later.
 */
export function BoardPip({ info }) {
  if (!info) return null;

  const posts = info.new_posts || 0;
  const threads = info.new_threads || 0;
  if (!posts && !threads) return null;

  const bits = [];
  if (posts) bits.push(posts + ' new ' + (posts === 1 ? 'reply' : 'replies'));
  if (threads) bits.push(threads + ' new ' + (threads === 1 ? 'thread' : 'threads'));

  return (
    <span
      className={'vg-unread ' + (info.mine ? 'is-mine' : '')}
      title={info.mine ? 'Includes a thread you have posted in' : bits.join(' and ')}
    >
      <span className="vg-unread-pip" aria-hidden="true" />
      {bits.join(' · ')}
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
