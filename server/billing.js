// Payments with Stripe Checkout: monthly memberships are Stripe subscriptions, one-time
// products are single payments. Without STRIPE_SECRET_KEY the store stays in demo mode
// (activation without charge).
//
// Access is granted when the customer comes back from Checkout (confirm) or when the
// webhook arrives, whichever happens first; both paths are idempotent. Renewals,
// cancellations and failed payments arrive through the webhook.
import crypto from 'node:crypto';
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
export const stripe = key ? new Stripe(key) : null;
export const paymentsMode = stripe ? 'stripe' : 'demo';
const CURRENCY = (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();
if (stripe) console.log(`Pagos con Stripe activos (${key.startsWith('sk_live') ? 'modo real' : 'modo prueba'}, ${CURRENCY}).`);

export class BillingError extends Error {}

const toIso = (unix) => (unix ? new Date(unix * 1000).toISOString() : null);
// Newer API versions keep the billing period on the subscription item
const periodEnd = (sub) => toIso(sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end);
const ENDED = new Set(['canceled', 'unpaid', 'incomplete_expired']);

// Base URL Stripe sends the customer back to
export function siteOrigin(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const origin = req.get('origin');
  return origin && /^https?:\/\/[^/\s]+$/.test(origin) ? origin : 'http://localhost:5173';
}

export function createBilling({ getProducts, findUser, save }) {
  async function customerFor(user) {
    if (user.stripeCustomerId) return user.stripeCustomerId;
    const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } });
    user.stripeCustomerId = customer.id;
    await save();
    return customer.id;
  }

  // Stripe-hosted payment page for one product. Returns its URL.
  async function startCheckout(user, product, { origin, returnPath }) {
    const monthly = product.period === 'month';
    const metadata = { userId: user.id, productId: product.id };
    const back = /^\/(?!\/)[^\s]*$/.test(returnPath ?? '') ? returnPath : '/';
    const session = await stripe.checkout.sessions.create({
      mode: monthly ? 'subscription' : 'payment',
      customer: await customerFor(user),
      client_reference_id: user.id,
      metadata,
      locale: 'es',
      allow_promotion_codes: true,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: Math.round(product.price * 100),
            product_data: { name: product.name, metadata: { productId: product.id } },
            ...(monthly && { recurring: { interval: 'month' } }),
          },
        },
      ],
      ...(monthly
        ? { subscription_data: { metadata } }
        : { payment_intent_data: { metadata }, invoice_creation: { enabled: true } }),
      success_url: `${origin}/perfil?pago=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${back}${back.includes('?') ? '&' : '?'}pago=cancelado`,
    });
    return session.url;
  }

  // Give access for a completed Checkout session (safe to call more than once).
  async function applyCheckoutSession(session) {
    const { userId, productId } = session.metadata ?? {};
    const user = findUser((u) => u.id === userId);
    const product = getProducts().find((p) => p.id === productId);
    if (!user || !product) return null;
    if (session.status !== 'complete' || session.payment_status === 'unpaid') return null;
    if (user.subscriptions.some((s) => s.checkoutSessionId === session.id)) return user;

    const sub = typeof session.subscription === 'string' ? await stripe.subscriptions.retrieve(session.subscription) : session.subscription;
    const now = new Date().toISOString();
    // A new purchase replaces any earlier (demo or cancelled) entry for the same product
    for (const s of user.subscriptions) if (s.productId === product.id && s.status !== 'expired') s.status = 'expired';
    user.subscriptions.push({
      id: crypto.randomUUID(),
      productId: product.id,
      period: product.period,
      price: (session.amount_total ?? product.price * 100) / 100,
      status: 'active',
      startedAt: now,
      renewsAt: sub ? periodEnd(sub) : null,
      endsAt: null,
      stripeSubscriptionId: sub?.id ?? null,
      checkoutSessionId: session.id,
    });
    user.stripeCustomerId ??= typeof session.customer === 'string' ? session.customer : session.customer?.id;
    await save();
    return user;
  }

  // Mirror a Stripe subscription (renewal, cancellation, failed payment) onto our record.
  async function syncSubscription(sub) {
    const user = findUser((u) => u.subscriptions.some((s) => s.stripeSubscriptionId === sub.id));
    if (!user) return; // not applied yet: the checkout event will create it
    const record = user.subscriptions.find((s) => s.stripeSubscriptionId === sub.id);
    const end = periodEnd(sub);
    if (ENDED.has(sub.status)) {
      record.status = 'expired';
      record.endsAt = new Date().toISOString();
    } else if (sub.cancel_at_period_end || sub.cancel_at) {
      record.status = 'cancelled';
      record.endsAt = toIso(sub.cancel_at) ?? end;
      record.renewsAt = end;
    } else {
      record.status = 'active';
      record.renewsAt = end;
      record.endsAt = null;
    }
    await save();
  }

  async function setCancelAtPeriodEnd(record, cancel) {
    const sub = await stripe.subscriptions.update(record.stripeSubscriptionId, { cancel_at_period_end: cancel });
    await syncSubscription(sub);
  }

  async function portalUrl(user, origin) {
    if (!user.stripeCustomerId) throw new BillingError('Todavía no tienes pagos registrados.');
    const session = await stripe.billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: `${origin}/perfil` });
    return session.url;
  }

  // POST /api/stripe/webhook (raw body)
  async function webhook(req, res) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !secret) return res.status(503).end();
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.get('stripe-signature'), secret);
    } catch (err) {
      console.warn('Webhook de Stripe rechazado:', err.message);
      return res.status(400).send('Firma inválida');
    }
    try {
      const obj = event.data.object;
      switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
          await applyCheckoutSession(obj);
          break;
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await syncSubscription(obj);
          break;
      }
      res.json({ received: true });
    } catch (err) {
      console.error(`Error procesando ${event.type}:`, err.message);
      res.status(500).end(); // Stripe retries later
    }
  }

  return { startCheckout, applyCheckoutSession, setCancelAtPeriodEnd, portalUrl, webhook };
}

// Stripe errors → friendly reply. Returns false if it was not a billing error.
export function sendBillingError(err, res) {
  if (err instanceof BillingError) {
    res.status(400).json({ error: err.message });
  } else if (err instanceof Stripe.errors.StripeError) {
    console.error('Error de Stripe:', err.type, err.message);
    const auth = err instanceof Stripe.errors.StripeAuthenticationError;
    res.status(auth ? 503 : 502).json({ error: 'No pudimos conectar con el sistema de pagos. Inténtalo de nuevo en un momento.' });
  } else {
    return false;
  }
  return true;
}
