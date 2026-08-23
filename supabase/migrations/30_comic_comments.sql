-- ============================================================
-- VIBEGROUNDS — 30: COMMENTS ON COMICS
-- ============================================================
-- Comics get a comment section, and it is the SAME comment section the
-- submissions already use rather than a second one alongside it.
--
-- That matters more than it sounds. A parallel comic_comments table would
-- need its own row-level security, its own rate limiter, its own reply
-- threading, its own moderation, its own report flow, its own reputation
-- counting and its own "delete this member's stuff" path in the admin tool.
-- Six of those already exist and are tested. A second copy would drift from
-- the first the day one of them is fixed and the other is forgotten — and
-- the one that gets forgotten is always the moderation one.
--
-- So reviews gains a comic_id, creation_id becomes optional, and a comment
-- must belong to exactly one of the two.
--
-- Two existing functions quietly assumed every comment had a creation, and
-- both misbehave in silence rather than failing loudly, so both are fixed
-- here:
--
--   * flatten_review_depth() guards against a reply being smuggled from one
--     page onto another by comparing the parent's creation_id with the new
--     row's. In SQL, null <> null is NULL, not true — so on two comic
--     comments the guard would have passed every time and the check would
--     have been decorative. It now compares both columns with
--     `is distinct from`, which treats nulls as values.
--
--   * reward_review() pays coins for commenting, but never for commenting on
--     your own work — it finds the owner via creations. For a comic comment
--     that lookup returns nothing, the owner never matches, and the site
--     would have paid people to comment on their own comics all day. It now
--     looks up whichever thing the comment is actually attached to.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A comment can hang off a comic instead of a submission
-- ------------------------------------------------------------
alter table public.reviews
  add column if not exists comic_id uuid references public.comics(id) on delete cascade;

alter table public.reviews
  alter column creation_id drop not null;

-- Exactly one target. Not both, not neither — a comment with no home would
-- be invisible everywhere and impossible to moderate.
alter table public.reviews
  drop constraint if exists reviews_one_target;
alter table public.reviews
  add constraint reviews_one_target check (
    (creation_id is not null and comic_id is null)
    or (creation_id is null and comic_id is not null)
  );

create index if not exists idx_reviews_comic
  on public.reviews (comic_id, created_at desc);

-- ------------------------------------------------------------
-- 2. Replies cannot hop between pages
-- ------------------------------------------------------------
create or replace function public.flatten_review_depth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.reviews%rowtype;
begin
  if new.parent_id is null then return new; end if;

  select * into v_parent from public.reviews where id = new.parent_id;
  if not found then
    raise exception 'That comment no longer exists.';
  end if;

  -- Replying to a reply attaches to the same root instead of nesting.
  if v_parent.parent_id is not null then
    new.parent_id := v_parent.parent_id;
  end if;

  -- A reply must live on the same page as its parent, or the thread could be
  -- used to smuggle comments onto somebody else's work.
  --
  -- `is distinct from`, not `<>`: with two comic comments both creation_ids
  -- are null, and null <> null is NULL, which is not true, so the old guard
  -- never fired and this check did nothing at all.
  if v_parent.creation_id is distinct from new.creation_id
     or v_parent.comic_id is distinct from new.comic_id then
    raise exception 'That reply does not belong to this page.';
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 3. Never pay somebody for commenting on their own work
-- ------------------------------------------------------------
-- Rewritten rather than patched, because the original found the owner in one
-- place only. The body below is the original with the ownership lookup
-- widened; nothing else about the reward has changed.
create or replace function public.reward_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward     int := public.setting_int('reward_review', 2);
  v_min_length int := public.setting_int('reward_review_min_length', 40);
  v_daily_cap  int := public.setting_int('reward_review_daily_cap', 5);
  v_today      date := (now() at time zone 'utc')::date;
  v_owner      uuid;
  v_paid_today int;
begin
  if v_reward <= 0 then
    return new;
  end if;

  if char_length(trim(new.body)) < v_min_length then
    return new;
  end if;

  -- Whichever thing this comment is attached to, find who made it.
  if new.creation_id is not null then
    select creator_id into v_owner from public.creations where id = new.creation_id;
  else
    select creator_id into v_owner from public.comics where id = new.comic_id;
  end if;

  if v_owner = new.author_id then
    return new;
  end if;

  select count(*) into v_paid_today
    from public.coin_transactions
   where user_id = new.author_id
     and reason = 'review_written'
     and (created_at at time zone 'utc')::date = v_today;

  if v_paid_today >= v_daily_cap then
    return new;
  end if;

  perform public.apply_coin_delta(
    new.author_id, v_reward, 'review_written', 'Wrote a review', new.id
  );

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 4. Do not let a comment be attached to a comic nobody can see
-- ------------------------------------------------------------
-- The existing insert policy checks the person. This checks the target: a
-- removed comic should not quietly keep collecting comments, and a comic id
-- that does not exist should be refused rather than stored.
drop policy if exists "Verified members can review" on public.reviews;
create policy "Verified members can review"
  on public.reviews for insert
  with check (
    auth.uid() = author_id
    and public.is_active_member()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_muted)
    and (
      comic_id is null
      or exists (
        select 1 from public.comics c
         where c.id = comic_id and c.status = 'published'
      )
    )
  );

-- ------------------------------------------------------------
-- 5. Expose comic_id to the interface
-- ------------------------------------------------------------
drop view if exists public.reviews_public;

create view public.reviews_public
with (security_invoker = on) as
select r.id, r.creation_id, r.comic_id, r.parent_id, r.body,
       r.created_at, r.updated_at, r.author_id,
       p.username as author_username, p.avatar_url as author_avatar, p.role as author_role
from public.reviews r
join public.profiles p on p.id = r.author_id
where r.status = 'visible';

grant select on public.reviews_public to anon, authenticated;

comment on column public.reviews.comic_id is
  'Set when the comment is on a comic. Exactly one of creation_id / comic_id is set.';
