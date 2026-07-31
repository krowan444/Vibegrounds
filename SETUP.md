# VibeGrounds — Setup Guide

## ✅ Already done

Steps 1–4 below are **complete**. The live project is:

| | |
|---|---|
| Project | `vibegrounds` |
| Reference | `oqiityancoxnwhfsrcgx` |
| Region | West Europe (London) |
| Organisation | Custom-AI-Hoodies |
| URL | `https://oqiityancoxnwhfsrcgx.supabase.co` |

All 8 migrations are applied: **21 tables, 11 views, 91 functions, 42 RLS
policies**, 24 badges, 8 categories, 3 coin packs priced in 5 currencies.
Email confirmation is **on**, minimum password length is **8** with a
letter-and-number requirement, and redirect URLs are set for both
vibegrounds.co.uk and localhost. `.env` is written and gitignored.

Verified end-to-end against the live database: signup trigger, the 50-coin
bonus, paid submission, vote scoring, badge awarding, the report queue, and
the admin RPCs. Five deliberate attacks (self-granting coins, self-promoting
to admin, inflating your own score, inserting a submission without paying,
and writing your own coin ledger entry) were all rejected.

**What's left for you: steps 5 and 7.**

---

## 1. Create the Supabase project *(done)*

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and click **New project**.
2. Name it `vibegrounds`, pick the **London (eu-west-2)** region, and set a strong
   database password. Save that password somewhere — you cannot see it again.
3. Wait for provisioning (a couple of minutes).

The old suspended project isn't needed. Nothing carries over, which also means
the account that posted the racist remarks is gone along with it.

---

## 2. Run the migrations

Open **SQL Editor → New query** and run each file from `supabase/migrations/`
**in order**. Paste one file, hit Run, wait for "Success", then move to the next.

| # | File | What it builds |
|---|------|----------------|
| 1 | `01_core_profiles.sql` | Profiles, roles, bans, reserved usernames, disposable-email blocklist, signup trigger |
| 2 | `02_coins.sql` | The coin ledger and every function that can move a balance |
| 3 | `03_moderation.sql` | Reports, ban/mute/role functions, permanent moderation log |
| 4 | `04_creations_votes.sql` | Categories, submissions, 0–5 voting, scoring, all the charts |
| 5 | `05_badges.sql` | 25 badges, live rarity stats, automatic awarding |
| 6 | `06_reviews_forum.sql` | Comments, reactions, forum, flood control |
| 7 | `07_admin.sql` | Everything the Control Room reads and does |
| 8 | `08_pricing.sql` | Multi-currency coin packs (£5 / $5 / €5) |
| 9 | `09_reputation.sql` | Creator XP, levels, ranks, daily streak bonus |

The old scripts now live in `supabase/legacy/` for reference only. **Do not run them** —
they conflict with the new schema.

---

## 3. Configure auth

**Authentication → Providers → Email**

- ✅ Enable email provider
- ✅ **Confirm email** — this is the whole anti-abuse strategy, it must be on
- Minimum password length: `8`

**Authentication → URL Configuration**

- Site URL: `https://vibegrounds.co.uk`
- Redirect URLs (add all of these):
  ```
  https://vibegrounds.co.uk/verify
  https://vibegrounds.co.uk/reset-password
  http://localhost:5173/verify
  http://localhost:5173/reset-password
  ```

**Authentication → Rate Limits** — lower the email sign-up limit to something
sane like 10/hour. Free Supabase email sending is capped anyway; see step 7.

---

## 4. Point the app at it

Create `.env` in the project root (it's gitignored — never commit it):

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Both values are in **Project Settings → API**. The `anon` key is safe in the
browser — every table is protected by row-level security, and coins and bans
can only be changed by server-side functions.

Then:

```bash
npm install
npm run dev
```

---

## 5. Make yourself the admin

1. Sign up on the running site with `kierandrowan@gmail.com` and confirm the email.
2. Back in **SQL Editor**, run:

   ```sql
   select public.bootstrap_admin('kierandrowan@gmail.com');
   ```

3. Refresh the site. A 🛡️ shield appears in the header — that's the Control Room
   at `/admin`, with a live count of open reports.

`bootstrap_admin` refuses to run once an admin exists, so it can't be used
against you later. After this, promote moderators from the Users tab instead.

---

## 6. Deploy

Vercel is already configured (`vercel.json`). Add the same two environment
variables in **Project Settings → Environment Variables**, then push:

```bash
git add .
git commit -m "Rebuild: coins, badges, charts, moderation"
git push
```

---

## 7. Email deliverability — ⚠️ THIS IS A LAUNCH BLOCKER

Supabase's built-in email sender is capped at a **handful of emails per hour**
and frequently lands in spam. Your entire anti-abuse design depends on
verification emails arriving, and people cannot reset forgotten passwords
without them. With the built-in sender, a launch-day rush would simply fail.

I could not configure this for you — it needs credentials, which is yours to
enter, not mine.

Set up a real SMTP provider under **Project Settings → Auth → SMTP Settings**.
[Resend](https://resend.com) has a free tier and takes about ten minutes with
your domain. Once custom SMTP is on, the send-rate limit can also be raised.

---

## 8. Stripe (when you're ready to take money)

The database side is done. `08_pricing.sql` holds the packs and prices, and
`create_purchase_intent()` builds a locked-in order that the client cannot tamper
with. What's still needed:

1. In Stripe, create a **Product** per pack with a **Price in each currency**
   (GBP, USD, EUR, CAD, AUD).
2. Store those price IDs:
   ```sql
   update public.coin_pack_prices
      set stripe_price_id = 'price_xxx'
    where pack_slug = 'starter' and currency = 'gbp';
   ```
3. Deploy two endpoints (Supabase Edge Functions or Vercel serverless):
   - `create-checkout` — takes a `purchase_id`, reads the amount **from the
     database**, returns a Stripe Checkout URL
   - `stripe-webhook` — on `checkout.session.completed`, calls
     `fulfil_coin_purchase(session_id)` with the service-role key
4. Set `VITE_CHECKOUT_URL` in your env to the `create-checkout` URL.

Until then the Buy buttons show a clear "not switched on yet" message rather
than failing silently.

### How the currency thing works

`get_coin_packs(country_code)` maps the viewer's country to a currency and
returns prices already formatted. A UK visitor sees **£5**, an American sees
**$5**, a German sees **€5** — the same clean number in each market, not a
converted amount like $6.37. The page guesses from the browser locale and
offers a manual picker if it gets it wrong.

---

## The anti-abuse design, in short

Nothing here relies on the client behaving itself:

- **Coins can only move through `apply_coin_delta()`**, which locks the row
  first. There is no INSERT policy on the ledger, so the browser cannot write to it.
- **Submissions can only be created by `submit_creation()`**, which verifies
  email confirmation, ban status, mute status, account age (10 minutes),
  a daily cap, duplicate URLs, and charges the coins — all in one transaction.
  There is deliberately **no INSERT policy** on `creations`, so the charge
  cannot be skipped.
- **A trigger reverts** any attempt to edit your own `coins`, `role`,
  `is_banned` or a submission's `score`, even if RLS would otherwise allow it.
- **Every staff action is logged** to `moderation_actions`, permanently.
- **Rate limits** on reports (10/hour) and comments (1 per 30s, 20/hour).
- **Disposable email domains** are rejected at signup.
- **Reserved usernames** stop anyone registering as `admin` or `vibegrounds`.

### Tuning without redeploying

```sql
select public.admin_set_setting('submission_cost', '15'::jsonb);
select public.admin_set_setting('daily_submission_limit', '3'::jsonb);
select public.admin_set_setting('registration_open', 'false'::jsonb);
```

---

## Handling a bad actor

From the Control Room:

- **Reports tab** → each report shows the content, the poster, their strike
  count, and how many other people reported the same thing. One row of buttons:
  remove content · ban 7 days · ban forever · **purge everything** · no action.
- **Purge** is the nuclear option: permanent ban plus every submission, comment,
  thread and reply that account ever posted is removed in one click.
- **Users tab** → search by username or email, ban, mute, adjust coins, change
  roles, purge.

---

## The OG Member badge

Anyone who joins before **1 January 2027** gets 👑 **OG Member**. After that date
`grant_badge()` refuses to award it — permanently, to everyone, including you.
It cannot be granted by hand afterwards either.

To change the deadline before it passes:

```sql
select public.admin_set_setting('og_badge_cutoff', '"2027-06-01T00:00:00Z"'::jsonb);
```
