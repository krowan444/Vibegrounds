-- ============================================================
-- VIBEGROUNDS — 09: CREATOR LEVELS, XP & STREAKS
--
-- The point of this file is retention economics. A brand new account
-- is worth 50 coins. An established one is worth its level, its rank,
-- its badges, its chart history and a daily allowance that grows with
-- all of the above. Starting over should feel like a loss, not a
-- shortcut — that is what keeps people on one account.
-- ============================================================

alter table public.profiles
  add column if not exists xp               int not null default 0,
  add column if not exists level            int not null default 1,
  add column if not exists rank_title       text not null default 'Lurker',
  add column if not exists last_daily_claim timestamptz,
  add column if not exists daily_streak     int not null default 0,
  add column if not exists longest_streak   int not null default 0,
  add column if not exists votes_received   int not null default 0;

create index if not exists idx_profiles_xp on public.profiles (xp desc);

-- These are all server-computed. Add them to the write guard so a user
-- cannot simply PATCH themselves to level 99.
create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.caller_is_privileged() then
    return new;
  end if;

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

  -- reputation
  new.xp               := old.xp;
  new.level            := old.level;
  new.rank_title       := old.rank_title;
  new.last_daily_claim := old.last_daily_claim;
  new.daily_streak     := old.daily_streak;
  new.longest_streak   := old.longest_streak;
  new.votes_received   := old.votes_received;

  new.updated_at       := now();

  if new.username is distinct from old.username
     and exists (select 1 from public.reserved_usernames r where r.username = new.username) then
    raise exception 'That username is reserved.';
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- RANKS
-- ------------------------------------------------------------
create table if not exists public.ranks (
  min_level int primary key,
  title     text not null,
  colour    text not null default '#999999',
  blurb     text default ''
);

insert into public.ranks (min_level, title, colour, blurb) values
  (1,  'Lurker',        '#8d8d8d', 'Just arrived. Have a look around.'),
  (2,  'Newcomer',      '#9ccc65', 'Posted something. It begins.'),
  (5,  'Regular',       '#4fc3f7', 'You show up. People notice.'),
  (10, 'Maker',         '#26c6da', 'A real body of work now.'),
  (15, 'Builder',       '#ba68c8', 'Consistently shipping.'),
  (22, 'Veteran',       '#ffa726', 'Been here, done this, still doing it.'),
  (30, 'Luminary',      '#e8a317', 'People come here for your stuff.'),
  (40, 'Legend',        '#ffd700', 'Portal royalty.'),
  (55, 'Mythic',        '#ff5c8a', 'Genuinely absurd. Well done.')
on conflict (min_level) do update set
  title = excluded.title, colour = excluded.colour, blurb = excluded.blurb;

alter table public.ranks enable row level security;
drop policy if exists "Ranks are public" on public.ranks;
create policy "Ranks are public" on public.ranks for select using (true);

-- ------------------------------------------------------------
-- XP CURVE
--   level = floor(sqrt(xp / 50)) + 1
--   L2 = 50xp · L5 = 800 · L10 = 4,050 · L20 = 18,050
-- ------------------------------------------------------------
create or replace function public.level_for_xp(p_xp int)
returns int language sql immutable as $$
  select greatest(1, least(99, floor(sqrt(greatest(p_xp, 0) / 50.0))::int + 1));
$$;

create or replace function public.xp_for_level(p_level int)
returns int language sql immutable as $$
  select (greatest(p_level, 1) - 1) * (greatest(p_level, 1) - 1) * 50;
$$;

-- ------------------------------------------------------------
-- XP CALCULATION
-- Weighted so that *quality* and *participation* both count. Posting
-- 100 dead links will not out-earn posting five things people liked.
-- ------------------------------------------------------------
create or replace function public.calculate_xp(p_user uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_subs      int;
  v_recv      int;
  v_quality   numeric;
  v_cast      int;
  v_reviews   int;
  v_badge_xp  int;
  v_age_days  int;
begin
  select count(*), coalesce(sum(vote_count), 0), coalesce(sum(score * vote_count), 0)
    into v_subs, v_recv, v_quality
    from public.creations
   where creator_id = p_user and status = 'published';

  select count(*) into v_cast    from public.votes   where user_id = p_user;
  select count(*) into v_reviews from public.reviews where author_id = p_user and status = 'visible';

  -- Event badges (OG Member, Founding 100) are identity markers, not
  -- achievements, so they award no XP. Without this exclusion every one of
  -- the first 100 members would start several levels deep and immediately
  -- collect all the level-up coin payouts for doing nothing — which is
  -- precisely the alt-account farming this system exists to discourage.
  select coalesce(sum(case b.tier
            when 'common'    then 5
            when 'uncommon'  then 15
            when 'rare'      then 40
            when 'epic'      then 90
            when 'legendary' then 200
            when 'mythic'    then 400
            else 5 end), 0)
    into v_badge_xp
    from public.user_badges ub join public.badges b on b.slug = ub.badge_slug
   where ub.user_id = p_user and b.category <> 'event';

  select least(coalesce(extract(day from now() - created_at), 0), 365)::int
    into v_age_days from public.profiles where id = p_user;

  return (
      25 * v_subs                    -- shipping things
    +  2 * v_recv                    -- being seen
    +  5 * round(v_quality)::int     -- being liked (score-weighted)
    +  1 * v_cast                    -- taking part in judging
    +  3 * v_reviews                 -- writing actual feedback
    +      v_badge_xp                -- achievements
    +  2 * v_age_days                -- simply sticking around
  )::int;
end;
$$;

-- ------------------------------------------------------------
-- REFRESH — recompute XP, apply level-ups, pay the level-up bonus
-- ------------------------------------------------------------
create or replace function public.refresh_reputation(p_user uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_level int;
  v_xp        int;
  v_new_level int;
  v_title     text;
  v_reward    int := 0;
  v_lvl       int;
begin
  select level into v_old_level from public.profiles where id = p_user;
  if not found then return null; end if;

  v_xp        := public.calculate_xp(p_user);
  v_new_level := public.level_for_xp(v_xp);

  select title into v_title from public.ranks
   where min_level <= v_new_level order by min_level desc limit 1;

  perform set_config('vg.privileged', 'on', true);
  update public.profiles
     set xp = v_xp,
         level = v_new_level,
         rank_title = coalesce(v_title, 'Lurker'),
         votes_received = (select coalesce(sum(vote_count),0)
                             from public.creations
                            where creator_id = p_user and status = 'published')
   where id = p_user;
  perform set_config('vg.privileged', 'off', true);

  -- Level-up pays out. This is the anti-alt-account lever: the longer
  -- you stay on one account, the more coins it has earned you.
  if v_new_level > v_old_level then
    for v_lvl in (v_old_level + 1)..v_new_level loop
      v_reward := v_reward + (10 * v_lvl);
    end loop;
    v_reward := least(v_reward, 100);   -- hard ceiling per level-up event
    perform public.apply_coin_delta(
      p_user, v_reward, 'achievement',
      'Reached level ' || v_new_level || ' — ' || coalesce(v_title, '')
    );
  end if;

  return json_build_object(
    'xp', v_xp,
    'level', v_new_level,
    'rank', v_title,
    'levelled_up', v_new_level > v_old_level,
    'reward', v_reward,
    'xp_this_level', v_xp - public.xp_for_level(v_new_level),
    'xp_next_level', public.xp_for_level(v_new_level + 1) - public.xp_for_level(v_new_level)
  );
end;
$$;

grant execute on function public.refresh_reputation(uuid) to authenticated;
grant execute on function public.level_for_xp(int) to anon, authenticated;
grant execute on function public.xp_for_level(int) to anon, authenticated;

-- ------------------------------------------------------------
-- DAILY CHECK-IN
-- A fresh account earns 3 coins a day. A level 20 account on a week's
-- streak earns ~26. Farming new accounts for the signup bonus stops
-- being the efficient play very quickly.
-- ------------------------------------------------------------
create or replace function public.claim_daily_bonus()
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid     uuid := auth.uid();
  v_p       public.profiles%rowtype;
  v_streak  int;
  v_amount  int;
  v_mult    numeric;
  v_balance int;
begin
  if v_uid is null then raise exception 'You must be signed in.'; end if;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'EMAIL_NOT_VERIFIED';
  end if;
  if not public.is_active_member(v_uid) then raise exception 'ACCOUNT_BANNED'; end if;

  select * into v_p from public.profiles where id = v_uid for update;

  if v_p.last_daily_claim is not null and v_p.last_daily_claim > now() - interval '20 hours' then
    return json_build_object(
      'claimed', false,
      'next_claim_at', v_p.last_daily_claim + interval '20 hours',
      'streak', v_p.daily_streak,
      'coins', v_p.coins
    );
  end if;

  -- streak continues if the last claim was within 48h, otherwise resets
  if v_p.last_daily_claim is not null and v_p.last_daily_claim > now() - interval '48 hours' then
    v_streak := v_p.daily_streak + 1;
  else
    v_streak := 1;
  end if;

  v_mult   := least(1 + (v_streak - 1) * 0.1, 2.0);          -- caps at 2x on day 11
  v_amount := greatest(1, round((3 + v_p.level) * v_mult))::int;

  perform set_config('vg.privileged', 'on', true);
  update public.profiles
     set last_daily_claim = now(),
         daily_streak = v_streak,
         longest_streak = greatest(longest_streak, v_streak)
   where id = v_uid;
  perform set_config('vg.privileged', 'off', true);

  v_balance := public.apply_coin_delta(
    v_uid, v_amount, 'achievement',
    'Daily check-in — day ' || v_streak
  );

  perform public.refresh_reputation(v_uid);

  return json_build_object(
    'claimed', true, 'amount', v_amount, 'streak', v_streak,
    'coins', v_balance, 'next_claim_at', now() + interval '20 hours'
  );
end;
$$;

grant execute on function public.claim_daily_bonus() to authenticated;

-- ------------------------------------------------------------
-- Keep reputation fresh whenever badges are evaluated
-- ------------------------------------------------------------
create or replace function public.refresh_my_reputation()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return null; end if;
  perform public.evaluate_badges(auth.uid());
  return public.refresh_reputation(auth.uid());
end;
$$;

grant execute on function public.refresh_my_reputation() to authenticated;

-- ------------------------------------------------------------
-- STREAK BADGES
-- ------------------------------------------------------------
insert into public.badges (slug, name, description, icon, tier, category, criteria, sort_order) values
  ('streak-7',   'Week One',     'Checked in seven days running.',        '📆', 'uncommon', 'community', '{"type":"streak","value":7}',   70),
  ('streak-30',  'Month Strong', 'Checked in thirty days running.',       '🗓️', 'rare',     'community', '{"type":"streak","value":30}',  71),
  ('streak-100', 'Unbroken',     'One hundred consecutive days. Respect.', '💯', 'legendary','community', '{"type":"streak","value":100}', 72),
  ('level-10',   'Double Digits','Reached level 10.',                     '🔟', 'uncommon', 'general',   '{"type":"level","value":10}',   73),
  ('level-25',   'Seasoned',     'Reached level 25.',                     '⚜️', 'rare',     'general',   '{"type":"level","value":25}',   74),
  ('level-50',   'Ascended',     'Reached level 50.',                     '🌠', 'legendary','general',   '{"type":"level","value":50}',   75)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  tier = excluded.tier, category = excluded.category, criteria = excluded.criteria,
  sort_order = excluded.sort_order;

-- Extend badge evaluation to cover levels and streaks.
create or replace function public.evaluate_streak_badges(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_p public.profiles%rowtype;
begin
  select * into v_p from public.profiles where id = p_user;
  if not found then return; end if;

  if v_p.longest_streak >= 7   then perform public.grant_badge(p_user, 'streak-7');   end if;
  if v_p.longest_streak >= 30  then perform public.grant_badge(p_user, 'streak-30');  end if;
  if v_p.longest_streak >= 100 then perform public.grant_badge(p_user, 'streak-100'); end if;
  if v_p.level >= 10 then perform public.grant_badge(p_user, 'level-10'); end if;
  if v_p.level >= 25 then perform public.grant_badge(p_user, 'level-25'); end if;
  if v_p.level >= 50 then perform public.grant_badge(p_user, 'level-50'); end if;
end;
$$;

-- ------------------------------------------------------------
-- LEADERBOARD
-- ------------------------------------------------------------
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
  row_number() over (order by p.xp desc, p.submission_count desc) as rank
from public.profiles p
where p.is_banned = false;

grant select on public.creator_leaderboard to anon, authenticated;

-- Public profile view with everything a profile page needs in one read.
create or replace view public.profiles_public
with (security_invoker = on) as
select
  p.id, p.username, p.display_name, p.bio, p.avatar_url, p.banner_url,
  p.website, p.location, p.accent_color, p.role, p.is_banned,
  p.level, p.rank_title, p.xp, p.submission_count, p.votes_received,
  p.total_votes_cast, p.daily_streak, p.longest_streak, p.created_at,
  public.xp_for_level(p.level)     as xp_level_floor,
  public.xp_for_level(p.level + 1) as xp_level_ceiling,
  r.colour as rank_colour,
  (select count(*) from public.user_badges ub where ub.user_id = p.id) as badge_count,
  coalesce((select round(avg(c.score), 2) from public.creations c
             where c.creator_id = p.id and c.status = 'published' and c.vote_count >= 3), 0) as avg_score,
  coalesce((select sum(c.view_count) from public.creations c
             where c.creator_id = p.id and c.status = 'published'), 0) as total_views
from public.profiles p
left join lateral (
  select colour from public.ranks where min_level <= p.level order by min_level desc limit 1
) r on true;

grant select on public.profiles_public to anon, authenticated;

-- ------------------------------------------------------------
-- Backfill everyone who already exists
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in select id from public.profiles loop
    perform public.refresh_reputation(r.id);
    perform public.evaluate_streak_badges(r.id);
  end loop;
end $$;
