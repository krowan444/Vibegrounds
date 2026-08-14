-- ============================================================
-- VIBEGROUNDS — 20: MAKER BADGES (what kind of thing you make)
-- ============================================================
-- There is already `first-blood` for your first submission of any kind. It
-- fires once and then never says anything about you again.
--
-- These say what you actually are. Post your first game and you are a Game
-- Developer; post your first short and you are a Film Maker. They stack, so
-- someone who has done a game, a tool and a track wears three — which is a
-- far better thing to look at on a profile than one generic "First Upload".
--
-- Common tier on purpose. These are not achievements for grinding, they are
-- labels for turning up, and the rare tiers should stay hard to get.
-- ============================================================

insert into public.badges
  (slug, name, description, icon, tier, category, criteria, sort_order, is_manual, retires_at)
values
  ('maker-games',       'Game Developer', 'Posted your first game.',                      '🎮', 'common', 'creator', '{"type":"first_in_category","value":"games"}',       30, false, null),
  ('maker-ai-movies',   'Film Maker',     'Posted your first AI movie or short.',         '🎬', 'common', 'creator', '{"type":"first_in_category","value":"ai-movies"}',   31, false, null),
  ('maker-software',    'Tool Builder',   'Posted your first piece of software.',         '🛠️', 'common', 'creator', '{"type":"first_in_category","value":"software"}',    32, false, null),
  ('maker-websites',    'Web Builder',    'Posted your first website.',                   '🌐', 'common', 'creator', '{"type":"first_in_category","value":"websites"}',    33, false, null),
  ('maker-art',         'Artist',         'Posted your first piece of art.',              '🎨', 'common', 'creator', '{"type":"first_in_category","value":"art"}',         34, false, null),
  ('maker-audio',       'Sound Designer', 'Posted your first audio piece.',               '🎵', 'common', 'creator', '{"type":"first_in_category","value":"audio"}',       35, false, null),
  ('maker-experiments', 'Mad Scientist',  'Posted your first experiment.',                '🧪', 'common', 'creator', '{"type":"first_in_category","value":"experiments"}', 36, false, null),
  ('maker-memes',       'Memelord',       'Posted your first meme.',                      '😂', 'common', 'creator', '{"type":"first_in_category","value":"memes"}',       37, false, null)
on conflict (slug) do update
  set name = excluded.name, description = excluded.description, icon = excluded.icon,
      tier = excluded.tier, category = excluded.category, criteria = excluded.criteria,
      sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- Award them
-- ------------------------------------------------------------
-- Driven off the category list rather than eight hand-written ifs, so adding
-- a ninth category later means inserting one badge row above and changing
-- nothing here. The slug convention (maker-<category slug>) is the join.
create or replace function public.grant_maker_badges(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  for r in
    select distinct c.category
      from public.creations c
     where c.creator_id = p_user
       and c.status = 'published'
  loop
    -- grant_badge is already idempotent, but checking the badge exists keeps
    -- a category with no badge row from raising.
    if exists (select 1 from public.badges where slug = 'maker-' || r.category) then
      perform public.grant_badge(p_user, 'maker-' || r.category);
    end if;
  end loop;
end;
$$;

-- Fire it when a creation is published.
--
-- The alternative was editing evaluate_badges() to call this, but that means
-- restating a 100-line function to add one line — and any drift between the
-- copy here and the real one silently breaks every other badge. A trigger of
-- its own is additive: if it is wrong, only maker badges are wrong.
create or replace function public.on_creation_maker_badge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' then
    perform public.grant_maker_badges(new.creator_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_maker_badges on public.creations;
create trigger trg_maker_badges
  after insert or update of status, category on public.creations
  for each row execute function public.on_creation_maker_badge();

-- Backfill everyone who already qualifies, so existing members get the badge
-- they earned before it existed rather than only on their next upload.
do $mig$
declare u record;
begin
  for u in select distinct creator_id from public.creations where status = 'published' loop
    perform public.grant_maker_badges(u.creator_id);
  end loop;
end
$mig$;
