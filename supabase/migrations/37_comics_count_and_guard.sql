-- ============================================================
-- 37 — COMICS COUNT TOWARDS STANDING, AND THE GUARD FAILS CLOSED
-- ============================================================
-- Three separate things, all small, all overdue.
-- ============================================================


-- ------------------------------------------------------------
-- 1. COMICS EARN NOTHING. THEY SHOULD.
--
-- calculate_xp only ever looked at public.creations. Post nine
-- comics and your standing does not move — not for shipping them,
-- not for the votes they get, not for the quality of those votes.
-- Rating somebody's comic did not count as taking part either.
--
-- Comics are a whole content type on the site earning nothing,
-- which quietly says they are the lesser kind of thing to make.
-- They are not.
--
-- The weights below are deliberately the same as for creations
-- rather than a discounted rate. A comic is a real piece of work.
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
  v_c_subs    int;
  v_c_recv    int;
  v_c_quality numeric;
  v_c_cast    int;
begin
  select count(*), coalesce(sum(vote_count), 0), coalesce(sum(score * vote_count), 0)
    into v_subs, v_recv, v_quality
    from public.creations
   where creator_id = p_user and status = 'published';

  -- The same three numbers again, for comics.
  select count(*), coalesce(sum(vote_count), 0), coalesce(sum(score * vote_count), 0)
    into v_c_subs, v_c_recv, v_c_quality
    from public.comics
   where creator_id = p_user and status = 'published';

  select count(*) into v_cast    from public.votes   where user_id = p_user;
  select count(*) into v_c_cast  from public.comic_votes where user_id = p_user;
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
      25 * (v_subs + v_c_subs)                        -- shipping things
    +  2 * (v_recv + v_c_recv)                        -- being seen
    +  5 * round(v_quality + v_c_quality)::int        -- being liked (score-weighted)
    +  1 * (v_cast + v_c_cast)                        -- taking part in judging
    +  3 * v_reviews                                  -- writing actual feedback
    +      v_badge_xp                                 -- achievements
    +  2 * v_age_days                                 -- simply sticking around
  )::int;
end;
$$;


-- ------------------------------------------------------------
-- 2. THE VOTES-RECEIVED COUNTER MISSED COMICS TOO
--
-- Shown on a profile. It said "votes received" and meant "votes
-- received on creations", which is not what a reader takes it to
-- mean when the same profile lists their comics underneath.
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
         -- Comics count here too now. The profile says "votes received",
         -- and a reader takes that to mean everything they made — which
         -- is fair, since their comics are listed on the same page.
         votes_received =
           (select coalesce(sum(vote_count),0) from public.creations
             where creator_id = p_user and status = 'published')
         + (select coalesce(sum(vote_count),0) from public.comics
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

revoke all on function public.refresh_reputation(uuid) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 3. NOTHING RECOMPUTED STANDING WHEN A COMIC WAS RATED
--
-- Fixing calculate_xp on its own would have changed nothing you
-- could see: a comic vote fired recalc_comic_score and stopped
-- there. The artist's standing would only move the next time some
-- unrelated thing happened to refresh it.
--
-- Creation votes have had this since migration 14. Comics never
-- got the same wiring. Both people move — the rater for taking
-- part, the artist for being rated.
-- ------------------------------------------------------------
create or replace function public.touch_reputation_on_comic_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid;
  v_voter   uuid := coalesce(new.user_id, old.user_id);
begin
  select creator_id into v_creator from public.comics
   where id = coalesce(new.comic_id, old.comic_id);

  if v_voter is not null then
    perform public.refresh_reputation(v_voter);
  end if;

  -- Rating your own comic would otherwise refresh the same person
  -- twice, and the second pass can hand out a level-up reward for a
  -- level-up that the first pass already paid.
  if v_creator is not null and v_creator is distinct from v_voter then
    perform public.refresh_reputation(v_creator);
  end if;

  return null;
end;
$$;

drop trigger if exists trg_comic_vote_reputation on public.comic_votes;
create trigger trg_comic_vote_reputation
  after insert or update or delete on public.comic_votes
  for each row execute function public.touch_reputation_on_comic_vote();


-- ------------------------------------------------------------
-- 4. THE GUARD NOW FAILS CLOSED
--
-- caller_is_privileged() decides whether the profiles trigger lets
-- a write to coins, role or is_banned through. It answered TRUE
-- when the JWT role was the empty string — and its exception
-- handler set the role to the empty string before testing it. So
-- "I could not work out who this is" resolved to "trusted".
--
-- Nothing could reach it: anon holds no write grant on any table,
-- and the profiles update policy needs auth.uid() = id, which is
-- null for a caller with no token. It has never been exploitable.
--
-- It is still the wrong way round. A guard that cannot identify
-- its caller should refuse, not wave them through, and the reason
-- it was safe was two other controls rather than this one.
--
-- Direct SQL — psql, the dashboard editor, a migration — sets no
-- request.jwt.claims at all, and that has to stay privileged or
-- every migration that touches a protected column breaks. So the
-- test is now explicit: PostgREST always sets the claim, and only
-- PostgREST is a browser. No claim key present at all means nobody
-- came in through the API.
-- ------------------------------------------------------------
create or replace function public.caller_is_privileged()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_claims text;
  v_role   text;
begin
  -- The deliberate override our own SECURITY DEFINER functions set
  -- around a protected write. Transaction-local, so it cannot leak
  -- into the next request on the same connection.
  if coalesce(current_setting('vg.privileged', true), 'off') = 'on' then
    return true;
  end if;

  v_claims := current_setting('request.jwt.claims', true);

  -- No claims setting at all: not a PostgREST request. Direct SQL by
  -- the owner, or a trigger firing inside one. Trusted.
  if v_claims is null or v_claims = '' then
    return true;
  end if;

  -- From here the caller came through the API, so anything we cannot
  -- read is a reason to refuse rather than to allow.
  begin
    v_role := v_claims::jsonb ->> 'role';
  exception when others then
    return false;          -- unparseable claims: refuse
  end;

  if v_role is null then
    return false;          -- claims with no role: refuse
  end if;

  return v_role = 'service_role';
end;
$$;

comment on function public.caller_is_privileged() is
  'True for direct SQL and for service_role. False for anon and authenticated, and false for anything arriving through the API that cannot be read — the answer to "I cannot tell who this is" is now no.';

notify pgrst, 'reload schema';
