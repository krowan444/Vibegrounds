-- ============================================================
-- VIBEGROUNDS — 14: REPLIES, THUMBNAIL APPROVAL, REPUTATION FIX
-- ============================================================

-- ------------------------------------------------------------
-- 1. THREADED REPLIES
-- ------------------------------------------------------------
-- One level of nesting only. Reddit-style infinite nesting turns a
-- 30-comment page into an unreadable staircase on a phone, and every
-- reply-to-a-reply is really still a reply to the top comment. Deeper
-- replies are re-parented to the thread root rather than rejected, so
-- the UI never has to say no.
alter table public.reviews
  add column if not exists parent_id uuid references public.reviews(id) on delete cascade;

create index if not exists idx_reviews_parent on public.reviews (parent_id, created_at);

create or replace function public.flatten_review_depth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.reviews%rowtype;
begin
  if new.parent_id is null then return new; end if;

  select * into v_parent from public.reviews where id = new.parent_id;
  if not found then
    raise exception 'That comment no longer exists.';
  end if;

  -- Replying to a reply attaches to the same root instead of nesting.
  if v_parent.parent_id is not null then
    new.parent_id := v_parent.parent_id;
  end if;

  -- A reply must live on the same submission as its parent, or the
  -- thread could be used to smuggle comments onto another page.
  if v_parent.creation_id <> new.creation_id then
    raise exception 'That reply does not belong to this submission.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_review_depth on public.reviews;
create trigger trg_review_depth
  before insert on public.reviews
  for each row execute function public.flatten_review_depth();

-- The 30-second cooldown was written for top-level comments. Applied to
-- replies it makes conversation impossible — you cannot answer two people
-- in a thread. Replies get a shorter floor, and the hourly cap still
-- catches anyone abusing it.
create or replace function public.check_review_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gap interval := case when new.parent_id is null
                         then interval '30 seconds'
                         else interval '10 seconds' end;
begin
  if exists (select 1 from public.reviews
              where author_id = new.author_id and created_at > now() - v_gap) then
    raise exception 'Slow down — give it a few seconds.';
  end if;
  if (select count(*) from public.reviews
       where author_id = new.author_id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Hourly comment limit reached.';
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2. CUSTOM SCREENSHOTS, PENDING APPROVAL
-- ------------------------------------------------------------
alter table public.creations
  add column if not exists pending_thumbnail_url    text,
  add column if not exists pending_thumbnail_at     timestamptz,
  add column if not exists pending_thumbnail_status text not null default 'none'
    check (pending_thumbnail_status in ('none','pending','approved','rejected')),
  add column if not exists pending_thumbnail_note   text;

create index if not exists idx_creations_pending_thumb
  on public.creations (pending_thumbnail_at)
  where pending_thumbnail_status = 'pending';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'thumbnails', 'thumbnails', true, 3145728,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update
  set public             = true,
      file_size_limit    = 3145728,
      allowed_mime_types = array['image/png','image/jpeg','image/webp'];

drop policy if exists "Thumbnails are publicly readable"   on storage.objects;
drop policy if exists "Members upload their own thumbs"    on storage.objects;
drop policy if exists "Members replace their own thumbs"   on storage.objects;
drop policy if exists "Members delete their own thumbs"    on storage.objects;

create policy "Thumbnails are publicly readable"
  on storage.objects for select using (bucket_id = 'thumbnails');

create policy "Members upload their own thumbs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Members replace their own thumbs"
  on storage.objects for update to authenticated
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Members delete their own thumbs"
  on storage.objects for delete to authenticated
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = auth.uid()::text);

-- The guard trigger must cover the new columns too, otherwise a creator
-- could set pending_thumbnail_status to 'approved' with a direct table
-- update and skip review entirely. Only the RPCs below may touch them.
create or replace function public.guard_creation_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.caller_is_privileged() or public.is_staff() then
    return new;
  end if;

  new.score          := old.score;
  new.vote_count     := old.vote_count;
  new.vote_sum       := old.vote_sum;
  new.view_count     := old.view_count;
  new.review_count   := old.review_count;
  new.status         := old.status;
  new.removed_reason := old.removed_reason;
  new.removed_by     := old.removed_by;
  new.is_featured    := old.is_featured;
  new.creator_id     := old.creator_id;
  new.coins_spent    := old.coins_spent;
  new.created_at     := old.created_at;

  new.pending_thumbnail_url    := old.pending_thumbnail_url;
  new.pending_thumbnail_at     := old.pending_thumbnail_at;
  new.pending_thumbnail_status := old.pending_thumbnail_status;
  new.pending_thumbnail_note   := old.pending_thumbnail_note;

  new.updated_at := now();
  return new;
end;
$$;

-- Owner submits a screenshot for review.
create or replace function public.submit_thumbnail(p_creation uuid, p_url text)
returns public.creations
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.creations%rowtype;
  v_url text := trim(p_url);
begin
  if v_uid is null then raise exception 'You must be signed in.'; end if;

  select * into v_row from public.creations where id = p_creation;
  if not found then raise exception 'Submission not found.'; end if;
  if v_row.creator_id <> v_uid then raise exception 'NOT_YOURS'; end if;

  -- Same reasoning as memes: only images we are hosting, so this cannot
  -- be pointed at an arbitrary URL.
  if v_url !~* '^https?://[a-z0-9.-]+/storage/v1/object/public/thumbnails/' then
    raise exception 'INVALID_IMAGE';
  end if;

  if v_row.pending_thumbnail_status = 'pending' then
    raise exception 'ALREADY_PENDING';
  end if;

  perform set_config('vg.privileged', 'on', true);
  update public.creations
     set pending_thumbnail_url    = v_url,
         pending_thumbnail_at     = now(),
         pending_thumbnail_status = 'pending',
         pending_thumbnail_note   = null
   where id = p_creation
   returning * into v_row;
  perform set_config('vg.privileged', 'off', true);

  return v_row;
end;
$$;

grant execute on function public.submit_thumbnail(uuid, text) to authenticated;

-- Staff approve or reject. Approving promotes it to the live thumbnail.
create or replace function public.review_thumbnail(
  p_creation uuid,
  p_approve  boolean,
  p_note     text default null
)
returns public.creations
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row public.creations%rowtype;
begin
  if not public.is_staff() then raise exception 'STAFF_ONLY'; end if;

  select * into v_row from public.creations where id = p_creation;
  if not found then raise exception 'Submission not found.'; end if;

  perform set_config('vg.privileged', 'on', true);
  if p_approve then
    update public.creations
       set thumbnail_url            = pending_thumbnail_url,
           pending_thumbnail_status = 'approved',
           pending_thumbnail_note   = p_note
     where id = p_creation
     returning * into v_row;
  else
    update public.creations
       set pending_thumbnail_status = 'rejected',
           pending_thumbnail_note   = p_note
     where id = p_creation
     returning * into v_row;
  end if;
  perform set_config('vg.privileged', 'off', true);

  return v_row;
end;
$$;

grant execute on function public.review_thumbnail(uuid, boolean, text) to authenticated;

-- The approval queue. Staff-only by RLS on the underlying table.
create or replace view public.pending_thumbnails
with (security_invoker = on) as
select
  c.id, c.title, c.category, c.project_url,
  c.thumbnail_url          as current_thumbnail,
  c.pending_thumbnail_url  as proposed_thumbnail,
  c.pending_thumbnail_at   as submitted_at,
  c.creator_id,
  p.username               as creator_username
from public.creations c
join public.profiles p on p.id = c.creator_id
where c.pending_thumbnail_status = 'pending'
order by c.pending_thumbnail_at asc;

grant select on public.pending_thumbnails to authenticated;

-- ------------------------------------------------------------
-- 3. REPUTATION: refresh the CREATOR, not just the voter
-- ------------------------------------------------------------
-- This is why Top Creators looked frozen. cast_vote re-evaluated the
-- creator's badges but never recomputed their XP or votes_received, and
-- refresh_reputation was otherwise only ever called for auth.uid(). So
-- your score only moved when *you* logged in — never when somebody
-- voted on your work, which is precisely when it should move.
create or replace function public.cast_vote(p_creation uuid, p_value int)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid     uuid := auth.uid();
  v_creator uuid;
  v_score   numeric;
  v_count   int;
begin
  if v_uid is null then raise exception 'Sign in to vote.'; end if;
  if p_value < 0 or p_value > 5 then raise exception 'Vote must be between 0 and 5.'; end if;

  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'EMAIL_NOT_VERIFIED';
  end if;
  if not public.is_active_member(v_uid) then raise exception 'ACCOUNT_BANNED'; end if;

  select creator_id into v_creator from public.creations where id = p_creation and status = 'published';
  if not found then raise exception 'Submission not found.'; end if;
  if v_creator = v_uid then raise exception 'SELF_VOTE'; end if;

  insert into public.votes (creation_id, user_id, value)
  values (p_creation, v_uid, p_value)
  on conflict (creation_id, user_id)
  do update set value = excluded.value, updated_at = now();

  perform set_config('vg.privileged', 'on', true);
  update public.profiles
     set total_votes_cast = (select count(*) from public.votes where user_id = v_uid)
   where id = v_uid;
  perform set_config('vg.privileged', 'off', true);

  -- Read the score *after* the vote trigger has recalculated it.
  select score, vote_count into v_score, v_count from public.creations where id = p_creation;

  perform public.evaluate_badges(v_uid);
  perform public.evaluate_badges(v_creator);

  -- The actual fix: the creator's standing must move when someone votes
  -- on their work, not only when they next log in themselves.
  perform public.refresh_reputation(v_uid);
  perform public.refresh_reputation(v_creator);

  return json_build_object('score', v_score, 'vote_count', v_count, 'your_vote', p_value);
end;
$$;

grant execute on function public.cast_vote(uuid,int) to authenticated;

-- Writing a review should move both people's standing too.
create or replace function public.touch_reputation_on_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid;
begin
  perform public.refresh_reputation(coalesce(new.author_id, old.author_id));
  select creator_id into v_creator from public.creations
   where id = coalesce(new.creation_id, old.creation_id);
  if v_creator is not null then
    perform public.refresh_reputation(v_creator);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_review_reputation on public.reviews;
create trigger trg_review_reputation
  after insert or delete on public.reviews
  for each row execute function public.touch_reputation_on_review();

-- ------------------------------------------------------------
-- 4. LEADERBOARD: rank by work, not by turning up
-- ------------------------------------------------------------
-- XP deliberately rewards showing up — daily streaks and account age are
-- most of it. That is fine for a personal level badge, but it made the
-- Top Creators board a list of who logs in most, with the top slot held
-- by an account with one submission and no votes.
--
-- `merit` is the sum of score x vote_count across published work, so it
-- rewards being liked and being liked *often*, and is zero until somebody
-- actually votes for you. XP stays as the final tiebreaker.
drop view if exists public.creator_leaderboard;

create or replace view public.creator_leaderboard
with (security_invoker = on) as
select
  p.id, p.username, p.avatar_url, p.level, p.rank_title, p.xp,
  p.submission_count, p.votes_received, p.daily_streak, p.created_at,
  coalesce((select round(avg(c.score), 2) from public.creations c
             where c.creator_id = p.id and c.status = 'published' and c.vote_count >= 3), 0) as avg_score,
  coalesce((select sum(c.view_count) from public.creations c
             where c.creator_id = p.id and c.status = 'published'), 0) as total_views,
  (select count(*) from public.user_badges ub where ub.user_id = p.id) as badge_count,
  coalesce((select round(sum(c.score * c.vote_count), 2) from public.creations c
             where c.creator_id = p.id and c.status = 'published'), 0) as merit,
  row_number() over (
    order by coalesce((select sum(c.score * c.vote_count) from public.creations c
                        where c.creator_id = p.id and c.status = 'published'), 0) desc,
             p.votes_received desc,
             p.xp desc
  ) as rank
from public.profiles p
where p.is_banned = false;

grant select on public.creator_leaderboard to anon, authenticated;

-- ------------------------------------------------------------
-- 5. BACKFILL — everyone whose numbers went stale
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in select id from public.profiles loop
    perform public.refresh_reputation(r.id);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 6. Expose parent_id so the UI can thread replies
-- ------------------------------------------------------------
drop view if exists public.reviews_public;

create or replace view public.reviews_public
with (security_invoker = on) as
select r.id, r.creation_id, r.parent_id, r.body, r.created_at, r.updated_at, r.author_id,
       p.username as author_username, p.avatar_url as author_avatar, p.role as author_role
from public.reviews r
join public.profiles p on p.id = r.author_id
where r.status = 'visible';

grant select on public.reviews_public to anon, authenticated;
