-- ============================================================
-- 43 — THE ARCADE SCORING HALF, PUT BACK IN THE REPOSITORY
-- ============================================================
-- This migration adds nothing new. Every line of it was already
-- running in production and none of it was ever committed, so the
-- repository could not rebuild the database and nobody — including
-- me — could read the code that decides whether a score counts.
--
-- Found while trying to answer "make sure the scoreboard updates
-- properly". I could not, because the thing that updates it was not
-- here. Recovered with pg_get_functiondef against production and
-- reproduced verbatim below; the column and setting definitions
-- were read back out of information_schema and site_settings.
--
-- WHAT WAS MISSING
--
--   arcade_plays        seed, ticks, input_log, finished_at
--   profiles            arcade_initials
--   site_settings       arcade_limits, arcade_default_max,
--                       arcade_default_rate, arcade_blocked_initials
--   functions           arcade_charts, finish_arcade_play,
--                       set_arcade_initials
--
-- Migration 31 built the arcade as far as paying for a go. Scoring
-- came later and went straight to the database. The app has been
-- calling three functions that exist nowhere in this repository,
-- and 36_lock_internal_functions even reasons about the grants on
-- arcade_charts — a function it could not see.
--
-- SAFE TO RE-RUN AGAINST PRODUCTION. Every statement is
-- add-if-missing or create-or-replace, and the settings are
-- on-conflict-do-nothing so the live values are never overwritten
-- by the defaults written here. On production it is a no-op; on a
-- fresh database it is the difference between an arcade that
-- records scores and one that throws on the last tick of every go.
-- ============================================================


-- ------------------------------------------------------------
-- 1. The columns scoring writes to
--
-- seed        the server's dice for the go, so a run can be replayed
-- ticks       how many frames the go lasted — checked against the
--             wall clock in finish_arcade_play, which is the whole
--             anti-cheat argument
-- input_log   what was pressed, capped at 8000 chars on write
-- finished_at when it ended; arcade_charts orders ties by it, so
--             the first person to reach a score keeps the higher
--             place
-- ------------------------------------------------------------
alter table public.arcade_plays
  add column if not exists seed        bigint,
  add column if not exists ticks       integer,
  add column if not exists input_log   text,
  add column if not exists finished_at timestamptz;

comment on column public.arcade_plays.ticks is
  'Frames the go lasted. Compared against wall-clock time to reject impossible scores.';


-- ------------------------------------------------------------
-- 2. Three letters on the board
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists arcade_initials text;


-- ------------------------------------------------------------
-- 3. The knobs the score check reads
--
-- on conflict do nothing, not do update. These are the values
-- production is running now, but they are meant to be tuned from
-- the Control Room, and a migration re-run must never quietly
-- reset somebody's tuning back to what it happened to be the day
-- this file was written.
--
-- max  the highest believable score for that game
-- rate the highest believable points per second
--
-- Both are guesses, and finish_arcade_play says so in the error it
-- raises — it tells the player to argue on the forum rather than
-- implying they cheated.
-- ------------------------------------------------------------
insert into public.site_settings (key, value, description) values
  ('arcade_default_max',  '50000'::jsonb,
   'Highest believable score for a game with no entry in arcade_limits'),
  ('arcade_default_rate', '100'::jsonb,
   'Highest believable points per second for a game with no entry in arcade_limits'),
  ('arcade_limits',
   '{"pong": {"max": 5, "rate": 5}, "rocks": {"max": 200000, "rate": 300}, "snake": {"max": 12000, "rate": 200}, "jumper": {"max": 200000, "rate": 30}, "repeat": {"max": 300, "rate": 5}, "stacker": {"max": 500000, "rate": 400}, "breakout": {"max": 20000, "rate": 200}, "crossing": {"max": 100000, "rate": 400}, "invaders": {"max": 200000, "rate": 300}}'::jsonb,
   'Per-game score and rate ceilings. Both are guesses; raise them when somebody proves one wrong.'),
  ('arcade_blocked_initials',
   '["FUK", "FUC", "FCK", "CNT", "KNT", "NIG", "NGR", "N1G", "FAG", "F4G", "JEW", "KKK", "SPZ", "TWT", "WNK", "SHT", "5HT", "AZN", "RPE", "H8R"]'::jsonb,
   'Three-letter arcade names nobody may take. Checked by set_arcade_initials.')
on conflict (key) do nothing;


-- ============================================================
-- 4. The functions, exactly as production has them
-- ============================================================
-- Reproduced verbatim from pg_get_functiondef. Deliberately not
-- tidied, reformatted or "improved" on the way in: the point of
-- this file is that the repository and the database agree. Any
-- change to how scoring behaves belongs in its own migration,
-- where it can be read as a change rather than hidden inside a
-- recovery.
-- ============================================================

CREATE OR REPLACE FUNCTION public.arcade_charts(p_top integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_top  int  := least(greatest(coalesce(p_top, 5), 1), 25);
  v_out  json;
begin
  with best as (
    select distinct on (ap.game, ap.user_id)
           ap.game,
           ap.user_id,
           ap.score,
           ap.finished_at as first_at
      from public.arcade_plays ap
      join public.profiles pr on pr.id = ap.user_id
     where ap.score is not null
       and not pr.is_banned
     order by ap.game, ap.user_id, ap.score desc, ap.finished_at asc
  ),
  ranked as (
    select b.*,
           row_number() over (
             partition by b.game order by b.score desc, b.first_at asc nulls last
           ) as rn
      from best b
  ),
  tops as (
    select r.game,
           json_agg(
             json_build_object(
               'rank',     r.rn,
               'user_id',  r.user_id,
               'username', pr.username,
               'initials', coalesce(
                             pr.arcade_initials,
                             upper(rpad(left(regexp_replace(pr.username::text, '[^A-Za-z0-9]', '', 'g'), 3), 3, '-'))),
               'named',    pr.arcade_initials is not null,
               'avatar',   pr.avatar_url,
               'score',    r.score,
               'at',       r.first_at,
               'you',      coalesce(r.user_id = v_user, false)
             ) order by r.rn
           ) as rows
      from ranked r
      join public.profiles pr on pr.id = r.user_id
     where r.rn <= v_top
     group by r.game
  ),
  mine as (
    select r.game,
           json_build_object('score', r.score, 'rank', r.rn) as row
      from ranked r
     where v_user is not null and r.user_id = v_user
  )
  select json_build_object(
    'top',    coalesce((select json_object_agg(game, rows) from tops), '{}'::json),
    'you',    coalesce((select json_object_agg(game, row)  from mine), '{}'::json),
    'initials', (select arcade_initials from public.profiles where id = v_user),
    'plays',  (select count(*) from public.arcade_plays),
    'scored', (select count(*) from public.arcade_plays where score is not null),
    'players',(select count(distinct user_id) from public.arcade_plays where score is not null)
  ) into v_out;
  return v_out;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finish_arcade_play(p_play uuid, p_score integer, p_ticks integer, p_log text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user     uuid := auth.uid();
  v_play     public.arcade_plays%rowtype;
  v_limits   jsonb;
  v_max      int;
  v_rate     numeric;
  v_seconds  numeric;
  v_wall     numeric;
  v_best     int;
  v_rank     int;
begin
  if v_user is null then
    raise exception 'Sign in to play.';
  end if;
  if p_score is null or p_ticks is null then
    raise exception 'That go did not come with a score.';
  end if;
  select * into v_play
    from public.arcade_plays
   where id = p_play
   for update;
  if not found then
    raise exception 'That go was not found.';
  end if;
  if v_play.user_id <> v_user then
    raise exception 'That go was not found.';
  end if;
  if v_play.score is not null then
    raise exception 'That go has already been counted.';
  end if;
  if v_play.created_at < now() - interval '6 hours' then
    raise exception 'That go is too old to save. Have another.';
  end if;
  if p_score < 0 or p_ticks < 0 then
    raise exception 'That score does not make sense.';
  end if;
  v_limits := coalesce(
    (select value from public.site_settings where key = 'arcade_limits'), '{}'::jsonb);
  v_max  := coalesce((v_limits -> v_play.game ->> 'max')::int,
                     public.setting_int('arcade_default_max', 50000));
  v_rate := coalesce((v_limits -> v_play.game ->> 'rate')::numeric,
                     public.setting_int('arcade_default_rate', 100));
  v_seconds := p_ticks / 60.0;
  v_wall    := extract(epoch from (now() - v_play.created_at));
  if v_seconds > v_wall + 10 then
    raise exception 'That go says it lasted longer than it did.';
  end if;
  if p_score > v_max then
    raise exception
      'That score is above the limit set for %, so it has not been saved. If you really scored that, say so on the forum and the limit will be raised — the limit is a guess and guesses can be wrong.',
      v_play.game;
  end if;
  if p_score > (v_rate * (v_seconds + 5)) then
    raise exception
      'That score came in faster than % can be played, so it has not been saved. If that is wrong, say so on the forum.',
      v_play.game;
  end if;
  update public.arcade_plays
     set score       = p_score,
         ticks       = p_ticks,
         input_log   = left(coalesce(p_log, ''), 8000),
         finished_at = now()
   where id = p_play;
  select max(score) into v_best
    from public.arcade_plays
   where user_id = v_user and game = v_play.game and score is not null;
  select count(*) + 1 into v_rank
    from (
      select ap.user_id, max(ap.score) as best
        from public.arcade_plays ap
        join public.profiles pr on pr.id = ap.user_id
       where ap.game = v_play.game
         and ap.score is not null
         and not pr.is_banned
       group by ap.user_id
    ) t
   where t.best > v_best;
  return json_build_object(
    'saved',       true,
    'score',       p_score,
    'your_best',   v_best,
    'personal_best', p_score >= v_best,
    'rank',        v_rank,
    'game',        v_play.game);
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_arcade_initials(p_initials text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user    uuid := auth.uid();
  v_clean   text;
  v_blocked jsonb;
begin
  if v_user is null then
    raise exception 'Sign in first.';
  end if;
  if exists (select 1 from public.profiles p where p.id = v_user and p.is_banned) then
    raise exception 'Your account cannot do that.';
  end if;
  v_clean := upper(trim(coalesce(p_initials, '')));
  if v_clean !~ '^[A-Z0-9]{3}$' then
    raise exception 'Arcade names are exactly three letters or numbers.';
  end if;
  v_blocked := coalesce(
    (select value from public.site_settings where key = 'arcade_blocked_initials'),
    '[]'::jsonb);
  if v_blocked ? v_clean then
    raise exception 'Pick something else for the board.';
  end if;
  update public.profiles
     set arcade_initials = v_clean
   where id = v_user;
  return json_build_object('initials', v_clean);
end;
$function$;

-- ------------------------------------------------------------
-- 5. Who may call them
--
-- arcade_charts stays open to anon on purpose — 36 already made
-- that argument: the leaderboard should be readable signed out.
-- The two that write are for signed-in members only, and both
-- check auth.uid() themselves as well; the grant is the outer
-- door, not the lock.
-- ------------------------------------------------------------
revoke all on function public.finish_arcade_play(uuid,integer,integer,text) from public, anon;
revoke all on function public.set_arcade_initials(text)                     from public, anon;

grant execute on function public.finish_arcade_play(uuid,integer,integer,text) to authenticated;
grant execute on function public.set_arcade_initials(text)                     to authenticated;
grant execute on function public.arcade_charts(integer)                        to anon, authenticated;

notify pgrst, 'reload schema';


-- ============================================================
-- CHECK IT WORKED
-- ============================================================
-- select column_name from information_schema.columns
--  where table_name='arcade_plays' order by ordinal_position;
--   -- must include seed, ticks, input_log, finished_at
--
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public' and proname like '%arcade%' order by 1;
--   -- arcade_charts, arcade_status, finish_arcade_play,
--   -- set_arcade_initials, start_arcade_play
--
-- select public.arcade_charts(5);   -- returns json, signed out too
-- ============================================================
