-- ============================================================
-- VIBEGROUNDS — 26: WHERE DOES IT ACTUALLY WORK
-- ============================================================
-- Somebody on a phone opens a vibe-coded thing, it wants a keyboard and a
-- 1400px window, and they leave. They do not leave a review saying so, they
-- just leave — and the creator never finds out why nobody scored it.
--
-- One column, four values, and a deliberate choice about the fourth:
--
--   both      works either way
--   desktop   needs a proper screen or a keyboard
--   mobile    built for a phone
--   unknown   nobody has said
--
-- 'unknown' is the default, and every creation posted before today keeps
-- it. Backfilling the existing 28 to 'both' would have made the filter look
-- populated immediately, and every one of those 28 claims would have been
-- invented by this migration rather than made by the person who built the
-- thing. A filter that quietly lies is worse than a filter with gaps in it.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The column
-- ------------------------------------------------------------
alter table public.creations
  add column if not exists works_on text not null default 'unknown';

do $$
begin
  alter table public.creations
    add constraint creations_works_on_check
    check (works_on in ('both', 'desktop', 'mobile', 'unknown'));
exception
  when duplicate_object then null;
end
$$;

-- Partial: 'unknown' rows are the majority today and nobody filters for
-- them, so there is no point carrying them in the index.
create index if not exists idx_creations_works_on
  on public.creations (works_on, created_at desc)
  where works_on <> 'unknown';

comment on column public.creations.works_on is
  'Where the creation is usable: both, desktop, mobile, or unknown if the creator has not said.';

-- ------------------------------------------------------------
-- 2. Let the creator set it, and nobody else
-- ------------------------------------------------------------
-- works_on is deliberately NOT added to guard_creation_columns. The guard
-- lists the columns a creator may not touch — score, status, view counts,
-- thumbnail moderation — and this is the opposite of those: it is theirs to
-- say, and only theirs, which the existing row-level policy already
-- enforces by only letting them update their own row.

-- ------------------------------------------------------------
-- 3. Accept it at submission
-- ------------------------------------------------------------
-- The old seven-argument version is DROPPED, not left alongside. This is the
-- whole reason this section is long.
--
-- The obvious move is to add an eighth argument with a default and leave the
-- original in place for older clients. That does not work here, and it does
-- not fail loudly: arguments five to eight all have defaults, so a call with
-- four to seven arguments matches BOTH functions and Postgres refuses to
-- pick — "function submit_creation(...) is not unique". Every upload on the
-- site would have started failing the moment this ran, including from the
-- currently deployed front end.
--
-- So there is exactly one submit_creation, with the whole original body
-- carried over unchanged and works_on added to the insert. The body below is
-- a faithful copy of what is in production today — the only differences are
-- the new argument, the v_works line, and two words in the insert.
drop function if exists public.submit_creation(text, text, text, text, text, text[], boolean);

create or replace function public.submit_creation(
  p_title       text,
  p_description text,
  p_category    text,
  p_project_url text,
  p_thumbnail   text    default '',
  p_tags        text[]  default '{}',
  p_is_nsfw     boolean default false,
  p_works_on    text    default 'unknown'
)
returns public.creations
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_uid     uuid := auth.uid();
  v_cost    int  := public.setting_int('submission_cost', 10);
  v_limit   int  := public.setting_int('daily_submission_limit', 5);
  v_profile public.profiles%rowtype;
  v_row     public.creations%rowtype;
  v_url     text;
  v_works   text;
begin
  if v_uid is null then
    raise exception 'You must be signed in to submit.';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'Account not found.'; end if;

  -- 1. Email must be verified
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'EMAIL_NOT_VERIFIED';
  end if;

  -- 2. Not banned / muted
  if v_profile.is_banned and (v_profile.banned_until is null or v_profile.banned_until > now()) then
    raise exception 'ACCOUNT_BANNED';
  end if;
  if v_profile.is_muted then
    raise exception 'ACCOUNT_MUTED';
  end if;

  -- 3. Account age gate — 10 minutes old before first post (kills drive-by bots)
  if v_profile.created_at > now() - interval '10 minutes' then
    raise exception 'ACCOUNT_TOO_NEW';
  end if;

  -- 4. Daily rate limit
  if (select count(*) from public.creations
       where creator_id = v_uid and created_at > now() - interval '24 hours') >= v_limit then
    raise exception 'DAILY_LIMIT_REACHED';
  end if;

  -- 5. Validate input
  v_url := trim(p_project_url);
  if v_url !~* '^https?://' then
    v_url := 'https://' || v_url;
  end if;
  if v_url !~* '^https?://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+' then
    raise exception 'INVALID_URL';
  end if;
  if char_length(trim(p_title)) < 2 then
    raise exception 'Title is too short.';
  end if;

  -- Anything unrecognised becomes 'unknown' rather than an error. This is a
  -- helpful label, not a gate, and not worth failing an upload over.
  v_works := case when p_works_on in ('both','desktop','mobile') then p_works_on else 'unknown' end;

  -- 6. No duplicate URL from the same creator
  if exists (select 1 from public.creations
              where creator_id = v_uid and lower(project_url) = lower(v_url) and status <> 'removed') then
    raise exception 'DUPLICATE_SUBMISSION';
  end if;

  -- 7. Charge the coins (raises INSUFFICIENT_COINS and rolls everything back)
  perform public.apply_coin_delta(v_uid, -v_cost, 'submission', trim(p_title));

  -- 8. Create it
  perform set_config('vg.privileged', 'on', true);
  insert into public.creations (
    creator_id, title, description, category, project_url,
    thumbnail_url, tags, is_nsfw, coins_spent, works_on
  ) values (
    v_uid, trim(p_title), trim(coalesce(p_description,'')),
    coalesce(p_category,'other'), v_url,
    coalesce(p_thumbnail,''), coalesce(p_tags,'{}'), coalesce(p_is_nsfw,false), v_cost, v_works
  ) returning * into v_row;
  perform set_config('vg.privileged', 'off', true);

  -- 9. Tag the coin transaction with the new creation id
  update public.coin_transactions
     set ref_id = v_row.id
   where id = (
     select id from public.coin_transactions
      where user_id = v_uid and reason = 'submission' and ref_id is null
      order by created_at desc
      limit 1
   );

  perform public.evaluate_badges(v_uid);
  return v_row;
end;
$fn$;

revoke all on function public.submit_creation(text, text, text, text, text, text[], boolean, text) from public;
grant execute on function public.submit_creation(text, text, text, text, text, text[], boolean, text) to authenticated;

-- ------------------------------------------------------------
-- 4. Show it to readers
-- ------------------------------------------------------------
-- Appended last. CREATE OR REPLACE VIEW can add columns but never reorder
-- or remove them, so a new column goes on the end or the replace fails.
create or replace view public.creations_public
with (security_invoker = true) as
  select
    c.id,
    c.creator_id,
    c.title,
    c.description,
    c.category,
    c.project_url,
    c.thumbnail_url,
    c.tags,
    c.status,
    c.is_featured,
    c.is_nsfw,
    c.score,
    c.vote_count,
    c.view_count,
    c.review_count,
    c.created_at,
    c.updated_at,
    p.username   as creator_username,
    p.avatar_url as creator_avatar,
    cat.name     as category_name,
    cat.icon     as category_icon,
    cat.color    as category_color,
    c.is_seed,
    c.source_url,
    c.source_author,
    c.accepts_ideas,
    c.update_count,
    c.last_update_at,
    c.works_on
  from public.creations c
  join public.profiles p on p.id = c.creator_id
  left join public.categories cat on cat.slug = c.category
  where c.status = 'published';
