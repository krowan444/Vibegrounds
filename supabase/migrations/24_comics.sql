-- ============================================================
-- VIBEGROUNDS — 24: COMICS
-- ============================================================
-- A comic is not a creation with a link on it, and it is not a meme. It is
-- an ordered run of images that has to be read in sequence, which is a
-- shape neither existing table can hold: creations point at somebody else's
-- URL, and a meme is exactly one picture.
--
-- So: `comics` is the book, `comic_pages` are the pages, and the position
-- column is the whole point. Everything else follows from getting the order
-- right and never letting it go wrong.
--
-- Three decisions worth keeping:
--
--   1. A comic is submitted whole, through one function, or not at all.
--      Uploading images then inserting rows one by one from the browser
--      means a dropped connection leaves a half-built comic in public with
--      pages missing from the middle. submit_comic() takes the finished
--      list and writes it in a single transaction.
--   2. Page numbers are unique per comic, but DEFERRABLE — so a reorder can
--      shuffle several rows inside one transaction without tripping over
--      itself halfway through.
--   3. Any page size is accepted. Comics arrive as scans, as phone photos,
--      as tall webtoon strips; the reader fits each page to the screen
--      rather than making the artist crop to a house format.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The book
-- ------------------------------------------------------------
create table if not exists public.comics (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.profiles(id) on delete cascade,

  title       text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 2000),

  -- Page one, copied here so a listing never has to join the pages table
  -- just to show a thumbnail.
  cover_url   text not null default '',

  is_nsfw     boolean not null default false,

  --   published  visible
  --   removed    moderated away, kept for the audit trail
  status      text not null default 'published'
              check (status in ('published','removed')),

  page_count  int not null default 0,
  view_count  int not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_comics_newest
  on public.comics (status, created_at desc);
create index if not exists idx_comics_creator
  on public.comics (creator_id, created_at desc);

-- ------------------------------------------------------------
-- 2. The pages
-- ------------------------------------------------------------
create table if not exists public.comic_pages (
  id        uuid primary key default gen_random_uuid(),
  comic_id  uuid not null references public.comics(id) on delete cascade,

  -- 1-based, because that is how anybody talks about a page of a comic.
  position  int not null check (position between 1 and 200),

  image_url text not null check (char_length(image_url) between 8 and 1000),

  -- Recorded at upload so the reader can reserve the right amount of space
  -- before the image arrives. Without it every page load shoves the layout
  -- around as each picture pops in.
  width     int,
  height    int,

  created_at timestamptz not null default now()
);

create index if not exists idx_comic_pages_order
  on public.comic_pages (comic_id, position);

-- Deferrable so a reorder can move several pages within one transaction.
-- A plain unique index rejects the intermediate state where two pages are
-- briefly both page 3, which makes any swap impossible without a temporary
-- position nobody wants to invent.
do $$
begin
  alter table public.comic_pages
    add constraint comic_pages_unique_position
    unique (comic_id, position) deferrable initially deferred;
exception
  when duplicate_table then null;
  when duplicate_object then null;
end
$$;

-- ------------------------------------------------------------
-- 3. Keep page_count and the cover honest
-- ------------------------------------------------------------
create or replace function public.recalc_comic_pages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_comic uuid;
begin
  v_comic := coalesce(new.comic_id, old.comic_id);
  perform set_config('vg.privileged', 'on', true);
  update public.comics c
     set page_count = (select count(*) from public.comic_pages where comic_id = v_comic),
         cover_url  = coalesce(
           (select image_url from public.comic_pages
             where comic_id = v_comic order by position limit 1), ''),
         updated_at = now()
   where c.id = v_comic;
  perform set_config('vg.privileged', 'off', true);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_recalc_comic_pages on public.comic_pages;
create trigger trg_recalc_comic_pages
  after insert or update or delete on public.comic_pages
  for each row execute function public.recalc_comic_pages();

-- ------------------------------------------------------------
-- 4. Column guard
-- ------------------------------------------------------------
-- Same reasoning as everywhere else: RLS picks the rows, this picks the
-- columns. Without it a creator could set their own view_count, hand the
-- comic to somebody else, or un-remove one a moderator had hidden.
create or replace function public.guard_comic_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.caller_is_privileged() or public.is_staff() then
    return new;
  end if;

  new.creator_id := old.creator_id;
  new.page_count := old.page_count;
  new.view_count := old.view_count;
  new.cover_url  := old.cover_url;
  new.status     := old.status;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_comic_columns on public.comics;
create trigger trg_guard_comic_columns
  before update on public.comics
  for each row execute function public.guard_comic_columns();

-- ------------------------------------------------------------
-- 5. Row level security
-- ------------------------------------------------------------
alter table public.comics      enable row level security;
alter table public.comic_pages enable row level security;

drop policy if exists "Comics are public" on public.comics;
create policy "Comics are public"
  on public.comics for select
  using (status <> 'removed' or auth.uid() = creator_id or public.is_staff());

-- Insert goes through submit_comic() in practice, but the policy has to
-- stand on its own: the function is not the only door to the table.
drop policy if exists "Verified members can post comics" on public.comics;
create policy "Verified members can post comics"
  on public.comics for insert
  with check (
    auth.uid() = creator_id
    and public.is_active_member()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_muted)
  );

drop policy if exists "Creators can edit their comics" on public.comics;
create policy "Creators can edit their comics"
  on public.comics for update
  using (status <> 'removed' and auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

drop policy if exists "Staff can moderate comics" on public.comics;
create policy "Staff can moderate comics"
  on public.comics for update
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Creators and staff can delete comics" on public.comics;
create policy "Creators and staff can delete comics"
  on public.comics for delete
  using (auth.uid() = creator_id or public.is_staff());

-- Pages inherit their permissions from the book they belong to. Checking
-- the parent rather than storing a second copy of the owner means the two
-- can never disagree.
drop policy if exists "Comic pages are public" on public.comic_pages;
create policy "Comic pages are public"
  on public.comic_pages for select
  using (exists (
    select 1 from public.comics c
     where c.id = comic_id
       and (c.status <> 'removed' or auth.uid() = c.creator_id or public.is_staff())
  ));

drop policy if exists "Creators manage their comic pages" on public.comic_pages;
create policy "Creators manage their comic pages"
  on public.comic_pages for insert
  with check (exists (
    select 1 from public.comics c where c.id = comic_id and c.creator_id = auth.uid()
  ));

drop policy if exists "Creators update their comic pages" on public.comic_pages;
create policy "Creators update their comic pages"
  on public.comic_pages for update
  using (exists (select 1 from public.comics c where c.id = comic_id and c.creator_id = auth.uid()))
  with check (exists (select 1 from public.comics c where c.id = comic_id and c.creator_id = auth.uid()));

drop policy if exists "Creators delete their comic pages" on public.comic_pages;
create policy "Creators delete their comic pages"
  on public.comic_pages for delete
  using (
    exists (select 1 from public.comics c where c.id = comic_id and c.creator_id = auth.uid())
    or public.is_staff()
  );

-- ------------------------------------------------------------
-- 6. Submit a whole comic, or none of it
-- ------------------------------------------------------------
-- p_pages is an array of image URLs already uploaded to storage, in reading
-- order. Positions are assigned here from the array index rather than
-- trusted from the client, so the order the artist arranged is the order
-- that lands in the database.
create or replace function public.submit_comic(
  p_title       text,
  p_description text default '',
  p_is_nsfw     boolean default false,
  p_pages       text[] default '{}',
  p_widths      int[]  default '{}',
  p_heights     int[]  default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comic uuid;
  v_uid   uuid := auth.uid();
  i       int;
begin
  if v_uid is null then
    raise exception 'You must be signed in to post a comic.';
  end if;
  if not public.is_active_member() then
    raise exception 'Confirm your email address before posting.';
  end if;
  if exists (select 1 from public.profiles p where p.id = v_uid and p.is_muted) then
    raise exception 'Your account cannot post at the moment.';
  end if;
  if coalesce(array_length(p_pages, 1), 0) < 1 then
    raise exception 'A comic needs at least one page.';
  end if;
  if array_length(p_pages, 1) > 200 then
    raise exception 'A comic can have at most 200 pages.';
  end if;

  insert into public.comics (creator_id, title, description, is_nsfw)
  values (v_uid, btrim(p_title), coalesce(btrim(p_description), ''), coalesce(p_is_nsfw, false))
  returning id into v_comic;

  for i in 1 .. array_length(p_pages, 1) loop
    insert into public.comic_pages (comic_id, position, image_url, width, height)
    values (
      v_comic,
      i,
      p_pages[i],
      nullif(coalesce(p_widths[i],  0), 0),
      nullif(coalesce(p_heights[i], 0), 0)
    );
  end loop;

  return v_comic;
end;
$$;

revoke all on function public.submit_comic(text, text, boolean, text[], int[], int[]) from public;
grant execute on function public.submit_comic(text, text, boolean, text[], int[], int[]) to authenticated;

-- ------------------------------------------------------------
-- 7. Count a read
-- ------------------------------------------------------------
create or replace function public.register_comic_view(p_comic uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('vg.privileged', 'on', true);
  update public.comics set view_count = view_count + 1 where id = p_comic;
  perform set_config('vg.privileged', 'off', true);
end;
$$;

grant execute on function public.register_comic_view(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 8. Reading views
-- ------------------------------------------------------------
create or replace view public.comics_public
with (security_invoker = on) as
select
  c.id, c.creator_id, c.title, c.description, c.cover_url,
  c.is_nsfw, c.page_count, c.view_count, c.created_at, c.updated_at,
  p.username   as creator_username,
  p.avatar_url as creator_avatar
from public.comics c
join public.profiles p on p.id = c.creator_id
where c.status = 'published';

create or replace view public.comic_pages_public
with (security_invoker = on) as
select pg.id, pg.comic_id, pg.position, pg.image_url, pg.width, pg.height
from public.comic_pages pg
join public.comics c on c.id = pg.comic_id
where c.status = 'published';

grant select on public.comics_public      to anon, authenticated;
grant select on public.comic_pages_public to anon, authenticated;

grant select, insert, update, delete on public.comics      to authenticated;
grant select                         on public.comics      to anon;
grant select, insert, update, delete on public.comic_pages to authenticated;
grant select                         on public.comic_pages to anon;

-- ------------------------------------------------------------
-- 9. Storage
-- ------------------------------------------------------------
-- 10MB a page: a comic page is a full-bleed illustration, several times the
-- weight of a meme, and asking an artist to compress below that is asking
-- them to degrade the thing they came here to show.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comics', 'comics', true, 10485760,
  array['image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do update
  set public             = true,
      file_size_limit    = 10485760,
      allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif'];

drop policy if exists "Comic pages are publicly readable" on storage.objects;
drop policy if exists "Members upload their own comics"   on storage.objects;
drop policy if exists "Members update their own comics"   on storage.objects;
drop policy if exists "Members delete their own comics"   on storage.objects;

create policy "Comic pages are publicly readable"
  on storage.objects for select
  using (bucket_id = 'comics');

-- Namespaced comics/<uid>/<file>, same as memes: the folder check stops
-- anyone writing into someone else's space or overwriting their art.
create policy "Members upload their own comics"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comics'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Members update their own comics"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'comics'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Members delete their own comics"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'comics'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- 10. Let people report a comic
-- ------------------------------------------------------------
-- reports.target_type is a closed list, and a new content type has to be
-- added to it or the report button fails against a check constraint the
-- moment somebody presses it — a moderation hole that looks like a working
-- button. Same for the moderation log on the other side.
alter table public.reports
  drop constraint if exists reports_target_type_check;
alter table public.reports
  add constraint reports_target_type_check
  check (target_type in ('creation','review','thread','post','profile','comic'));

alter table public.moderation_actions
  drop constraint if exists moderation_actions_target_type_check;
alter table public.moderation_actions
  add constraint moderation_actions_target_type_check
  check (target_type in ('profile','creation','review','thread','post','report','comic'));

-- ------------------------------------------------------------
-- 11. The explainer thread
-- ------------------------------------------------------------
do $mig$
declare
  v_cat   uuid;
  v_admin uuid;
  v_title text := 'Comics: posting one, and what size to draw';
begin
  select id into v_cat   from public.forum_categories where slug = 'general';
  select id into v_admin from public.profiles where role = 'admin' order by created_at limit 1;

  if v_cat is null or v_admin is null then
    raise notice 'Missing general category or admin profile - skipping comics explainer.';
    return;
  end if;

  if not exists (select 1 from public.forum_threads where category_id = v_cat and title = v_title) then
    insert into public.forum_threads (category_id, author_id, title, body, is_pinned)
    values (v_cat, v_admin, v_title, $g$There is a **Comics** section now. One page or a hundred, a one-shot or chapter three of something long.

**What size should I draw at?**

Short answer: **1400 x 2100 pixels**, and do not worry about it too much.

Longer answer, if you want it:

- **1400px wide** is the useful number. Phones have been drawing at roughly double their stated width for years, so 1400 stays sharp on a phone and still looks right on a laptop. Much bigger and readers on phone data are waiting for a picture they cannot see the extra detail in anyway.
- **2:3** (so 1400 x 2100) is close to the proportions of a printed comic page. It reads naturally and fills a phone screen almost exactly.
- **Under about 2MB a page.** The limit is 10MB, but a twenty-page comic at 8MB a page is 160MB, and nobody on a train is going to sit through that.
- **PNG, JPG or WebP.** JPG for painted or shaded work, PNG for flat colour and line art, WebP if you know what it is.

**Any size actually works.** Tall webtoon strips, square pages, phone photos of pencil work on paper — the reader fits each page to the screen. The recommendation is a recommendation, not a gate. Mixed sizes in one comic are fine too.

**Posting one**

Comics -> Post a comic. Drop your pages in, drag them into the right order, and the number in the corner of each is the page number a reader will see. Give it a title, hit post.

The order you leave them in is the order it reads in. Check it before you post — page 7 arriving before page 6 is the one mistake readers actually notice.

**Reading one**

Click a page to go forward, or use the arrow keys. There is a page counter at the bottom and a strip of thumbnails you can jump around with.

If your comic is not for children, tick the box. It gets a cover people have to click through, same as everywhere else on the site.$g$, true);
  end if;
end
$mig$;
