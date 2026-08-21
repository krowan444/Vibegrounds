-- ============================================================
-- VIBEGROUNDS — 23: CREATION UPDATES (the creator's devlog)
-- ============================================================
-- Reviews are what visitors think. Ideas are what visitors want. Updates
-- are the creator talking back: "v2 is up, the enemies are harder and the
-- music no longer loops wrong."
--
-- That third voice matters more than it looks. A submission with no
-- updates is a link someone dropped once. A submission with four updates
-- is somebody still working on it — which is the difference between a
-- directory and a place where things are being made. It also gives the
-- Ideas board somewhere to land: suggest a leaderboard, watch it get
-- marked Built, then read the update where it shipped.
--
-- Three rules shape the design:
--
--   1. Only the creator posts here. This is not another comment box —
--      it is the maker's own log. Enforced in the policy, not the UI.
--   2. Everyone can read it. The whole point is that a curious visitor
--      can see the thing is alive before deciding to try it.
--   3. Posting an update does NOT bump the creation up the newest list.
--      If it did, the way to the top of the front page would be to edit
--      your own description forty times, and the charts would stop
--      meaning anything.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Counters on the creation
-- ------------------------------------------------------------
-- Denormalised so a card can show "4 updates · latest 2d ago" without
-- joining this table on every listing query.
alter table public.creations
  add column if not exists update_count   int not null default 0,
  add column if not exists last_update_at timestamptz;

-- ------------------------------------------------------------
-- 2. The updates
-- ------------------------------------------------------------
create table if not exists public.creation_updates (
  id          uuid primary key default gen_random_uuid(),
  creation_id uuid not null references public.creations(id) on delete cascade,
  -- Denormalised from the creation rather than trusted from the client.
  -- Kept as a real column so an update survives with its authorship even
  -- if ownership of the creation is ever transferred.
  author_id   uuid not null references public.profiles(id) on delete cascade,

  -- Short and required. An untitled devlog is a wall of paragraphs nobody
  -- scans; a title is what makes the list browsable, which is the whole
  -- request: "anyone curious can browse further".
  title       text not null check (char_length(title) between 3 and 120),
  body        text not null check (char_length(body) between 4 and 4000),

  --   visible  normal
  --   removed  moderated away, kept for the audit trail
  status      text not null default 'visible'
              check (status in ('visible','removed')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Newest first, per creation. Covers the only query the page makes.
create index if not exists idx_updates_creation
  on public.creation_updates (creation_id, created_at desc);

-- ------------------------------------------------------------
-- 3. Keep the counters honest
-- ------------------------------------------------------------
-- Recount rather than increment, same as scores and idea votes: a double
-- fire, a manual delete in the SQL editor, or a moderator hiding one can
-- never leave the number permanently wrong.
--
-- The privileged flag is what lets this write to columns that
-- guard_creation_columns otherwise pins. Without it the trigger silently
-- does nothing and every count stays at zero.
create or replace function public.recalc_creation_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_creation uuid;
begin
  v_creation := coalesce(new.creation_id, old.creation_id);
  perform set_config('vg.privileged', 'on', true);
  update public.creations
     set update_count = (
           select count(*) from public.creation_updates
            where creation_id = v_creation and status = 'visible'
         ),
         last_update_at = (
           select max(created_at) from public.creation_updates
            where creation_id = v_creation and status = 'visible'
         )
   where id = v_creation;
  perform set_config('vg.privileged', 'off', true);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_recalc_creation_updates on public.creation_updates;
create trigger trg_recalc_creation_updates
  after insert or update or delete on public.creation_updates
  for each row execute function public.recalc_creation_updates();

-- ------------------------------------------------------------
-- 4. Column guard
-- ------------------------------------------------------------
-- RLS says which rows you may touch; it cannot say which columns. Without
-- this, an author allowed to edit their own update could also re-point it
-- at somebody else's creation or backdate it.
create or replace function public.guard_creation_update_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.caller_is_privileged() or public.is_staff() then
    return new;
  end if;

  new.creation_id := old.creation_id;
  new.author_id   := old.author_id;
  new.created_at  := old.created_at;
  -- Only a moderator hides things. An author who wants it gone deletes it.
  new.status      := old.status;
  new.updated_at  := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_creation_update_columns on public.creation_updates;
create trigger trg_guard_creation_update_columns
  before update on public.creation_updates
  for each row execute function public.guard_creation_update_columns();

-- ------------------------------------------------------------
-- 5. Extend the creations guard
-- ------------------------------------------------------------
-- The two new counters have to be pinned here as well, or a creator can
-- simply set update_count to 99 on their own submission.
--
-- CREATE OR REPLACE FUNCTION cannot patch a single line, so the whole body
-- is restated. That makes this dangerous to write from memory: the version
-- below is migration 14's, NOT migration 04's. Migration 14 added the four
-- pending_thumbnail_* lines, and restating an older copy here would quietly
-- delete them — which would let a creator approve their own pending
-- thumbnail and walk straight past moderation. Anything that redefines this
-- function in future must start from the newest version, not the first one.
create or replace function public.guard_creation_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.caller_is_privileged() or public.is_staff() then
    return new;
  end if;

  new.score          := old.score;
  new.vote_count     := old.vote_count;
  new.vote_sum       := old.vote_sum;
  new.view_count     := old.view_count;
  new.review_count   := old.review_count;
  new.status         := old.status;
  new.removed_reason := old.removed_reason;
  new.removed_by     := old.removed_by;
  new.is_featured    := old.is_featured;
  new.creator_id     := old.creator_id;
  new.coins_spent    := old.coins_spent;
  new.created_at     := old.created_at;

  -- From migration 14. Thumbnail moderation lives here: without these a
  -- creator could approve their own pending thumbnail.
  new.pending_thumbnail_url    := old.pending_thumbnail_url;
  new.pending_thumbnail_at     := old.pending_thumbnail_at;
  new.pending_thumbnail_status := old.pending_thumbnail_status;
  new.pending_thumbnail_note   := old.pending_thumbnail_note;

  -- New in migration 23. Maintained only by recalc_creation_updates().
  new.update_count   := old.update_count;
  new.last_update_at := old.last_update_at;

  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 6. Row level security
-- ------------------------------------------------------------
alter table public.creation_updates enable row level security;

drop policy if exists "Updates are public" on public.creation_updates;
create policy "Updates are public"
  on public.creation_updates for select
  using (status <> 'removed' or auth.uid() = author_id or public.is_staff());

-- The important one. Anyone verified can review or suggest an idea, but
-- only the person whose project it is may post to its devlog. Checked
-- against creations.creator_id rather than against the author_id the
-- client sent, so claiming to be the owner is not enough.
drop policy if exists "Only the creator can post updates" on public.creation_updates;
create policy "Only the creator can post updates"
  on public.creation_updates for insert
  with check (
    auth.uid() = author_id
    and public.is_active_member()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_muted)
    and exists (
      select 1 from public.creations c
       where c.id = creation_id
         and c.creator_id = auth.uid()
         and c.status = 'published'
    )
  );

drop policy if exists "Authors can edit their updates" on public.creation_updates;
create policy "Authors can edit their updates"
  on public.creation_updates for update
  using (status <> 'removed' and auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "Staff can moderate updates" on public.creation_updates;
create policy "Staff can moderate updates"
  on public.creation_updates for update
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Authors and staff can delete updates" on public.creation_updates;
create policy "Authors and staff can delete updates"
  on public.creation_updates for delete
  using (auth.uid() = author_id or public.is_staff());

-- ------------------------------------------------------------
-- 7. Reading view
-- ------------------------------------------------------------
-- Joins the author on so the page does not need a second round trip for
-- an avatar it already knows it needs.
create or replace view public.creation_updates_public
with (security_invoker = on) as
select
  u.id, u.creation_id, u.author_id, u.title, u.body,
  u.created_at, u.updated_at,
  p.username   as author_username,
  p.avatar_url as author_avatar
from public.creation_updates u
join public.profiles p on p.id = u.author_id
where u.status <> 'removed';

grant select on public.creation_updates_public to anon, authenticated;

-- Explicit rather than relying on Supabase defaults, so this migration
-- behaves the same on a fresh project. RLS above decides who may do what;
-- these only open the door.
grant select, insert, update, delete on public.creation_updates to authenticated;
grant select                         on public.creation_updates to anon;

-- ------------------------------------------------------------
-- 8. Expose the counters to the front end
-- ------------------------------------------------------------
-- Appended at the very end of the select list. CREATE OR REPLACE VIEW can
-- add columns but never reorder or remove them, so anything new has to go
-- last. This repeats the definition from migration 19 with two columns
-- added.
create or replace view public.creations_public
with (security_invoker = on) as
select
  c.id, c.creator_id, c.title, c.description, c.category, c.project_url,
  c.thumbnail_url, c.tags, c.status, c.is_featured, c.is_nsfw,
  c.score, c.vote_count, c.view_count, c.review_count,
  c.created_at, c.updated_at,
  p.username    as creator_username,
  p.avatar_url  as creator_avatar,
  cat.name      as category_name,
  cat.icon      as category_icon,
  cat.color     as category_color,
  c.is_seed, c.source_url, c.source_author,
  c.accepts_ideas,
  c.update_count, c.last_update_at
from public.creations c
join public.profiles p   on p.id = c.creator_id
left join public.categories cat on cat.slug = c.category
where c.status = 'published';

-- ------------------------------------------------------------
-- 9. Backfill
-- ------------------------------------------------------------
-- No-op on a fresh install; correct if this migration is ever re-run
-- after updates already exist.
do $backfill$
begin
  perform set_config('vg.privileged', 'on', true);
  update public.creations c
     set update_count = coalesce(u.n, 0),
         last_update_at = u.latest
    from (
      select creation_id, count(*) as n, max(created_at) as latest
        from public.creation_updates
       where status = 'visible'
       group by creation_id
    ) u
   where u.creation_id = c.id;
  perform set_config('vg.privileged', 'off', true);
end
$backfill$;

-- ------------------------------------------------------------
-- 10. The explainer thread
-- ------------------------------------------------------------
-- Same reasoning as Start Here and Ideas: a thread rather than a static
-- page, so anyone confused can ask underneath it.
do $mig$
declare
  v_cat   uuid;
  v_admin uuid;
  v_title text := 'Updates: telling people what you changed';
begin
  select id into v_cat   from public.forum_categories where slug = 'general';
  select id into v_admin from public.profiles where role = 'admin' order by created_at limit 1;

  if v_cat is null or v_admin is null then
    raise notice 'Missing general category or admin profile - skipping updates explainer.';
    return;
  end if;

  if not exists (select 1 from public.forum_threads where category_id = v_cat and title = v_title) then
    insert into public.forum_threads (category_id, author_id, title, body, is_pinned)
    values (v_cat, v_admin, v_title, $g$Your submissions now have an **Updates** section, under the description.

**What it is**

Your devlog for that project. Only you can post to it. "v2 is up — enemies are harder, and the music no longer loops wrong." That is a whole update. It does not need to be an essay.

**Why bother**

A submission with no updates looks like a link somebody dropped once and forgot. A submission with four updates looks like something a person is still building — and people are far more willing to try a thing that is visibly alive. It also closes the loop on Ideas: somebody suggests a leaderboard, you mark it Built, and the update is where you say it shipped.

**Two things worth knowing**

- Posting an update does **not** push your submission back up the newest list. That is deliberate. If it did, the way to the top of the front page would be to spam your own devlog, and the charts would stop meaning anything.
- Everyone can read it, including people who are not signed in. Write it for a curious stranger, not for people who already know your project.

**A decent update**

> **v1.3 — the squirrel can now jump**
> Turns out he could not, which explains the reviews. Also fixed the bit where the score reset if you paused.

Short, says what changed, slightly funny about your own mistakes. That is the whole format.$g$, true);
  end if;
end
$mig$;
