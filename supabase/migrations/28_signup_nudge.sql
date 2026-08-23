-- ============================================================
-- VIBEGROUNDS — 28: THE WEEK-LATER NUDGE
-- ============================================================
-- Somebody joins, gets their 50 coins, has a look round, and never posts.
-- A week later they have forgotten the site exists. One email, once, is a
-- fair thing to send them; a stream of them is not, and the difference
-- between the two is entirely in the details below.
--
-- Four rules this is built around:
--
--   1. ONCE. nudged_at is stamped when it sends, and the query skips
--      anybody who has one. There is no second email, ever, from this.
--   2. STOPPABLE. Every message carries a one-click unsubscribe that works
--      without signing in — because somebody who has forgotten the site
--      certainly cannot remember a password, and an unsubscribe link that
--      demands a login is not an unsubscribe link.
--   3. HONEST. It only goes to people who confirmed their email address,
--      which means they asked for contact. Never to anyone banned, opted
--      out, or who already posted something.
--   4. OFF UNTIL SOMEBODY LOOKS. This ships disabled and, when enabled,
--      starts in dry-run: it works out exactly who would be emailed and
--      writes it to email_log without sending anything. Two settings turn
--      it on properly. Sending to real people is the one thing on this
--      site that cannot be undone, and a bad first run damages the
--      domain's reputation permanently.
-- ============================================================

-- ------------------------------------------------------------
-- 1. What we need to remember about a person
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists email_optout boolean not null default false;

alter table public.profiles
  add column if not exists nudged_at timestamptz;

-- Random per person and never exposed in the app. It is the whole security
-- of the unsubscribe link: knowing it proves you received the email, which
-- is exactly as much proof as unsubscribing needs.
alter table public.profiles
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists idx_profiles_unsub_token
  on public.profiles (unsubscribe_token);

-- Existing rows all got the same default at ALTER time in some Postgres
-- versions; make sure everybody has their own.
update public.profiles p
   set unsubscribe_token = gen_random_uuid()
 where unsubscribe_token in (
   select unsubscribe_token from public.profiles
   group by unsubscribe_token having count(*) > 1
 );

-- ------------------------------------------------------------
-- 2. A record of everything sent
-- ------------------------------------------------------------
-- Partly so a bug cannot quietly send the same thing twice, and partly so
-- that "did you email me?" has an answer that is not a shrug.
create table if not exists public.email_log (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  kind       text not null,
  to_email   text not null default '',
  dry_run    boolean not null default true,
  note       text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_email_log_kind on public.email_log (kind, created_at desc);

alter table public.email_log enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='email_log' and policyname='email_log_staff_read') then
    create policy email_log_staff_read on public.email_log
      for select to authenticated using (public.is_staff());
  end if;
end
$$;
grant select on public.email_log to authenticated;

-- ------------------------------------------------------------
-- 3. Settings — all three default to "do nothing"
-- ------------------------------------------------------------
insert into public.site_settings (key, value, description) values
  ('nudge_enabled', 'false'::jsonb,
   'Master switch for the week-later signup nudge. Leave false until you have looked at a dry run.'),
  ('nudge_dry_run', 'true'::jsonb,
   'When true, work out who would be emailed and log it, but send nothing.'),
  ('nudge_after_days', '7'::jsonb,
   'How long after joining, in days, before the nudge is considered.')
on conflict (key) do nothing;

-- Restated from migration 15 rather than assumed. 15 needs pg_net and gets
-- skipped when this stack is replayed anywhere without it, and a migration
-- that only works if an earlier one happened to run is a migration that
-- fails at the worst possible moment. Identical definition, so re-creating
-- it changes nothing where 15 did run.
create or replace function public.setting_text(p_key text, p_default text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select value #>> '{}' from public.site_settings where key = p_key), p_default);
$$;

create or replace function public.setting_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (value #>> '{}')::boolean from public.site_settings where key = p_key), p_default);
$$;

-- ------------------------------------------------------------
-- 4. Stopping the email, without signing in
-- ------------------------------------------------------------
create or replace function public.unsubscribe_by_token(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.profiles where unsubscribe_token = p_token;
  if v_id is null then
    return false;
  end if;

  perform set_config('vg.privileged', 'on', true);
  update public.profiles set email_optout = true where id = v_id;
  perform set_config('vg.privileged', 'off', true);

  insert into public.email_log (profile_id, kind, note, dry_run)
  values (v_id, 'unsubscribe', 'unsubscribed from an email link', false);

  return true;
end;
$$;

revoke all on function public.unsubscribe_by_token(uuid) from public;
grant execute on function public.unsubscribe_by_token(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 5. Who is due one
-- ------------------------------------------------------------
-- A view rather than a subquery buried in the sender, so the list can be
-- looked at before anything is sent, and so the dry run and the real run
-- can never disagree about who qualifies.
create or replace view public.nudge_due
with (security_invoker = true) as
  select
    p.id,
    p.username,
    u.email,
    p.created_at,
    p.unsubscribe_token
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.nudged_at is null
    and p.email_optout = false
    and p.is_banned = false
    and u.email_confirmed_at is not null
    and u.email is not null
    and p.created_at < now() - (public.setting_int('nudge_after_days', 7) || ' days')::interval
    -- Nothing posted anywhere. Somebody who put up a comic but no creation
    -- has not gone quiet, and telling them they have would be insulting.
    and not exists (select 1 from public.creations c where c.creator_id = p.id)
    and not exists (select 1 from public.comics  cm where cm.creator_id = p.id);

-- ------------------------------------------------------------
-- 6. The sender
-- ------------------------------------------------------------
create or replace function public.send_signup_nudges()
returns TABLE(considered int, sent int, mode text)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_key     text;
  v_from    text;
  v_origin  text;
  v_dry     boolean;
  v_row     record;
  v_html    text;
  v_unsub   text;
  n_seen    int := 0;
  n_sent    int := 0;
begin
  if not public.setting_bool('nudge_enabled', false) then
    return query select 0, 0, 'disabled'::text;
    return;
  end if;

  v_dry    := public.setting_bool('nudge_dry_run', true);
  v_from   := public.setting_text('notify_email_from', 'VibeGrounds <onboarding@resend.dev>');
  v_origin := public.setting_text('site_origin', 'https://www.vibegrounds.com');

  -- Only when actually sending. A dry run sends nothing, so making it
  -- depend on the mail key means the first thing anybody runs is the thing
  -- most likely to fail — and it would fail for a reason that has nothing
  -- to do with what the dry run is for.
  if not v_dry then
    begin
      select decrypted_secret into v_key
        from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
    exception
      when others then v_key := null;
    end;

    -- Without a key this would send nothing while stamping everybody as
    -- nudged — burning the single email each of them ever gets, silently.
    -- Refuse instead.
    if v_key is null or length(v_key) < 10 then
      raise exception 'No Resend key configured — refusing to mark people as emailed.';
    end if;
  end if;

  -- A cap, because the first real run is the dangerous one. Fifty a day
  -- also keeps a new sending domain well under the rate at which mail
  -- providers start treating it as a spam source.
  for v_row in select * from public.nudge_due order by created_at limit 50 loop
    n_seen := n_seen + 1;
    v_unsub := v_origin || '/unsubscribe?t=' || v_row.unsubscribe_token;

    if not v_dry then
      v_html :=
        '<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;background:#14141e;color:#e0e0e0;padding:24px">'
        || '<div style="max-width:520px;margin:0 auto;background:#1a1a2e;border:1px solid #2a2a40;border-radius:6px;overflow:hidden">'
        || '<div style="background:#252540;border-bottom:2px solid #e8a317;padding:14px 18px">'
        ||   '<strong style="color:#e8a317;letter-spacing:1px">VIBEGROUNDS</strong>'
        || '</div>'
        || '<div style="padding:20px 18px">'
        ||   '<h2 style="margin:0 0 10px;font-size:19px;color:#fff">Still got something half-finished?</h2>'
        ||   '<p style="margin:0 0 14px;color:#bbb;font-size:15px;line-height:1.5">'
        ||     'Hello ' || coalesce(nullif(v_row.username,''), 'there') || ' — you joined VibeGrounds a week ago '
        ||     'and have not posted anything yet. No pressure at all, but the whole point of the place is that '
        ||     'it does not have to be finished. Broken, odd and unfinished is welcome.'
        ||   '</p>'
        ||   '<p style="margin:0 0 18px;color:#bbb;font-size:15px;line-height:1.5">'
        ||     'You still have your free coins waiting.'
        ||   '</p>'
        ||   '<a href="' || v_origin || '/upload" '
        ||     'style="display:inline-block;background:#e8a317;color:#000;font-weight:bold;text-decoration:none;padding:11px 20px;border-radius:4px">'
        ||     'Post something</a>'
        ||   '<p style="margin:18px 0 0;color:#666;font-size:13px;line-height:1.5">'
        ||     'This is the only email of this kind you will get from us.<br>'
        ||     '<a href="' || v_unsub || '" style="color:#888">Stop emails from VibeGrounds</a> '
        ||     '&middot; or just reply to this and tell me what put you off.'
        ||   '</p>'
        || '</div></div></div>';

      perform net.http_post(
        url     := 'https://api.resend.com/emails',
        headers := jsonb_build_object(
                     'Content-Type',  'application/json',
                     'Authorization', 'Bearer ' || v_key
                   ),
        body    := jsonb_build_object(
                     'from',    v_from,
                     'to',      jsonb_build_array(v_row.email),
                     'subject', 'Still got something half-finished?',
                     'html',    v_html,
                     -- The header Gmail and Outlook use to show their own
                     -- unsubscribe button next to the sender name.
                     'headers', jsonb_build_object(
                       'List-Unsubscribe', '<' || v_unsub || '>',
                       'List-Unsubscribe-Post', 'List-Unsubscribe=One-Click'
                     )
                   )
      );

      perform set_config('vg.privileged', 'on', true);
      update public.profiles set nudged_at = now() where id = v_row.id;
      perform set_config('vg.privileged', 'off', true);

      n_sent := n_sent + 1;
    end if;

    insert into public.email_log (profile_id, kind, to_email, dry_run, note)
    values (v_row.id, 'signup_nudge', v_row.email, v_dry,
            case when v_dry then 'dry run — nothing sent' else 'sent' end);
  end loop;

  return query select n_seen, n_sent, case when v_dry then 'dry run' else 'live' end::text;
end;
$$;

revoke all on function public.send_signup_nudges() from public;
-- Staff only. The cron job runs as the table owner and does not need this.
grant execute on function public.send_signup_nudges() to authenticated;

-- ------------------------------------------------------------
-- 6b. Flipping the switches without touching SQL
-- ------------------------------------------------------------
-- The two settings that decide whether real people get real email should
-- not require opening a database console. One function, staff only, and it
-- writes what happened to email_log so the decision is on the record.
create or replace function public.set_nudge_mode(p_enabled boolean, p_dry boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only.';
  end if;

  update public.site_settings set value = to_jsonb(p_enabled) where key = 'nudge_enabled';
  update public.site_settings set value = to_jsonb(p_dry)     where key = 'nudge_dry_run';

  insert into public.email_log (kind, note, dry_run)
  values ('setting',
          'nudge_enabled=' || p_enabled || ', nudge_dry_run=' || p_dry,
          true);
end;
$$;

revoke all on function public.set_nudge_mode(boolean, boolean) from public;
grant execute on function public.set_nudge_mode(boolean, boolean) to authenticated;

-- ------------------------------------------------------------
-- 7. Daily, at a civilised hour
-- ------------------------------------------------------------
-- 10am UTC. The function itself no-ops while nudge_enabled is false, so
-- scheduling it now is safe and means there is nothing left to remember
-- when the switch is flipped.
-- No `with schema extensions` here, and that is not a style choice: pg_cron
-- insists on its own `cron` schema and refuses to be installed anywhere
-- else. The first version of this migration asked for the extensions schema,
-- failed, and — because the failure was swallowed by the exception handler
-- below — reported success while quietly scheduling nothing at all. The
-- feature would have sat there looking finished and never once run.
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('vg-signup-nudge');
exception
  when others then null;   -- simply not scheduled yet
end
$$;

do $$
begin
  perform cron.schedule('vg-signup-nudge', '0 10 * * *', 'select public.send_signup_nudges();');
  raise notice 'Scheduled vg-signup-nudge daily at 10:00 UTC.';
exception
  when others then
    -- Still tolerated, because a stack without pg_cron should not fail the
    -- whole migration — but it says so loudly rather than passing silently.
    raise warning 'COULD NOT SCHEDULE the nudge (%). It will never run on its own — run send_signup_nudges() by hand or fix pg_cron.', sqlerrm;
end
$$;
