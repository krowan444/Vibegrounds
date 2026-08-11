-- ============================================================
-- 12_engagement_rewards.sql
--
-- Paying for the behaviour we can actually get.
--
-- Submissions are the thing we want, but a site with three members will not
-- produce daily submissions for months. Ratings and reviews, however, are
-- available from day one — a member with no project of their own can still
-- turn up and score five things.
--
-- So the economy now pays for judging, not just posting:
--
--   * Rate 5 things in a day  -> a coin bounty, once per day
--   * Write a review          -> coins per review, capped daily
--
-- Reviews pay more than votes because a paragraph of honest feedback is worth
-- vastly more to a new creator than an anonymous 4/5, and because it is much
-- harder to fake at scale.
--
-- Every payout goes through apply_coin_delta, so it lands in the same locking
-- ledger as everything else and cannot be double-spent by racing requests.
-- ============================================================

-- ------------------------------------------------------------
-- The ledger's `reason` is a CHECK-constrained enum, so the two new payout
-- kinds have to be admitted before anything can write them. Done first, and
-- as a single atomic swap, so a failure here stops the whole migration rather
-- than leaving functions that raise at runtime.
-- ------------------------------------------------------------
alter table public.coin_transactions
  drop constraint if exists coin_transactions_reason_check;

alter table public.coin_transactions
  add constraint coin_transactions_reason_check check (reason in (
    'signup_bonus','submission','purchase','refund',
    'admin_grant','admin_deduct','achievement','contest_prize','featured_bonus',
    'quest_rate5','review_written'
  ));

-- ------------------------------------------------------------
-- One row per user per quest per day. The unique constraint IS the
-- anti-double-claim mechanism — cheaper and more reliable than checking
-- first and inserting after, which races.
-- ------------------------------------------------------------
create table if not exists public.quest_claims (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  quest      text not null,
  day        date not null default (now() at time zone 'utc')::date,
  amount     int  not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, quest, day)
);

alter table public.quest_claims enable row level security;

drop policy if exists quest_claims_own on public.quest_claims;
create policy quest_claims_own on public.quest_claims
  for select using (user_id = auth.uid());

-- ------------------------------------------------------------
-- How many votes has this member cast today? Used by both the claim
-- function and the UI progress bar, so they can never disagree.
-- ------------------------------------------------------------
create or replace function public.rating_quest_status()
returns json
language plpgsql stable security definer set search_path = public, auth
as $$
declare
  v_uid    uuid := auth.uid();
  v_today  date := (now() at time zone 'utc')::date;
  v_votes  int;
  v_target int := 5;
  v_reward int := 5;
  v_done   boolean;
begin
  if v_uid is null then
    return json_build_object('signed_in', false);
  end if;

  select count(*) into v_votes
    from public.votes
   where user_id = v_uid
     and (updated_at at time zone 'utc')::date = v_today;

  select exists (
    select 1 from public.quest_claims
     where user_id = v_uid and quest = 'rate5' and day = v_today
  ) into v_done;

  return json_build_object(
    'signed_in', true,
    'votes_today', v_votes,
    'target', v_target,
    'reward', v_reward,
    'claimed', v_done,
    'claimable', (v_votes >= v_target and not v_done)
  );
end;
$$;

grant execute on function public.rating_quest_status() to authenticated;

-- ------------------------------------------------------------
-- Claim the daily rating bounty.
-- ------------------------------------------------------------
create or replace function public.claim_rating_quest()
returns json
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_uid     uuid := auth.uid();
  v_today   date := (now() at time zone 'utc')::date;
  v_votes   int;
  v_target  int := 5;
  v_reward  int := 5;
  v_balance int;
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;

  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'EMAIL_NOT_VERIFIED';
  end if;
  if not public.is_active_member(v_uid) then raise exception 'ACCOUNT_BANNED'; end if;

  -- Votes on your own work are impossible (cast_vote blocks self-votes), so
  -- this cannot be farmed by rating yourself five times.
  select count(*) into v_votes
    from public.votes
   where user_id = v_uid
     and (updated_at at time zone 'utc')::date = v_today;

  if v_votes < v_target then
    raise exception 'Rate % more before claiming.', v_target - v_votes;
  end if;

  -- Let the primary key reject a second claim rather than testing for it.
  begin
    insert into public.quest_claims (user_id, quest, day, amount)
    values (v_uid, 'rate5', v_today, v_reward);
  exception when unique_violation then
    raise exception 'Already claimed today. Come back tomorrow.';
  end;

  v_balance := public.apply_coin_delta(
    v_uid, v_reward, 'quest_rate5', 'Rated 5 submissions today'
  );

  return json_build_object('awarded', v_reward, 'balance', v_balance);
end;
$$;

grant execute on function public.claim_rating_quest() to authenticated;

-- ------------------------------------------------------------
-- Reviews earn coins. Capped per day so it cannot become a coin printer,
-- and short throwaway comments earn nothing — the payout is for effort.
-- ------------------------------------------------------------
create or replace function public.reward_review()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_today       date := (now() at time zone 'utc')::date;
  v_paid_today  int;
  v_daily_cap   int := 3;
  v_reward      int := 3;
  v_min_length  int := 80;
  v_creator     uuid;
begin
  if TG_OP <> 'INSERT' or new.status <> 'visible' then
    return new;
  end if;

  -- A one-line "nice!" is not worth paying for.
  if char_length(trim(new.body)) < v_min_length then
    return new;
  end if;

  -- Never pay someone for reviewing their own submission.
  select creator_id into v_creator from public.creations where id = new.creation_id;
  if v_creator = new.author_id then
    return new;
  end if;

  select count(*) into v_paid_today
    from public.coin_transactions
   where user_id = new.author_id
     and reason = 'review_written'
     and (created_at at time zone 'utc')::date = v_today;

  if v_paid_today >= v_daily_cap then
    return new;
  end if;

  perform public.apply_coin_delta(
    new.author_id, v_reward, 'review_written', 'Wrote a review', new.id
  );

  return new;
end;
$$;

drop trigger if exists trg_reward_review on public.reviews;
create trigger trg_reward_review
  after insert on public.reviews
  for each row execute function public.reward_review();

comment on function public.claim_rating_quest() is
  'Daily bounty for rating five submissions. Voting is the habit a small site '
  'can actually build; submissions follow later.';
