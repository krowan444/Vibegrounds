-- ============================================================
-- 38 — A LINK SOMEBODY TYPES IS A WEB LINK, OR IT IS NOTHING
-- ============================================================
-- profiles.website and creations.project_url are typed by members
-- and rendered straight into an href. Nothing checked that what
-- went in was a web address.
--
-- This is NOT currently exploitable, and it is worth being precise
-- about why rather than overstating it: React 19 replaces a
-- javascript: URL with a harmless error before it ever reaches the
-- DOM, and browsers have blocked top-level navigation to data:
-- URLs for years. I tested that rather than assuming it.
--
-- But both of those protections belong to somebody else. They hold
-- as long as this stays a React 19 app rendering links through JSX.
-- The moment a link is built by hand, put in an email, or handed to
-- something that is not React, the only thing standing between a
-- member and a script is a library's good manners.
--
-- So: clean on the way in, where it stays clean.
--
-- SANITISE RATHER THAN REJECT. A check constraint would be the
-- obvious move and it is the wrong one here — it fails against any
-- existing row that does not match, and it turns a typo into an
-- error message rather than into a working link. This corrects
-- instead, which also means it cannot break an edit somebody is
-- halfway through.
-- ============================================================


-- ------------------------------------------------------------
-- What counts as a link
--
--   already http(s)      -> kept as typed
--   any other scheme     -> dropped (javascript:, data:, vbscript:,
--                           file:, mailto: — none of them are the
--                           personal website this field asks for)
--   no scheme at all     -> https:// put on the front, because
--                           "vibegrounds.com" is what people type
--                           and refusing it would be pedantry
-- ------------------------------------------------------------
create or replace function public.safe_link(p_url text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_url is null                                then null
    when btrim(p_url) = ''                            then ''
    when btrim(p_url) ~* '^https?://[^[:space:]]+$'   then btrim(p_url)
    -- Has a scheme, and it is not one we serve. Drop it rather than
    -- mangle it: https://javascript:alert(1) would be a dead link
    -- sitting on somebody's profile looking like a mistake we made.
    when btrim(p_url) ~ '^[A-Za-z][A-Za-z0-9+.-]*:'   then ''
    else 'https://' || btrim(p_url)
  end
$$;

comment on function public.safe_link(text) is
  'Normalises a member-typed web address. Keeps http(s), adds https:// to a bare domain, and drops anything carrying another scheme.';


-- ------------------------------------------------------------
-- Applied on the way into both tables.
--
-- A trigger rather than validation inside submit_creation(),
-- because profiles.website is written by a plain PostgREST update
-- against the table — there is no function to put a check in, and
-- adding one would mean changing how the profile form saves.
-- A trigger covers every path into the column, including ones
-- written later by somebody who has not read this file.
-- ------------------------------------------------------------
create or replace function public.clean_profile_website()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.website := public.safe_link(new.website);
  return new;
end;
$$;

drop trigger if exists trg_clean_profile_website on public.profiles;
create trigger trg_clean_profile_website
  before insert or update of website on public.profiles
  for each row execute function public.clean_profile_website();


create or replace function public.clean_creation_url()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.project_url := public.safe_link(new.project_url);
  return new;
end;
$$;

drop trigger if exists trg_clean_creation_url on public.creations;
create trigger trg_clean_creation_url
  before insert or update of project_url on public.creations
  for each row execute function public.clean_creation_url();


-- ------------------------------------------------------------
-- Existing rows
--
-- Left alone deliberately. Rewriting every row would touch
-- updated_at on work people posted months ago and shuffle the
-- "recently updated" ordering for something nobody can see. They
-- get cleaned the next time they are edited.
--
-- To find any that would change today:
--
--   select id, website from public.profiles
--    where website is distinct from public.safe_link(website);
--
--   select id, project_url from public.creations
--    where project_url is distinct from public.safe_link(project_url);
--
-- hall_of_fame.creator_url / source_url / project_url are staff
-- entered rather than member typed, so they are not covered here.
-- If that ever opens up to submissions, they want the same trigger.
-- ------------------------------------------------------------

notify pgrst, 'reload schema';
