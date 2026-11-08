// Booking assistant: businesses, availability, bookings and an AI chat (Claude + tool use).
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { ai, aiAvailableFor, aiSpent, AI_LIMITS, baseRequest, getClient, plainText, sendAiError, trackUsage } from './ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data', 'businesses.json');
const SEED_FILE = path.join(__dirname, 'seed-businesses.json');

const MAX_TOOL_ROUNDS = 6;
const BOOKING_WINDOW_DAYS = 60;
const LEAD_MINUTES = 30; // no bookings starting sooner than this
const MAX_ACTIVE_PER_PHONE = 3;
const SLOT_STEPS = [10, 15, 20, 30, 45, 60];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// ---------- Storage ----------
let businesses = [];
let writeQueue = Promise.resolve();

async function load() {
  try {
    businesses = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    businesses = JSON.parse(await fs.readFile(SEED_FILE, 'utf8'));
    await save();
  }
}

function save() {
  const snapshot = JSON.stringify(businesses, null, 2);
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmp, snapshot);
    await fs.rename(tmp, DATA_FILE);
  });
  return writeQueue;
}

const findBusiness = (id) => businesses.find((b) => b.id === id);

// ---------- Time helpers (all in the business's local time) ----------
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const fromMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const weekdayOf = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
const addDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

function nowLocal(timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Free start times for a service on a date, or { error } explaining why there are none.
function availableSlots(business, serviceId, date) {
  const service = business.services.find((s) => s.id === serviceId);
  if (!service) return { error: 'Servicio no encontrado.' };
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) return { error: 'Fecha inválida (usa AAAA-MM-DD).' };

  const now = nowLocal(business.timezone);
  if (date < now.date) return { error: 'Esa fecha ya pasó.' };
  if (date > addDays(now.date, BOOKING_WINDOW_DAYS)) {
    return { error: `Solo se puede reservar con hasta ${BOOKING_WINDOW_DAYS} días de antelación.` };
  }

  const ranges = business.hours[weekdayOf(date)] ?? [];
  if (ranges.length === 0) return { slots: [], closed: true };

  const taken = business.bookings
    .filter((b) => b.status === 'confirmed' && b.date === date)
    .map((b) => [toMin(b.time), toMin(b.time) + b.minutes]);

  const minStart = date === now.date ? now.minutes + LEAD_MINUTES : -1;
  const slots = [];
  for (const [open, close] of ranges) {
    for (let t = toMin(open); t + service.minutes <= toMin(close); t += business.slotMinutes) {
      if (t < minStart) continue;
      if (taken.some(([s, e]) => t < e && t + service.minutes > s)) continue;
      slots.push(fromMin(t));
    }
  }
  return { slots, closed: false };
}

const cleanText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function createBooking(business, input, source) {
  const name = cleanText(input.name, 60);
  const phone = cleanText(input.phone, 20);
  const notes = cleanText(input.notes, 300);
  if (name.length < 2) return { error: 'Falta el nombre del cliente.' };
  if (!/^[+\d][\d\s()-]{6,19}$/.test(phone)) return { error: 'Teléfono inválido.' };
  if (!TIME_RE.test(input.time ?? '')) return { error: 'Hora inválida (usa HH:MM).' };

  const { slots, error } = availableSlots(business, input.serviceId, input.date);
  if (error) return { error };
  if (!slots.includes(input.time)) return { error: 'Ese horario ya no está disponible.' };

  const now = nowLocal(business.timezone);
  const digits = phone.replace(/\D/g, '');
  const active = business.bookings.filter(
    (b) => b.status === 'confirmed' && b.date >= now.date && b.phone.replace(/\D/g, '') === digits
  );
  if (active.length >= MAX_ACTIVE_PER_PHONE) {
    return { error: 'Este teléfono ya tiene varias citas pendientes. Contacta con el negocio para gestionarlas.' };
  }

  const service = business.services.find((s) => s.id === input.serviceId);
  const booking = {
    id: crypto.randomBytes(4).toString('hex').toUpperCase(),
    serviceId: service.id,
    serviceName: service.name,
    minutes: service.minutes,
    date: input.date,
    time: input.time,
    name,
    phone,
    notes,
    status: 'confirmed',
    source,
    createdAt: new Date().toISOString(),
  };
  business.bookings.push(booking);
  return { booking };
}

const publicBooking = ({ id, serviceName, date, time, name }) => ({ id, serviceName, date, time, name });

// ---------- Business validation (admin) ----------
function validateBusiness(body, { isNew }) {
  const errors = [];
  const b = {};
  body ??= {};

  if (isNew) {
    b.id = cleanText(body.id, 40).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(b.id)) errors.push('Identificador inválido (minúsculas, números y guiones)');
  }
  b.name = cleanText(body.name, 80);
  if (!b.name) errors.push('Nombre requerido');
  b.description = cleanText(body.description, 300);
  b.timezone = cleanText(body.timezone, 60);
  if (!isValidTimeZone(b.timezone)) errors.push('Zona horaria inválida (ej.: America/Mexico_City)');
  b.slotMinutes = Number(body.slotMinutes);
  if (!SLOT_STEPS.includes(b.slotMinutes)) errors.push('Intervalo entre citas inválido');
  b.faq = cleanText(body.faq, 3000);
  b.active = body.active !== false;
  // Customer account that sees this agenda in their panel (optional)
  b.ownerEmail = cleanText(body.ownerEmail, 254).toLowerCase();
  if (b.ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.ownerEmail)) errors.push('Correo del dueño inválido');

  if (!Array.isArray(body.hours) || body.hours.length !== 7) {
    errors.push('Horario inválido');
  } else {
    b.hours = body.hours.map((day, i) => {
      if (!Array.isArray(day) || day.length > 3) {
        errors.push(`Horario del ${WEEKDAYS[i]} inválido`);
        return [];
      }
      return day.map(([open, close]) => {
        if (!TIME_RE.test(open ?? '') || !TIME_RE.test(close ?? '') || toMin(open) >= toMin(close)) {
          errors.push(`Horario del ${WEEKDAYS[i]} inválido`);
        }
        return [open, close];
      });
    });
  }

  if (!Array.isArray(body.services) || body.services.length === 0 || body.services.length > 30) {
    errors.push('Añade entre 1 y 30 servicios');
  } else {
    b.services = body.services.map((s) => {
      const service = {
        id: /^[a-z0-9]{6}$/.test(s?.id ?? '') ? s.id : crypto.randomBytes(3).toString('hex'),
        name: cleanText(s?.name, 60),
        minutes: Number(s?.minutes),
        price: Math.round(Number(s?.price) * 100) / 100,
      };
      if (!service.name) errors.push('Cada servicio necesita nombre');
      if (!Number.isInteger(service.minutes) || service.minutes < 5 || service.minutes > 480) {
        errors.push(`Duración inválida en "${service.name}"`);
      }
      if (!Number.isFinite(service.price) || service.price < 0) errors.push(`Precio inválido en "${service.name}"`);
      return service;
    });
  }
  return { business: b, errors };
}

const publicBusiness = (b) => ({
  id: b.id,
  name: b.name,
  description: b.description,
  timezone: b.timezone,
  hours: b.hours,
  services: b.services,
  today: nowLocal(b.timezone).date,
  windowDays: BOOKING_WINDOW_DAYS,
  assistant: aiAvailableFor(`biz:${b.id}`),
});

// ---------- AI assistant ----------

function systemPrompt(business) {
  const now = nowLocal(business.timezone);
  const services = business.services
    .map((s) => `- ${s.name} (id: ${s.id}) · ${s.minutes} min · $${s.price}`)
    .join('\n');
  const hours = business.hours
    .map((ranges, i) => `- ${WEEKDAYS[i]}: ${ranges.length ? ranges.map(([o, c]) => `${o}–${c}`).join(', ') : 'cerrado'}`)
    .join('\n');

  return `Eres el asistente de reservas de "${business.name}". Atiendes a sus clientes por chat.

Fecha y hora actuales del negocio: ${WEEKDAYS[weekdayOf(now.date)]} ${now.date}, ${fromMin(now.minutes)} (${business.timezone}).

Sobre el negocio: ${business.description || '(sin descripción)'}

Servicios:
${services}

Horario de atención:
${hours}

Información adicional y preguntas frecuentes del negocio:
${business.faq || '(ninguna)'}

Cómo trabajas:
- Responde en el idioma del cliente (español por defecto), con un tono cercano y frases cortas: 1 a 3 frases por mensaje. Texto plano, sin tablas ni encabezados.
- Para ofrecer horarios usa siempre get_available_slots; nunca supongas disponibilidad. Si un día no hay huecos, ofrece el siguiente día con disponibilidad.
- Interpreta fechas relativas ("mañana", "el viernes") a partir de la fecha actual y pásalas a las herramientas como AAAA-MM-DD.
- Antes de usar create_booking necesitas servicio, fecha, hora, nombre y teléfono, y el cliente debe confirmar explícitamente el resumen de la cita.
- Tras reservar, confirma la cita con su código.
- No puedes cancelar ni cambiar citas existentes: pide al cliente que contacte directamente con el negocio.
- Solo ayudas con este negocio y sus reservas. Si te piden otra cosa, redirige con amabilidad. No inventes precios, servicios ni políticas que no aparezcan arriba.`;
}

function chatTools(business) {
  const serviceIds = business.services.map((s) => s.id);
  return [
    {
      name: 'get_available_slots',
      description:
        'Devuelve las horas de inicio libres para un servicio en una fecha concreta, en hora local del negocio. Úsala siempre antes de proponer horarios.',
      strict: true,
      input_schema: {
        type: 'object',
        properties: {
          service_id: { type: 'string', enum: serviceIds, description: 'Id del servicio' },
          date: { type: 'string', description: 'Fecha en formato AAAA-MM-DD' },
        },
        required: ['service_id', 'date'],
        additionalProperties: false,
      },
    },
    {
      name: 'create_booking',
      description:
        'Crea la reserva. Solo después de que el cliente haya confirmado servicio, fecha, hora, nombre y teléfono.',
      strict: true,
      input_schema: {
        type: 'object',
        properties: {
          service_id: { type: 'string', enum: serviceIds },
          date: { type: 'string', description: 'AAAA-MM-DD' },
          time: { type: 'string', description: 'HH:MM, una de las horas devueltas por get_available_slots' },
          customer_name: { type: 'string' },
          customer_phone: { type: 'string' },
          notes: { type: 'string', description: 'Notas del cliente, o cadena vacía' },
        },
        required: ['service_id', 'date', 'time', 'customer_name', 'customer_phone', 'notes'],
        additionalProperties: false,
      },
    },
  ];
}

async function runTool(business, name, input, created) {
  if (name === 'get_available_slots') {
    const { slots, closed, error } = availableSlots(business, input.service_id, input.date);
    if (error) return { content: error, isError: true };
    if (closed) return { content: `El negocio está cerrado el ${input.date}.` };
    return { content: slots.length ? `Horas libres el ${input.date}: ${slots.join(', ')}` : `No quedan horas libres el ${input.date}.` };
  }
  if (name === 'create_booking') {
    const { booking, error } = createBooking(
      business,
      {
        serviceId: input.service_id,
        date: input.date,
        time: input.time,
        name: input.customer_name,
        phone: input.customer_phone,
        notes: input.notes,
      },
      'chat'
    );
    if (error) return { content: error, isError: true };
    await save();
    created.push(booking);
    return { content: `Reserva creada. Código: ${booking.id}. ${booking.serviceName}, ${booking.date} a las ${booking.time}.` };
  }
  return { content: `Herramienta desconocida: ${name}`, isError: true };
}

// One customer turn: runs the tool loop and returns the assistant's reply text.
// Only plain text goes back to the browser, so earlier turns are replayed as text.
async function chat(business, history) {
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  const created = [];
  const system = systemPrompt(business);
  const tools = chatTools(business);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await getClient().beta.messages.create({
      ...baseRequest,
      system,
      tools,
      messages,
    });
    trackUsage('reservas-chat', response.usage, `biz:${business.id}`);

    if (response.stop_reason === 'refusal') {
      return { reply: 'Lo siento, no puedo ayudarte con eso. ¿Quieres reservar una cita?', created };
    }
    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      const reply = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return { reply: plainText(reply) || '¿En qué más te puedo ayudar?', created };
    }

    messages.push({ role: 'assistant', content: response.content });
    const results = [];
    for (const block of toolUses) {
      const { content, isError } = await runTool(business, block.name, block.input, created);
      results.push({ type: 'tool_result', tool_use_id: block.id, content, ...(isError && { is_error: true }) });
    }
    messages.push({ role: 'user', content: results });
  }
  return { reply: 'Perdona, me he liado. ¿Puedes repetirme qué necesitas?', created };
}

function validateHistory(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 40) return null;
  const history = [];
  for (const [i, m] of raw.entries()) {
    const role = i % 2 === 0 ? 'user' : 'assistant'; // must alternate, starting with the customer
    if (m?.role !== role || typeof m.content !== 'string') return null;
    const content = m.content.trim().slice(0, 1000);
    if (!content) return null;
    history.push({ role, content });
  }
  return history.at(-1).role === 'user' ? history : null;
}

// ---------- Rate limiting ----------
function limiter(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return res.status(429).json({ error: 'Demasiadas solicitudes. Espera unos minutos.' });
    recent.push(now);
    hits.set(req.ip, recent);
    next();
  };
}

// Public data for page titles and the sitemap (active businesses only).
export const activeBusinesses = () =>
  businesses.filter((b) => b.active).map(({ id, name, description }) => ({ id, name, description }));

// Agenda for the customer panel: businesses whose owner is this email, with upcoming bookings.
export function getOwnedBusinesses(email) {
  return businesses
    .filter((b) => b.ownerEmail && b.ownerEmail === email)
    .map((b) => {
      const today = nowLocal(b.timezone).date;
      return {
        id: b.id,
        name: b.name,
        active: b.active,
        today,
        bookings: b.bookings
          .filter((x) => x.status === 'confirmed' && x.date >= today)
          .sort((x, y) => `${x.date} ${x.time}`.localeCompare(`${y.date} ${y.time}`))
          .map(({ id, serviceName, minutes, date, time, name, phone, notes, source }) => ({
            id,
            serviceName,
            minutes,
            date,
            time,
            name,
            phone,
            notes,
            source,
          })),
      };
    });
}

// ---------- Routers ----------
export function createBookingRouters({ requireAdmin }) {
  const pub = express.Router();
  const admin = express.Router();
  admin.use(requireAdmin);

  const activeBusiness = (req, res, next) => {
    const business = findBusiness(req.params.slug);
    if (!business?.active) return res.status(404).json({ error: 'Negocio no encontrado' });
    req.business = business;
    next();
  };

  pub.get('/:slug', activeBusiness, (req, res) => res.json(publicBusiness(req.business)));

  pub.get('/:slug/slots', activeBusiness, (req, res) => {
    const { slots, closed, error } = availableSlots(req.business, String(req.query.service), String(req.query.date));
    if (error) return res.status(400).json({ error });
    res.json({ slots, closed });
  });

  pub.post('/:slug/bookings', limiter(10, 60 * 60 * 1000), activeBusiness, async (req, res) => {
    const { booking, error } = createBooking(req.business, req.body ?? {}, 'form');
    if (error) return res.status(400).json({ error });
    await save();
    res.status(201).json(publicBooking(booking));
  });

  pub.post('/:slug/chat', limiter(40, 10 * 60 * 1000), activeBusiness, async (req, res) => {
    if (!aiAvailableFor(`biz:${req.business.id}`)) return res.status(503).json({ error: 'El asistente no está disponible ahora mismo.' });
    const history = validateHistory(req.body?.messages);
    if (!history) return res.status(400).json({ error: 'Conversación inválida.' });

    try {
      const { reply, created } = await chat(req.business, history);
      res.json({ reply, bookings: created.map(publicBooking) });
    } catch (err) {
      if (!sendAiError(err, res)) throw err;
    }
  });

  admin.get('/', (req, res) => {
    res.json(
      businesses.map(({ bookings, ...b }) => ({
        ...b,
        upcoming: bookings.filter((x) => x.status === 'confirmed' && x.date >= nowLocal(b.timezone).date).length,
        aiSpent: aiSpent(`biz:${b.id}`),
        aiLimit: AI_LIMITS.business,
      }))
    );
  });

  admin.get('/:id', (req, res) => {
    const business = findBusiness(req.params.id);
    if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });
    res.json({ ...business, today: nowLocal(business.timezone).date });
  });

  admin.post('/', async (req, res) => {
    const { business, errors } = validateBusiness(req.body, { isNew: true });
    if (errors.length) return res.status(400).json({ error: [...new Set(errors)].join('. ') });
    if (findBusiness(business.id)) return res.status(409).json({ error: 'Ya existe un negocio con ese identificador' });
    const created = { ...business, bookings: [], createdAt: new Date().toISOString() };
    businesses.push(created);
    await save();
    res.status(201).json(created);
  });

  admin.put('/:id', async (req, res) => {
    const index = businesses.findIndex((b) => b.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Negocio no encontrado' });
    const { business, errors } = validateBusiness(req.body, { isNew: false });
    if (errors.length) return res.status(400).json({ error: [...new Set(errors)].join('. ') });
    businesses[index] = { ...businesses[index], ...business, id: businesses[index].id };
    await save();
    res.json(businesses[index]);
  });

  admin.delete('/:id', async (req, res) => {
    const index = businesses.findIndex((b) => b.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Negocio no encontrado' });
    businesses.splice(index, 1);
    await save();
    res.status(204).end();
  });

  admin.patch('/:id/bookings/:bookingId', async (req, res) => {
    const business = findBusiness(req.params.id);
    const booking = business?.bookings.find((b) => b.id === req.params.bookingId);
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (!['confirmed', 'cancelled'].includes(req.body?.status)) return res.status(400).json({ error: 'Estado inválido' });
    if (req.body.status === 'confirmed' && booking.status !== 'confirmed') {
      const start = toMin(booking.time);
      const clash = business.bookings.some(
        (b) =>
          b !== booking &&
          b.status === 'confirmed' &&
          b.date === booking.date &&
          start < toMin(b.time) + b.minutes &&
          start + booking.minutes > toMin(b.time)
      );
      if (clash) return res.status(409).json({ error: 'Ese hueco ya lo ocupa otra cita.' });
    }
    booking.status = req.body.status;
    await save();
    res.json(booking);
  });

  return { publicRouter: pub, adminRouter: admin };
}

await load();
