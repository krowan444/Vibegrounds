-- ============================================================
-- VIBEGROUNDS — 32: RATING A COMIC
-- ============================================================
-- Comics get scored out of 5, the same as everything else on the site.
-- Deliberately no charts yet: two comics do not make a leaderboard, and a
-- chart with two entries makes a place look emptier than no chart at all.
-- The score is recorded now so that when there are enough to rank, the
-- history is already there rather than starting from zero.
--
-- Why a separate comic_votes table, when comments went the other way and
-- shared one table with submissions?
--
-- Because the rule "one vote per person per thing" is not written in code
-- here — it IS the primary key (creation_id, user_id). A primary key column
-- cannot be null, so teaching votes about comics would mean dropping that
-- key and rebuilding the rule out of two partial indexes, on the table every
-- score, badge and reputation number on the site is computed from. Comments
-- had no such constraint and six behaviours worth sharing; votes have one
-- behaviour, and it is welded to the key. So this one gets its own table and
-- borrows only the formula.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Somewhere to keep the score
-- ------------------------------------------------------------
alter table public.comics
  add column if not exists score      numeric(3,2) not null default 0,
  add column if not exists vote_count int          not null default 0,
  add column if not exists vote_sum   int          not null default 0;

-- ------------------------------------------------------------
-- 2. Close the hole the new columns would otherwise open
-- ------------------------------------------------------------
-- The guard freezes the columns a creator must not set on their own comic.
-- Adding score without adding it here would let anybody give their own comic
-- a 5.00 with a single update — the exact thing this trigger exists to stop.
create or replace function public.guard_comic_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.caller_is_privileged() or public.is_staff() then
    return new;
  end if;

  new.creator_id := old.creator_id;
  new.page_count := old.page_count;
  new.view_count := old.view_count;
  new.cover_url  := old.cover_url;
  new.status     := old.status;
  new.created_at := old.created_at;
  new.score      := old.score;
  new.vote_count := old.vote_count;
  new.vote_sum   := old.vote_sum;
  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 3. The votes
-- ------------------------------------------------------------
create table if not exists public.comic_votes (
  comic_id   uuid not null references public.comics(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  value      int  not null check (value between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (comic_id, user_id)
);

create index if not exists idx_comic_votes_comic
  on public.comic_votes (comic_id, updated_at desc);

alter table public.comic_votes enable row level security;

drop policy if exists "Comic votes are publicly readable" on public.comic_votes;
create policy "Comic votes are publicly readable"
  on public.comic_votes for select using (true);

-- No insert or update policy on purpose. Writes go through cast_comic_vote()
-- only, which is where the "not your own comic" rule lives.

grant select on public.comic_votes to anon, authenticated;

-- ------------------------------------------------------------
-- 4. The score
-- ------------------------------------------------------------
-- The same Bayesian average submissions use, with the same prior, so that
-- 3.4 on a comic means what 3.4 means on a game. A plain average would let
-- one 5/5 from a mate sit above a comic twenty people rated 4.
create or replace function public.recalc_comic_score(p_comic uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n     int;
  v_sum   int;
  v_prior int     := 6;
  v_mean  numeric := 2.50;
begin
  select count(*), coalesce(sum(value), 0) into v_n, v_sum
    from public.comic_votes where comic_id = p_comic;

  -- Lift the column guard for this write, or it reverts the very score it
  -- is there to protect.
  perform set_config('vg.privileged', 'on', true);
  update public.comics
     set vote_count = v_n,
         vote_sum   = v_sum,
         score      = round(((v_prior * v_mean) + v_sum)::numeric / (v_prior + v_n), 2)
   where id = p_comic;
  perform set_config('vg.privileged', 'off', true);
end;
$$;

create or replace function public.on_comic_vote_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_comic_score(coalesce(new.comic_id, old.comic_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_comic_vote_change on public.comic_votes;
create trigger trg_comic_vote_change
  after insert or update or delete on public.comic_votes
  for each row execute function public.on_comic_vote_change();

-- ------------------------------------------------------------
-- 5. Casting one
-- ------------------------------------------------------------
-- The error strings are the same codes the submission voting uses, because
-- the interface already translates those into plain English and a second
-- vocabulary would mean a second translation to keep in step.
create or replace function public.cast_comic_vote(p_comic uuid, p_value int)
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

  select creator_id into v_creator from public.comics
   where id = p_comic and status = 'published';
  if not found then raise exception 'Comic not found.'; end if;
  if v_creator = v_uid then raise exception 'SELF_VOTE'; end if;

  insert into public.comic_votes (comic_id, user_id, value)
  values (p_comic, v_uid, p_value)
  on conflict (comic_id, user_id)
  do update set value = excluded.value, updated_at = now();

  -- Read the score after the trigger has recalculated it.
  select score, vote_count into v_score, v_count from public.comics where id = p_comic;

  return json_build_object('score', v_score, 'vote_count', v_count, 'your_vote', p_value);
end;
$$;

revoke all on function public.cast_comic_vote(uuid,int) from public, anon;
grant execute on function public.cast_comic_vote(uuid,int) to authenticated;

-- ------------------------------------------------------------
-- 6. Show it
-- ------------------------------------------------------------
-- create or replace can only append columns to a view, never reorder them,
-- so score and vote_count arrive on the end. That is fine — everything
-- selects by name.
create or replace view public.comics_public
with (security_invoker = on) as
select
  c.id, c.creator_id, c.title, c.description, c.cover_url,
  c.is_nsfw, c.page_count, c.view_count, c.created_at, c.updated_at,
  p.username   as creator_username,
  p.avatar_url as creator_avatar,
  c.score, c.vote_count
from public.comics c
join public.profiles p on p.id = c.creator_id
where c.status = 'published';

grant select on public.comics_public to anon, authenticated;

comment on table public.comic_votes is
  'One rating per person per comic. Written only by cast_comic_vote().';
