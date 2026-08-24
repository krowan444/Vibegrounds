-- ============================================================
-- VIBEGROUNDS — 33: WHICH BOARDS HAVE SOMETHING NEW
-- ============================================================
-- The Community page lists seven boards and gives no clue which of them has
-- moved. You have to open each one to find out, and six of those trips are
-- wasted. Threads already carry an unread pip; boards did not.
--
-- This deliberately does NOT define "new" a second time. It sits on top of
-- forum_thread_unread and adds them up per board, so the moment the rule
-- changes there — what counts as read, how far back the baseline goes — the
-- boards follow automatically. Two definitions of "new" that drift apart is
-- how you end up with a board showing a pip that opens onto nothing.
-- ============================================================

-- forum_thread_unread does not carry the board, so it gains one. create or
-- replace can only append, so category_id arrives on the end; everything
-- selects by name.
create or replace view public.forum_thread_unread
with (security_invoker = on) as
select
  t.id as thread_id,

  (r.last_read_at is null and t.created_at > b.baseline) as is_new_thread,

  (select count(*)
     from public.forum_posts fp
    where fp.thread_id  = t.id
      and fp.status     = 'visible'
      and fp.author_id <> auth.uid()
      and fp.created_at > b.baseline)::int as new_count,

  (t.author_id = auth.uid()
   or exists (select 1
                from public.forum_posts x
               where x.thread_id = t.id
                 and x.author_id = auth.uid()
                 and x.status    = 'visible')) as is_participant,

  t.category_id

from public.forum_threads t

left join public.forum_thread_reads r
       on r.thread_id = t.id
      and r.user_id   = auth.uid()

cross join lateral (
  select coalesce(
           r.last_read_at,
           greatest(
             (select pr.created_at from public.profiles pr where pr.id = auth.uid()),
             now() - interval '14 days'
           )
         ) as baseline
) b

where t.status = 'visible'
  and auth.uid() is not null;

grant select on public.forum_thread_unread to authenticated;

-- ------------------------------------------------------------
-- One row per board that has anything for you
-- ------------------------------------------------------------
-- Boards with nothing new are simply absent rather than present with zeroes,
-- so the page can treat "no row" as "nothing here" without checking numbers.
create or replace view public.forum_board_unread
with (security_invoker = on) as
select
  u.category_id,
  count(*) filter (where u.is_new_thread)::int          as new_threads,
  coalesce(sum(u.new_count), 0)::int                    as new_posts,
  -- Gold pip vs grey: is any of this in a conversation you are actually part
  -- of? That is the difference between "news" and "someone answered you".
  bool_or(u.is_participant and u.new_count > 0)         as mine
from public.forum_thread_unread u
group by u.category_id
having count(*) filter (where u.is_new_thread) > 0
    or coalesce(sum(u.new_count), 0) > 0;

grant select on public.forum_board_unread to authenticated;

comment on view public.forum_board_unread is
  'Per-board unread totals, built on forum_thread_unread so there is only one '
  'definition of "new" on the site.';
