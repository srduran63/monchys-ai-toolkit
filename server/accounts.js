// Customer accounts and subscriptions.
// Activation is a demo for now: no payment provider is connected, renewals are simulated.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { hashPassword, verifyPassword } from './password.js';
import { ai, aiAvailableFor, aiSpent, AI_LIMITS } from './ai.js';
import { createBilling, paymentsMode, sendBillingError, siteOrigin, stripe } from './billing.js';
import { createStore } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data', 'users.json');
const SESSION_MS = 30 * 24 * 60 * 60 * 1000; // customers stay signed in for 30 days
const COOKIE = 'user_session';
const MAX_LOGIN_ATTEMPTS = 8;
const LOCK_MS = 15 * 60 * 1000;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex')); // keeps unknown-email logins as slow as real ones

// ---------- Storage ----------
let users = [];
let writeQueue = Promise.resolve();

async function load() {
  try {
    users = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    users = [];
  }
}

function save() {
  const snapshot = JSON.stringify(users, null, 2);
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmp, snapshot);
    await fs.rename(tmp, DATA_FILE);
  });
  return writeQueue;
}

// ---------- Subscriptions ----------
const addMonth = (iso) => {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
};

// Expire cancelled memberships whose period ended, and roll demo memberships forward
// (Stripe memberships are renewed by Stripe's webhook instead).
function refreshSubscriptions(user) {
  const now = new Date().toISOString();
  let changed = false;
  for (const s of user.subscriptions) {
    if (s.period !== 'month') continue;
    if (s.status === 'active' && !s.stripeSubscriptionId) {
      while (s.renewsAt <= now) {
        s.renewsAt = addMonth(s.renewsAt);
        changed = true;
      }
    } else if (s.status === 'cancelled' && s.endsAt <= now) {
      s.status = 'expired';
      changed = true;
    }
  }
  return changed;
}

// Emails the admin gave every tool for free (edited in the admin panel). Only counts once the
// account has signed in with Google or Apple, which verify the email: a password sign-up doesn't,
// so anyone could register with someone else's address.
const freeAccess = await createStore('free-access', { emails: [] });
const normEmail = (e) => String(e ?? '').trim().toLowerCase();
export const hasFreeAccess = (user) =>
  Boolean(user?.providers?.length) && freeAccess.data.emails.includes(normEmail(user.email));

const isLive = (s) => s.status === 'active' || s.status === 'cancelled'; // cancelled keeps access until endsAt

// Product ids this user (or a visitor, when user is null) can use.
export function accessFor(user, products) {
  if (hasFreeAccess(user)) return new Set(products.map((p) => p.id));
  const access = new Set(products.filter((p) => p.price === 0).map((p) => p.id));
  for (const s of user?.subscriptions ?? []) {
    if (!isLive(s)) continue;
    access.add(s.productId);
    const product = products.find((p) => p.id === s.productId);
    for (const id of product?.includes ?? []) access.add(id);
  }
  return access;
}

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  createdAt: u.createdAt,
  hasPassword: Boolean(u.passwordHash),
  providers: u.providers ?? [],
});

// ---------- Session cookie ----------
export function createAccountRouters({ getProducts, getOwnedBusinesses, cookieSecure }) {
  const secret = process.env.SESSION_SECRET;
  const sign = (value) => crypto.createHmac('sha256', `user:${secret}`).update(value).digest('hex');

  const tokenFor = (user) => {
    const payload = `${user.id}.${Date.now() + SESSION_MS}`;
    return `${payload}.${sign(payload)}`;
  };

  function userFromRequest(req) {
    const token = req.cookies?.[COOKIE];
    if (typeof token !== 'string') return null;
    const [id, exp, sig] = token.split('.');
    if (!id || !exp || !sig) return null;
    const expected = sign(`${id}.${exp}`);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    if (Number(exp) < Date.now()) return null;
    return users.find((u) => u.id === id) ?? null;
  }

  const setSession = (res, user) =>
    res.cookie(COOKIE, tokenFor(user), {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieSecure,
      maxAge: SESSION_MS,
      path: '/',
    });

  // Tool APIs: signed-in customer with access to the product (directly or through a plan).
  function requireAccess(productId) {
    return (req, res, next) => {
      const user = userFromRequest(req);
      if (!user) return res.status(401).json({ error: 'Inicia sesión para usar esta herramienta.' });
      if (refreshSubscriptions(user)) save();
      if (!accessFor(user, getProducts()).has(productId)) {
        return res.status(403).json({ error: 'Activa esta herramienta para usarla.' });
      }
      req.user = user;
      next();
    };
  }

  function requireUser(req, res, next) {
    const user = userFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
    if (refreshSubscriptions(user)) save();
    req.user = user;
    next();
  }

  const attempts = new Map(); // ip -> { count, lockedUntil }
  function loginLimiter(req, res, next) {
    const record = attempts.get(req.ip);
    if (record?.lockedUntil > Date.now()) {
      return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
    }
    next();
  }
  function loginFailed(req) {
    const count = (attempts.get(req.ip)?.count ?? 0) + 1;
    attempts.set(req.ip, { count, lockedUntil: count >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCK_MS : 0 });
  }

  function accountView(user) {
    const products = getProducts();
    return {
      user: publicUser(user),
      subscriptions: user.subscriptions
        .filter((s) => s.status !== 'expired')
        .map(({ productId, period, status, startedAt, renewsAt, endsAt }) => ({
          productId,
          period,
          status,
          startedAt,
          renewsAt,
          endsAt,
        })),
      access: [...accessFor(user, products)],
      ai: aiAvailableFor(`user:${user.id}`),
      payments: paymentsMode,
      billing: Boolean(stripe && user.stripeCustomerId),
    };
  }

  const billing = stripe ? createBilling({ getProducts, findUser: (fn) => users.find(fn), save }) : null;

  // ---------- Routes ----------
  const router = express.Router();

  router.get('/me', (req, res) => {
    const user = userFromRequest(req);
    if (!user) {
      return res.json({ user: null, subscriptions: [], access: [...accessFor(null, getProducts())], ai: ai.available, payments: paymentsMode });
    }
    if (refreshSubscriptions(user)) save();
    res.json(accountView(user));
  });

  router.post('/register', loginLimiter, async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (name.length < 2) return res.status(400).json({ error: 'Escribe tu nombre.' });
    if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Correo electrónico inválido.' });
    if (password.length < 8 || password.length > 200) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }
    if (users.some((u) => u.email === email)) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo. Inicia sesión.' });
    }
    const user = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash: hashPassword(password),
      subscriptions: [],
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    await save();
    setSession(res, user);
    res.status(201).json(accountView(user));
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const user = users.find((u) => u.email === email);
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (user && !user.passwordHash) {
      const via = (user.providers ?? []).map((p) => ({ google: 'Google', apple: 'Apple' })[p] ?? p).join(' o ');
      return res.status(400).json({ error: `Esta cuenta se creó con ${via || 'Google o Apple'}. Entra con ese botón.` });
    }
    if (!user || !ok) {
      loginFailed(req);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
    attempts.delete(req.ip);
    if (refreshSubscriptions(user)) await save();
    setSession(res, user);
    res.json(accountView(user));
  });

  // Google / Apple sign-in through Supabase Auth. The browser does the OAuth dance with Supabase
  // and sends us the access token; we ask Supabase who it belongs to, then create or link the account.
  router.post('/oauth', loginLimiter, async (req, res) => {
    const token = typeof req.body?.accessToken === 'string' ? req.body.accessToken : '';
    const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anon } = process.env;
    if (!url || !anon) return res.status(503).json({ error: 'El inicio de sesión con Google o Apple no está configurado.' });
    if (!token) return res.status(400).json({ error: 'Falta la sesión.' });

    let sbUser;
    try {
      const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
      if (!r.ok) return res.status(401).json({ error: 'No pudimos verificar tu inicio de sesión. Inténtalo de nuevo.' });
      sbUser = await r.json();
    } catch {
      return res.status(502).json({ error: 'No pudimos contactar con el servicio de inicio de sesión.' });
    }

    const email = String(sbUser.email ?? '').toLowerCase();
    // Google and Apple verify emails; refuse anything unverified so nobody can claim someone else's account
    if (!EMAIL_RE.test(email) || !sbUser.email_confirmed_at) {
      return res.status(400).json({ error: 'Tu cuenta de Google o Apple no tiene un correo verificado.' });
    }
    const provider = sbUser.app_metadata?.provider ?? 'oauth';
    const meta = sbUser.user_metadata ?? {};

    let user = users.find((u) => u.email === email);
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        name: String(meta.full_name || meta.name || email.split('@')[0]).trim().slice(0, 60) || 'Cliente',
        email,
        passwordHash: null, // signs in with Google/Apple only (can't use the password form)
        providers: [],
        subscriptions: [],
        createdAt: new Date().toISOString(),
      };
      users.push(user);
    }
    user.providers = [...new Set([...(user.providers ?? []), provider])];
    user.supabaseId ??= sbUser.id;
    await save();
    setSession(res, user);
    res.json(accountView(user));
  });

  router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ user: null });
  });

  router.put('/profile', requireUser, async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : '';
    if (name.length < 2) return res.status(400).json({ error: 'Escribe tu nombre.' });
    req.user.name = name;
    await save();
    res.json(accountView(req.user));
  });

  router.put('/password', requireUser, async (req, res) => {
    const { current, next } = req.body ?? {};
    if (req.user.passwordHash && (typeof current !== 'string' || !(await verifyPassword(current, req.user.passwordHash)))) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
    }
    if (typeof next !== 'string' || next.length < 8 || next.length > 200) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }
    req.user.passwordHash = hashPassword(next);
    await save();
    res.json({ ok: true });
  });

  // Activate a membership or one-time product. With Stripe the reply is { checkoutUrl }
  // (the customer pays there); in demo mode access is given at once without charge.
  router.post('/subscriptions', requireUser, async (req, res) => {
    const product = getProducts().find((p) => p.id === req.body?.productId && p.published);
    if (!product) return res.status(404).json({ error: 'Servicio no encontrado.' });
    if (product.price === 0) return res.status(400).json({ error: 'Este servicio es gratuito: no hace falta activarlo.' });

    const existing = req.user.subscriptions.find((s) => s.productId === product.id && s.status !== 'expired');
    if (existing?.status === 'active') return res.status(409).json({ error: 'Ya tienes este servicio activo.' });

    if (billing) {
      try {
        if (existing?.status === 'cancelled' && existing.stripeSubscriptionId) {
          // Resume before the paid period ends: Stripe keeps charging on the same date
          await billing.setCancelAtPeriodEnd(existing, false);
          return res.json(accountView(req.user));
        }
        const checkoutUrl = await billing.startCheckout(req.user, product, {
          origin: siteOrigin(req),
          returnPath: req.body?.returnPath,
        });
        return res.json({ checkoutUrl });
      } catch (err) {
        if (sendBillingError(err, res)) return;
        throw err;
      }
    }

    const now = new Date().toISOString();
    if (existing?.status === 'cancelled') {
      // Resume before the paid period ends: keep the same billing date
      existing.status = 'active';
      existing.endsAt = null;
    } else {
      req.user.subscriptions.push({
        id: crypto.randomUUID(),
        productId: product.id,
        period: product.period,
        price: product.price,
        status: 'active',
        startedAt: now,
        renewsAt: product.period === 'month' ? addMonth(now) : null,
        endsAt: null,
        demo: true, // no payment was taken
      });
    }
    await save();
    res.status(201).json(accountView(req.user));
  });

  // Cancel a membership: access continues until the end of the current period.
  router.post('/subscriptions/:productId/cancel', requireUser, async (req, res) => {
    const sub = req.user.subscriptions.find((s) => s.productId === req.params.productId && s.status === 'active');
    if (!sub) return res.status(404).json({ error: 'No tienes este servicio activo.' });
    if (sub.period !== 'month') return res.status(400).json({ error: 'Las compras de pago único no se cancelan.' });
    if (sub.stripeSubscriptionId && billing) {
      try {
        await billing.setCancelAtPeriodEnd(sub, true);
      } catch (err) {
        if (sendBillingError(err, res)) return;
        throw err;
      }
    } else {
      sub.status = 'cancelled';
      sub.endsAt = sub.renewsAt;
      await save();
    }
    res.json(accountView(req.user));
  });

  // Back from Stripe Checkout: give access right away (the webhook does the same).
  router.post('/checkout/confirm', requireUser, async (req, res) => {
    const id = req.body?.sessionId;
    if (!billing) return res.status(400).json({ error: 'Los pagos no están activados.' });
    if (typeof id !== 'string' || !id.startsWith('cs_')) return res.status(400).json({ error: 'Pago no válido.' });
    try {
      const session = await stripe.checkout.sessions.retrieve(id, { expand: ['subscription'] });
      if (session.metadata?.userId !== req.user.id) return res.status(403).json({ error: 'Este pago es de otra cuenta.' });
      const applied = await billing.applyCheckoutSession(session);
      if (!applied) return res.status(402).json({ error: 'El pago aún no se ha completado.' });
      res.json({ ...accountView(req.user), productId: session.metadata.productId });
    } catch (err) {
      if (sendBillingError(err, res)) return;
      throw err;
    }
  });

  // Stripe customer portal: invoices, card and cancellations.
  router.post('/billing-portal', requireUser, async (req, res) => {
    if (!billing) return res.status(400).json({ error: 'Los pagos no están activados.' });
    try {
      res.json({ url: await billing.portalUrl(req.user, siteOrigin(req)) });
    } catch (err) {
      if (sendBillingError(err, res)) return;
      throw err;
    }
  });

  // Businesses this customer owns (booking assistant subscribers).
  router.get('/businesses', requireUser, (req, res) => {
    if (!accessFor(req.user, getProducts()).has('RES-01')) {
      return res.status(403).json({ error: 'Activa el asistente de reservas para ver tu agenda.' });
    }
    res.json(getOwnedBusinesses(req.user.email));
  });

  // Admin: customer list
  const admin = express.Router();
  admin.get('/', (req, res) => {
    for (const u of users) refreshSubscriptions(u);
    res.json(
      users.map((u) => ({
        ...publicUser(u),
        subscriptions: u.subscriptions.filter((s) => s.status !== 'expired'),
        freeAccess: hasFreeAccess(u),
        aiSpent: aiSpent(`user:${u.id}`),
        aiLimit: AI_LIMITS.customer,
      }))
    );
  });

  // Admin: emails with every tool free
  admin.get('/acceso-gratis', (req, res) => res.json({ emails: freeAccess.data.emails }));
  admin.put('/acceso-gratis', async (req, res) => {
    const list = Array.isArray(req.body?.emails) ? req.body.emails : [];
    const emails = [...new Set(list.map(normEmail).filter(Boolean))];
    const bad = emails.find((e) => !EMAIL_RE.test(e));
    if (bad) return res.status(400).json({ error: `Correo no válido: ${bad}` });
    if (emails.length > 200) return res.status(400).json({ error: 'Máximo 200 correos.' });
    freeAccess.data.emails = emails;
    await freeAccess.save();
    res.json({ emails });
  });

  const stripeWebhook = (req, res) => (billing ? billing.webhook(req, res) : res.status(503).end());

  return { accountRouter: router, adminUsersRouter: admin, userFromRequest, requireAccess, stripeWebhook };
}

await load();
