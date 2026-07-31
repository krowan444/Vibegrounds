-- ============================================================
-- VIBEGROUNDS — 04: THE PORTAL
-- Submissions, 0–5 voting, weighted scores and the Top charts.
-- ============================================================

-- ------------------------------------------------------------
-- CATEGORIES (data-driven so you can add sections without a deploy)
-- ------------------------------------------------------------
create table if not exists public.categories (
  slug        text primary key,
  name        text not null,
  tagline     text default '',
  icon        text default '✨',
  color       text default '#e8a317',
  sort_order  int  default 0,
  is_active   boolean default true
);

insert into public.categories (slug, name, tagline, icon, color, sort_order) values
  ('games',       'Games',        'Playable vibe-coded games',                  '🎮', '#e8a317', 1),
  ('ai-movies',   'AI Movies',    'Generated films, shorts and animations',     '🎬', '#ff5c8a', 2),
  ('software',    'Software',     'Apps, utilities and tools that do the job',  '🛠️', '#4fc3f7', 3),
  ('websites',    'Websites',     'Sites, landing pages and web experiences',   '🌐', '#66bb6a', 4),
  ('art',         'Art',          'Images, generative art and visual weirdness','🎨', '#ba68c8', 5),
  ('audio',       'Audio',        'Music, sound design and AI voice',           '🎵', '#ffa726', 6),
  ('experiments', 'Experiments',  'Half-finished, unhinged, gloriously broken', '🧪', '#26c6da', 7),
  ('other',       'Other',        'Everything that defies classification',      '❓', '#9e9e9e', 8)
on conflict (slug) do nothing;

alter table public.categories enable row level security;
drop policy if exists "Categories are publicly readable" on public.categories;
create policy "Categories are publicly readable"
  on public.categories for select using (true);

-- ------------------------------------------------------------
-- CREATIONS
-- ------------------------------------------------------------
create table if not exists public.creations (
  id             uuid primary key default gen_random_uuid(),
  creator_id     uuid not null references public.profiles(id) on delete cascade,

  title          text not null check (char_length(title) between 2 and 80),
  description    text default '' check (char_length(description) <= 2000),
  category       text not null default 'other' references public.categories(slug),
  project_url    text not null,
  thumbnail_url  text default '',
  tags           text[] default '{}',

  -- lifecycle
  status         text not null default 'published'
                 check (status in ('published','removed','hidden','under_review')),
  removed_reason text,
  removed_by     uuid references public.profiles(id) on delete set null,
  is_featured    boolean not null default false,
  is_nsfw        boolean not null default false,

  -- scoring (maintained by trigger — never written by clients)
  score          numeric(4,2) not null default 0,
  vote_count     int  not null default 0,
  vote_sum       int  not null default 0,
  view_count     int  not null default 0,
  review_count   int  not null default 0,

  coins_spent    int  not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_creations_category on public.creations (category, created_at desc);
create index if not exists idx_creations_creator  on public.creations (creator_id, created_at desc);
create index if not exists idx_creations_created  on public.creations (created_at desc);
create index if not exists idx_creations_score    on public.creations (score desc, vote_count desc);
create index if not exists idx_creations_status   on public.creations (status);

-- ------------------------------------------------------------
-- VOTES — 0 to 5, one per member per submission, changeable
-- ------------------------------------------------------------
create table if not exists public.votes (
  creation_id uuid not null references public.creations(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  value       int  not null check (value between 0 and 5),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (creation_id, user_id)
);

create index if not exists idx_votes_creation_time on public.votes (creation_id, updated_at desc);
create index if not exists idx_votes_user on public.votes (user_id, updated_at desc);

alter table public.votes enable row level security;

drop policy if exists "Votes are publicly readable" on public.votes;
create policy "Votes are publicly readable" on public.votes for select using (true);
-- Writes go through cast_vote() only.

-- ------------------------------------------------------------
-- SCORE RECALCULATION
-- Bayesian average: pulls low-vote submissions toward the mean
-- so a single 5/5 from a mate can't top the all-time chart.
-- ------------------------------------------------------------
create or replace function public.recalc_creation_score(p_creation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n     int;
  v_sum   int;
  v_prior int     := 6;      -- pseudo-votes of weight
  v_mean  numeric := 2.50;   -- prior mean score
begin
  select count(*), coalesce(sum(value), 0) into v_n, v_sum
    from public.votes where creation_id = p_creation;

  -- This is a trusted internal write, so lift the column guard for it —
  -- otherwise the guard reverts the very score it is meant to protect.
  perform set_config('vg.privileged', 'on', true);
  update public.creations
     set vote_count = v_n,
         vote_sum   = v_sum,
         score      = round(((v_prior * v_mean) + v_sum)::numeric / (v_prior + v_n), 2)
   where id = p_creation;
  perform set_config('vg.privileged', 'off', true);
end;
$$;

create or replace function public.on_vote_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_creation_score(coalesce(new.creation_id, old.creation_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_vote_change on public.votes;
create trigger trg_vote_change
  after insert or update or delete on public.votes
  for each row execute function public.on_vote_change();

-- Keep profiles.submission_count honest
create or replace function public.on_creation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('vg.privileged', 'on', true);
  update public.profiles p
     set submission_count = (
       select count(*) from public.creations c
        where c.creator_id = p.id and c.status = 'published'
     )
   where p.id = coalesce(new.creator_id, old.creator_id);
  perform set_config('vg.privileged', 'off', true);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_creation_change on public.creations;
create trigger trg_creation_change
  after insert or update of status or delete on public.creations
  for each row execute function public.on_creation_change();

-- ------------------------------------------------------------
-- RLS: removed content disappears for everyone except staff & the owner
-- ------------------------------------------------------------
alter table public.creations enable row level security;

drop policy if exists "Published creations are public" on public.creations;
create policy "Published creations are public"
  on public.creations for select
  using (
    status in ('published','under_review')
    or auth.uid() = creator_id
    or public.is_staff()
  );

drop policy if exists "Owners can update own creations" on public.creations;
create policy "Owners can update own creations"
  on public.creations for update
  using (auth.uid() = creator_id and status <> 'removed')
  with check (auth.uid() = creator_id);

drop policy if exists "Staff can update any creation" on public.creations;
create policy "Staff can update any creation"
  on public.creations for update
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Owners can delete own creations" on public.creations;
create policy "Owners can delete own creations"
  on public.creations for delete
  using (auth.uid() = creator_id or public.is_staff());

-- No INSERT policy — submissions must go through submit_creation()
-- so the coin charge can never be skipped.

-- Owners must not be able to hand-edit their own score or status
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
  new.updated_at     := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_creation_columns on public.creations;
create trigger trg_guard_creation_columns
  before update on public.creations
  for each row execute function public.guard_creation_columns();

-- ============================================================
-- SUBMIT — the one and only way a creation gets created
-- ============================================================
create or replace function public.submit_creation(
  p_title       text,
  p_description text,
  p_category    text,
  p_project_url text,
  p_thumbnail   text default '',
  p_tags        text[] default '{}',
  p_is_nsfw     boolean default false
)
returns public.creations
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid     uuid := auth.uid();
  v_cost    int  := public.setting_int('submission_cost', 10);
  v_limit   int  := public.setting_int('daily_submission_limit', 5);
  v_profile public.profiles%rowtype;
  v_row     public.creations%rowtype;
  v_url     text;
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
    thumbnail_url, tags, is_nsfw, coins_spent
  ) values (
    v_uid, trim(p_title), trim(coalesce(p_description,'')),
    coalesce(p_category,'other'), v_url,
    coalesce(p_thumbnail,''), coalesce(p_tags,'{}'), coalesce(p_is_nsfw,false), v_cost
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
$$;

grant execute on function public.submit_creation(text,text,text,text,text,text[],boolean) to authenticated;

-- ============================================================
-- VOTE
-- ============================================================
create or replace function public.cast_vote(p_creation uuid, p_value int)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid     uuid := auth.uid();
  v_creator uuid;
  v_score   numeric;
  v_count   int;
begin
  if v_uid is null then raise exception 'Sign in to vote.'; end if;
  if p_value < 0 or p_value > 5 then raise exception 'Vote must be between 0 and 5.'; end if;

  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'EMAIL_NOT_VERIFIED';
  end if;
  if not public.is_active_member(v_uid) then raise exception 'ACCOUNT_BANNED'; end if;

  select creator_id into v_creator from public.creations where id = p_creation and status = 'published';
  if not found then raise exception 'Submission not found.'; end if;
  if v_creator = v_uid then raise exception 'SELF_VOTE'; end if;

  insert into public.votes (creation_id, user_id, value)
  values (p_creation, v_uid, p_value)
  on conflict (creation_id, user_id)
  do update set value = excluded.value, updated_at = now();

  perform set_config('vg.privileged', 'on', true);
  update public.profiles
     set total_votes_cast = (select count(*) from public.votes where user_id = v_uid)
   where id = v_uid;
  perform set_config('vg.privileged', 'off', true);

  select score, vote_count into v_score, v_count from public.creations where id = p_creation;

  perform public.evaluate_badges(v_uid);
  perform public.evaluate_badges(v_creator);

  return json_build_object('score', v_score, 'vote_count', v_count, 'your_vote', p_value);
end;
$$;

grant execute on function public.cast_vote(uuid,int) to authenticated;

-- Cheap view counter (anonymous allowed)
create or replace function public.register_view(p_creation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('vg.privileged', 'on', true);
  update public.creations set view_count = view_count + 1 where id = p_creation;
  perform set_config('vg.privileged', 'off', true);
end;
$$;

grant execute on function public.register_view(uuid) to anon, authenticated;

-- ============================================================
-- STAFF: remove / restore / feature a submission
-- ============================================================
create or replace function public.admin_set_creation_status(
  p_creation uuid,
  p_status   text,
  p_reason   text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'Moderators only.'; end if;
  if p_status not in ('published','removed','hidden','under_review') then
    raise exception 'Invalid status.';
  end if;

  update public.creations
     set status = p_status,
         removed_reason = case when p_status = 'removed' then p_reason else null end,
         removed_by     = case when p_status = 'removed' then auth.uid() else null end,
         updated_at = now()
   where id = p_creation;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), 'set_creation_status', 'creation', p_creation, p_status || ': ' || coalesce(p_reason,''));
end;
$$;

create or replace function public.admin_set_featured(p_creation uuid, p_featured boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'Moderators only.'; end if;
  update public.creations set is_featured = p_featured where id = p_creation;
  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), 'set_featured', 'creation', p_creation, p_featured::text);
end;
$$;

grant execute on function public.admin_set_creation_status(uuid,text,text) to authenticated;
grant execute on function public.admin_set_featured(uuid,boolean)          to authenticated;

-- ============================================================
-- THE CHARTS
-- ============================================================

-- Enriched base view used everywhere in the UI
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
  cat.color     as category_color
from public.creations c
join public.profiles p   on p.id = c.creator_id
left join public.categories cat on cat.slug = c.category
where c.status = 'published';

-- Top charts. Ranked by weighted score; ties broken by vote count.
-- A submission needs at least 3 votes to chart, so nothing sneaks in on one vote.
create or replace view public.chart_daily
with (security_invoker = on) as
select *, row_number() over (order by score desc, vote_count desc, created_at desc) as rank
from public.creations_public
where created_at > now() - interval '24 hours' and vote_count >= 3;

create or replace view public.chart_weekly
with (security_invoker = on) as
select *, row_number() over (order by score desc, vote_count desc, created_at desc) as rank
from public.creations_public
where created_at > now() - interval '7 days' and vote_count >= 3;

create or replace view public.chart_monthly
with (security_invoker = on) as
select *, row_number() over (order by score desc, vote_count desc, created_at desc) as rank
from public.creations_public
where created_at > now() - interval '30 days' and vote_count >= 3;

-- The wall of fame.
create or replace view public.chart_alltime
with (security_invoker = on) as
select *, row_number() over (order by score desc, vote_count desc, created_at asc) as rank
from public.creations_public
where vote_count >= 5;

-- "Hot right now" — recent voting activity, not lifetime score.
create or replace view public.chart_hot
with (security_invoker = on) as
select cp.*,
       (select count(*) from public.votes v
         where v.creation_id = cp.id and v.updated_at > now() - interval '48 hours') as recent_votes,
       row_number() over (
         order by (select count(*) from public.votes v
                    where v.creation_id = cp.id and v.updated_at > now() - interval '48 hours') desc,
                  cp.score desc
       ) as rank
from public.creations_public cp;

-- Creator leaderboard
create or replace view public.top_creators
with (security_invoker = on) as
select
  p.id, p.username, p.avatar_url, p.created_at,
  count(c.id)                       as submissions,
  coalesce(round(avg(c.score), 2), 0) as avg_score,
  coalesce(sum(c.view_count), 0)    as total_views,
  coalesce(sum(c.vote_count), 0)    as total_votes,
  row_number() over (order by coalesce(avg(c.score),0) desc, count(c.id) desc) as rank
from public.profiles p
join public.creations c on c.creator_id = p.id and c.status = 'published'
where p.is_banned = false
group by p.id, p.username, p.avatar_url, p.created_at
having count(c.id) >= 1;

-- Make sure the browser can actually read all of the above.
grant select on
  public.creations_public,
  public.chart_daily,
  public.chart_weekly,
  public.chart_monthly,
  public.chart_alltime,
  public.chart_hot,
  public.top_creators
to anon, authenticated;
