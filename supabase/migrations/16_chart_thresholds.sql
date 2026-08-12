-- ============================================================
-- VIBEGROUNDS — 16: CHART THRESHOLDS
-- ============================================================
-- The charts looked broken. They were not — they were filtering almost
-- everything out.
--
-- chart_alltime required vote_count >= 5 and the rest required >= 3. On a
-- site this young that left 2 items in the all-time chart, 1 in the weekly
-- and 0 in the daily, while submissions sitting on 2 votes were invisible.
-- To anyone looking at the home page that reads as "the chart is stuck".
--
-- The thresholds were belt-and-braces against a single friendly vote
-- crowning something. But that job is already done, properly, by the
-- Bayesian average in recalc_creation_score: with a prior of 6 pseudo-votes
-- at 2.50, one 5/5 vote scores
--
--     (6 x 2.50 + 5) / (6 + 1) = 2.86
--
-- which is mid-table, not the top. Five 5/5 votes gets you 3.93. The maths
-- already makes rank earn itself, so the count filter was doing nothing
-- except hiding the site's own content.
--
-- Dropping to >= 1 means "has been rated at all", which is the honest bar:
-- unrated work stays out, everything else competes on its weighted score.
-- ============================================================

create or replace view public.chart_daily
with (security_invoker = on) as
select *, row_number() over (order by score desc, vote_count desc, created_at desc) as rank
from public.creations_public
where created_at > now() - interval '24 hours' and vote_count >= 1 and category <> 'memes';

create or replace view public.chart_weekly
with (security_invoker = on) as
select *, row_number() over (order by score desc, vote_count desc, created_at desc) as rank
from public.creations_public
where created_at > now() - interval '7 days' and vote_count >= 1 and category <> 'memes';

create or replace view public.chart_monthly
with (security_invoker = on) as
select *, row_number() over (order by score desc, vote_count desc, created_at desc) as rank
from public.creations_public
where created_at > now() - interval '30 days' and vote_count >= 1 and category <> 'memes';

create or replace view public.chart_alltime
with (security_invoker = on) as
select *, row_number() over (order by score desc, vote_count desc, created_at asc) as rank
from public.creations_public
where vote_count >= 1 and category <> 'memes';
