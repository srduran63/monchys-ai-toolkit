import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import { verifyPassword } from './password.js';
import { createConverterRouter } from './converter.js';
import { createAhorroRouter } from './tools/ahorro.js';
import { createDiarioRouter } from './tools/diario.js';
import { createTranscribeRouter } from './tools/transcribe.js';
import { createBackgroundRouter } from './tools/background.js';
import { createPdfRouter } from './tools/pdf.js';
import { createCvRouter } from './tools/cv.js';
import { createCompressRouter } from './tools/compress.js';
import { createSubtitlesRouter } from './tools/subtitles.js';
import { createWriterRouter } from './tools/writer.js';
import { createTranslateRouter } from './tools/translate.js';
import { createUpscaleRouter } from './tools/upscale.js';
import { createImageRouter } from './tools/imagegen.js';
import { createVideoRouter } from './tools/videogen.js';
import { createBookingRouters, getOwnedBusinesses, activeBusinesses } from './booking.js';
import { seoFor, sitemapPaths } from '../shared/seo.js';
import { renderHtml, robotsTxt, sitemapXml } from './seo-html.js';
import { createAccountRouters, accessFor } from './accounts.js';
import { createGuideRouter } from './guide.js';
import { createAssistantRouter } from './assistant.js';
import { spendByMonth } from './ai.js';
import { ICON_NAMES, PERIODS } from '../shared/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data', 'products.json');
const SEED_FILE = path.join(__dirname, 'seed.json');
// Seed ids already offered to this store: a product deleted in the admin panel is not re-added
const SEEN_FILE = path.join(__dirname, 'data', 'seed-seen.json');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT) || 3001;
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true'; // set to true when served over HTTPS
const { ADMIN_USER, ADMIN_PASSWORD_HASH, SESSION_SECRET } = process.env;

if (!ADMIN_USER || !ADMIN_PASSWORD_HASH || !SESSION_SECRET) {
  console.error('Faltan credenciales de admin. Ejecuta: npm run set-password');
  process.exit(1);
}

// ---------- Storage (JSON file, serialized atomic writes) ----------
let products = [];
let writeQueue = Promise.resolve();

async function load() {
  const seed = JSON.parse(await fs.readFile(SEED_FILE, 'utf8'));
  try {
    products = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    products = seed;
    await save();
  }
  // New tools shipped in seed.json reach existing stores once. Stores created before this
  // list existed have already seen the original catalog (even products they deleted).
  let seen;
  try {
    seen = new Set(JSON.parse(await fs.readFile(SEEN_FILE, 'utf8')));
  } catch {
    seen = new Set([...products.map((p) => p.id), ...seed.filter((p) => p.createdAt < '2026-10-28').map((p) => p.id)]);
  }
  const added = seed.filter((p) => !seen.has(p.id) && !products.some((x) => x.id === p.id));
  if (added.length) {
    products.push(...added);
    await save();
    console.log(`Catálogo: añadidas ${added.map((p) => p.id).join(', ')}`);
  }
  for (const p of seed) seen.add(p.id);
  await fs.writeFile(SEEN_FILE, JSON.stringify([...seen]));
}

function save() {
  const snapshot = JSON.stringify(products, null, 2);
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmp, snapshot);
    await fs.rename(tmp, DATA_FILE);
  });
  return writeQueue;
}

// ---------- Auth (single admin, stateless HMAC-signed session cookie) ----------
const SESSION_MS = 8 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const attempts = new Map(); // ip -> { count, lockedUntil }

const hmac = (value) => crypto.createHmac('sha256', SESSION_SECRET).update(value).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(hmac(String(a)), hmac(String(b)));

function createToken() {
  const exp = String(Date.now() + SESSION_MS);
  return `${exp}.${hmac(exp).toString('hex')}`;
}

function isValidToken(token) {
  if (typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  return safeEqual(sig, hmac(exp).toString('hex')) && Number(exp) > Date.now();
}

function requireAdmin(req, res, next) {
  if (isValidToken(req.cookies.session)) return next();
  res.status(401).json({ error: 'No autorizado' });
}

// ---------- Validation ----------
function text(value, max) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v.length > 0 && v.length <= max ? v : null;
}

function validateProduct(body, { isNew }) {
  const errors = [];
  const p = {};
  body ??= {};

  if (isNew) {
    p.id = typeof body.id === 'string' ? body.id.trim().toUpperCase() : '';
    if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(p.id)) errors.push('ID inválido (A-Z, 0-9 y guiones, 2-20 caracteres)');
  }

  p.name = text(body.name, 80);
  if (!p.name) errors.push('Nombre requerido (máx. 80)');

  p.price = Math.round(Number(body.price) * 100) / 100;
  if (!Number.isFinite(p.price) || p.price < 0 || p.price > 100000) errors.push('Precio inválido');

  p.period = body.period ?? 'once';
  if (!PERIODS.includes(p.period)) errors.push('Tipo de pago inválido');

  p.category = text(body.category, 40)?.toUpperCase();
  if (!p.category) errors.push('Categoría requerida (máx. 40)');

  p.icon = ICON_NAMES.includes(body.icon) ? body.icon : null;
  if (!p.icon) errors.push('Icono inválido');

  p.desc = text(body.desc, 200);
  if (!p.desc) errors.push('Descripción corta requerida (máx. 200)');

  p.details = text(body.details, 2000) ?? '';

  // Optional link to the tool page inside this site, e.g. "/convertir"
  p.toolUrl = text(body.toolUrl, 100) ?? '';
  if (p.toolUrl && !/^\/[a-z0-9\-/]*$/.test(p.toolUrl)) errors.push('Enlace de herramienta inválido (ej.: /convertir)');
  // Optional link to a live demo, e.g. "/reservar/demo"
  // Plans: ids of the products this membership unlocks
  p.includes = Array.isArray(body.includes)
    ? [...new Set(body.includes.map((id) => String(id).trim().toUpperCase()).filter(Boolean))].slice(0, 30)
    : [];
  if (p.includes.some((id) => !/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(id))) errors.push('Lista de servicios incluidos inválida');

  p.demoUrl = text(body.demoUrl, 100) ?? '';
  if (p.demoUrl && !/^\/[a-z0-9\-/]*$/.test(p.demoUrl)) errors.push('Enlace de demo inválido (ej.: /reservar/demo)');

  p.specs = {};
  const specs = body.specs;
  if (specs && typeof specs === 'object' && !Array.isArray(specs)) {
    const entries = Object.entries(specs);
    if (entries.length > 12) errors.push('Máximo 12 especificaciones');
    for (const [k, v] of entries.slice(0, 12)) {
      const key = text(k, 30);
      const val = text(v, 100);
      if (!key || !val) { errors.push(`Especificación inválida: "${k}"`); continue; }
      p.specs[key] = val;
    }
  } else if (specs !== undefined) {
    errors.push('Especificaciones inválidas');
  }

  p.published = body.published !== false;
  return { product: p, errors };
}

// ---------- App ----------
const app = express();
app.disable('x-powered-by');
// Behind Fly's proxy every request comes from the proxy: its Fly-Client-IP header holds the
// visitor's address (set by Fly, so it can't be faked), which per-visitor limits rely on.
if (process.env.FLY_APP_NAME) {
  app.use((req, res, next) => {
    const ip = req.get('fly-client-ip');
    if (ip) Object.defineProperty(req, 'ip', { value: ip });
    next();
  });
}
// Stripe signs the raw body, so its webhook is read before the JSON parser
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => accounts.stripeWebhook(req, res));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/products', (req, res) => {
  res.json(products.filter((p) => p.published));
});

app.get('/api/auth/me', (req, res) => {
  res.json({ admin: isValidToken(req.cookies.session) });
});

app.post('/api/auth/login', async (req, res) => {
  const now = Date.now();
  const record = attempts.get(req.ip);
  if (record?.lockedUntil > now) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
  }

  const { username, password } = req.body ?? {};
  const userOk = typeof username === 'string' && safeEqual(username, ADMIN_USER);
  const passOk = typeof password === 'string' && (await verifyPassword(password, ADMIN_PASSWORD_HASH));

  if (!userOk || !passOk) {
    const count = (record?.count ?? 0) + 1;
    attempts.set(req.ip, { count, lockedUntil: count >= MAX_ATTEMPTS ? now + LOCK_MS : 0 });
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  attempts.delete(req.ip);
  res.cookie('session', createToken(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: COOKIE_SECURE,
    maxAge: SESSION_MS,
    path: '/',
  });
  res.json({ admin: true });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('session', { path: '/' });
  res.json({ admin: false });
});

app.get('/api/admin/products', requireAdmin, (req, res) => {
  res.json(products);
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const { product, errors } = validateProduct(req.body, { isNew: true });
  if (errors.length) return res.status(400).json({ error: errors.join('. ') });
  if (products.some((p) => p.id === product.id)) {
    return res.status(409).json({ error: 'Ya existe un producto con ese ID' });
  }
  const now = new Date().toISOString();
  const created = { ...product, createdAt: now, updatedAt: now };
  products.push(created);
  await save();
  res.status(201).json(created);
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const index = products.findIndex((p) => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Producto no encontrado' });
  const { product, errors } = validateProduct(req.body, { isNew: false });
  if (errors.length) return res.status(400).json({ error: errors.join('. ') });
  products[index] = { ...products[index], ...product, updatedAt: new Date().toISOString() };
  await save();
  res.json(products[index]);
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const index = products.findIndex((p) => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Producto no encontrado' });
  products.splice(index, 1);
  await save();
  res.status(204).end();
});

const booking = createBookingRouters({ requireAdmin });
app.use('/api/booking', booking.publicRouter);
app.use('/api/admin/businesses', booking.adminRouter);

const accounts = createAccountRouters({
  getProducts: () => products,
  getOwnedBusinesses,
  cookieSecure: COOKIE_SECURE,
});
app.use('/api/account', accounts.accountRouter);
app.use('/api/admin/users', requireAdmin, accounts.adminUsersRouter);
app.use('/api/guide', createGuideRouter({ getProducts: () => products }));
app.use('/api/asistente', createAssistantRouter({ getProducts: () => products, userFromRequest: accounts.userFromRequest }));
app.get('/api/admin/ai-usage', requireAdmin, (req, res) => res.json(spendByMonth()));

// Customer tools (each one checks the customer's access to its product)
const { requireAccess } = accounts;
app.use('/api/tools', createConverterRouter({ requireAccess }));
app.use('/api/tools/ahorro', await createAhorroRouter({ requireAccess }));
app.use('/api/tools/diario', await createDiarioRouter({ requireAccess }));
app.use('/api/tools/transcribir', await createTranscribeRouter({ requireAccess }));
app.use('/api/tools/quitar-fondo', createBackgroundRouter({ requireAccess }));
app.use('/api/tools/pdf', await createPdfRouter({ requireAccess }));
app.use('/api/tools/cv', await createCvRouter({ requireAccess }));
app.use('/api/tools/comprimir', createCompressRouter());
app.use('/api/tools/subtitulos', await createSubtitlesRouter({ requireAccess }));
app.use('/api/tools/escritor', createWriterRouter({ requireAccess }));
app.use('/api/tools/traductor', createTranslateRouter({ requireAccess }));
app.use('/api/tools/mejorar-foto', createUpscaleRouter({ requireAccess }));
// A few free images a day for everyone, more with the subscription: checks access itself
app.use(
  '/api/tools/imagenes',
  await createImageRouter({ userFromRequest: accounts.userFromRequest, hasAccess: (user) => accessFor(user, products).has('GEN-01') })
);
app.use('/api/tools/videos', createVideoRouter({ requireAccess }));

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// ---------- SEO: robots, sitemap and per-page <head> ----------
// SITE_URL (e.g. https://monchys.store) gives absolute URLs; otherwise the request's host is used.
const originOf = (req) => process.env.SITE_URL?.replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`;

// One URL per page for Google: www.monshys.io and a trailing slash redirect to the canonical address
app.get('/{*splat}', (req, res, next) => {
  const host = req.get('host') ?? '';
  const trimmed = req.path.length > 1 && req.path.endsWith('/') ? req.path.replace(/\/+$/, '') : req.path;
  if (!host.startsWith('www.') && trimmed === req.path) return next();
  const query = req.originalUrl.slice(req.path.length);
  const origin = host.startsWith('www.') ? `https://${host.slice(4)}` : '';
  // Collapse leading slashes so "//other.site/" can't become a redirect to another domain
  res.redirect(301, `${origin}${trimmed.replace(/^\/+/, '/') || '/'}${query}`);
});

app.get('/robots.txt', (req, res) => res.type('text/plain').send(robotsTxt(originOf(req))));
app.get('/sitemap.xml', (req, res) =>
  res.type('application/xml').send(sitemapXml(originOf(req), sitemapPaths({ products: products.filter((p) => p.published), businesses: activeBusinesses() })))
);
app.get('/convertir', (req, res) => res.redirect(301, '/herramientas/convertidor'));
// Compressing videos moved to the free converter
app.get('/herramientas/convertidor-pro/comprimir-video', (req, res) => res.redirect(301, '/herramientas/convertidor/comprimir-video'));

// Production: serve the built frontend; every page gets its own title, description and tags.
if (existsSync(DIST_DIR)) {
  const template = readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
  app.use(express.static(DIST_DIR, { index: false }));
  app.get('/{*splat}', (req, res) => {
    const pagePath = req.path.replace(/\/+$/, '') || '/';
    const slug = pagePath.match(/^\/reservar\/([a-z0-9-]+)$/)?.[1];
    const business = slug ? activeBusinesses().find((b) => b.id === slug) ?? null : null;
    const seo = seoFor(pagePath, { products: products.filter((p) => p.published), business });
    res.status(seo.notFound ? 404 : 200).type('html').send(renderHtml(template, seo, originOf(req)));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.status ? err.message : 'Error interno del servidor' });
});

await load();
app.listen(PORT, (err) => {
  // Express 5 passes listen errors here (e.g. the port is still taken by an old process)
  if (err) {
    console.error(`No se pudo iniciar en el puerto ${PORT}: ${err.code === 'EADDRINUSE' ? 'el puerto está ocupado por otro proceso' : err.message}`);
    process.exit(1);
  }
  console.log(`API lista en http://localhost:${PORT}`);
});
