-- ============================================================
-- VIBEGROUNDS - 22: FORUM UNREAD MARKERS
-- ============================================================
-- "I never know if someone has replied or not."
--
-- The forum lists threads by last_activity_at, which tells you something
-- happened but not whether it happened since you looked, and certainly not
-- whether it happened to you.
--
-- This adds a per-user read mark per thread, and derives two things from it:
--   new_count      - visible replies since you last opened it, excluding your
--                    own, because being told you replied is not news
--   is_participant - you started the thread or posted in it, which is the
--                    difference between "the forum is busy" and "answer me"
--
-- Threads you have never opened do not scream. Their baseline is the later of
-- your signup date and 14 days ago, so joining today does not mark every
-- thread in the archive unread - only what is genuinely current.
-- ============================================================

-- user_id points at auth.users, NOT public.profiles, and that matters.
--
-- With foreign keys to both forum_threads and profiles, PostgREST reads this
-- table as a junction between them - which gives forum_threads a second route
-- to profiles alongside forum_threads.author_id. PostgREST refuses ambiguous
-- embeds, so every select('*, profiles(...)') on forum_threads started
-- failing and the thread lists rendered empty.
--
-- profiles.id already references auth.users(id), so cascade-delete behaviour
-- is identical. Only the phantom relationship goes away.
create table if not exists public.forum_thread_reads (
  user_id      uuid not null references auth.users(id)           on delete cascade,
  thread_id    uuid not null references public.forum_threads(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);

-- Repair for databases that already ran the first version of this file.
alter table public.forum_thread_reads
  drop constraint if exists forum_thread_reads_user_id_fkey;
alter table public.forum_thread_reads
  add constraint forum_thread_reads_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- The nav pip asks "has this user got anything unread anywhere".
create index if not exists idx_forum_thread_reads_user
  on public.forum_thread_reads(user_id);

-- Counting replies after a timestamp is the hot path of the whole feature.
create index if not exists idx_forum_posts_thread_created
  on public.forum_posts(thread_id, created_at);

alter table public.forum_thread_reads enable row level security;

-- Your read marks are yours. There is no reason for anyone, including staff,
-- to see which threads someone else has opened.
drop policy if exists "own thread reads readable" on public.forum_thread_reads;
create policy "own thread reads readable" on public.forum_thread_reads
  for select using (user_id = auth.uid());

drop policy if exists "own thread reads insertable" on public.forum_thread_reads;
create policy "own thread reads insertable" on public.forum_thread_reads
  for insert with check (user_id = auth.uid());

drop policy if exists "own thread reads updatable" on public.forum_thread_reads;
create policy "own thread reads updatable" on public.forum_thread_reads
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- security_invoker so this reads with the caller's own permissions, matching
-- every other view in this schema. Signed-out visitors get zero rows.
create or replace view public.forum_thread_unread
with (security_invoker = on) as
select
  t.id as thread_id,

  -- Never opened, and it has moved since your baseline: the thread itself is
  -- the new thing, even if nobody has replied to it yet.
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
                 and x.status    = 'visible')) as is_participant

from public.forum_threads t

left join public.forum_thread_reads r
       on r.thread_id = t.id
      and r.user_id   = auth.uid()

-- Read it and the mark is exact - no clamping, or a thread you last opened a
-- month ago would silently hide three weeks of replies. Never read it and we
-- fall back to the later of your signup and a fortnight ago.
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

-- Invoker rights on purpose: the RLS policies above already say you may only
-- write your own row, so a definer function here would hand out a way to
-- forge someone else's read marks for no benefit.
create or replace function public.mark_thread_read(p_thread uuid)
returns void
language sql
set search_path = public
as $fn$
  insert into public.forum_thread_reads (user_id, thread_id, last_read_at)
  select auth.uid(), p_thread, now()
   where auth.uid() is not null
  on conflict (user_id, thread_id)
  do update set last_read_at = now();
$fn$;

grant execute on function public.mark_thread_read(uuid) to authenticated;

-- How many threads have something in them for you. The pip only needs to know
-- whether this is above zero, but returning the count leaves room to show it.
create or replace function public.forum_unread_count()
returns int
language sql
stable
set search_path = public
as $fn$
  select coalesce(count(*), 0)::int
    from public.forum_thread_unread
   where new_count > 0 or is_new_thread;
$fn$;

grant execute on function public.forum_unread_count() to authenticated;
