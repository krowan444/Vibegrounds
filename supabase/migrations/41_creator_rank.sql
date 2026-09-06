-- ============================================================
-- 41 — "NEWCOMER" BECOMES "CREATOR"
-- ============================================================
-- Kieran's request. The ladder had no Creator rung at all:
--
--   1 Lurker · 2 Newcomer · 5 Regular · 10 Maker · 15 Builder
--   22 Veteran · 30 Luminary · 40 Legend · 55 Mythic
--
-- A rename rather than a new rung. Inserting Creator between
-- Newcomer and Regular would have been the other option and it
-- makes the early ladder worse, not better: levels 2, 3 and 4 all
-- sit in one band on purpose, and splitting them means somebody
-- gets promoted for posting a second thing and then waits twice as
-- long for the next step. The complaint was the word, not the
-- spacing.
--
-- It also reads better. "Newcomer" describes how long somebody has
-- been here; "Creator" describes what they did to get there, which
-- is what every other rung on this ladder does — Regular, Maker,
-- Builder, Veteran. Newcomer was the odd one out.
--
-- Applies to everyone at levels 2 to 4, not to one account. A rank
-- that means something different for the owner than for everybody
-- else is not a rank.
-- ============================================================

update public.ranks
   set title = 'Creator',
       -- The blurb was already about the act rather than the
       -- arrival, so it needs no change: "Posted something. It
       -- begins." reads as Creator's first line better than it read
       -- as Newcomer's.
       colour = colour
 where min_level = 2
   and title = 'Newcomer';


-- ------------------------------------------------------------
-- Bring the denormalised copies along
--
-- profiles.rank_title is a stored copy, written by
-- refresh_reputation when somebody's XP changes. Renaming the rank
-- alone would leave every existing member reading "Newcomer" until
-- they next earned XP — and a member who has stopped posting would
-- have carried the old word indefinitely.
--
-- Not done by calling refresh_reputation() for every account: that
-- function also recalculates XP and pays level-up rewards, and a
-- rename has no business moving anybody's coins. This only
-- recomputes the title from the level already recorded.
--
-- rank_title is write-protected by the profiles guard trigger, so
-- this needs the privileged flag the rest of the schema uses.
-- ------------------------------------------------------------
select set_config('vg.privileged', 'on', true);

update public.profiles p
   set rank_title = coalesce(
         (select r.title from public.ranks r
           where r.min_level <= p.level
           order by r.min_level desc
           limit 1),
         'Lurker')
 where p.rank_title is distinct from coalesce(
         (select r.title from public.ranks r
           where r.min_level <= p.level
           order by r.min_level desc
           limit 1),
         'Lurker');

select set_config('vg.privileged', 'off', true);


-- ============================================================
-- CHECK IT WORKED
-- ============================================================
-- select min_level, title from public.ranks order by min_level;
--   -- 2 should read Creator, nothing else should have moved
--
-- select rank_title, count(*) from public.profiles group by 1 order by 2 desc;
--   -- no rows should say Newcomer
--
-- Nobody's level, XP or coins should have changed. If a level-up
-- reward had fired here, that would be the bug:
-- select count(*) from public.coin_transactions
--  where reason = 'level_up' and created_at > now() - interval '5 minutes';
--   -- expected: 0
-- ============================================================
