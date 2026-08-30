-- ============================================================
-- 39 — SERIES, VOLUMES AND EDITIONS FOR COMICS
-- ============================================================
-- Kieran's ask: an artist should be able to say "this one is 1 of
-- 3", and clicking that should open a page holding the whole run
-- so somebody can read it in order.
--
-- WHY A TABLE AND NOT A TEXT COLUMN
--
-- The cheap version is a `series_name` column on comics and a
-- listing that groups by it. It falls apart quickly: "Ant Saga"
-- and "Ant saga " are two different runs, there is nowhere to put
-- a description of the series itself, and renaming it means
-- editing every comic in it. A series is a thing on the site with
-- its own page, so it gets its own row.
--
-- The posting form still only asks for a name. Type one you have
-- used before and the comic joins that series; type a new one and
-- the series is created. The artist never has to think about
-- whether a series "exists" — see set_comic_series below.
--
-- WHAT "1 of 3" MEANS
--
-- Two different numbers, and conflating them is the usual bug:
--   edition_number  where this comic sits in the run
--   planned_count   how many the artist intends there to be
--
-- planned_count is optional. Set it and the page can honestly say
-- "1 of 3" while only one exists. Leave it and the series page
-- counts what is actually there. Deriving the total from the row
-- count alone would print "1 of 1" on the first part of a trilogy,
-- which is worse than saying nothing.
-- ============================================================


create table if not exists public.comic_series (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.profiles(id) on delete cascade,

  title       text not null check (char_length(btrim(title)) between 2 and 120),
  -- What the series page lives at: /comics/series/<slug>
  slug        text not null unique,
  description text not null default '' check (char_length(description) <= 1000),

  -- Null when the artist has not said how long the run will be.
  planned_count int check (planned_count is null or planned_count between 1 and 500),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_comic_series_creator
  on public.comic_series (creator_id, created_at desc);

comment on table public.comic_series is
  'A run of comics by one artist. Created on demand by set_comic_series when somebody types a name that is not already theirs.';


alter table public.comics
  add column if not exists series_id      uuid references public.comic_series(id) on delete set null,
  add column if not exists edition_number int,
  add column if not exists edition_label  text;

-- `on delete set null`, never cascade. Deleting a series must not
-- delete the comics in it — somebody tidying up their series list
-- would otherwise destroy the actual work.
alter table public.comics
  drop constraint if exists comics_edition_number_check;
alter table public.comics
  add constraint comics_edition_number_check
  check (edition_number is null or edition_number between 1 and 5000);

alter table public.comics
  drop constraint if exists comics_edition_label_check;
alter table public.comics
  add constraint comics_edition_label_check
  check (edition_label is null or char_length(edition_label) <= 40);

-- Deliberately NOT unique on (series_id, edition_number). An artist
-- who wants a 2a and a 2b, or who is midway through renumbering,
-- should not be stopped by the database. The ordering below is
-- fully determined regardless, so duplicates look tidy rather than
-- random.
create index if not exists idx_comics_series
  on public.comics (series_id, edition_number nulls last, created_at);

comment on column public.comics.edition_number is
  'Where this sits in its series. Null means it is in the series but unnumbered.';
comment on column public.comics.edition_label is
  'Optional wording for the number — "Volume", "Book", "Part". Just the noun; the number is edition_number.';


-- ------------------------------------------------------------
-- SLUGS
--
-- Lower case, letters digits and hyphens, no leading or trailing
-- hyphen, never empty, and unique across the site because it is
-- the whole URL. A title of nothing but punctuation still has to
-- produce something addressable, hence the fallback.
-- ------------------------------------------------------------
create or replace function public.comic_series_slug(p_title text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_base text;
  v_try  text;
  v_n    int := 1;
begin
  v_base := lower(btrim(coalesce(p_title, '')));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := btrim(v_base, '-');
  v_base := left(v_base, 60);
  if v_base = '' then v_base := 'series'; end if;

  v_try := v_base;
  while exists (select 1 from public.comic_series s where s.slug = v_try) loop
    v_n := v_n + 1;
    v_try := left(v_base, 60 - char_length(v_n::text) - 1) || '-' || v_n::text;
  end loop;

  return v_try;
end;
$$;


-- ------------------------------------------------------------
-- PUT A COMIC IN A SERIES
--
-- One call does everything the form needs: finds the artist's
-- series by name, creates it if this is a new name, and records
-- where the comic sits in it.
--
-- Matching is case-insensitive on the trimmed title and scoped to
-- the caller, so "ant saga" joins their existing "Ant Saga" rather
-- than making a second one — the mistake a plain text column makes
-- constantly. It cannot join somebody else's series: two artists
-- may both have a series called "Volume One" without colliding,
-- and neither can post into the other's run.
-- ------------------------------------------------------------
create or replace function public.set_comic_series(
  p_comic   uuid,
  p_series  text,
  p_edition int  default null,
  p_label   text default null,
  p_planned int  default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_owner  uuid;
  v_name   text := btrim(coalesce(p_series, ''));
  v_series uuid;
  v_slug   text;
begin
  if v_uid is null then
    raise exception 'Sign in first.';
  end if;

  select creator_id into v_owner from public.comics where id = p_comic;
  if not found then
    raise exception 'That comic was not found.';
  end if;
  if v_owner <> v_uid then
    raise exception 'That is not your comic.';
  end if;

  -- An empty name means "take this out of its series". The series
  -- itself stays, because other comics may be in it.
  if v_name = '' then
    update public.comics
       set series_id = null, edition_number = null, edition_label = null,
           updated_at = now()
     where id = p_comic;
    return json_build_object('series', null);
  end if;

  if char_length(v_name) < 2 then
    raise exception 'A series name needs at least two characters.';
  end if;

  select id into v_series
    from public.comic_series
   where creator_id = v_uid and lower(btrim(title)) = lower(v_name)
   limit 1;

  if v_series is null then
    v_slug := public.comic_series_slug(v_name);
    insert into public.comic_series (creator_id, title, slug, planned_count)
    values (v_uid, v_name, v_slug, p_planned)
    returning id into v_series;
  elsif p_planned is not null then
    update public.comic_series
       set planned_count = p_planned, updated_at = now()
     where id = v_series;
  end if;

  update public.comics
     set series_id      = v_series,
         edition_number = p_edition,
         edition_label  = nullif(btrim(coalesce(p_label, '')), ''),
         updated_at     = now()
   where id = p_comic;

  return (select json_build_object(
            'series_id', s.id, 'title', s.title, 'slug', s.slug,
            'planned_count', s.planned_count,
            'edition_number', p_edition)
          from public.comic_series s where s.id = v_series);
end;
$$;

revoke all on function public.set_comic_series(uuid, text, int, text, int) from public, anon, authenticated;
grant execute on function public.set_comic_series(uuid, text, int, text, int) to authenticated;


-- ------------------------------------------------------------
-- EDIT THE SERIES ITSELF
-- ------------------------------------------------------------
create or replace function public.update_comic_series(
  p_series      uuid,
  p_title       text default null,
  p_description text default null,
  p_planned     int  default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;

  select creator_id into v_owner from public.comic_series where id = p_series;
  if not found then raise exception 'That series was not found.'; end if;
  if v_owner <> v_uid then raise exception 'That is not your series.'; end if;

  update public.comic_series
     set title         = coalesce(nullif(btrim(p_title), ''), title),
         description   = coalesce(p_description, description),
         -- -1 is how the form says "clear this", since null already
         -- means "leave it alone" for every other argument here.
         planned_count = case when p_planned = -1 then null
                              else coalesce(p_planned, planned_count) end,
         updated_at    = now()
   where id = p_series;

  -- The slug is deliberately left alone on a rename. Somebody may
  -- have shared the old link, and quietly breaking it to tidy a URL
  -- is a bad trade.
  return (select json_build_object('id', id, 'title', title, 'slug', slug,
                                   'description', description,
                                   'planned_count', planned_count)
          from public.comic_series where id = p_series);
end;
$$;

revoke all on function public.update_comic_series(uuid, text, text, int) from public, anon, authenticated;
grant execute on function public.update_comic_series(uuid, text, text, int) to authenticated;


-- ------------------------------------------------------------
-- THE SERIES PAGE
--
-- Readable signed out: a series is something you would share.
-- Removed comics are left out, but they still count against the
-- numbering the artist chose, which is why the editions are
-- ordered by edition_number rather than renumbered on the fly.
-- ------------------------------------------------------------
create or replace function public.comic_series_page(p_slug text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_out json;
begin
  select json_build_object(
    'id',            s.id,
    'title',         s.title,
    'slug',          s.slug,
    'description',   s.description,
    'planned_count', s.planned_count,
    'created_at',    s.created_at,
    'creator', json_build_object(
      'id', p.id, 'username', p.username, 'avatar_url', p.avatar_url),
    'editions', coalesce((
      select json_agg(json_build_object(
               'id',             c.id,
               'title',          c.title,
               'cover_url',      c.cover_url,
               'page_count',     c.page_count,
               'view_count',     c.view_count,
               'score',          c.score,
               'vote_count',     c.vote_count,
               'is_nsfw',        c.is_nsfw,
               'edition_number', c.edition_number,
               'edition_label',  c.edition_label,
               'created_at',     c.created_at)
             order by c.edition_number nulls last, c.created_at)
      from public.comics c
      where c.series_id = s.id and c.status = 'published'
    ), '[]'::json)
  ) into v_out
  from public.comic_series s
  join public.profiles p on p.id = s.creator_id
  where s.slug = p_slug;

  return v_out;   -- null when there is no such series; the page says so
end;
$$;

grant execute on function public.comic_series_page(text) to anon, authenticated;

comment on function public.comic_series_page(text) is
  'Everything the series page needs, in one call. Readable signed out.';


-- ------------------------------------------------------------
-- THE ARTIST'S OWN SERIES, for the picker on the posting form
-- ------------------------------------------------------------
create or replace function public.my_comic_series()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return '[]'::json; end if;

  return coalesce((
    select json_agg(json_build_object(
             'id', s.id, 'title', s.title, 'slug', s.slug,
             'planned_count', s.planned_count,
             'count', (select count(*) from public.comics c
                        where c.series_id = s.id and c.status = 'published'),
             'next', coalesce((select max(c.edition_number) + 1 from public.comics c
                                where c.series_id = s.id), 1))
           order by s.updated_at desc)
    from public.comic_series s
    where s.creator_id = v_uid
  ), '[]'::json);
end;
$$;

revoke all on function public.my_comic_series() from public, anon;
grant execute on function public.my_comic_series() to authenticated;


-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.comic_series enable row level security;

drop policy if exists "Series are publicly readable" on public.comic_series;
create policy "Series are publicly readable"
  on public.comic_series for select using (true);

drop policy if exists "Artists manage their own series" on public.comic_series;
create policy "Artists manage their own series"
  on public.comic_series for update
  using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

drop policy if exists "Artists delete their own series" on public.comic_series;
create policy "Artists delete their own series"
  on public.comic_series for delete
  using (auth.uid() = creator_id);

-- No insert policy: series are only ever created by
-- set_comic_series(), which runs as the owner and checks the caller
-- owns the comic first. Letting the table be written directly would
-- allow a series with no comic in it and no way to reach it.
grant select on public.comic_series to anon, authenticated;
grant update, delete on public.comic_series to authenticated;


-- ------------------------------------------------------------
-- comics_public carries the series with it
--
-- Redefined rather than altered: a view's column list cannot be
-- extended in place. Every existing column keeps its name and
-- position, so nothing that already selects from this breaks.
-- ------------------------------------------------------------
create or replace view public.comics_public
with (security_invoker = on) as
select
  c.id, c.creator_id, c.title, c.description, c.cover_url,
  c.is_nsfw, c.page_count, c.view_count, c.created_at, c.updated_at,
  p.username   as creator_username,
  p.avatar_url as creator_avatar,
  c.score, c.vote_count,
  c.series_id,
  c.edition_number,
  c.edition_label,
  s.title as series_title,
  s.slug  as series_slug,
  s.planned_count as series_planned_count
from public.comics c
join public.profiles p on p.id = c.creator_id
left join public.comic_series s on s.id = c.series_id
where c.status = 'published';

grant select on public.comics_public to anon, authenticated;

notify pgrst, 'reload schema';
