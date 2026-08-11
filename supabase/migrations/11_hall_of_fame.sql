-- ============================================================
-- 11_hall_of_fame.sql
--
-- The cold-start problem, solved honestly.
--
-- A scoring site with nothing to score is an empty room. Rather than invent
-- users and submissions (which reads as tacky the moment anyone looks twice),
-- this table holds *curated external projects* — real AI-built things made by
-- other people, credited to them, linking out to them.
--
-- The hard rule enforced below: every entry must carry a `source_url` proving
-- the attribution. If we cannot cite where we learned a project was AI-built,
-- it does not go on the wall. That constraint is the whole point — it is what
-- separates a credible hall of fame from a made-up list.
--
-- These never appear in the member charts and cannot be voted on. They are
-- clearly a different kind of object, and the UI labels them as such.
-- ============================================================

create table if not exists public.hall_of_fame (
  id            uuid primary key default gen_random_uuid(),
  rank          int  not null,
  title         text not null,
  creator       text not null,               -- the human who made it, credited
  creator_url   text,                         -- their profile, if we have one
  project_url   text not null,                -- where to go and look at it
  blurb         text not null,                -- one honest sentence
  category      text not null default 'other',
  built_with    text,                         -- "Claude Code", "Cursor", "Lovable"
  source_url    text not null,                -- WHERE WE LEARNED THIS. Required.
  source_label  text,                         -- "creator's post on X", "README"
  added_at      timestamptz not null default now(),
  is_active     boolean not null default true,

  constraint hof_rank_positive check (rank > 0),
  -- Belt and braces: a blank string would satisfy `not null`.
  constraint hof_source_real  check (length(trim(source_url)) > 8),
  constraint hof_project_real check (length(trim(project_url)) > 8)
);

create unique index if not exists hall_of_fame_rank_idx
  on public.hall_of_fame (rank) where is_active;

alter table public.hall_of_fame enable row level security;

-- Anyone may read the wall.
drop policy if exists hof_read on public.hall_of_fame;
create policy hof_read on public.hall_of_fame
  for select using (is_active);

-- Only staff may change it. No INSERT/UPDATE/DELETE policy exists for members,
-- so the table is append-only from the dashboard and unreachable from the app.
drop policy if exists hof_staff_all on public.hall_of_fame;
create policy hof_staff_all on public.hall_of_fame
  for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'mod')
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'mod')
  ));

-- ------------------------------------------------------------
-- Adding an entry. Renumbers nothing — you pass the rank you want, and the
-- unique index stops you quietly creating two #7s.
-- ------------------------------------------------------------
create or replace function public.add_hall_of_fame(
  p_rank        int,
  p_title       text,
  p_creator     text,
  p_project_url text,
  p_blurb       text,
  p_source_url  text,
  p_category    text default 'other',
  p_built_with  text default null,
  p_creator_url text default null,
  p_source_label text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'mod')
  ) and coalesce(current_setting('vg.privileged', true), 'off') <> 'on' then
    raise exception 'Staff only';
  end if;

  if coalesce(trim(p_source_url), '') = '' then
    raise exception 'Every hall of fame entry needs a source URL for its attribution';
  end if;

  insert into public.hall_of_fame
    (rank, title, creator, creator_url, project_url, blurb,
     category, built_with, source_url, source_label)
  values
    (p_rank, trim(p_title), trim(p_creator), p_creator_url, trim(p_project_url),
     trim(p_blurb), coalesce(p_category, 'other'), p_built_with,
     trim(p_source_url), p_source_label)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.add_hall_of_fame(int, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.add_hall_of_fame(int, text, text, text, text, text, text, text, text, text) to authenticated;

comment on table public.hall_of_fame is
  'Curated external AI-built projects, credited to their real makers. Every row '
  'must cite where the attribution came from. Never mixed into member charts.';
