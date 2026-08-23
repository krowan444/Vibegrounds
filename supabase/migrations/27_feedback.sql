-- ============================================================
-- VIBEGROUNDS — 27: TELLING KIERAN SOMETHING IS BROKEN
-- ============================================================
-- Distinct from `reports`, which is about a piece of content and a person:
-- somebody posted something that breaks the rules. This is about the site
-- itself — a button that does nothing, a page that looks wrong on a phone,
-- a wording that confuses people, an idea for something missing.
--
-- The decision worth explaining is that this accepts feedback from people
-- who are NOT signed in.
--
-- Requiring an account is the obvious way to keep spam out, and it silently
-- throws away the most valuable message the site can receive: "I tried to
-- join and it did not work." The person who most needs to reach you is
-- exactly the person who cannot get an account. So anonymous is allowed,
-- and the spam risk is handled by a rate limit inside the function instead:
-- five anonymous messages an hour across the whole site. At fifteen members
-- that is generous; if it ever starts filling with rubbish, the number is
-- one line to change.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The table
-- ------------------------------------------------------------
create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),

  -- Null for anonymous. Set null rather than cascade-deleting on account
  -- removal: the bug report stays useful after the person leaves.
  reporter_id  uuid references public.profiles(id) on delete set null,

  kind         text not null default 'bug'
               check (kind in ('bug','idea','confusing','other')),

  body         text not null check (char_length(body) between 10 and 4000),

  -- Where they were when they hit it. The single most useful field in a bug
  -- report and the one nobody ever remembers to include, so it is filled in
  -- automatically rather than asked for.
  page_url     text not null default '' check (char_length(page_url) <= 500),

  -- Same reasoning. "It looks broken" and "it looks broken on an iPhone in
  -- Safari" are different amounts of information.
  user_agent   text not null default '' check (char_length(user_agent) <= 400),

  -- Optional, and only meaningful for anonymous senders — a signed-in one
  -- can already be replied to. Never shown publicly.
  contact_email text not null default '' check (char_length(contact_email) <= 200),

  status       text not null default 'new'
               check (status in ('new','reading','done','wontfix')),
  admin_note   text not null default '' check (char_length(admin_note) <= 2000),
  handled_by   uuid references public.profiles(id) on delete set null,
  handled_at   timestamptz,

  created_at   timestamptz not null default now()
);

create index if not exists idx_feedback_status
  on public.feedback (status, created_at desc);

-- ------------------------------------------------------------
-- 2. Who can see what
-- ------------------------------------------------------------
alter table public.feedback enable row level security;

do $$
begin
  -- Staff read everything. That is the inbox.
  if not exists (select 1 from pg_policies where tablename='feedback' and policyname='feedback_staff_read') then
    create policy feedback_staff_read on public.feedback
      for select to authenticated using (public.is_staff());
  end if;

  -- You can see your own, so "did that send?" has an answer.
  if not exists (select 1 from pg_policies where tablename='feedback' and policyname='feedback_own_read') then
    create policy feedback_own_read on public.feedback
      for select to authenticated using (reporter_id = auth.uid());
  end if;

  -- Only staff change status or leave notes.
  if not exists (select 1 from pg_policies where tablename='feedback' and policyname='feedback_staff_write') then
    create policy feedback_staff_write on public.feedback
      for update to authenticated using (public.is_staff()) with check (public.is_staff());
  end if;
end
$$;

-- Deliberately no insert policy for anybody. Everything goes through
-- submit_feedback() below, which is the only place the rate limit exists —
-- an insert policy would be a way around it.

-- Row-level security decides WHICH rows; this decides whether the role may
-- look at the table at all. Both are needed, and it is easy to write the
-- policies, believe the job is done, and end up with an inbox that even
-- staff get "permission denied" from — which is exactly what happened here
-- the first time. anon gets nothing: it can send feedback through the
-- function and read none of it back.
grant select on public.feedback to authenticated;
grant update (status, admin_note, handled_by, handled_at) on public.feedback to authenticated;

-- ------------------------------------------------------------
-- 3. Sending one
-- ------------------------------------------------------------
create or replace function public.submit_feedback(
  p_kind    text,
  p_body    text,
  p_page    text default '',
  p_agent   text default '',
  p_email   text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_kind text;
  v_id   uuid;
  v_recent int;
begin
  if char_length(coalesce(trim(p_body), '')) < 10 then
    raise exception 'Tell me a bit more than that — a sentence is plenty.';
  end if;

  v_kind := case when p_kind in ('bug','idea','confusing','other') then p_kind else 'other' end;

  if v_uid is null then
    -- Anonymous. Rate limited across the whole site rather than per person,
    -- because there is no person to count.
    select count(*) into v_recent
      from public.feedback
     where reporter_id is null
       and created_at > now() - interval '1 hour';
    if v_recent >= 5 then
      raise exception 'RATE_LIMITED';
    end if;
  else
    -- Signed in. Counted per account, and more generously.
    select count(*) into v_recent
      from public.feedback
     where reporter_id = v_uid
       and created_at > now() - interval '1 hour';
    if v_recent >= 10 then
      raise exception 'RATE_LIMITED';
    end if;
  end if;

  insert into public.feedback (reporter_id, kind, body, page_url, user_agent, contact_email)
  values (
    v_uid,
    v_kind,
    trim(p_body),
    left(coalesce(p_page, ''), 500),
    left(coalesce(p_agent, ''), 400),
    left(coalesce(trim(p_email), ''), 200)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_feedback(text, text, text, text, text) from public;
grant execute on function public.submit_feedback(text, text, text, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 4. The inbox
-- ------------------------------------------------------------
-- security_invoker so the policies above still apply — this view does not
-- become a way for a signed-in user to read everybody's feedback.
create or replace view public.feedback_inbox
with (security_invoker = true) as
  select
    f.id,
    f.kind,
    f.body,
    f.page_url,
    f.user_agent,
    f.contact_email,
    f.status,
    f.admin_note,
    f.created_at,
    f.handled_at,
    f.reporter_id,
    p.username  as reporter_username,
    h.username  as handled_by_username
  from public.feedback f
  left join public.profiles p on p.id = f.reporter_id
  left join public.profiles h on h.id = f.handled_by;

grant select on public.feedback_inbox to authenticated;

-- ------------------------------------------------------------
-- 5. Marking one done
-- ------------------------------------------------------------
create or replace function public.set_feedback_status(
  p_id     uuid,
  p_status text,
  p_note   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only.';
  end if;
  if p_status not in ('new','reading','done','wontfix') then
    raise exception 'Unknown status.';
  end if;

  update public.feedback
     set status     = p_status,
         admin_note = coalesce(left(p_note, 2000), admin_note),
         handled_by = auth.uid(),
         handled_at = now()
   where id = p_id;
end;
$$;

revoke all on function public.set_feedback_status(uuid, text, text) from public;
grant execute on function public.set_feedback_status(uuid, text, text) to authenticated;
