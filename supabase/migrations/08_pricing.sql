-- ============================================================
-- VIBEGROUNDS — 08: MULTI-CURRENCY COIN PACKS
-- The headline number stays a clean "5" in every market:
-- £5 in the UK, $5 in the US, €5 in the eurozone — not a
-- converted £5 that shows up as $6.37.
-- ============================================================

create table if not exists public.coin_packs (
  slug        text primary key,
  name        text not null,
  coins       int  not null check (coins > 0),
  bonus_coins int  not null default 0,
  blurb       text default '',
  is_active   boolean not null default true,
  is_popular  boolean not null default false,
  sort_order  int not null default 0
);

insert into public.coin_packs (slug, name, coins, bonus_coins, blurb, is_popular, sort_order) values
  ('starter', 'Starter Stack', 50,  0,  '5 more submissions.',              true,  1),
  ('creator', 'Creator Chest', 150, 20, '17 submissions. Best value.',      false, 2),
  ('legend',  'Legend Vault',  400, 100,'50 submissions. Absolute unit.',   false, 3)
on conflict (slug) do update set
  name = excluded.name, coins = excluded.coins, bonus_coins = excluded.bonus_coins,
  blurb = excluded.blurb, is_popular = excluded.is_popular, sort_order = excluded.sort_order;

alter table public.coin_packs enable row level security;
drop policy if exists "Coin packs are public" on public.coin_packs;
create policy "Coin packs are public" on public.coin_packs for select using (is_active);

-- ------------------------------------------------------------
-- PRICES — one row per pack per currency.
-- unit_amount is in the currency's MINOR unit (pence/cents).
-- stripe_price_id is filled in once you create the Prices in Stripe.
-- ------------------------------------------------------------
create table if not exists public.coin_pack_prices (
  pack_slug       text not null references public.coin_packs(slug) on delete cascade,
  currency        text not null check (currency ~ '^[a-z]{3}$'),
  unit_amount     int  not null check (unit_amount > 0),
  symbol          text not null default '£',
  stripe_price_id text,
  primary key (pack_slug, currency)
);

insert into public.coin_pack_prices (pack_slug, currency, unit_amount, symbol) values
  ('starter','gbp', 500,  '£'),  ('starter','usd', 500,  '$'),
  ('starter','eur', 500,  '€'),  ('starter','cad', 700,  'CA$'),
  ('starter','aud', 800,  'A$'),

  ('creator','gbp', 1200, '£'),  ('creator','usd', 1200, '$'),
  ('creator','eur', 1200, '€'),  ('creator','cad', 1700, 'CA$'),
  ('creator','aud', 1900, 'A$'),

  ('legend','gbp',  2500, '£'),  ('legend','usd',  2500, '$'),
  ('legend','eur',  2500, '€'),  ('legend','cad',  3500, 'CA$'),
  ('legend','aud',  3900, 'A$')
on conflict (pack_slug, currency) do update set
  unit_amount = excluded.unit_amount, symbol = excluded.symbol;

alter table public.coin_pack_prices enable row level security;
drop policy if exists "Coin pack prices are public" on public.coin_pack_prices;
create policy "Coin pack prices are public" on public.coin_pack_prices for select using (true);

-- ------------------------------------------------------------
-- COUNTRY → CURRENCY
-- Anything not listed falls back to GBP.
-- ------------------------------------------------------------
create table if not exists public.country_currency (
  country_code char(2) primary key,
  currency     text not null
);

insert into public.country_currency (country_code, currency) values
  ('GB','gbp'),('IE','eur'),
  ('US','usd'),('PR','usd'),
  ('CA','cad'),('AU','aud'),('NZ','aud'),
  ('DE','eur'),('FR','eur'),('ES','eur'),('IT','eur'),('NL','eur'),('BE','eur'),
  ('AT','eur'),('PT','eur'),('FI','eur'),('GR','eur'),('LU','eur'),('SK','eur'),
  ('SI','eur'),('EE','eur'),('LV','eur'),('LT','eur'),('CY','eur'),('MT','eur'),('HR','eur')
on conflict (country_code) do update set currency = excluded.currency;

alter table public.country_currency enable row level security;
drop policy if exists "Country currency map is public" on public.country_currency;
create policy "Country currency map is public" on public.country_currency for select using (true);

-- ------------------------------------------------------------
-- What the "Buy coins" page calls.
-- Pass an ISO country code (from the browser locale or a geo
-- header); get the packs priced in that market's currency.
-- ------------------------------------------------------------
create or replace function public.get_coin_packs(p_country text default 'GB')
returns table (
  slug        text,
  name        text,
  coins       int,
  bonus_coins int,
  total_coins int,
  blurb       text,
  is_popular  boolean,
  currency    text,
  unit_amount int,
  symbol      text,
  display     text,
  submissions int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_currency text;
  v_cost     int := public.setting_int('submission_cost', 10);
begin
  select cc.currency into v_currency
    from public.country_currency cc
   where cc.country_code = upper(coalesce(p_country, 'GB'));

  v_currency := coalesce(v_currency, 'gbp');

  return query
  select
    p.slug, p.name, p.coins, p.bonus_coins,
    (p.coins + p.bonus_coins) as total_coins,
    p.blurb, p.is_popular,
    pr.currency, pr.unit_amount, pr.symbol,
    pr.symbol || trim(to_char(pr.unit_amount / 100.0, 'FM999990.00')) as display,
    ((p.coins + p.bonus_coins) / greatest(v_cost, 1)) as submissions
  from public.coin_packs p
  join public.coin_pack_prices pr
    on pr.pack_slug = p.slug and pr.currency = v_currency
  where p.is_active
  order by p.sort_order;
end;
$$;

grant execute on function public.get_coin_packs(text) to anon, authenticated;

-- ------------------------------------------------------------
-- Checkout intent — created by the app, completed by the webhook.
-- Amount and currency are read from the DB, never from the client,
-- so nobody can hand-craft a request for 400 coins at 1p.
-- ------------------------------------------------------------
alter table public.coin_purchases
  add column if not exists pack_slug text references public.coin_packs(slug),
  add column if not exists country_code char(2);

create or replace function public.create_purchase_intent(
  p_pack    text,
  p_country text default 'GB'
)
returns public.coin_purchases
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid  uuid := auth.uid();
  v_pack record;
  v_row  public.coin_purchases%rowtype;
begin
  if v_uid is null then raise exception 'You must be signed in.'; end if;

  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'EMAIL_NOT_VERIFIED';
  end if;
  if not public.is_active_member(v_uid) then raise exception 'ACCOUNT_BANNED'; end if;

  select * into v_pack from public.get_coin_packs(p_country) g where g.slug = p_pack;
  if not found then raise exception 'Unknown coin pack.'; end if;

  insert into public.coin_purchases (user_id, coins, amount_pence, currency, status, pack_slug, country_code)
  values (v_uid, v_pack.total_coins, v_pack.unit_amount, v_pack.currency, 'pending',
          p_pack, upper(coalesce(p_country,'GB')))
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_purchase_intent(text,text) to authenticated;

-- Webhook attaches the Stripe session id to the intent it created.
create or replace function public.attach_checkout_session(p_purchase uuid, p_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.coin_purchases set stripe_session_id = p_session_id where id = p_purchase;
end;
$$;

revoke all on function public.attach_checkout_session(uuid,text) from public, anon, authenticated;
