-- ============================================================
-- VIBEGROUNDS — 10: LAUNCH SEED SUPPORT
--
-- Everything created for the launch is tagged. That matters for two
-- reasons: you can remove the lot with one command when real users
-- arrive, and you can always tell seeded activity apart from genuine
-- activity — which keeps your own charts meaningful to you.
-- ============================================================

alter table public.profiles
  add column if not exists is_seed boolean not null default false;

alter table public.creations
  add column if not exists is_seed boolean not null default false,
  add column if not exists source_url text,      -- where the project really lives
  add column if not exists source_author text;   -- who actually made it

create index if not exists idx_profiles_seed  on public.profiles (is_seed) where is_seed;
create index if not exists idx_creations_seed on public.creations (is_seed) where is_seed;

-- Keep the new columns out of reach of the client.
create or replace function public.guard_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.caller_is_privileged() then return new; end if;

  new.coins            := old.coins;
  new.lifetime_coins   := old.lifetime_coins;
  new.bonus_claimed    := old.bonus_claimed;
  new.role             := old.role;
  new.is_banned        := old.is_banned;
  new.ban_reason       := old.ban_reason;
  new.banned_until     := old.banned_until;
  new.banned_at        := old.banned_at;
  new.banned_by        := old.banned_by;
  new.strike_count     := old.strike_count;
  new.is_muted         := old.is_muted;
  new.submission_count := old.submission_count;
  new.total_votes_cast := old.total_votes_cast;
  new.total_score_sum  := old.total_score_sum;
  new.created_at       := old.created_at;
  new.xp               := old.xp;
  new.level            := old.level;
  new.rank_title       := old.rank_title;
  new.last_daily_claim := old.last_daily_claim;
  new.daily_streak     := old.daily_streak;
  new.longest_streak   := old.longest_streak;
  new.votes_received   := old.votes_received;
  new.is_seed          := old.is_seed;
  new.updated_at       := now();

  if new.username is distinct from old.username
     and exists (select 1 from public.reserved_usernames r where r.username = new.username) then
    raise exception 'That username is reserved.';
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Surface attribution in the public view so credit is always visible
-- ------------------------------------------------------------
create or replace view public.creations_public
with (security_invoker = on) as
select
  c.id, c.creator_id, c.title, c.description, c.category, c.project_url,
  c.thumbnail_url, c.tags, c.status, c.is_featured, c.is_nsfw,
  c.score, c.vote_count, c.view_count, c.review_count,
  c.created_at, c.updated_at,
  p.username    as creator_username,
  p.avatar_url  as creator_avatar,
  cat.name      as category_name,
  cat.icon      as category_icon,
  cat.color     as category_color,
  -- New columns must be appended, not inserted: CREATE OR REPLACE VIEW
  -- can only add columns at the end, never reorder existing ones.
  c.is_seed, c.source_url, c.source_author
from public.creations c
join public.profiles p   on p.id = c.creator_id
left join public.categories cat on cat.slug = c.category
where c.status = 'published';

grant select on public.creations_public to anon, authenticated;

-- ------------------------------------------------------------
-- THE OFF SWITCH
--   select public.purge_seed_data();
-- Removes every seeded account and everything they posted, in one go.
-- Real accounts and real submissions are untouched.
-- ------------------------------------------------------------
create or replace function public.purge_seed_data()
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_users int; v_creations int;
begin
  if not public.is_admin() and current_user not in ('postgres','supabase_admin') then
    raise exception 'Admins only.';
  end if;

  select count(*) into v_creations from public.creations where is_seed;
  select count(*) into v_users     from public.profiles  where is_seed;

  -- deleting the auth user cascades to profile, creations, votes, reviews
  delete from auth.users u
   using public.profiles p
   where p.id = u.id and p.is_seed;

  return json_build_object('users_removed', v_users, 'submissions_removed', v_creations);
end;
$$;

-- ------------------------------------------------------------
-- How many of each are left? Handy before you decide to purge.
-- ------------------------------------------------------------
create or replace function public.seed_status()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'seed_users',       (select count(*) from public.profiles  where is_seed),
    'real_users',       (select count(*) from public.profiles  where not is_seed),
    'seed_submissions', (select count(*) from public.creations where is_seed),
    'real_submissions', (select count(*) from public.creations where not is_seed)
  );
$$;

grant execute on function public.seed_status() to authenticated;
