-- ============================================================
-- 13. MEMES
-- ============================================================
-- Memes ride on the existing `creations` table as their own category
-- rather than getting a table of their own.
--
-- That is a deliberate choice. Voting, scoring, reviews, reporting,
-- moderation, badges, sharing and the edit screen already work against
-- `creations` and are already hardened. A separate table would mean
-- duplicating every one of those — and every duplicate is somewhere new
-- for a bug to live. A meme is just a submission whose "project" is an
-- image, so it fits the shape we already have.
--
-- What memes need that projects do not:
--   * they are free to post (the whole point is a low barrier)
--   * the image is uploaded here rather than linked elsewhere
--   * they must not pollute the project charts
-- ============================================================

-- ------------------------------------------------------------
-- 1. The category
-- ------------------------------------------------------------
insert into public.categories (slug, name, tagline, icon, color, sort_order) values
  ('memes', 'Memes', 'Shitposts, reaction images and cursed screenshots', '😂', '#f06292', 9)
on conflict (slug) do update
  set name     = excluded.name,
      tagline  = excluded.tagline,
      icon     = excluded.icon,
      color    = excluded.color;

-- ------------------------------------------------------------
-- 2. Storage bucket
-- ------------------------------------------------------------
-- Public read so images render without signed URLs. 5 MB and an explicit
-- MIME allow-list are enforced by storage itself, so a hand-crafted
-- request cannot push a 200 MB video or an .html file through the
-- uploader. The client checks the same limits first purely for a nicer
-- error message — it is not the thing keeping us safe.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memes', 'memes', true, 5242880,
  array['image/png','image/jpeg','image/gif','image/webp']
)
on conflict (id) do update
  set public             = true,
      file_size_limit    = 5242880,
      allowed_mime_types = array['image/png','image/jpeg','image/gif','image/webp'];

drop policy if exists "Memes are publicly readable"    on storage.objects;
drop policy if exists "Members upload their own memes" on storage.objects;
drop policy if exists "Members update their own memes" on storage.objects;
drop policy if exists "Members delete their own memes" on storage.objects;

create policy "Memes are publicly readable"
  on storage.objects for select
  using (bucket_id = 'memes');

-- Uploads are namespaced by user id: memes/<uid>/<file>. The folder check
-- stops anyone writing into someone else's space or overwriting their image.
create policy "Members upload their own memes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'memes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Members update their own memes"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'memes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Members delete their own memes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'memes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- 3. Keep memes out of the project charts
-- ------------------------------------------------------------
-- A meme scoring 4.8 should not outrank a game someone spent a fortnight
-- on. The charts stay for projects; memes get their own board below.
--
-- These are dropped rather than replaced. `creations_public` gained an
-- `is_seed` column after the chart views were first created, so the live
-- views are a column short of what `select *` now produces — and
-- `create or replace view` refuses to change a view's shape. Dropping is
-- safe here: nothing depends on these, they are read directly by the app.
drop view if exists public.chart_daily;
drop view if exists public.chart_weekly;
drop view if exists public.chart_monthly;
drop view if exists public.chart_alltime;
drop view if exists public.chart_hot;

create or replace view public.chart_daily
with (security_invoker = on) as
select *, row_number() over (order by score desc, vote_count desc, created_at desc) as rank
from public.creations_public
where created_at > now() - interval '24 hours' and vote_count >= 3 and category <> 'memes';

create or replace view public.chart_weekly
with (security_invoker = on) as
select *, row_number() over (order by score desc, vote_count desc, created_at desc) as rank
from public.creations_public
where created_at > now() - interval '7 days' and vote_count >= 3 and category <> 'memes';

create or replace view public.chart_monthly
with (security_invoker = on) as
select *, row_number() over (order by score desc, vote_count desc, created_at desc) as rank
from public.creations_public
where created_at > now() - interval '30 days' and vote_count >= 3 and category <> 'memes';

create or replace view public.chart_alltime
with (security_invoker = on) as
select *, row_number() over (order by score desc, vote_count desc, created_at asc) as rank
from public.creations_public
where vote_count >= 5 and category <> 'memes';

-- "Hot Now" is a live tab on the Charts page, so it needs the same
-- exclusion or memes leak back in through the side door.
create or replace view public.chart_hot
with (security_invoker = on) as
select cp.*,
       (select count(*) from public.votes v
         where v.creation_id = cp.id and v.updated_at > now() - interval '48 hours') as recent_votes,
       row_number() over (
         order by (select count(*) from public.votes v
                    where v.creation_id = cp.id and v.updated_at > now() - interval '48 hours') desc,
                  cp.score desc
       ) as rank
from public.creations_public cp
where cp.category <> 'memes';

-- ------------------------------------------------------------
-- 4. Meme views
-- ------------------------------------------------------------
create or replace view public.memes_public
with (security_invoker = on) as
select * from public.creations_public
where category = 'memes';

-- The meme board. One vote is enough to rank — memes are disposable and
-- waiting for three votes would leave the board looking empty for weeks.
create or replace view public.chart_memes
with (security_invoker = on) as
select *, row_number() over (order by score desc, vote_count desc, created_at desc) as rank
from public.memes_public
where vote_count >= 1;

-- Front-page carousel source. Anything flagged 18+ is excluded outright:
-- the home page is what a stranger sees before they have opted into
-- anything, and that is not the place to gamble.
create or replace view public.chart_memes_safe
with (security_invoker = on) as
select *, row_number() over (order by score desc, vote_count desc, created_at desc) as rank
from public.memes_public
where is_nsfw = false;

grant select on public.memes_public      to anon, authenticated;
grant select on public.chart_memes       to anon, authenticated;
grant select on public.chart_memes_safe  to anon, authenticated;

-- ------------------------------------------------------------
-- 5. submit_meme — free, rate limited
-- ------------------------------------------------------------
-- Free posting is the point, so the spam defences have to be real rather
-- than "it costs coins". Same verified/banned/muted/account-age gates as
-- a project submission, plus a separate daily cap that does not eat into
-- the project allowance.
insert into public.site_settings (key, value, description)
values ('daily_meme_limit', '10'::jsonb, 'Memes a member may post per 24 hours')
on conflict (key) do nothing;

create or replace function public.submit_meme(
  p_title       text,
  p_image_url   text,
  p_description text default '',
  p_tags        text[] default '{}',
  p_is_nsfw     boolean default false
)
returns public.creations
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid     uuid := auth.uid();
  v_limit   int  := public.setting_int('daily_meme_limit', 10);
  v_profile public.profiles%rowtype;
  v_row     public.creations%rowtype;
  v_url     text := trim(p_image_url);
begin
  if v_uid is null then
    raise exception 'You must be signed in to post a meme.';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'Account not found.'; end if;

  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'EMAIL_NOT_VERIFIED';
  end if;

  if v_profile.is_banned and (v_profile.banned_until is null or v_profile.banned_until > now()) then
    raise exception 'ACCOUNT_BANNED';
  end if;
  if v_profile.is_muted then
    raise exception 'ACCOUNT_MUTED';
  end if;

  if v_profile.created_at > now() - interval '10 minutes' then
    raise exception 'ACCOUNT_TOO_NEW';
  end if;

  if (select count(*) from public.creations
       where creator_id = v_uid
         and category = 'memes'
         and created_at > now() - interval '24 hours') >= v_limit then
    raise exception 'DAILY_LIMIT_REACHED';
  end if;

  -- The image must be one we are hosting. Without this, submit_meme
  -- becomes an open redirect: anyone could point a "meme" at any URL on
  -- the internet and have the site render it, which is a hotlinking and
  -- malware problem we do not want to own.
  if v_url !~* '^https?://[a-z0-9.-]+/storage/v1/object/public/memes/' then
    raise exception 'INVALID_IMAGE';
  end if;

  if char_length(trim(p_title)) < 2 then
    raise exception 'Title is too short.';
  end if;

  if exists (select 1 from public.creations
              where creator_id = v_uid
                and lower(project_url) = lower(v_url)
                and status <> 'removed') then
    raise exception 'DUPLICATE_SUBMISSION';
  end if;

  perform set_config('vg.privileged', 'on', true);
  insert into public.creations (
    creator_id, title, description, category, project_url,
    thumbnail_url, tags, is_nsfw, coins_spent
  ) values (
    v_uid, trim(p_title), trim(coalesce(p_description,'')),
    'memes', v_url,
    v_url, coalesce(p_tags,'{}'), coalesce(p_is_nsfw,false), 0
  ) returning * into v_row;
  perform set_config('vg.privileged', 'off', true);

  perform public.evaluate_badges(v_uid);
  return v_row;
end;
$$;

grant execute on function public.submit_meme(text,text,text,text[],boolean) to authenticated;
