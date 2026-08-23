-- ============================================================
-- VIBEGROUNDS — 29: FIX THE EMAIL PANEL'S EMPTY ERROR
-- ============================================================
-- The Email tab showed a blank count and `{"message":""}`. The cause is one
-- word in migration 28.
--
-- nudge_due was created `with (security_invoker = true)`, which means the
-- view's query runs as whoever is reading it. The view has to join
-- auth.users to get an email address, and no ordinary role can read
-- auth.users — not even an admin. So every read failed, and it failed with
-- an empty message, which is how it reached the screen as `{"message":""}`.
--
-- security_invoker was the right instinct in the wrong place. It exists so a
-- view cannot be used to sneak past row-level security, and it is correct on
-- comics_public and creations_public, where the rows belong to the reader's
-- world. Here the view exists precisely to read something the reader is not
-- allowed to touch, and its protection has to come from somewhere else.
--
-- So:
--   * nudge_due runs as its owner again, and is revoked from everybody. The
--     only thing that reads it is send_signup_nudges(), which is security
--     definer and has its own rules about what it will do.
--   * The panel gets nudge_status() instead — staff only, and it returns a
--     count and the settings, never an address.
--
-- Worth being blunt about why this is not just "add a grant": nudge_due has
-- every member's email address in it. Handing that to authenticated so a
-- number could appear on a screen would have leaked the mailing list to any
-- signed-in user. The number is what the panel needs; the addresses are not.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The view, owner-run and closed to everyone
-- ------------------------------------------------------------
drop view if exists public.nudge_due;

create view public.nudge_due as
  select
    p.id,
    p.username,
    u.email,
    p.created_at,
    p.unsubscribe_token
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.nudged_at is null
    and p.email_optout = false
    and p.is_banned = false
    and u.email_confirmed_at is not null
    and u.email is not null
    and p.created_at < now() - (public.setting_int('nudge_after_days', 7) || ' days')::interval
    and not exists (select 1 from public.creations c where c.creator_id = p.id)
    and not exists (select 1 from public.comics  cm where cm.creator_id = p.id);

revoke all on public.nudge_due from anon, authenticated;

-- ------------------------------------------------------------
-- 2. What the panel is allowed to know
-- ------------------------------------------------------------
create or replace function public.nudge_status()
returns TABLE(due int, enabled boolean, dry_run boolean, after_days int)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only.';
  end if;

  return query
    select
      (select count(*)::int from public.nudge_due),
      public.setting_bool('nudge_enabled', false),
      public.setting_bool('nudge_dry_run', true),
      public.setting_int('nudge_after_days', 7);
end;
$$;

revoke all on function public.nudge_status() from public;
grant execute on function public.nudge_status() to authenticated;

comment on function public.nudge_status() is
  'Count and settings for the Email panel. Staff only, and never returns an address.';
