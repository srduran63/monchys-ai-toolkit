// Monchys Ahorro: expenses and income written in plain Spanish ("gasté 20 en comida"),
// monthly budgets per category and a savings goal.
import crypto from 'node:crypto';
import express from 'express';
import { createStore } from '../store.js';

export const CATEGORIES = {
  comida: 'Comida',
  transporte: 'Transporte',
  hogar: 'Hogar',
  ocio: 'Ocio',
  salud: 'Salud',
  compras: 'Compras',
  educacion: 'Educación',
  otros: 'Otros',
};

const KEYWORDS = {
  comida: ['comida', 'almuerzo', 'comer', 'cena', 'cenar', 'desayuno', 'restaurante', 'super', 'supermercado', 'mercado', 'cafe', 'pizza', 'tacos', 'hamburguesa', 'despensa', 'panaderia', 'pan', 'frutas', 'verduras', 'snack', 'bebida', 'refresco', 'delivery', 'rappi', 'didi food', 'uber eats'],
  transporte: ['uber', 'taxi', 'didi', 'gasolina', 'nafta', 'combustible', 'bus', 'autobus', 'metro', 'pasaje', 'transporte', 'estacionamiento', 'parking', 'peaje', 'tren', 'avion', 'vuelo', 'mecanico', 'auto', 'coche', 'carro', 'moto', 'bici'],
  hogar: ['renta', 'alquiler', 'luz', 'agua', 'gas', 'internet', 'telefono', 'celular', 'casa', 'hipoteca', 'limpieza', 'muebles', 'mantenimiento', 'cable', 'electricidad'],
  ocio: ['cine', 'netflix', 'spotify', 'disney', 'hbo', 'salida', 'bar', 'fiesta', 'juego', 'videojuego', 'concierto', 'teatro', 'cerveza', 'copas', 'viaje', 'vacaciones', 'hotel', 'suscripcion', 'streaming'],
  salud: ['farmacia', 'medico', 'doctor', 'medicina', 'medicamento', 'dentista', 'gimnasio', 'gym', 'hospital', 'consulta', 'analisis', 'terapia', 'seguro medico', 'lentes'],
  compras: ['ropa', 'zapatos', 'tenis', 'amazon', 'mercado libre', 'regalo', 'tienda', 'compra', 'compras', 'shein', 'electronica', 'maquillaje', 'perfume', 'accesorios'],
  educacion: ['curso', 'libro', 'libros', 'colegiatura', 'escuela', 'universidad', 'clase', 'clases', 'utiles', 'matricula', 'taller'],
};

const INCOME_RE = /\b(cobr[eé]|gan[eé]|recib[ií]|ingres[oóe]s?|me pagaron|me depositaron|sueldo|salario|quincena|n[oó]mina|vend[ií]|me transfirieron|propina)\b/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ENTRIES = 5000;

const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const addDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// "1.200" -> 1200, "20.50" -> 20.5, "1,5" -> 1.5, "2.350,75" -> 2350.75
function parseAmount(token) {
  const lastDot = token.lastIndexOf('.');
  const lastComma = token.lastIndexOf(',');
  let normalized = token;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    normalized = token.split(thousands).join('').replace(decimal, '.');
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const parts = token.split(sep);
    const isThousands = parts.length > 2 || parts.at(-1).length === 3;
    normalized = isThousands ? parts.join('') : parts.join('.');
  }
  return Number(normalized);
}

export function parseEntry(text, today) {
  const clean = normalize(text);
  const match = clean.match(/\d[\d.,]*/);
  if (!match) return { error: 'No encontré ninguna cantidad. Prueba con algo como "gasté 20 en comida".' };
  let amount = parseAmount(match[0].replace(/[.,]$/, ''));
  if (/\d\s*(k|mil)\b/.test(clean.slice(match.index, match.index + match[0].length + 5))) amount *= 1000;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return { error: 'La cantidad no parece válida.' };

  const type = INCOME_RE.test(clean) ? 'income' : 'expense';
  let category = 'otros';
  if (type === 'expense') {
    for (const [cat, words] of Object.entries(KEYWORDS)) {
      if (words.some((w) => new RegExp(`\\b${w}s?\\b`).test(clean))) {
        category = cat;
        break;
      }
    }
  }

  let date = today;
  if (/\banteayer\b/.test(clean)) date = addDays(today, -2);
  else if (/\bayer\b/.test(clean)) date = addDays(today, -1);

  return { amount: Math.round(amount * 100) / 100, type, category: type === 'income' ? 'ingreso' : category, date, note: text.trim().slice(0, 140) };
}

function monthTotals(entries, month) {
  const inMonth = entries.filter((e) => e.date.startsWith(month));
  const spent = inMonth.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const income = inMonth.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const byCategory = {};
  for (const e of inMonth) if (e.type === 'expense') byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  return { spent, income, byCategory };
}

const fmt = (n) => `$${n.toLocaleString('es', { maximumFractionDigits: 2 })}`;

function replyFor(entry, user) {
  const month = entry.date.slice(0, 7);
  const { spent, income, byCategory } = monthTotals(user.entries, month);
  if (entry.type === 'income') {
    return { text: `Anotado: ingreso de ${fmt(entry.amount)}. Este mes llevas ${fmt(income)} de ingresos.`, alert: null };
  }
  const name = CATEGORIES[entry.category];
  const budget = user.budgets[entry.category];
  const catSpent = byCategory[entry.category] ?? 0;
  let text = `Anotado: ${fmt(entry.amount)} en ${name}. Este mes llevas ${fmt(catSpent)} en ${name} y ${fmt(spent)} en total.`;
  let alert = null;
  if (budget) {
    if (catSpent > budget) alert = `Te pasaste del presupuesto de ${name} por ${fmt(catSpent - budget)}.`;
    else if (catSpent >= budget * 0.8) alert = `Ya usaste el ${Math.round((catSpent / budget) * 100)}% de tu presupuesto de ${name}.`;
    else text += ` Te quedan ${fmt(budget - catSpent)} de presupuesto.`;
  }
  return { text, alert };
}

export async function createAhorroRouter({ requireAccess }) {
  const store = await createStore('ahorro', {});
  const router = express.Router();
  router.use(requireAccess('AHO-01'));

  const userData = (req) => store.forUser(req.user.id, () => ({ entries: [], budgets: {}, goal: 0 }));
  const view = (u) => ({ categories: CATEGORIES, entries: u.entries, budgets: u.budgets, goal: u.goal });

  router.get('/', (req, res) => res.json(view(userData(req))));

  router.post('/entries', async (req, res) => {
    const u = userData(req);
    if (u.entries.length >= MAX_ENTRIES) return res.status(400).json({ error: 'Has llegado al máximo de movimientos guardados.' });
    const today = DATE_RE.test(req.body?.today ?? '') ? req.body.today : new Date().toISOString().slice(0, 10);

    let parsed;
    if (typeof req.body?.text === 'string' && req.body.text.trim()) {
      parsed = parseEntry(req.body.text.slice(0, 300), today);
    } else {
      const amount = Math.round(Number(req.body?.amount) * 100) / 100;
      const type = req.body?.type === 'income' ? 'income' : 'expense';
      const category = type === 'income' ? 'ingreso' : CATEGORIES[req.body?.category] ? req.body.category : 'otros';
      const date = DATE_RE.test(req.body?.date ?? '') ? req.body.date : today;
      parsed =
        Number.isFinite(amount) && amount > 0 && amount <= 100_000_000
          ? { amount, type, category, date, note: String(req.body?.note ?? '').trim().slice(0, 140) }
          : { error: 'Cantidad inválida.' };
    }
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const entry = { id: crypto.randomUUID(), ...parsed, createdAt: new Date().toISOString() };
    u.entries.push(entry);
    await store.save();
    res.status(201).json({ entry, reply: replyFor(entry, u), ...view(u) });
  });

  router.patch('/entries/:id', async (req, res) => {
    const u = userData(req);
    const entry = u.entries.find((e) => e.id === req.params.id);
    if (!entry) return res.status(404).json({ error: 'Movimiento no encontrado.' });
    if (entry.type === 'expense' && CATEGORIES[req.body?.category]) entry.category = req.body.category;
    await store.save();
    res.json(view(u));
  });

  router.delete('/entries/:id', async (req, res) => {
    const u = userData(req);
    u.entries = u.entries.filter((e) => e.id !== req.params.id);
    await store.save();
    res.json(view(u));
  });

  router.put('/settings', async (req, res) => {
    const u = userData(req);
    const budgets = {};
    for (const [cat, value] of Object.entries(req.body?.budgets ?? {})) {
      const n = Math.round(Number(value) * 100) / 100;
      if (CATEGORIES[cat] && Number.isFinite(n) && n > 0 && n <= 100_000_000) budgets[cat] = n;
    }
    const goal = Math.round(Number(req.body?.goal) * 100) / 100;
    u.budgets = budgets;
    u.goal = Number.isFinite(goal) && goal > 0 ? goal : 0;
    await store.save();
    res.json(view(u));
  });

  return router;
}
