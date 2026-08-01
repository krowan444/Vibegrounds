// ============================================================
// VIBEGROUNDS — create-checkout
//
// Turns a pending coin_purchases row into a Stripe Checkout session.
//
// The critical detail: the amount and currency are read from the
// DATABASE, never from the request body. The client only ever sends a
// purchase_id. Otherwise someone could hand-craft a request for 400
// coins at 1p and we would happily bill them for it.
// ============================================================

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Built lazily. Constructing Stripe at module scope with a missing key
// crashes the whole function on boot, which surfaces in the browser as an
// opaque "Failed to fetch" rather than something you can act on.
function getStripe(): Stripe | null {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) return null;
  return new Stripe(key, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://vibegrounds.vercel.app';

// Max 22 characters, letters/numbers/spaces only. Stripe rejects longer.
const STATEMENT_DESCRIPTOR = (Deno.env.get('STATEMENT_DESCRIPTOR') ?? 'VIBEGROUNDS').slice(0, 22);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const stripe = getStripe();
  if (!stripe) {
    return json({ error: 'Card payments are not switched on yet.' }, 503);
  }

  try {
    // ── 1. Who is asking? ──────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return json({ error: 'Not signed in.' }, 401);

    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await anon.auth.getUser(token);
    if (userErr || !user) return json({ error: 'Not signed in.' }, 401);

    // ── 2. Load the order the app already created ──────────
    const { purchase_id } = await req.json();
    if (!purchase_id) return json({ error: 'Missing purchase_id.' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: purchase, error: pErr } = await admin
      .from('coin_purchases')
      .select('*')
      .eq('id', purchase_id)
      .maybeSingle();

    if (pErr || !purchase) return json({ error: 'Order not found.' }, 404);

    // The order must belong to the caller and still be unpaid.
    if (purchase.user_id !== user.id) return json({ error: 'Not your order.' }, 403);
    if (purchase.status === 'paid') return json({ error: 'Already paid.' }, 409);

    // ── 3. Create the session from DB-held figures ─────────
    const { data: pack } = await admin
      .from('coin_packs')
      .select('name')
      .eq('slug', purchase.pack_slug)
      .maybeSingle();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      client_reference_id: purchase.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: purchase.currency,
          unit_amount: purchase.amount_pence,
          product_data: {
            name: `${pack?.name ?? 'Coin pack'} — ${purchase.coins} VibeGrounds coins`,
            description: `${Math.floor(purchase.coins / 10)} submissions`,
          },
        },
      }],
      // What the customer sees on their bank statement. Without this it
      // would show the Stripe account's trading name, which would look
      // like an unrecognised charge and trigger chargebacks.
      payment_intent_data: {
        statement_descriptor: STATEMENT_DESCRIPTOR,
        statement_descriptor_suffix: STATEMENT_DESCRIPTOR,
        description: `${purchase.coins} VibeGrounds coins`,
      },
      metadata: {
        purchase_id: purchase.id,
        user_id: user.id,
        coins: String(purchase.coins),
      },
      success_url: `${SITE_URL}/coins?paid=1`,
      cancel_url: `${SITE_URL}/coins?cancelled=1`,
    });

    // ── 4. Remember which session belongs to this order ────
    await admin.rpc('attach_checkout_session', {
      p_purchase: purchase.id,
      p_session_id: session.id,
    });

    return json({ url: session.url, session_id: session.id });
  } catch (err) {
    console.error('create-checkout failed:', err);
    return json({ error: (err as Error).message ?? 'Checkout failed.' }, 500);
  }
});
