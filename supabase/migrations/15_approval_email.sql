-- ============================================================
-- VIBEGROUNDS — 15: EMAIL ON SCREENSHOT SUBMISSION
-- ============================================================
-- When a member sends a screenshot for approval, email the admin so the
-- queue does not sit unchecked. Without this the feature quietly dies:
-- people upload, nothing happens, they stop bothering.
--
-- Sending goes through Resend's HTTP API rather than SMTP, because a
-- Postgres trigger cannot hold open an SMTP conversation. pg_net fires
-- the request asynchronously — it queues and returns immediately, so a
-- slow or dead mail provider can never make the upload itself hang.
--
-- On the sender address: vibegrounds.com is not verified in Resend yet
-- (no DKIM record exists), so mail cannot be sent *from* the domain.
-- Resend's shared `onboarding@resend.dev` sender works without any DNS
-- setup, with one restriction — it can only deliver to the account
-- owner's own address. That restriction does not matter here, because
-- the only recipient is the admin. The moment the domain is verified,
-- change one row in site_settings and it sends as noreply@vibegrounds.com
-- instead. No code change.
-- ============================================================

create extension if not exists pg_net with schema extensions;

-- ------------------------------------------------------------
-- Settings — sender and recipient live in the database, not in code,
-- so they can be changed without a deploy.
-- ------------------------------------------------------------
insert into public.site_settings (key, value, description) values
  ('notify_email_from', '"VibeGrounds <onboarding@resend.dev>"'::jsonb,
   'Sender for admin notifications. Change to noreply@vibegrounds.com once the domain is verified in Resend.'),
  ('notify_email_to',   '"kierandrowan@gmail.com"'::jsonb,
   'Where admin notifications are delivered.'),
  ('site_origin',       '"https://www.vibegrounds.com"'::jsonb,
   'Used to build links inside notification emails.')
on conflict (key) do nothing;

create or replace function public.setting_text(p_key text, p_default text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select value #>> '{}' from public.site_settings where key = p_key), p_default);
$$;

-- ------------------------------------------------------------
-- The notifier
-- ------------------------------------------------------------
create or replace function public.notify_thumbnail_pending()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key     text;
  v_from    text;
  v_to      text;
  v_origin  text;
  v_user    text;
  v_subject text;
  v_html    text;
begin
  -- Only when it *becomes* pending. Without this guard, any later update
  -- to the row would fire another email.
  if new.pending_thumbnail_status is distinct from 'pending' then
    return null;
  end if;
  if old.pending_thumbnail_status is not distinct from 'pending' then
    return null;
  end if;

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'resend_api_key' limit 1;

  -- No key configured yet: stay silent rather than raising. An upload must
  -- never fail because notification is not set up.
  if v_key is null or length(v_key) < 10 then
    return null;
  end if;

  v_from   := public.setting_text('notify_email_from', 'VibeGrounds <onboarding@resend.dev>');
  v_to     := public.setting_text('notify_email_to',   'kierandrowan@gmail.com');
  v_origin := public.setting_text('site_origin',       'https://www.vibegrounds.com');

  select username into v_user from public.profiles where id = new.creator_id;

  v_subject := 'Screenshot waiting for approval — ' || coalesce(new.title, 'a submission');

  v_html :=
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;background:#14141e;color:#e0e0e0;padding:24px">'
    || '<div style="max-width:520px;margin:0 auto;background:#1a1a2e;border:1px solid #2a2a40;border-radius:6px;overflow:hidden">'
    || '<div style="background:#252540;border-bottom:2px solid #e8a317;padding:14px 18px">'
    ||   '<strong style="color:#e8a317;letter-spacing:1px">VIBEGROUNDS</strong>'
    || '</div>'
    || '<div style="padding:20px 18px">'
    ||   '<h2 style="margin:0 0 6px;font-size:19px;color:#fff">A screenshot needs approving</h2>'
    ||   '<p style="margin:0 0 16px;color:#999;font-size:15px;line-height:1.45">'
    ||     coalesce(nullif(v_user, ''), 'Someone') || ' uploaded a custom screenshot for '
    ||     '<strong style="color:#e0e0e0">' || coalesce(new.title, 'their submission') || '</strong>. '
    ||     'It will not appear on the site until you approve it.'
    ||   '</p>'
    ||   '<img src="' || coalesce(new.pending_thumbnail_url, '') || '" alt="" '
    ||     'style="width:100%;max-height:240px;object-fit:contain;background:#0a0a12;border:1px solid #333;border-radius:4px;display:block;margin-bottom:18px" />'
    ||   '<a href="' || v_origin || '/admin" '
    ||     'style="display:inline-block;background:#e8a317;color:#000;font-weight:bold;text-decoration:none;padding:11px 20px;border-radius:4px">'
    ||     'Review it now</a>'
    ||   '<p style="margin:16px 0 0;color:#666;font-size:13px">'
    ||     'Open the Screenshots tab in the admin dashboard to approve or reject.'
    ||   '</p>'
    || '</div></div></div>';

  -- Fire and forget. pg_net queues this; the transaction does not wait.
  perform net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := jsonb_build_object(
                 'from',    v_from,
                 'to',      jsonb_build_array(v_to),
                 'subject', v_subject,
                 'html',    v_html
               )
  );

  return null;
exception
  when others then
    -- Never let a notification failure roll back the upload. The row is
    -- already saved and visible in the admin queue either way.
    raise warning 'Screenshot notification failed: %', sqlerrm;
    return null;
end;
$$;

drop trigger if exists trg_notify_thumbnail_pending on public.creations;
create trigger trg_notify_thumbnail_pending
  after update on public.creations
  for each row execute function public.notify_thumbnail_pending();
