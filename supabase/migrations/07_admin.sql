-- ============================================================
-- VIBEGROUNDS — 07: ADMIN CONTROL ROOM
-- Everything the moderation dashboard needs, in one place.
-- All functions self-check the caller's role.
-- ============================================================

-- ------------------------------------------------------------
-- AT-A-GLANCE NUMBERS
-- ------------------------------------------------------------
create or replace function public.admin_stats()
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_staff() then raise exception 'Moderators only.'; end if;

  return json_build_object(
    'members_total',       (select count(*) from public.profiles),
    'members_new_7d',      (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'members_banned',      (select count(*) from public.profiles where is_banned),
    'members_unverified',  (select count(*) from auth.users where email_confirmed_at is null),
    'creations_total',     (select count(*) from public.creations where status = 'published'),
    'creations_new_24h',   (select count(*) from public.creations where created_at > now() - interval '24 hours'),
    'creations_removed',   (select count(*) from public.creations where status = 'removed'),
    'reports_open',        (select count(*) from public.reports where status = 'open'),
    'reports_reviewing',   (select count(*) from public.reports where status = 'reviewing'),
    'votes_total',         (select count(*) from public.votes),
    'reviews_total',       (select count(*) from public.reviews where status = 'visible'),
    'coins_in_circulation',(select coalesce(sum(coins),0) from public.profiles),
    'revenue_pence',       (select coalesce(sum(amount_pence),0) from public.coin_purchases where status = 'paid')
  );
end;
$$;

grant execute on function public.admin_stats() to authenticated;

-- ------------------------------------------------------------
-- USER SEARCH — includes the email, which is why it's a function
-- and not a view (auth.users is not exposed to the client).
-- ------------------------------------------------------------
create or replace function public.admin_list_users(
  p_query  text default '',
  p_filter text default 'all',       -- all | banned | unverified | staff | new
  p_limit  int  default 50,
  p_offset int  default 0
)
returns table (
  id               uuid,
  username         text,
  email            text,
  email_verified   boolean,
  role             text,
  coins            int,
  is_banned        boolean,
  is_muted         boolean,
  ban_reason       text,
  banned_until     timestamptz,
  strike_count     int,
  submission_count int,
  open_reports     bigint,
  created_at       timestamptz,
  last_sign_in_at  timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_staff() then raise exception 'Moderators only.'; end if;

  return query
  select
    p.id,
    p.username::text,
    u.email::text,
    (u.email_confirmed_at is not null) as email_verified,
    p.role,
    p.coins,
    p.is_banned,
    p.is_muted,
    p.ban_reason,
    p.banned_until,
    p.strike_count,
    p.submission_count,
    (select count(*) from public.reports r
      where r.target_type = 'profile' and r.target_id = p.id and r.status = 'open') as open_reports,
    p.created_at,
    u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where
    (p_query = '' or p.username::text ilike '%' || p_query || '%' or u.email::text ilike '%' || p_query || '%')
    and case p_filter
          when 'banned'     then p.is_banned
          when 'unverified' then u.email_confirmed_at is null
          when 'staff'      then p.role in ('admin','mod')
          when 'new'        then p.created_at > now() - interval '7 days'
          else true
        end
  order by p.created_at desc
  limit greatest(1, least(p_limit, 200)) offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.admin_list_users(text,text,int,int) to authenticated;

-- ------------------------------------------------------------
-- REPORT QUEUE WITH THE REPORTED CONTENT ATTACHED
-- Saves the dashboard doing five round trips per report.
-- ------------------------------------------------------------
create or replace function public.admin_report_queue(
  p_status text default 'open',
  p_limit  int  default 50
)
returns table (
  report_id        uuid,
  target_type      text,
  target_id        uuid,
  reason           text,
  details          text,
  status           text,
  created_at       timestamptz,
  reporter_id      uuid,
  reporter_name    text,
  duplicate_count  bigint,
  content_title    text,
  content_body     text,
  content_url      text,
  owner_id         uuid,
  owner_name       text,
  owner_strikes    int,
  owner_banned     boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'Moderators only.'; end if;

  return query
  select
    r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at,
    r.reporter_id, rp.username::text,
    (select count(*) from public.reports r2
      where r2.target_type = r.target_type and r2.target_id = r.target_id),
    case r.target_type
      when 'creation' then (select c.title from public.creations c where c.id = r.target_id)
      when 'thread'   then (select t.title from public.forum_threads t where t.id = r.target_id)
      when 'profile'  then (select p.username::text from public.profiles p where p.id = r.target_id)
      else null
    end,
    case r.target_type
      when 'creation' then (select c.description from public.creations c where c.id = r.target_id)
      when 'review'   then (select rv.body from public.reviews rv where rv.id = r.target_id)
      when 'thread'   then (select t.body from public.forum_threads t where t.id = r.target_id)
      when 'post'     then (select fp.body from public.forum_posts fp where fp.id = r.target_id)
      when 'profile'  then (select p.bio from public.profiles p where p.id = r.target_id)
      else null
    end,
    case r.target_type
      when 'creation' then (select c.project_url from public.creations c where c.id = r.target_id)
      else null
    end,
    o.id, o.username::text, o.strike_count, o.is_banned
  from public.reports r
  left join public.profiles rp on rp.id = r.reporter_id
  left join public.profiles o on o.id = case r.target_type
      when 'creation' then (select c.creator_id from public.creations c where c.id = r.target_id)
      when 'review'   then (select rv.author_id from public.reviews rv where rv.id = r.target_id)
      when 'thread'   then (select t.author_id from public.forum_threads t where t.id = r.target_id)
      when 'post'     then (select fp.author_id from public.forum_posts fp where fp.id = r.target_id)
      when 'profile'  then r.target_id
    end
  where (p_status = 'all' or r.status = p_status)
  order by r.created_at desc
  limit greatest(1, least(p_limit, 200));
end;
$$;

grant execute on function public.admin_report_queue(text,int) to authenticated;

-- ------------------------------------------------------------
-- NUCLEAR OPTION — ban + wipe everything a bad actor posted.
-- One click for the "racist remarks" case.
-- ------------------------------------------------------------
create or replace function public.admin_purge_user(p_user uuid, p_reason text default 'Terms of service violation')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creations int; v_reviews int; v_threads int; v_posts int;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if public.is_admin(p_user) then raise exception 'You cannot purge an administrator.'; end if;

  update public.creations set status = 'removed', removed_reason = p_reason, removed_by = auth.uid()
   where creator_id = p_user and status <> 'removed';
  get diagnostics v_creations = row_count;

  update public.reviews set status = 'removed', removed_by = auth.uid()
   where author_id = p_user and status <> 'removed';
  get diagnostics v_reviews = row_count;

  update public.forum_threads set status = 'removed' where author_id = p_user and status <> 'removed';
  get diagnostics v_threads = row_count;

  update public.forum_posts set status = 'removed' where author_id = p_user and status <> 'removed';
  get diagnostics v_posts = row_count;

  perform public.admin_ban_user(p_user, p_reason, null);

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason, metadata)
  values (auth.uid(), 'purge_user', 'profile', p_user, p_reason,
          jsonb_build_object('creations', v_creations, 'reviews', v_reviews,
                             'threads', v_threads, 'posts', v_posts));

  return json_build_object('creations', v_creations, 'reviews', v_reviews,
                           'threads', v_threads, 'posts', v_posts);
end;
$$;

grant execute on function public.admin_purge_user(uuid,text) to authenticated;

-- ------------------------------------------------------------
-- RECENT ACTIVITY FEED for the dashboard
-- ------------------------------------------------------------
create or replace function public.admin_recent_activity(p_limit int default 40)
returns table (
  kind       text,
  id         uuid,
  label      text,
  actor      text,
  actor_id   uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'Moderators only.'; end if;

  return query
  (
    select 'creation'::text, c.id, c.title, p.username::text, p.id, c.created_at
      from public.creations c join public.profiles p on p.id = c.creator_id
     order by c.created_at desc limit p_limit
  )
  union all
  (
    select 'signup'::text, p.id, p.username::text, p.username::text, p.id, p.created_at
      from public.profiles p order by p.created_at desc limit p_limit
  )
  union all
  (
    select 'report'::text, r.id, r.reason || ' → ' || r.target_type, rp.username::text, rp.id, r.created_at
      from public.reports r left join public.profiles rp on rp.id = r.reporter_id
     order by r.created_at desc limit p_limit
  )
  order by 6 desc
  limit p_limit;
end;
$$;

grant execute on function public.admin_recent_activity(int) to authenticated;

-- ------------------------------------------------------------
-- BOOTSTRAP: make yourself the first admin.
-- Run ONCE from the SQL editor after you've signed up:
--   select public.bootstrap_admin('kierandrowan@gmail.com');
-- It refuses to run a second time once an admin exists.
-- ------------------------------------------------------------
create or replace function public.bootstrap_admin(p_email text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_id uuid;
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'An admin already exists. Use admin_set_role() from the dashboard instead.';
  end if;

  select id into v_id from auth.users where lower(email) = lower(p_email);
  if v_id is null then
    raise exception 'No account found for %. Sign up first, then run this again.', p_email;
  end if;

  perform set_config('vg.privileged', 'on', true);
  update public.profiles set role = 'admin' where id = v_id;
  perform set_config('vg.privileged', 'off', true);

  perform public.evaluate_badges(v_id);

  return 'Done — ' || p_email || ' is now an administrator.';
end;
$$;

-- ------------------------------------------------------------
-- SETTINGS EDITOR
-- ------------------------------------------------------------
create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  insert into public.site_settings (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value, updated_at = now();

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), 'set_setting', 'profile', auth.uid(), p_key || ' = ' || p_value::text);
end;
$$;

grant execute on function public.admin_set_setting(text,jsonb) to authenticated;
