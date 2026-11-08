// Shared access to Claude for every tool.
import Anthropic from '@anthropic-ai/sdk';
import { createStore } from './store.js';

export const MODEL = 'claude-opus-5-5';

// Off when no credentials are configured, or once the API rejects them.
export const ai = { available: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) };
if (!ai.available) console.warn('Funciones de IA desactivadas: añade ANTHROPIC_API_KEY a .env para activarlas.');

let client = null;
export function getClient() {
  client ??= new Anthropic();
  return client;
}

// Common request options: low effort, server-side fallback when the model declines.
export const baseRequest = {
  model: MODEL,
  max_tokens: 16000,
  output_config: { effort: 'low' },
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',
};

export class AiRefusal extends Error {}

// Our UI shows plain text: drop markdown bold and headings the model may add.
export const plainText = (text) => text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '').trim();

// ---------- Spend tracking (estimate, Claude Opus 5.5 list prices in USD per million tokens) ----------
const PRICE = { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 };
const spend = await createStore('ai-usage', {});

// Monthly AI budget per customer account ("user:<id>"), per booking business ("biz:<id>")
// and for site-wide features shared by all visitors ("site:<feature>"), in USD.
export const AI_LIMITS = {
  customer: Number(process.env.AI_BUDGET_CUSTOMER_USD) || 2,
  business: Number(process.env.AI_BUDGET_BUSINESS_USD) || 10,
  guide: Number(process.env.AI_BUDGET_GUIDE_USD) || 3,
  // Monchys chat for visitors and free accounts, all together
  assistant: Number(process.env.AI_BUDGET_ASSISTANT_USD) || 10,
  // Turning image descriptions into prompts (Generar imágenes), all users together
  images: Number(process.env.AI_BUDGET_IMAGES_USD) || 5,
};
const budgets = await createStore('ai-budgets', {});
const monthKey = () => new Date().toISOString().slice(0, 7);
const limitFor = (subject) =>
  subject === 'site:guide'
    ? AI_LIMITS.guide
    : subject === 'site:asistente'
      ? AI_LIMITS.assistant
      : subject === 'site:imagenes'
        ? AI_LIMITS.images
        : subject.startsWith('biz:')
          ? AI_LIMITS.business
          : AI_LIMITS.customer;

export const aiSpent = (subject) => budgets.data[monthKey()]?.[subject] ?? 0;
export const withinBudget = (subject) => aiSpent(subject) < limitFor(subject);
// AI usable right now for this customer/business
export const aiAvailableFor = (subject) => ai.available && withinBudget(subject);

export function requireAiBudget(subjectOf) {
  return (req, res, next) => {
    if (withinBudget(subjectOf(req))) return next();
    res.status(429).json({
      error: 'Llegaste al límite de uso de IA incluido en tu plan este mes. Se renueva el día 1; el resto de funciones sigue disponible.',
    });
  };
}

export function trackUsage(feature, usage, subject) {
  if (!usage) return;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cost =
    (usage.input_tokens * PRICE.input + usage.output_tokens * PRICE.output + cacheWrite * PRICE.cacheWrite + cacheRead * PRICE.cacheRead) / 1e6;
  const month = new Date().toISOString().slice(0, 7);
  const entry = ((spend.data[month] ??= {})[feature] ??= { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 });
  entry.calls++;
  entry.inputTokens += usage.input_tokens + cacheWrite + cacheRead;
  entry.outputTokens += usage.output_tokens;
  entry.cost += cost;
  spend.save();
  if (subject) {
    const month = (budgets.data[monthKey()] ??= {});
    month[subject] = (month[subject] ?? 0) + cost;
    budgets.save();
  }
  console.log(`[IA] ${feature}: ${usage.input_tokens + cacheWrite + cacheRead} entrada${cacheRead ? ` (${cacheRead} en caché)` : ''} + ${usage.output_tokens} salida ≈ $${cost.toFixed(4)}`);
}

export const spendByMonth = () => spend.data;

// Single-turn (or multi-turn, no tools) completion that returns the text.
// raw: keep the text exactly as written (no markdown clean-up), e.g. for translations.
export async function complete({ system, messages, feature, subject, raw = false }) {
  const response = await getClient().beta.messages.create({ ...baseRequest, system, messages });
  trackUsage(feature, response.usage, subject);
  if (response.stop_reason === 'refusal') throw new AiRefusal('La IA no puede ayudar con esta solicitud.');
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return raw ? text.trim() : plainText(text);
}

// Completion whose answer is a JSON object (the prompt must ask for JSON only).
export async function completeJson(options) {
  const text = await complete({ ...options, raw: true });
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new AiRefusal('La IA devolvió una respuesta incompleta. Inténtalo de nuevo.');
  }
}

// Map an error from the SDK to an HTTP reply. Returns false if it was not an AI error.
export function sendAiError(err, res) {
  if (err instanceof AiRefusal) {
    res.status(422).json({ error: err.message });
  } else if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    ai.available = false;
    console.error('IA desactivada: credenciales de Anthropic inválidas.');
    res.status(503).json({ error: 'Las funciones de IA no están disponibles ahora mismo.' });
  } else if (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)) {
    // The account has no credits: switch AI features off until the server restarts.
    ai.available = false;
    console.error('IA desactivada: la cuenta de Anthropic no tiene saldo (Plans & Billing en console.anthropic.com).');
    res.status(503).json({ error: 'Las funciones de IA no están disponibles ahora mismo.' });
  } else if (err instanceof Anthropic.RateLimitError) {
    res.status(429).json({ error: 'La IA está muy ocupada. Inténtalo en un momento.' });
  } else if (err instanceof Anthropic.APIError) {
    console.error('Error de la API de Anthropic:', err.status, err.message);
    res.status(502).json({ error: 'La IA tuvo un problema. Inténtalo de nuevo.' });
  } else if (err?.message?.includes('apiKey') || err?.message?.includes('authToken')) {
    ai.available = false;
    res.status(503).json({ error: 'Las funciones de IA no están disponibles ahora mismo.' });
  } else {
    return false;
  }
  return true;
}

export function requireAi(req, res, next) {
  if (!ai.available) return res.status(503).json({ error: 'Esta función necesita la IA, que no está activada en el servidor.' });
  next();
}
