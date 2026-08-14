-- ============================================================
-- VIBEGROUNDS — 19: IDEAS (community suggestions on a creation)
-- ============================================================
-- A review says what a thing is worth. An idea says what it could become.
-- Those are different enough to deserve different boxes: reviews are a
-- verdict aimed at other visitors, ideas are a to-do list aimed at the
-- creator. Mixing them means the useful "add a leaderboard" gets buried
-- under "3/5, quite fun".
--
-- Three rules shape the whole design:
--
--   1. The creator is in charge. accepts_ideas can be switched off, and
--      when it is off nothing can be posted — enforced in the policy, not
--      just hidden in the UI, or the API is an open door.
--   2. The community ranks. Anyone can upvote, so the best idea rises
--      instead of the earliest one winning by default.
--   3. The creator answers. Marking an idea Planned or Built is what turns
--      a suggestion box into something that visibly develops. Without that
--      loop nobody bothers suggesting twice.
--
-- The optional `prompt` field is the vibe-coding bit: an idea can carry a
-- prompt the creator can copy straight into whatever built the thing.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The opt-out
-- ------------------------------------------------------------
-- Default true: a feature nobody can find is a feature nobody uses, and
-- the toggle to switch it off sits right on the edit form. Deliberately
-- NOT added to guard_creation_columns — the creator must be able to change
-- this one, which is precisely the difference between it and `score`.
alter table public.creations
  add column if not exists accepts_ideas boolean not null default true;

-- ------------------------------------------------------------
-- 2. Ideas
-- ------------------------------------------------------------
create table if not exists public.creation_ideas (
  id          uuid primary key default gen_random_uuid(),
  creation_id uuid not null references public.creations(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,

  body        text not null check (char_length(body) between 4 and 1000),
  -- Optional. Long, because a good prompt is not a sentence.
  prompt      text not null default '' check (char_length(prompt) <= 2000),

  --   open     nobody has responded yet
  --   planned  the creator intends to do it
  --   built    it is in the thing now
  --   declined a polite no, kept visible so it is not suggested again
  --   removed  moderated away
  status      text not null default 'open'
              check (status in ('open','planned','built','declined','removed')),

  vote_count  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_ideas_creation on public.creation_ideas (creation_id, vote_count desc, created_at desc);

-- One idea per person per creation would be too strict (someone may have
-- three good ones) but the same body twice is always a mistake.
create unique index if not exists idx_ideas_no_dupe
  on public.creation_ideas (creation_id, author_id, md5(lower(body)));

-- ------------------------------------------------------------
-- 3. Upvotes
-- ------------------------------------------------------------
-- Composite primary key does the "one vote per person" work for free, and
-- makes the un-vote a plain delete.
create table if not exists public.idea_votes (
  idea_id    uuid not null references public.creation_ideas(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

-- Keep the denormalised count honest. Same approach as creation scores:
-- recount rather than increment, so a double-fire or a manual fiddle in the
-- SQL editor cannot drift the number permanently.
create or replace function public.recalc_idea_votes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_idea uuid;
begin
  v_idea := coalesce(new.idea_id, old.idea_id);
  perform set_config('vg.privileged', 'on', true);
  update public.creation_ideas
     set vote_count = (select count(*) from public.idea_votes where idea_id = v_idea)
   where id = v_idea;
  perform set_config('vg.privileged', 'off', true);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_recalc_idea_votes on public.idea_votes;
create trigger trg_recalc_idea_votes
  after insert or delete on public.idea_votes
  for each row execute function public.recalc_idea_votes();

-- ------------------------------------------------------------
-- 4. Column guard
-- ------------------------------------------------------------
-- RLS decides which ROWS you may touch; it cannot stop you touching the
-- wrong COLUMN of a row you are allowed to touch. Without this, the idea's
-- author could set their own vote_count to 500, or mark their own idea as
-- "built" on someone else's project. So: authors own the words, the
-- creation's owner owns the status, and nobody owns the count.
create or replace function public.guard_idea_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_owner uuid;
begin
  if public.caller_is_privileged() or public.is_staff() then
    return new;
  end if;

  select creator_id into v_owner from public.creations where id = old.creation_id;

  -- The count is only ever set by the vote trigger above.
  new.vote_count  := old.vote_count;
  new.creation_id := old.creation_id;
  new.author_id   := old.author_id;
  new.created_at  := old.created_at;

  -- Status belongs to the person whose project it is.
  if auth.uid() is distinct from v_owner then
    new.status := old.status;
  end if;

  -- The words belong to whoever wrote them.
  if auth.uid() is distinct from old.author_id then
    new.body   := old.body;
    new.prompt := old.prompt;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_idea_columns on public.creation_ideas;
create trigger trg_guard_idea_columns
  before update on public.creation_ideas
  for each row execute function public.guard_idea_columns();

-- ------------------------------------------------------------
-- 5. Row level security
-- ------------------------------------------------------------
alter table public.creation_ideas enable row level security;
alter table public.idea_votes     enable row level security;

drop policy if exists "Ideas are public" on public.creation_ideas;
create policy "Ideas are public"
  on public.creation_ideas for select
  using (status <> 'removed' or auth.uid() = author_id or public.is_staff());

-- The accepts_ideas check lives here, not only in the UI. Hiding a form
-- stops honest people; a policy stops everyone.
drop policy if exists "Verified members can suggest" on public.creation_ideas;
create policy "Verified members can suggest"
  on public.creation_ideas for insert
  with check (
    auth.uid() = author_id
    and public.is_active_member()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_muted)
    and exists (
      select 1 from public.creations c
       where c.id = creation_id
         and c.accepts_ideas
         and c.status = 'published'
    )
  );

-- Author edits the wording, creation owner sets the status. Which of those
-- two you actually are is sorted out by the guard trigger above.
drop policy if exists "Authors and owners can update ideas" on public.creation_ideas;
create policy "Authors and owners can update ideas"
  on public.creation_ideas for update
  using (
    status <> 'removed'
    and (
      auth.uid() = author_id
      or auth.uid() = (select creator_id from public.creations where id = creation_id)
    )
  )
  with check (
    auth.uid() = author_id
    or auth.uid() = (select creator_id from public.creations where id = creation_id)
  );

drop policy if exists "Staff can moderate ideas" on public.creation_ideas;
create policy "Staff can moderate ideas"
  on public.creation_ideas for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Authors and staff can delete ideas" on public.creation_ideas;
create policy "Authors and staff can delete ideas"
  on public.creation_ideas for delete
  using (auth.uid() = author_id or public.is_staff());

drop policy if exists "Idea votes are public" on public.idea_votes;
create policy "Idea votes are public"
  on public.idea_votes for select using (true);

drop policy if exists "Members can upvote ideas" on public.idea_votes;
create policy "Members can upvote ideas"
  on public.idea_votes for insert
  with check (auth.uid() = user_id and public.is_active_member());

drop policy if exists "Members can take back an upvote" on public.idea_votes;
create policy "Members can take back an upvote"
  on public.idea_votes for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 6. Reading view
-- ------------------------------------------------------------
-- Joins the author on so the board does not need a second round trip, and
-- exposes has_voted for the current viewer so the arrow can render filled
-- without every client counting rows itself.
create or replace view public.creation_ideas_public
with (security_invoker = on) as
select
  i.id, i.creation_id, i.author_id, i.body, i.prompt, i.status,
  i.vote_count, i.created_at, i.updated_at,
  p.username   as author_username,
  p.avatar_url as author_avatar,
  exists (
    select 1 from public.idea_votes v
     where v.idea_id = i.id and v.user_id = auth.uid()
  ) as has_voted
from public.creation_ideas i
join public.profiles p on p.id = i.author_id
where i.status <> 'removed';

grant select on public.creation_ideas_public to anon, authenticated;

-- Explicit rather than relying on Supabase's default privileges, so this
-- migration works the same on a fresh project as on this one. RLS above is
-- what actually decides who may do what; these only open the door.
grant select, insert, update, delete on public.creation_ideas to authenticated;
grant select                         on public.creation_ideas to anon;
grant select, insert, delete         on public.idea_votes     to authenticated;
grant select                         on public.idea_votes     to anon;

-- ------------------------------------------------------------
-- 7. Expose the opt-out to the front end
-- ------------------------------------------------------------
-- Appended at the very end. CREATE OR REPLACE VIEW can add columns but
-- never reorder them, so inserting accepts_ideas mid-list would fail.
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
  c.accepts_ideas
from public.creations c
join public.profiles p   on p.id = c.creator_id
left join public.categories cat on cat.slug = c.category
where c.status = 'published';

-- ------------------------------------------------------------
-- 8. The explainer thread
-- ------------------------------------------------------------
-- Same reasoning as the Start Here guides: a forum thread rather than a
-- static page, so anyone confused by the feature can ask underneath it.
do $mig$
declare
  v_cat   uuid;
  v_admin uuid;
  v_title text := 'Ideas: how to help someone improve what they built';
begin
  select id into v_cat   from public.forum_categories where slug = 'general';
  select id into v_admin from public.profiles where role = 'admin' order by created_at limit 1;

  if v_cat is null or v_admin is null then
    raise notice 'Missing general category or admin profile - skipping ideas explainer.';
    return;
  end if;

  if not exists (select 1 from public.forum_threads where category_id = v_cat and title = v_title) then
    insert into public.forum_threads (category_id, author_id, title, body, is_pinned)
    values (v_cat, v_admin, v_title, $g$Every submission now has an **Ideas** box under the reviews.

**What it is for**

A review is a verdict — "3/5, quite fun". An idea is a suggestion — "add a leaderboard and people will come back". Both are useful, but they are different jobs, so they now have different boxes. Ideas are aimed at the creator, not at other visitors.

**How it works**

- Anyone verified can post an idea on a submission.
- You can attach a **prompt** — the actual thing the creator could paste into Claude, Cursor, or whatever they built it with. This is the good bit. "Make the enemies harder" is a comment; a prompt they can run is a contribution.
- Everyone can upvote. Best idea rises, rather than the earliest one winning.
- The creator marks each idea **Planned**, **Built**, or **Not for me**.

That last part is the whole point. Watching a submission go from "someone suggested a leaderboard" to a Built tag is the thing that makes this place feel alive rather than a wall of links.

**If you do not want ideas on your submission**

Turn them off. Edit your creation and untick "Open to ideas". The box disappears and nobody can post to it — that is enforced by the database, not just hidden.

Nobody has to accept suggestions on their own work, and nobody should feel bad about switching it off. Some things are finished.

**Please do not**

- Post "make it better". That is not an idea.
- Post the same idea somebody already posted. Upvote theirs instead.
- Take a Not for me personally. It is their project.

Rules apply here exactly as they do everywhere else: be decent, or a moderator will remove it.$g$, true);
  end if;
end
$mig$;
