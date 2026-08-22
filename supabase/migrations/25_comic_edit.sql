-- ============================================================
-- VIBEGROUNDS — 25: EDITING A COMIC
-- ============================================================
-- Posting a comic was always going to be the easy half. Nobody gets the
-- order right first time, a page gets redrawn, a chapter gains an epilogue —
-- and until now the only way to fix any of that was to delete the comic and
-- post it again, which loses its address, its read count and anyone's link
-- to it.
--
-- The awkward part is that an edit is not one change, it is a whole new page
-- list. Applying it a row at a time from the browser means a dropped
-- connection can leave a comic half-reordered, with two page 4s and no page
-- 7. So the whole list goes in one call, inside one transaction, exactly
-- like submit_comic:
--
--   * delete every page of the comic
--   * insert the new list, numbered from the array index
--
-- Which reads as heavy-handed until you notice the alternative is diffing
-- two lists in SQL and getting the intermediate states legal, and the
-- deferrable unique constraint from migration 24 exists precisely so that a
-- transaction may hold a briefly impossible arrangement on its way to a
-- legal one. The page rows are cheap; the pictures they point at are not
-- touched.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Replace a comic's pages and details, whole
-- ------------------------------------------------------------
create or replace function public.update_comic(
  p_comic       uuid,
  p_title       text,
  p_description text,
  p_is_nsfw     boolean,
  p_pages       text[],
  p_widths      int[]  default null,
  p_heights     int[]  default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_status text;
  i int;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to edit a comic.';
  end if;

  select creator_id, status into v_owner, v_status
    from public.comics where id = p_comic;

  if v_owner is null then
    raise exception 'That comic does not exist.';
  end if;

  -- Staff can fix somebody else's comic; nobody else can touch it. Checked
  -- here rather than left to RLS because this function is security definer,
  -- which means RLS is not going to check it for us.
  if v_owner <> auth.uid() and not public.is_staff() then
    raise exception 'That is not your comic.';
  end if;

  -- A removed comic stays removed. Letting the creator edit their way out of
  -- a moderator's decision would make the decision meaningless.
  if v_status <> 'published' and not public.is_staff() then
    raise exception 'That comic has been removed.';
  end if;

  if p_pages is null or array_length(p_pages, 1) is null then
    raise exception 'A comic needs at least one page.';
  end if;

  if array_length(p_pages, 1) > 200 then
    raise exception 'A comic can hold 200 pages.';
  end if;

  if char_length(coalesce(trim(p_title), '')) < 2 then
    raise exception 'Give the comic a title.';
  end if;

  -- The column guard from migration 24 refuses edits to creator_id,
  -- page_count, view_count and the rest. This function is the one place
  -- allowed past it, and only for the columns set below.
  perform set_config('vg.privileged', 'on', true);

  update public.comics
     set title       = trim(p_title),
         description = coalesce(trim(p_description), ''),
         is_nsfw     = coalesce(p_is_nsfw, false),
         updated_at  = now()
   where id = p_comic;

  delete from public.comic_pages where comic_id = p_comic;

  for i in 1 .. array_length(p_pages, 1) loop
    insert into public.comic_pages (comic_id, position, image_url, width, height)
    values (
      p_comic,
      i,
      p_pages[i],
      nullif(coalesce(p_widths[i],  0), 0),
      nullif(coalesce(p_heights[i], 0), 0)
    );
  end loop;

  perform set_config('vg.privileged', 'off', true);

  return p_comic;
end;
$$;

revoke all on function public.update_comic(uuid, text, text, boolean, text[], int[], int[]) from public;
grant execute on function public.update_comic(uuid, text, text, boolean, text[], int[], int[]) to authenticated;

comment on function public.update_comic(uuid, text, text, boolean, text[], int[], int[]) is
  'Replaces a comic''s details and its whole page list in one transaction. Creator or staff only.';

-- Deliberately not here: a "take my comic down" function. `status` has room
-- for exactly two values, and a creator hiding their own comic would be
-- indistinguishable from a moderator removing one — which means either the
-- creator can undo a moderator, or they cannot undo themselves. Neither is
-- acceptable, and the fix is a third status, which is a bigger change than
-- this migration should be making on the way past.

-- ------------------------------------------------------------
-- 2. The editor has to be able to read its own pages
-- ------------------------------------------------------------
-- comic_pages_public only shows pages of published comics, which is right
-- for readers. The edit screen needs the pages of the comic it is editing
-- even in the moment after a moderator has hidden it, so the creator can see
-- what they have rather than an empty grid. One extra policy, owner scoped.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'comic_pages'
       and policyname = 'comic_pages_owner_read'
  ) then
    create policy comic_pages_owner_read on public.comic_pages
      for select to authenticated
      using (
        exists (
          select 1 from public.comics c
           where c.id = comic_pages.comic_id
             and (c.creator_id = auth.uid() or public.is_staff())
        )
      );
  end if;
end
$$;
