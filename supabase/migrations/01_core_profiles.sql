-- ============================================================
-- VIBEGROUNDS — 01: CORE & PROFILES
-- Run these migration files IN ORDER in the Supabase SQL Editor.
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ------------------------------------------------------------
-- SITE SETTINGS (tunable knobs, no redeploy needed)
-- ------------------------------------------------------------
create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null,
  description text default '',
  updated_at  timestamptz default now()
);

insert into public.site_settings (key, value, description) values
  ('submission_cost',        '10'::jsonb,   'Coins deducted per submission'),
  ('signup_bonus',           '50'::jsonb,   'Free coins granted on email verification'),
  ('coin_pack_size',         '50'::jsonb,   'Coins per purchased pack'),
  ('coin_pack_price_pence',  '500'::jsonb,  'Price of a coin pack in GBP pence'),
  ('daily_submission_limit', '5'::jsonb,    'Max submissions per user per rolling 24h'),
  ('og_badge_cutoff',        '"2027-01-01T00:00:00Z"'::jsonb, 'Accounts created before this date get the OG badge'),
  ('registration_open',      'true'::jsonb, 'Master switch for new signups')
on conflict (key) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "Settings are publicly readable" on public.site_settings;
create policy "Settings are publicly readable"
  on public.site_settings for select using (true);

-- Helper: read an integer setting with a fallback
create or replace function public.setting_int(p_key text, p_default int)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (value #>> '{}')::int from public.site_settings where key = p_key), p_default);
$$;

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,

  -- identity
  username          citext unique not null,
  display_name      text default '',
  bio               text default '' check (char_length(bio) <= 500),
  avatar_url        text default '',
  banner_url        text default '',
  website           text default '',
  location          text default '',
  accent_color      text default '#e8a317',

  -- economy (WRITE-PROTECTED — see guard trigger below)
  coins             int  not null default 0 check (coins >= 0),
  lifetime_coins    int  not null default 0,
  bonus_claimed     boolean not null default false,

  -- role & standing (WRITE-PROTECTED)
  role              text not null default 'user' check (role in ('user','mod','admin')),
  is_banned         boolean not null default false,
  ban_reason        text,
  banned_until      timestamptz,          -- null + is_banned = permanent
  banned_at         timestamptz,
  banned_by         uuid references auth.users(id) on delete set null,
  strike_count      int not null default 0,
  is_muted          boolean not null default false,

  -- denormalised stats (maintained by triggers)
  submission_count  int not null default 0,
  total_votes_cast  int not null default 0,
  total_score_sum   numeric not null default 0,
  profile_views     int not null default 0,

  -- prefs
  settings          jsonb not null default '{}'::jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint username_format check (username ~ '^[A-Za-z0-9_-]{3,20}$')
);

create index if not exists idx_profiles_username on public.profiles (username);
create index if not exists idx_profiles_created  on public.profiles (created_at desc);
create index if not exists idx_profiles_banned   on public.profiles (is_banned) where is_banned = true;

-- ------------------------------------------------------------
-- RESERVED USERNAMES (stops impersonation of staff/system)
-- ------------------------------------------------------------
create table if not exists public.reserved_usernames (
  username citext primary key
);

insert into public.reserved_usernames (username) values
  ('admin'),('administrator'),('mod'),('moderator'),('staff'),('support'),
  ('vibegrounds'),('vibegrounds_official'),('official'),('system'),('root'),
  ('help'),('api'),('null'),('undefined'),('anonymous'),('deleted'),
  ('tom'),('owner'),('team'),('security'),('billing'),('noreply')
on conflict do nothing;

alter table public.reserved_usernames enable row level security;
drop policy if exists "Reserved usernames readable" on public.reserved_usernames;
create policy "Reserved usernames readable"
  on public.reserved_usernames for select using (true);

-- ------------------------------------------------------------
-- DISPOSABLE EMAIL BLOCKLIST (throwaway signup abuse)
-- ------------------------------------------------------------
create table if not exists public.blocked_email_domains (
  domain text primary key,
  added_at timestamptz default now()
);

insert into public.blocked_email_domains (domain) values
  ('mailinator.com'),('guerrillamail.com'),('10minutemail.com'),('tempmail.com'),
  ('temp-mail.org'),('throwawaymail.com'),('yopmail.com'),('trashmail.com'),
  ('sharklasers.com'),('getnada.com'),('dispostable.com'),('maildrop.cc'),
  ('fakeinbox.com'),('mailnesia.com'),('mintemail.com'),('spamgourmet.com'),
  ('tempr.email'),('emailondeck.com'),('mohmal.com'),('grr.la')
on conflict do nothing;

alter table public.blocked_email_domains enable row level security;
-- Deliberately NO select policy: only server-side (definer) functions read this.

-- ------------------------------------------------------------
-- ROLE HELPERS
-- ------------------------------------------------------------
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role = 'admin');
$$;

create or replace function public.is_staff(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role in ('admin','mod'));
$$;

-- Is the caller a real, verified, non-banned member?
create or replace function public.is_active_member(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = uid
      and u.email_confirmed_at is not null
      and (
        p.is_banned = false
        or (p.banned_until is not null and p.banned_until < now())
      )
  );
$$;

-- ------------------------------------------------------------
-- WHO IS ACTUALLY CALLING?
--
-- This matters more than it looks. Inside a SECURITY DEFINER function
-- current_user is the function *owner* (postgres), not the caller — so
-- checking current_user or session_user from inside a guard tells you
-- nothing and silently disables it. The JWT claims that PostgREST sets
-- on every API request are the only reliable signal.
--
--   no JWT at all -> direct SQL by the owner  -> trusted
--   role = service_role -> our own backend    -> trusted
--   role = authenticated / anon -> a browser  -> GUARDED
-- ------------------------------------------------------------
create or replace function public.caller_is_privileged()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_role text;
begin
  if coalesce(current_setting('vg.privileged', true), 'off') = 'on' then
    return true;
  end if;
  begin
    v_role := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  exception when others then
    v_role := '';
  end;
  return v_role in ('', 'service_role');
end;
$$;

-- ------------------------------------------------------------
-- WRITE GUARD: users may never edit their own coins / role / ban state
-- ------------------------------------------------------------
create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.caller_is_privileged() then
    return new;
  end if;

  new.coins            := old.coins;
  new.lifetime_coins   := old.lifetime_coins;
  new.bonus_claimed    := old.bonus_claimed;
  new.role             := old.role;
  new.is_banned        := old.is_banned;
  new.ban_reason       := old.ban_reason;
  new.banned_until     := old.banned_until;
  new.banned_at        := old.banned_at;
  new.banned_by        := old.banned_by;
  new.strike_count     := old.strike_count;
  new.is_muted         := old.is_muted;
  new.submission_count := old.submission_count;
  new.total_votes_cast := old.total_votes_cast;
  new.total_score_sum  := old.total_score_sum;
  new.created_at       := old.created_at;
  new.updated_at       := now();

  -- A username may never be changed to a reserved name.
  if new.username is distinct from old.username then
    if exists (select 1 from public.reserved_usernames r where r.username = new.username) then
      raise exception 'That username is reserved.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_columns on public.profiles;
create trigger trg_guard_profile_columns
  before update on public.profiles
  for each row execute function public.guard_profile_columns();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
  on public.profiles for select using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Staff can update any profile" on public.profiles;
create policy "Staff can update any profile"
  on public.profiles for update
  using (public.is_staff())
  with check (public.is_staff());

-- No INSERT policy: profiles are only created by the signup trigger below.

-- ------------------------------------------------------------
-- SIGNUP: create profile automatically, with a safe unique username
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested text;
  v_base      text;
  v_candidate text;
  v_domain    text;
  v_n         int := 0;
begin
  -- Block throwaway email providers outright
  v_domain := lower(split_part(new.email, '@', 2));
  if exists (select 1 from public.blocked_email_domains d where d.domain = v_domain) then
    raise exception 'Disposable email addresses are not allowed. Please use a real email.';
  end if;

  v_requested := coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1));

  -- Strip anything not allowed, clamp length
  v_base := regexp_replace(v_requested, '[^A-Za-z0-9_-]', '', 'g');
  v_base := left(v_base, 20);
  if char_length(v_base) < 3 then
    v_base := 'viber' || left(replace(new.id::text, '-', ''), 6);
  end if;

  v_candidate := v_base;

  -- Resolve collisions and reserved names
  while exists (select 1 from public.profiles p where p.username = v_candidate)
     or exists (select 1 from public.reserved_usernames r where r.username = v_candidate)
  loop
    v_n := v_n + 1;
    v_candidate := left(v_base, 20 - char_length(v_n::text) - 1) || '_' || v_n::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (new.id, v_candidate, v_candidate);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
