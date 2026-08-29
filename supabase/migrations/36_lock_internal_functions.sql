-- ============================================================
-- 36 — CLOSE THE FUNCTIONS THAT WERE NEVER MEANT TO BE PUBLIC
--
-- Two defaults conspired here, and neither is obvious.
--
--   1. PostgreSQL grants EXECUTE on every new function to PUBLIC
--      unless you take it away. Creating a function quietly
--      publishes it.
--   2. Supabase then grants EXECUTE to `anon` and `authenticated`
--      on everything created in the `public` schema, as a separate
--      explicit grant.
--
-- So `revoke ... from public` — which several earlier migrations
-- do — removes only the first of the two. The `anon` grant stays,
-- and PostgREST will happily call the function for anyone holding
-- the anon key. The anon key is in the JavaScript bundle, on
-- purpose, so "anyone" means anyone.
--
-- The rule from here on: revoke from `public, anon, authenticated`,
-- then grant back only to the role that genuinely needs it.
--
-- Nothing below breaks the site. Every one of these functions is
-- called either by a trigger, by pg_cron, or by another SECURITY
-- DEFINER function — all of which run as the table owner and are
-- unaffected by grants to API roles.
-- ============================================================

-- ------------------------------------------------------------
-- The one that mattered: grant_badge
--
-- SECURITY DEFINER, no caller check, and it hands any badge to any
-- account. admin_grant_badge() is the guarded front door and calls
-- this one internally; the back door was standing open beside it.
-- ------------------------------------------------------------
revoke all on function public.grant_badge(uuid, text, uuid)
  from public, anon, authenticated;

revoke all on function public.grant_maker_badges(uuid)
  from public, anon, authenticated;

revoke all on function public.evaluate_badges(uuid)
  from public, anon, authenticated;

revoke all on function public.evaluate_streak_badges(uuid)
  from public, anon, authenticated;

-- ------------------------------------------------------------
-- Recompute helpers. These cannot invent a score — they only add
-- up rows that are already there — so nobody gains anything by
-- calling them. What they cost is database work, on demand, for
-- free, which on the free tier is worth caring about.
-- ------------------------------------------------------------
revoke all on function public.recalc_creation_score(uuid)
  from public, anon, authenticated;

revoke all on function public.recalc_comic_score(uuid)
  from public, anon, authenticated;

revoke all on function public.refresh_reputation(uuid)
  from public, anon, authenticated;

-- refresh_my_reputation() and refresh_my_badges() stay reachable:
-- they take no arguments, act only on auth.uid(), and refuse a
-- caller who is not signed in. That is the safe shape.

-- ------------------------------------------------------------
-- send_signup_nudges: this one actually sends email
--
-- The migration that created it says "Staff only" in a comment.
-- The comment was the only thing enforcing it, and it was reachable
-- by anonymous callers while nudge_enabled was true and dry_run was
-- false — i.e. while it was really sending mail.
--
-- Revoking is the fix. Worth also adding `if not public.is_staff()
-- then raise exception ...` at the top of the body next time it is
-- edited, so the guard survives someone re-granting execute later.
-- ------------------------------------------------------------
revoke all on function public.send_signup_nudges()
  from public, anon, authenticated;

grant execute on function public.send_signup_nudges() to authenticated;

-- ------------------------------------------------------------
-- bootstrap_admin: it has done its job, so take the ladder away
--
-- It makes the named account an admin, and refuses once an admin
-- exists — which is why it is harmless today. But it was callable
-- by anonymous internet traffic, and it is only ever one restore
-- from an older backup away from being the front door to the whole
-- site. There is an admin now; admin_set_role() is the supported
-- way to make another.
-- ------------------------------------------------------------
revoke all on function public.bootstrap_admin(text)
  from public, anon, authenticated;

comment on function public.bootstrap_admin(text) is
  'Historical. Made the first admin before admin_set_role() had anyone to authorise it. Revoked from every API role in migration 36 — call it from the SQL editor if it is ever needed again.';

-- ------------------------------------------------------------
-- Deliberately NOT revoked — these are meant to be open:
--
--   register_view(uuid), register_comic_view(uuid)
--     a view counter has to work for people who are not signed in
--   unsubscribe_by_token(uuid)
--     the whole point is that it works from a link in an email,
--     and the token is an unguessable uuid
--   arcade_charts(int), arcade_status()
--     read-only, and the leaderboard should be readable signed out
--   submit_feedback(...)
--     anonymous feedback is intentional, and it is rate limited
-- ------------------------------------------------------------

notify pgrst, 'reload schema';
