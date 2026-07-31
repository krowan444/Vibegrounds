-- ============================================================
-- VIBEGROUNDS — 02: GOLD COIN ECONOMY
-- Every coin movement is recorded in an append-only ledger.
-- Balances can ONLY change through the functions in this file.
-- ============================================================

create table if not exists public.coin_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  amount        int  not null,          -- positive = credit, negative = debit
  balance_after int  not null,
  reason        text not null check (reason in (
                  'signup_bonus','submission','purchase','refund',
                  'admin_grant','admin_deduct','achievement','contest_prize','featured_bonus'
                )),
  note          text default '',
  ref_id        uuid,                   -- creation id, badge id, etc.
  external_ref  text,                   -- Stripe checkout session / payment intent id
  created_at    timestamptz not null default now()
);

create index if not exists idx_coin_tx_user    on public.coin_transactions (user_id, created_at desc);
create unique index if not exists idx_coin_tx_external
  on public.coin_transactions (external_ref) where external_ref is not null;

alter table public.coin_transactions enable row level security;

drop policy if exists "Users read own transactions" on public.coin_transactions;
create policy "Users read own transactions"
  on public.coin_transactions for select
  using (auth.uid() = user_id or public.is_staff());

-- No INSERT/UPDATE/DELETE policies: ledger is written only by definer functions.

-- ------------------------------------------------------------
-- CORE LEDGER PRIMITIVE (internal — not callable by clients)
-- ------------------------------------------------------------
create or replace function public.apply_coin_delta(
  p_user        uuid,
  p_amount      int,
  p_reason      text,
  p_note        text default '',
  p_ref         uuid  default null,
  p_external    text  default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  perform set_config('vg.privileged', 'on', true);

  -- Lock the row so concurrent requests can't double-spend
  select coins into v_balance from public.profiles where id = p_user for update;
  if not found then
    raise exception 'Account not found.';
  end if;

  if v_balance + p_amount < 0 then
    raise exception 'INSUFFICIENT_COINS';
  end if;

  update public.profiles
     set coins = coins + p_amount,
         lifetime_coins = lifetime_coins + greatest(p_amount, 0),
         updated_at = now()
   where id = p_user
   returning coins into v_balance;

  insert into public.coin_transactions (user_id, amount, balance_after, reason, note, ref_id, external_ref)
  values (p_user, p_amount, v_balance, p_reason, coalesce(p_note,''), p_ref, p_external);

  perform set_config('vg.privileged', 'off', true);
  return v_balance;
end;
$$;

revoke all on function public.apply_coin_delta(uuid,int,text,text,uuid,text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- SIGNUP BONUS — claimed once, only after email verification
-- ------------------------------------------------------------
create or replace function public.claim_signup_bonus()
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid      uuid := auth.uid();
  v_bonus    int  := public.setting_int('signup_bonus', 50);
  v_claimed  boolean;
  v_balance  int;
begin
  if v_uid is null then
    raise exception 'You must be signed in.';
  end if;

  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'EMAIL_NOT_VERIFIED';
  end if;

  select bonus_claimed, coins into v_claimed, v_balance
    from public.profiles where id = v_uid for update;

  if v_claimed then
    return json_build_object('granted', false, 'coins', v_balance);
  end if;

  perform set_config('vg.privileged', 'on', true);
  update public.profiles set bonus_claimed = true where id = v_uid;
  perform set_config('vg.privileged', 'off', true);

  v_balance := public.apply_coin_delta(v_uid, v_bonus, 'signup_bonus', 'Welcome to VibeGrounds!');

  return json_build_object('granted', true, 'coins', v_balance, 'amount', v_bonus);
end;
$$;

grant execute on function public.claim_signup_bonus() to authenticated;

-- ------------------------------------------------------------
-- PURCHASES — recorded by the Stripe webhook (service_role only)
-- ------------------------------------------------------------
create table if not exists public.coin_purchases (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  coins              int  not null,
  amount_pence       int  not null,
  currency           text not null default 'gbp',
  status             text not null default 'pending'
                     check (status in ('pending','paid','failed','refunded')),
  stripe_session_id  text unique,
  stripe_payment_id  text,
  created_at         timestamptz not null default now(),
  completed_at       timestamptz
);

create index if not exists idx_purchases_user on public.coin_purchases (user_id, created_at desc);

alter table public.coin_purchases enable row level security;

drop policy if exists "Users read own purchases" on public.coin_purchases;
create policy "Users read own purchases"
  on public.coin_purchases for select
  using (auth.uid() = user_id or public.is_staff());

-- Called by the Stripe webhook with the service_role key. Idempotent:
-- replaying the same session id will not double-credit.
create or replace function public.fulfil_coin_purchase(
  p_session_id text,
  p_payment_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.coin_purchases%rowtype;
  v_balance  int;
begin
  select * into v_purchase
    from public.coin_purchases
   where stripe_session_id = p_session_id
   for update;

  if not found then
    raise exception 'Unknown checkout session %', p_session_id;
  end if;

  if v_purchase.status = 'paid' then
    return json_build_object('already_fulfilled', true);
  end if;

  update public.coin_purchases
     set status = 'paid',
         stripe_payment_id = coalesce(p_payment_id, stripe_payment_id),
         completed_at = now()
   where id = v_purchase.id;

  v_balance := public.apply_coin_delta(
    v_purchase.user_id,
    v_purchase.coins,
    'purchase',
    v_purchase.coins || ' coin pack',
    v_purchase.id,
    p_session_id
  );

  return json_build_object('already_fulfilled', false, 'coins', v_balance);
end;
$$;

revoke all on function public.fulfil_coin_purchase(text,text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- ADMIN: grant or deduct coins by hand
-- ------------------------------------------------------------
create or replace function public.admin_adjust_coins(
  p_user   uuid,
  p_amount int,
  p_note   text default ''
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_balance int;
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;

  v_balance := public.apply_coin_delta(
    p_user, p_amount,
    case when p_amount >= 0 then 'admin_grant' else 'admin_deduct' end,
    p_note
  );

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), 'adjust_coins', 'profile', p_user, p_amount || ' coins: ' || coalesce(p_note,''));

  return v_balance;
end;
$$;

grant execute on function public.admin_adjust_coins(uuid,int,text) to authenticated;
