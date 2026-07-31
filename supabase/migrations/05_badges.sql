-- ============================================================
-- VIBEGROUNDS — 05: BADGES & ACHIEVEMENTS
-- Rarity is both *designed* (a tier we choose) and *live*
-- (what % of members actually hold it) — the profile shows both.
-- ============================================================

create table if not exists public.badges (
  slug         text primary key,
  name         text not null,
  description  text not null,
  icon         text not null default '🏅',
  -- designed tier, used for colour/ordering in the UI
  tier         text not null default 'common'
               check (tier in ('common','uncommon','rare','epic','legendary','mythic')),
  category     text not null default 'general'
               check (category in ('general','creator','critic','community','economy','staff','event')),
  criteria     jsonb not null default '{}'::jsonb,
  is_secret    boolean not null default false,   -- hidden until earned
  is_manual    boolean not null default false,   -- only staff can grant
  is_retired   boolean not null default false,   -- can never be earned again
  retires_at   timestamptz,
  sort_order   int not null default 100,
  created_at   timestamptz not null default now()
);

alter table public.badges enable row level security;
drop policy if exists "Badges are publicly readable" on public.badges;
create policy "Badges are publicly readable" on public.badges for select using (true);

create table if not exists public.user_badges (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  badge_slug text not null references public.badges(slug) on delete cascade,
  earned_at  timestamptz not null default now(),
  granted_by uuid references public.profiles(id) on delete set null,
  is_pinned  boolean not null default false,     -- user picks favourites for their profile
  primary key (user_id, badge_slug)
);

create index if not exists idx_user_badges_user  on public.user_badges (user_id);
create index if not exists idx_user_badges_badge on public.user_badges (badge_slug);

alter table public.user_badges enable row level security;

drop policy if exists "User badges are publicly readable" on public.user_badges;
create policy "User badges are publicly readable" on public.user_badges for select using (true);

drop policy if exists "Users can pin own badges" on public.user_badges;
create policy "Users can pin own badges"
  on public.user_badges for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- THE BADGE LIST
-- ------------------------------------------------------------
insert into public.badges (slug, name, description, icon, tier, category, criteria, sort_order, is_manual, retires_at) values
  -- Founding / time-limited
  ('og-member',     'OG Member',        'Joined VibeGrounds before January 2027. Never obtainable again.', '👑', 'legendary','event',    '{"type":"joined_before","value":"2027-01-01T00:00:00Z"}', 1,  false, '2027-01-01T00:00:00Z'),
  ('founding-100',  'Founding 100',     'One of the first 100 accounts ever created.',                     '🌟', 'mythic',   'event',    '{"type":"signup_rank","value":100}',                     2,  false, null),
  ('verified',      'Verified Human',   'Confirmed your email address. Welcome aboard.',                   '✅', 'common',   'general',  '{"type":"email_verified"}',                              10, false, null),

  -- Creator
  ('first-blood',   'First Upload',     'Posted your first creation to the Portal.',                       '🎖️', 'common',   'creator',  '{"type":"submissions","value":1}',                       20, false, null),
  ('regular',       'Regular',          'Posted 5 creations.',                                             '📦', 'uncommon', 'creator',  '{"type":"submissions","value":5}',                       21, false, null),
  ('prolific',      'Prolific Creator', 'Posted 25 creations.',                                            '🔥', 'rare',     'creator',  '{"type":"submissions","value":25}',                      22, false, null),
  ('machine',       'The Machine',      'Posted 100 creations. Do you ever sleep?',                        '🤖', 'epic',     'creator',  '{"type":"submissions","value":100}',                     23, false, null),
  ('polymath',      'Polymath',         'Posted in five different categories.',                            '🧠', 'rare',     'creator',  '{"type":"distinct_categories","value":5}',               24, false, null),
  ('crowd-pleaser', 'Crowd Pleaser',    'A submission scored 4.00+ with 10 or more votes.',                '💛', 'rare',     'creator',  '{"type":"score_threshold","score":4.0,"votes":10}',       25, false, null),
  ('portal-legend', 'Portal Legend',    'A submission scored 4.50+ with 25 or more votes.',                '🏆', 'legendary','creator',  '{"type":"score_threshold","score":4.5,"votes":25}',       26, false, null),
  ('well-viewed',   'Eyes On',          'Your creations have been viewed 1,000 times.',                    '👀', 'uncommon', 'creator',  '{"type":"total_views","value":1000}',                    27, false, null),
  ('viral',         'Gone Viral',       'Your creations have been viewed 25,000 times.',                   '📈', 'epic',     'creator',  '{"type":"total_views","value":25000}',                   28, false, null),

  -- Critic
  ('first-vote',    'First Verdict',    'Cast your first vote on someone else''s work.',                   '⭐', 'common',   'critic',   '{"type":"votes_cast","value":1}',                        40, false, null),
  ('critic',        'Critic',           'Cast 50 votes.',                                                  '📝', 'uncommon', 'critic',   '{"type":"votes_cast","value":50}',                       41, false, null),
  ('judge',         'Portal Judge',     'Cast 250 votes. You decide what survives.',                       '⚖️', 'rare',     'critic',   '{"type":"votes_cast","value":250}',                      42, false, null),
  ('supreme-judge', 'Supreme Judge',    'Cast 1,000 votes.',                                               '🎯', 'epic',     'critic',   '{"type":"votes_cast","value":1000}',                     43, false, null),

  -- Economy
  ('supporter',     'Supporter',        'Bought your first coin pack and kept the lights on.',             '💰', 'uncommon', 'economy',  '{"type":"purchases","value":1}',                         60, false, null),
  ('patron',        'Patron',           'Bought five coin packs. Absolute legend.',                        '💎', 'epic',     'economy',  '{"type":"purchases","value":5}',                         61, false, null),

  -- Community / manual
  ('profile-pro',   'Looking Sharp',    'Filled in your bio, avatar and website.',                         '😎', 'common',   'community','{"type":"profile_complete"}',                            80, false, null),
  ('night-owl',     'Night Owl',        'Submitted something between 2am and 5am.',                        '🦉', 'uncommon', 'community','{"type":"night_submission"}',                            81, false, null),
  ('daily-winner',  'Daily #1',         'Took the number one spot on the Daily chart.',                    '🥇', 'legendary','event',    '{"type":"manual"}',                                      90, true,  null),
  ('weekly-winner', 'Weekly #1',        'Took the number one spot on the Weekly chart.',                   '🥈', 'legendary','event',    '{"type":"manual"}',                                      91, true,  null),
  ('staff',         'VG Staff',         'Keeps the Grounds running.',                                      '🛡️', 'mythic',   'staff',    '{"type":"manual"}',                                      95, true,  null),
  ('good-samaritan','Good Samaritan',   'Filed reports that led to real moderation action.',               '🚨', 'rare',     'community','{"type":"manual"}',                                      96, true,  null)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  tier = excluded.tier, category = excluded.category, criteria = excluded.criteria,
  sort_order = excluded.sort_order, is_manual = excluded.is_manual, retires_at = excluded.retires_at;

-- ------------------------------------------------------------
-- LIVE RARITY — what fraction of members actually hold each badge
-- ------------------------------------------------------------
create or replace view public.badge_stats as
with member_count as (
  select greatest(count(*), 1)::numeric as total from public.profiles where is_banned = false
)
select
  b.slug, b.name, b.description, b.icon, b.tier, b.category,
  b.is_secret, b.is_manual, b.is_retired, b.retires_at, b.sort_order,
  coalesce(h.holders, 0) as holders,
  round(coalesce(h.holders, 0) * 100.0 / mc.total, 2) as holder_percent,
  case
    when coalesce(h.holders,0) = 0                          then 'Unobtained'
    when coalesce(h.holders,0) * 100.0 / mc.total < 0.5      then 'Ultra Rare'
    when coalesce(h.holders,0) * 100.0 / mc.total < 2        then 'Very Rare'
    when coalesce(h.holders,0) * 100.0 / mc.total < 10       then 'Rare'
    when coalesce(h.holders,0) * 100.0 / mc.total < 30       then 'Uncommon'
    else                                                          'Common'
  end as live_rarity
from public.badges b
cross join member_count mc
left join (
  select badge_slug, count(*) as holders from public.user_badges group by badge_slug
) h on h.badge_slug = b.slug;

grant select on public.badge_stats to anon, authenticated;

-- ------------------------------------------------------------
-- GRANT
-- ------------------------------------------------------------
create or replace function public.grant_badge(p_user uuid, p_badge text, p_by uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_retires timestamptz; v_rows int := 0;
begin
  select retires_at into v_retires from public.badges where slug = p_badge;
  if not found then return false; end if;

  -- Retired badges (e.g. OG Member after Jan 2027) can never be handed out again
  if v_retires is not null and now() >= v_retires then
    return false;
  end if;

  insert into public.user_badges (user_id, badge_slug, granted_by)
  values (p_user, p_badge, p_by)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

create or replace function public.admin_grant_badge(p_user uuid, p_badge text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_ok boolean;
begin
  if not public.is_staff() then raise exception 'Moderators only.'; end if;
  v_ok := public.grant_badge(p_user, p_badge, auth.uid());
  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), 'grant_badge', 'profile', p_user, p_badge);
  return v_ok;
end;
$$;

create or replace function public.admin_revoke_badge(p_user uuid, p_badge text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'Moderators only.'; end if;
  delete from public.user_badges where user_id = p_user and badge_slug = p_badge;
  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), 'revoke_badge', 'profile', p_user, p_badge);
end;
$$;

grant execute on function public.admin_grant_badge(uuid,text)  to authenticated;
grant execute on function public.admin_revoke_badge(uuid,text) to authenticated;

-- ------------------------------------------------------------
-- EVALUATE — run after any action that could earn something
-- ------------------------------------------------------------
create or replace function public.evaluate_badges(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_p            public.profiles%rowtype;
  v_verified     boolean;
  v_subs         int;
  v_votes        int;
  v_cats         int;
  v_views        bigint;
  v_purchases    int;
  v_signup_rank  bigint;
  v_og_cutoff    timestamptz;
begin
  select * into v_p from public.profiles where id = p_user;
  if not found then return; end if;

  select (email_confirmed_at is not null) into v_verified from auth.users where id = p_user;

  -- ---- time-limited founding badges ----
  v_og_cutoff := (select (value #>> '{}')::timestamptz from public.site_settings where key = 'og_badge_cutoff');
  if v_p.created_at < coalesce(v_og_cutoff, '2027-01-01T00:00:00Z'::timestamptz) then
    perform public.grant_badge(p_user, 'og-member');
  end if;

  select count(*) into v_signup_rank from public.profiles where created_at <= v_p.created_at;
  if v_signup_rank <= 100 then
    perform public.grant_badge(p_user, 'founding-100');
  end if;

  if coalesce(v_verified, false) then
    perform public.grant_badge(p_user, 'verified');
  end if;

  -- ---- creator ----
  select count(*) into v_subs from public.creations where creator_id = p_user and status = 'published';
  if v_subs >= 1   then perform public.grant_badge(p_user, 'first-blood'); end if;
  if v_subs >= 5   then perform public.grant_badge(p_user, 'regular');     end if;
  if v_subs >= 25  then perform public.grant_badge(p_user, 'prolific');    end if;
  if v_subs >= 100 then perform public.grant_badge(p_user, 'machine');     end if;

  select count(distinct category) into v_cats
    from public.creations where creator_id = p_user and status = 'published';
  if v_cats >= 5 then perform public.grant_badge(p_user, 'polymath'); end if;

  if exists (select 1 from public.creations
              where creator_id = p_user and status = 'published'
                and score >= 4.0 and vote_count >= 10) then
    perform public.grant_badge(p_user, 'crowd-pleaser');
  end if;

  if exists (select 1 from public.creations
              where creator_id = p_user and status = 'published'
                and score >= 4.5 and vote_count >= 25) then
    perform public.grant_badge(p_user, 'portal-legend');
  end if;

  select coalesce(sum(view_count), 0) into v_views
    from public.creations where creator_id = p_user and status = 'published';
  if v_views >= 1000  then perform public.grant_badge(p_user, 'well-viewed'); end if;
  if v_views >= 25000 then perform public.grant_badge(p_user, 'viral');       end if;

  if exists (select 1 from public.creations
              where creator_id = p_user
                and extract(hour from created_at) between 2 and 4) then
    perform public.grant_badge(p_user, 'night-owl');
  end if;

  -- ---- critic ----
  select count(*) into v_votes from public.votes where user_id = p_user;
  if v_votes >= 1    then perform public.grant_badge(p_user, 'first-vote');    end if;
  if v_votes >= 50   then perform public.grant_badge(p_user, 'critic');        end if;
  if v_votes >= 250  then perform public.grant_badge(p_user, 'judge');         end if;
  if v_votes >= 1000 then perform public.grant_badge(p_user, 'supreme-judge'); end if;

  -- ---- economy ----
  select count(*) into v_purchases from public.coin_purchases where user_id = p_user and status = 'paid';
  if v_purchases >= 1 then perform public.grant_badge(p_user, 'supporter'); end if;
  if v_purchases >= 5 then perform public.grant_badge(p_user, 'patron');    end if;

  -- ---- community ----
  if coalesce(v_p.bio,'') <> '' and coalesce(v_p.avatar_url,'') <> '' and coalesce(v_p.website,'') <> '' then
    perform public.grant_badge(p_user, 'profile-pro');
  end if;

  if v_p.role in ('admin','mod') then
    perform public.grant_badge(p_user, 'staff');
  end if;
end;
$$;

grant execute on function public.evaluate_badges(uuid) to authenticated;

-- Let a signed-in user refresh their own badges (called after profile edits)
create or replace function public.refresh_my_badges()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  perform public.evaluate_badges(auth.uid());
end;
$$;

grant execute on function public.refresh_my_badges() to authenticated;

-- Convenience view for profile pages
create or replace view public.user_badges_detailed as
select
  ub.user_id, ub.earned_at, ub.is_pinned,
  bs.*
from public.user_badges ub
join public.badge_stats bs on bs.slug = ub.badge_slug;

grant select on public.user_badges_detailed to anon, authenticated;
