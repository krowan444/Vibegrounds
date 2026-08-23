-- ============================================================
-- VIBEGROUNDS — 31: THE ARCADE
-- ============================================================
-- A cabinet on the site with a handful of small games in it. A go costs a
-- coin, and everybody gets one free go a day so the machine is never a
-- locked door to somebody who has just arrived and spent their coins.
--
-- The whole point of charging is the same as it is for posting: friction,
-- not money. Nobody can buy coins into this; they are earned by taking part.
--
-- Three things this deliberately does NOT do:
--
--   * It does not trust the browser. The page cannot tell the database "that
--     was free" or "that cost nothing" — start_arcade_play() decides, and it
--     is the only way to start a game.
--   * It does not store scores yet. A leaderboard is the obvious next thing
--     and it is a bigger conversation (what stops somebody posting a made-up
--     score from the console?), so the play row has room for one and nothing
--     reads it.
--   * It does not refund. A go that crashes is a go. Refund logic invites
--     "the game froze, give me my coin back" and there is no way to tell.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A reason the coin ledger will accept
-- ------------------------------------------------------------
alter table public.coin_transactions
  drop constraint if exists coin_transactions_reason_check;

alter table public.coin_transactions
  add constraint coin_transactions_reason_check check (reason in (
    'signup_bonus','submission','purchase','refund',
    'admin_grant','admin_deduct','achievement','contest_prize','featured_bonus',
    'quest_rate5','review_written','arcade_play'
  ));

-- ------------------------------------------------------------
-- 2. What it costs, and the free go
-- ------------------------------------------------------------
insert into public.site_settings (key, value, description) values
  ('arcade_play_cost',          '1'::jsonb, 'Coins a single go in the arcade costs'),
  ('arcade_free_plays_per_day', '1'::jsonb, 'Free goes each person gets per day')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 3. One row per go
-- ------------------------------------------------------------
create table if not exists public.arcade_plays (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  game       text not null check (char_length(game) between 1 and 40),
  was_free   boolean not null default false,
  coins_paid int not null default 0,
  -- Room for a leaderboard later. Nothing writes or reads it yet, and it is
  -- here rather than in a later migration so the row shape stops changing
  -- once people have started playing.
  score      int,
  day        date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);

create index if not exists idx_arcade_plays_user
  on public.arcade_plays (user_id, created_at desc);

-- The free go is enforced by this index, not by a check-then-insert, which
-- races: two taps on a slow connection both read "no free go used yet" and
-- both insert. A unique index cannot be raced — the second one fails.
create unique index if not exists idx_arcade_free_once_a_day
  on public.arcade_plays (user_id, day) where was_free;

alter table public.arcade_plays enable row level security;

drop policy if exists "Players read their own plays" on public.arcade_plays;
create policy "Players read their own plays"
  on public.arcade_plays for select
  using (auth.uid() = user_id or public.is_staff());

-- No insert policy on purpose. Rows arrive only through the function below,
-- which is security definer. A player cannot hand themselves a free go by
-- posting a row with was_free set.

grant select on public.arcade_plays to authenticated;

-- ------------------------------------------------------------
-- 4. Starting a go
-- ------------------------------------------------------------
create or replace function public.start_arcade_play(p_game text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_cost    int  := public.setting_int('arcade_play_cost', 1);
  v_free    int  := public.setting_int('arcade_free_plays_per_day', 1);
  v_today   date := (now() at time zone 'utc')::date;
  v_used    int;
  v_balance int;
  v_play    uuid;
begin
  if v_user is null then
    raise exception 'Sign in to play.';
  end if;

  if not public.is_active_member() then
    raise exception 'Confirm your email address to play.';
  end if;

  if exists (select 1 from public.profiles p where p.id = v_user and p.is_banned) then
    raise exception 'Your account cannot play.';
  end if;

  -- Ten goes in a minute is a script, not a person. This is not about the
  -- coins — it is about somebody hammering the endpoint.
  if (select count(*) from public.arcade_plays
       where user_id = v_user and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Slow down a moment.';
  end if;

  select count(*) into v_used
    from public.arcade_plays
   where user_id = v_user and day = v_today and was_free;

  if v_used < v_free then
    insert into public.arcade_plays (user_id, game, was_free, coins_paid)
    values (v_user, p_game, true, 0)
    returning id into v_play;

    select coins into v_balance from public.profiles where id = v_user;
    return json_build_object(
      'play_id', v_play, 'free', true, 'paid', 0, 'balance', v_balance,
      'free_left', greatest(0, v_free - v_used - 1));
  end if;

  select coins into v_balance from public.profiles where id = v_user;
  if v_balance < v_cost then
    raise exception 'Not enough coins — you need % and have %. Rate a few things or post something to earn more.',
      v_cost, v_balance;
  end if;

  insert into public.arcade_plays (user_id, game, was_free, coins_paid)
  values (v_user, p_game, false, v_cost)
  returning id into v_play;

  -- The ledger is the source of truth for the balance, so the charge happens
  -- after the row exists and returns the new balance.
  v_balance := public.apply_coin_delta(
    v_user, -v_cost, 'arcade_play', 'Arcade: ' || p_game, v_play);

  return json_build_object(
    'play_id', v_play, 'free', false, 'paid', v_cost, 'balance', v_balance,
    'free_left', 0);
end;
$$;

revoke all on function public.start_arcade_play(text) from public, anon;
grant execute on function public.start_arcade_play(text) to authenticated;

-- ------------------------------------------------------------
-- 5. What the cabinet needs to know before you press start
-- ------------------------------------------------------------
create or replace function public.arcade_status()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_free  int  := public.setting_int('arcade_free_plays_per_day', 1);
  v_today date := (now() at time zone 'utc')::date;
  v_used  int  := 0;
begin
  if v_user is null then
    return json_build_object(
      'signed_in', false,
      'cost', public.setting_int('arcade_play_cost', 1),
      'free_left', v_free, 'balance', 0);
  end if;

  select count(*) into v_used
    from public.arcade_plays
   where user_id = v_user and day = v_today and was_free;

  return json_build_object(
    'signed_in', true,
    'cost', public.setting_int('arcade_play_cost', 1),
    'free_left', greatest(0, v_free - v_used),
    'balance', (select coins from public.profiles where id = v_user));
end;
$$;

grant execute on function public.arcade_status() to anon, authenticated;

comment on function public.start_arcade_play(text) is
  'Starts one go. Decides free vs paid itself — the browser does not get a say.';
