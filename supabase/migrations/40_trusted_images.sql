-- ============================================================
-- 40 — A PICTURE ON THIS SITE COMES FROM THIS SITE
-- ============================================================
-- Reported by a member, who demonstrated it by setting his own
-- avatar to a GIF hosted somewhere else. He was right that the
-- field is unguarded. Worth being precise about what that does
-- and does not get you, because the fix is the same either way
-- and overstating it helps nobody.
--
-- WHAT IT IS NOT. The report said this allows script execution
-- in other members' browsers via an SVG carrying <script> or an
-- onload attribute. It does not, and I checked rather than
-- assuming. Every place an avatar is rendered is an <img src>
-- in JSX (ChartRail, ReviewSection, ArcadeCharts, SiteHeader,
-- ProfilePage, CreationPage, ForumThreadPage, ForumCategoryPage,
-- EditProfilePage). An SVG loaded through <img> is rendered in a
-- restricted mode: no script execution, no event handlers, no
-- external fetches. And an SVG served from somebody else's host
-- would execute in THEIR origin, not ours, so it could not reach
-- a VibeGrounds session even if it ran. The share-card endpoint
-- (api/share.js) already filters to http(s) and escapes before
-- the value reaches an og:image tag.
--
-- WHAT IT IS. Still worth closing, on its own merits:
--
--   * Every member who loads a page showing that avatar makes a
--     request to a server the poster controls. That hands them
--     the IP address, user-agent and referring page of everyone
--     who so much as scrolls past — across the charts, the forum
--     and the arcade leaderboard. It is a tracking pixel with
--     sitewide reach, and the people being tracked cannot see it.
--   * The address passes review once; what it serves can change
--     afterwards. Nothing stops a tame image becoming something
--     that gets the site reported, hours later, with no edit to
--     moderate.
--   * It costs somebody else's bandwidth, and it breaks whenever
--     they choose.
--   * The no-script guarantee above belongs to the browser, not
--     to us. It holds while these fields are only ever rendered
--     through <img>. The moment one lands in an <object>, an
--     email, or anything that is not React, the only thing left
--     is somebody else's good manners. Migration 38 made this
--     argument about links. It applies here and I missed it.
--
-- SO: AN ALLOWLIST, NOT A BLOCKLIST. Trying to enumerate the bad
-- addresses is a losing game. There are exactly two kinds of
-- picture this site has any business displaying — one shipped
-- with the build, and one uploaded to our own storage — and
-- everything else is refused without needing to know why it is
-- bad.
--
-- Same shape as 38: correct on the way in, at the table, where
-- it holds no matter which door the write came through. The
-- browser form is not a security control; the REST API is a door
-- too, and that is the one that was used.
-- ============================================================


-- ------------------------------------------------------------
-- Where our own uploads live
--
-- A setting rather than a constant so the storage host can move
-- without a migration. Falls back to the current project.
-- ------------------------------------------------------------
insert into public.site_settings (key, value, description) values
  ('image_origin',
   '"https://oqiityancoxnwhfsrcgx.supabase.co"'::jsonb,
   'Origin that uploaded images must come from. Anything else is refused.')
on conflict (key) do nothing;


create or replace function public.trusted_image_origin()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select value #>> '{}' from public.site_settings where key = 'image_origin'),
    'https://oqiityancoxnwhfsrcgx.supabase.co'
  )
$$;


-- ------------------------------------------------------------
-- What counts as a picture
--
--   /images/…            a file shipped with the build — the 132
--                        avatars, the badges, the site furniture
--   <our storage>/…      a file somebody uploaded through us
--   anything else        ''  (empty, so the UI falls back to the
--                            default avatar rather than showing
--                            a broken frame)
--
-- The local-path test is a full match, not a prefix test, and
-- that is deliberate. "//evil.example/x" is a protocol-relative
-- URL that a browser happily fetches from evil.example, and a
-- careless `like '/images/%'` would wave it through. Requiring
-- the whole string to be /images/ plus safe characters refuses
-- it, along with "/images/../../etc" and anything carrying a
-- space, a newline or a control character.
-- ------------------------------------------------------------
create or replace function public.safe_image(p_url text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v        text := btrim(coalesce(p_url, ''));
  v_prefix text;
begin
  if v = '' then
    return '';
  end if;

  -- Nothing legitimate carries whitespace or control characters.
  -- Both are used to smuggle a second address past a naive check.
  if v ~ '[[:space:][:cntrl:]]' then
    return '';
  end if;

  -- No traversal, anywhere, in either form.
  if v like '%..%' then
    return '';
  end if;

  -- A file shipped with the site.
  if v ~ '^/images/[A-Za-z0-9][A-Za-z0-9/._-]*$' then
    return v;
  end if;

  -- A file uploaded to our own storage.
  v_prefix := public.trusted_image_origin() || '/storage/v1/object/public/';
  if left(v, length(v_prefix)) = v_prefix
     and length(v) > length(v_prefix)
  then
    return v;
  end if;

  return '';
end;
$$;

comment on function public.safe_image(text) is
  'Returns the address unchanged if it is a site asset or one of our own '
  'uploads, and '''' otherwise. Allowlist: everything not recognised is refused.';


-- ============================================================
-- THE FIELDS
-- ============================================================
-- Optional, decorative pictures are blanked rather than refused.
-- A member editing their bio should not get an error about a
-- banner they set eight months ago, and an empty avatar already
-- has a sensible fallback everywhere it is drawn.
-- ============================================================

-- ------------------------------------------------------------
-- profiles.avatar_url, profiles.banner_url
--
-- banner_url is the same hole as the reported one. It was not
-- mentioned and it is not guarded either: same column type, same
-- update policy, rendered the same way on ProfilePage.
-- ------------------------------------------------------------
create or replace function public.clean_profile_images()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.avatar_url := public.safe_image(new.avatar_url);
  new.banner_url := public.safe_image(new.banner_url);
  return new;
end;
$$;

drop trigger if exists trg_clean_profile_images on public.profiles;
create trigger trg_clean_profile_images
  before insert or update on public.profiles
  for each row execute function public.clean_profile_images();


-- ------------------------------------------------------------
-- creations.thumbnail_url
--
-- Covers memes too — a meme is a creation with category='memes',
-- not a table of its own.
--
-- project_url is left alone: that one is a link, it is meant to
-- point off-site, and migration 38 already sanitises it.
-- ------------------------------------------------------------
create or replace function public.clean_creation_image()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.thumbnail_url := public.safe_image(new.thumbnail_url);
  return new;
end;
$$;

drop trigger if exists trg_clean_creation_image on public.creations;
create trigger trg_clean_creation_image
  before insert or update on public.creations
  for each row execute function public.clean_creation_image();


-- ------------------------------------------------------------
-- comics.cover_url
--
-- On update this is already reverted to the old value by
-- guard_comic_columns, and set from the first page by
-- recalc_comic_pages. Neither of those covers the INSERT, where
-- the row is written straight through the policy and cover_url
-- is whatever the caller sent.
--
-- recalc_comic_pages copies from comic_pages.image_url, which is
-- validated below, so nothing legitimate is affected.
-- ------------------------------------------------------------
create or replace function public.clean_comic_cover()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.cover_url := public.safe_image(new.cover_url);
  return new;
end;
$$;

drop trigger if exists trg_clean_comic_cover on public.comics;
create trigger trg_clean_comic_cover
  before insert or update on public.comics
  for each row execute function public.clean_comic_cover();


-- ------------------------------------------------------------
-- comic_pages.image_url
--
-- This one is refused rather than blanked. The column is NOT
-- NULL with a length check, so there is no empty value to fall
-- back to, and a comic page with no picture is not a page. An
-- error here is also honest: it only ever fires on a write that
-- did not come from the upload form.
--
-- Only checked when the value actually changes, so reordering
-- pages or editing a caption on an old comic cannot be blocked
-- by a row that predates this migration.
-- ------------------------------------------------------------
create or replace function public.check_comic_page_image()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.image_url is not distinct from old.image_url then
    return new;
  end if;

  if public.safe_image(new.image_url) = '' then
    raise exception
      'Comic pages must be uploaded here, not linked from another site.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_comic_page_image on public.comic_pages;
create trigger trg_check_comic_page_image
  before insert or update on public.comic_pages
  for each row execute function public.check_comic_page_image();


-- ============================================================
-- WHILE I AM IN HERE: THE BADGE SHELF
-- ============================================================
-- Not reported, found while checking whether the avatar field
-- was the only one of its kind. It is worse than the avatar.
--
--   create policy "Users can pin own badges"
--     on public.user_badges for update
--     using (auth.uid() = user_id) with check (auth.uid() = user_id);
--
-- The intent is the pin toggle on the profile. But an UPDATE
-- policy grants the whole row, not the column somebody had in
-- mind, and the row's other column is badge_slug. So:
--
--   PATCH /user_badges?badge_slug=eq.verified
--   { "badge_slug": "staff" }
--
-- Everybody gets 'verified' for confirming their email. One
-- request turns it into 🛡️ VG Staff — which is is_manual, only
-- ever granted by hand, and is the marking members are told to
-- trust. Same request grants og-member, founding-100,
-- hall-of-famer, anything in the table. earned_at and granted_by
-- are writable too, so it can be backdated and attributed to a
-- real moderator.
--
-- Nothing is stolen and no permission changes — the shield is
-- cosmetic, is_staff() reads profiles.role, which is protected.
-- But a convincing fake moderator is how somebody talks a member
-- out of something, and it would have been my word against a
-- badge.
--
-- RLS picks rows; a trigger picks columns. Same split used for
-- profiles and comics already.
-- ------------------------------------------------------------
create or replace function public.guard_user_badge_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.caller_is_privileged() then
    return new;
  end if;

  -- is_pinned is the only thing this policy was ever for.
  new.user_id    := old.user_id;
  new.badge_slug := old.badge_slug;
  new.earned_at  := old.earned_at;
  new.granted_by := old.granted_by;
  return new;
end;
$$;

drop trigger if exists trg_guard_user_badge_columns on public.user_badges;
create trigger trg_guard_user_badge_columns
  before update on public.user_badges
  for each row execute function public.guard_user_badge_columns();


-- ============================================================
-- AND THE UNBOUNDED TEXT
-- ============================================================
-- bio is capped at 500 by a check constraint. display_name and
-- location are not capped at all, and both are written straight
-- through the update policy. A megabyte of text in display_name
-- is rendered on every chart row, every forum post and every
-- comment that member ever left.
--
-- accent_color is not rendered anywhere today. It is capped and
-- format-checked regardless, because it exists to be dropped
-- into a style attribute, and the day somebody does that is not
-- the day to discover it holds arbitrary text.
--
-- settings is a jsonb the member controls. Capped so it cannot
-- be used as free storage.
--
-- Trimmed rather than refused, and in a trigger rather than a
-- check constraint, for the reason given in 38: a constraint
-- fails against rows that already exist, and turns somebody's
-- long nickname into an error message instead of a shorter
-- nickname.
-- ------------------------------------------------------------
create or replace function public.clean_profile_text()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.display_name := left(btrim(coalesce(new.display_name, '')), 50);
  new.location     := left(btrim(coalesce(new.location, '')), 60);

  if coalesce(new.accent_color, '') !~ '^#[0-9A-Fa-f]{6}$' then
    new.accent_color := '#e8a317';
  end if;

  if pg_column_size(coalesce(new.settings, '{}'::jsonb)) > 4096 then
    new.settings := case tg_op when 'UPDATE' then old.settings else '{}'::jsonb end;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_clean_profile_text on public.profiles;
create trigger trg_clean_profile_text
  before insert or update on public.profiles
  for each row execute function public.clean_profile_text();


-- ============================================================
-- CLEAN UP WHAT IS ALREADY THERE
-- ============================================================
-- The triggers stop the next one. These rows are the ones that
-- got in before — including the GIF that started this.
--
-- Each of these passes back through the triggers above, so the
-- result is exactly what the rules allow, and running the
-- migration twice changes nothing the second time.
-- ============================================================

update public.profiles
   set avatar_url = public.safe_image(avatar_url)
 where avatar_url is not null
   and avatar_url <> public.safe_image(avatar_url);

update public.profiles
   set banner_url = public.safe_image(banner_url)
 where banner_url is not null
   and banner_url <> public.safe_image(banner_url);

update public.creations
   set thumbnail_url = public.safe_image(thumbnail_url)
 where thumbnail_url is not null
   and thumbnail_url <> public.safe_image(thumbnail_url);

update public.comics
   set cover_url = public.safe_image(cover_url)
 where cover_url is not null
   and cover_url <> public.safe_image(cover_url);

-- Text fields: a no-op update runs them through clean_profile_text.
update public.profiles
   set updated_at = updated_at
 where char_length(coalesce(display_name, '')) > 50
    or char_length(coalesce(location, '')) > 60
    or coalesce(accent_color, '') !~ '^#[0-9A-Fa-f]{6}$'
    or pg_column_size(coalesce(settings, '{}'::jsonb)) > 4096;


-- ------------------------------------------------------------
-- Comic pages are reported, not rewritten
--
-- Blanking one would break the row's own length check, and a
-- comic missing a page in the middle is worse than a comic with
-- one bad page. If this returns anything, look at it by hand.
-- ------------------------------------------------------------
do $$
declare v_n int;
begin
  select count(*) into v_n
    from public.comic_pages
   where public.safe_image(image_url) = '';

  if v_n > 0 then
    raise warning
      '% comic page(s) point somewhere other than our own storage. '
      'Run: select id, comic_id, position, image_url from public.comic_pages '
      'where public.safe_image(image_url) = '''';', v_n;
  end if;
end $$;


-- ============================================================
-- CHECK IT WORKED
-- ============================================================
-- select public.safe_image('/images/avatars/avatar_07.png');  -- kept
-- select public.safe_image('https://evil.example/x.svg');     -- ''
-- select public.safe_image('//evil.example/x.png');           -- ''
-- select public.safe_image('/images/../../etc/passwd');       -- ''
--
-- Nothing left pointing off-site (all four should be 0):
--   select count(*) from public.profiles  where avatar_url    <> public.safe_image(avatar_url);
--   select count(*) from public.profiles  where banner_url    <> public.safe_image(banner_url);
--   select count(*) from public.creations where thumbnail_url <> public.safe_image(thumbnail_url);
--   select count(*) from public.comics    where cover_url     <> public.safe_image(cover_url);
--
-- The badge shelf, as the member who found this would test it:
--   update public.user_badges set badge_slug = 'staff'
--    where user_id = auth.uid() and badge_slug = 'verified';
--   -- reports success, changes nothing. Confirm with:
--   select badge_slug from public.user_badges where user_id = auth.uid();
-- ============================================================
