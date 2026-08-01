// ============================================================
// VIBEGROUNDS — stripe-webhook
//
// Stripe tells us a payment succeeded; we credit the coins.
//
// Two things matter here:
//   1. The signature is verified before anything is trusted. Without
//      it, anyone who finds this URL could POST fake "payment
//      succeeded" events and mint themselves unlimited coins.
//   2. Fulfilment is idempotent. Stripe retries webhooks, and
//      fulfil_coin_purchase() refuses to credit the same session
//      twice, so a retry can never double-pay.
// ============================================================

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Built lazily so a missing key produces a readable 503 rather than
// crashing the function on boot.
function getStripe(): Stripe | null {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) return null;
  return new Stripe(key, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const stripe = getStripe();
  const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripe || !WEBHOOK_SECRET) {
    console.error('Stripe secrets are not configured.');
    return new Response('Stripe not configured', { status: 503 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    // Async variant is required on Deno — the sync one uses node crypto.
    event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error('Signature verification failed:', (err as Error).message);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Only credit once the money is actually there.
        if (session.payment_status !== 'paid') {
          console.log('Session completed but not paid yet:', session.id);
          break;
        }

        const { data, error } = await admin.rpc('fulfil_coin_purchase', {
          p_session_id: session.id,
          p_payment_id: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
        });

        if (error) {
          console.error('Fulfilment failed:', error.message);
          // 500 makes Stripe retry, which is what we want.
          return new Response('Fulfilment failed', { status: 500 });
        }

        console.log('Fulfilled', session.id, JSON.stringify(data));
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        await admin
          .from('coin_purchases')
          .update({ status: 'failed' })
          .eq('stripe_session_id', session.id)
          .eq('status', 'pending');
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        if (charge.payment_intent) {
          await admin
            .from('coin_purchases')
            .update({ status: 'refunded' })
            .eq('stripe_payment_id', charge.payment_intent as string);
        }
        break;
      }

      default:
        // Everything else is noise we don't need.
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return new Response('Handler error', { status: 500 });
  }
});
