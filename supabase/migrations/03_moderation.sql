-- ============================================================
-- VIBEGROUNDS — 03: REPORTS, BANS & THE MODERATION LOG
-- "Free to be weird, not free to be a dick."
-- ============================================================

-- ------------------------------------------------------------
-- AUDIT LOG — every staff action, permanently recorded
-- ------------------------------------------------------------
create table if not exists public.moderation_actions (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.profiles(id) on delete set null,
  action       text not null,           -- ban_user, unban_user, remove_creation, ...
  target_type  text not null check (target_type in ('profile','creation','review','thread','post','report')),
  target_id    uuid,
  reason       text default '',
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_modlog_created on public.moderation_actions (created_at desc);
create index if not exists idx_modlog_target  on public.moderation_actions (target_type, target_id);

alter table public.moderation_actions enable row level security;

drop policy if exists "Staff read moderation log" on public.moderation_actions;
create policy "Staff read moderation log"
  on public.moderation_actions for select using (public.is_staff());

-- ------------------------------------------------------------
-- REPORTS — any signed-in member can flag anything
-- ------------------------------------------------------------
create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid references public.profiles(id) on delete set null,
  target_type     text not null check (target_type in ('creation','review','thread','post','profile')),
  target_id       uuid not null,
  reason          text not null check (reason in (
                    'hate_speech','harassment','nsfw','spam','malware',
                    'stolen_content','illegal','broken_link','other'
                  )),
  details         text default '' check (char_length(details) <= 1000),
  status          text not null default 'open'
                  check (status in ('open','reviewing','actioned','dismissed')),
  handled_by      uuid references public.profiles(id) on delete set null,
  handled_at      timestamptz,
  resolution_note text default '',
  created_at      timestamptz not null default now(),

  -- one open report per user per item (stops report-spamming)
  unique (reporter_id, target_type, target_id)
);

create index if not exists idx_reports_status  on public.reports (status, created_at desc);
create index if not exists idx_reports_target  on public.reports (target_type, target_id);

alter table public.reports enable row level security;

drop policy if exists "Staff read all reports" on public.reports;
create policy "Staff read all reports"
  on public.reports for select
  using (public.is_staff() or auth.uid() = reporter_id);

drop policy if exists "Members can file reports" on public.reports;
create policy "Members can file reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id and public.is_active_member());

drop policy if exists "Staff can update reports" on public.reports;
create policy "Staff can update reports"
  on public.reports for update
  using (public.is_staff()) with check (public.is_staff());

-- Rate limit: max 10 reports per user per hour
create or replace function public.check_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.reports
       where reporter_id = new.reporter_id
         and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'You are reporting too quickly. Please slow down.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_report_rate_limit on public.reports;
create trigger trg_report_rate_limit
  before insert on public.reports
  for each row execute function public.check_report_rate_limit();

-- ------------------------------------------------------------
-- MODERATION QUEUE VIEW — what the admin panel actually reads
-- ------------------------------------------------------------
create or replace view public.report_queue
with (security_invoker = on) as
select
  r.*,
  rep.username  as reporter_username,
  rep.avatar_url as reporter_avatar,
  (select count(*) from public.reports r2
    where r2.target_type = r.target_type and r2.target_id = r.target_id) as report_count_for_target
from public.reports r
left join public.profiles rep on rep.id = r.reporter_id;

grant select on public.report_queue to authenticated;

-- ------------------------------------------------------------
-- STAFF ACTIONS
-- ------------------------------------------------------------

-- Ban (or temp-ban) a user. p_days = null → permanent.
create or replace function public.admin_ban_user(
  p_user   uuid,
  p_reason text,
  p_days   int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_until timestamptz;
begin
  if not public.is_staff() then
    raise exception 'Moderators only.';
  end if;

  if public.is_admin(p_user) then
    raise exception 'You cannot ban an administrator.';
  end if;

  v_until := case when p_days is null then null else now() + (p_days || ' days')::interval end;

  perform set_config('vg.privileged', 'on', true);
  update public.profiles
     set is_banned    = true,
         ban_reason   = p_reason,
         banned_until = v_until,
         banned_at    = now(),
         banned_by    = auth.uid(),
         strike_count = strike_count + 1
   where id = p_user;
  perform set_config('vg.privileged', 'off', true);

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason, metadata)
  values (auth.uid(), 'ban_user', 'profile', p_user, p_reason,
          jsonb_build_object('days', p_days, 'until', v_until));
end;
$$;

create or replace function public.admin_unban_user(p_user uuid, p_note text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Moderators only.';
  end if;

  perform set_config('vg.privileged', 'on', true);
  update public.profiles
     set is_banned = false, ban_reason = null, banned_until = null,
         banned_at = null, banned_by = null
   where id = p_user;
  perform set_config('vg.privileged', 'off', true);

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), 'unban_user', 'profile', p_user, p_note);
end;
$$;

-- Mute: can still browse, cannot post or comment.
create or replace function public.admin_set_mute(p_user uuid, p_muted boolean, p_reason text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Moderators only.';
  end if;

  perform set_config('vg.privileged', 'on', true);
  update public.profiles set is_muted = p_muted where id = p_user;
  perform set_config('vg.privileged', 'off', true);

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), case when p_muted then 'mute_user' else 'unmute_user' end, 'profile', p_user, p_reason);
end;
$$;

-- Promote/demote. Admins only.
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;
  if p_role not in ('user','mod','admin') then
    raise exception 'Invalid role.';
  end if;

  perform set_config('vg.privileged', 'on', true);
  update public.profiles set role = p_role where id = p_user;
  perform set_config('vg.privileged', 'off', true);

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), 'set_role', 'profile', p_user, 'role → ' || p_role);
end;
$$;

-- Resolve a report (and every other open report on the same item).
create or replace function public.admin_resolve_report(
  p_report uuid,
  p_status text,
  p_note   text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.reports%rowtype;
begin
  if not public.is_staff() then
    raise exception 'Moderators only.';
  end if;
  if p_status not in ('reviewing','actioned','dismissed') then
    raise exception 'Invalid status.';
  end if;

  select * into r from public.reports where id = p_report;
  if not found then raise exception 'Report not found.'; end if;

  update public.reports
     set status = p_status, handled_by = auth.uid(), handled_at = now(), resolution_note = p_note
   where target_type = r.target_type
     and target_id   = r.target_id
     and status in ('open','reviewing');

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), 'resolve_report', r.target_type, r.target_id, p_status || ': ' || coalesce(p_note,''));
end;
$$;

grant execute on function public.admin_ban_user(uuid,text,int)        to authenticated;
grant execute on function public.admin_unban_user(uuid,text)          to authenticated;
grant execute on function public.admin_set_mute(uuid,boolean,text)    to authenticated;
grant execute on function public.admin_set_role(uuid,text)            to authenticated;
grant execute on function public.admin_resolve_report(uuid,text,text) to authenticated;
