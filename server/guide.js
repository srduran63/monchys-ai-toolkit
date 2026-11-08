// Monchys guide chat: asks visitors what they want to do today and recommends tools.
// Free-text questions go to Claude with the live catalog; without AI (or over budget)
// a keyword matcher answers instead, so the chat always works.
import express from 'express';
import { ai, complete, sendAiError, withinBudget } from './ai.js';
import { isCrisis } from './tools/diario.js';

const SUBJECT = 'site:guide'; // monthly AI budget shared by every visitor (AI_BUDGET_GUIDE_USD)
const MAX_MESSAGES = 12; // history sent to the model
const MAX_CHARS = 500;
const PER_HOUR = 30; // messages per visitor IP
const MAX_TOOLS = 3;

// Fallback matcher: first matching rules win, up to MAX_TOOLS products.
const KEYWORDS = [
  ['IMG-01', /fondo|recort|transparente|png sin|foto de producto/],
  ['PDE-01', /editar (un |el |mi )?pdf|firmar|firma|rellenar|unir pdf|juntar pdf|ordenar p[aá]ginas|girar|escribir en (un |el )?pdf/],
  ['CMP-01', /comprim|reducir (el )?(peso|tama[nñ]o)|pesa mucho|muy pesad|achicar/],
  ['SUB-01', /subt[ií]tul|captions|srt/],
  ['TRD-01', /tradu|traductor|otro idioma|al ingl[eé]s|al espa[nñ]ol/],
  ['UPS-01', /mejorar (la |una |mis )?foto|pixelad|borros|ampliar|aumentar (la )?resoluci[oó]n|foto (vieja|antigua)|nitidez/],
  ['DES-01', /descripci[oó]n|mercado ?libre|amazon|marketplace|ficha de producto|vender (un |mi )?producto|etsy/],
  ['RED-01', /redes|instagram|facebook|tiktok|linkedin|publicaci[oó]n|post|caption|hashtag|copy/],
  ['TRA-01', /transcrib|audio a texto|voz a texto|entrevista|reuni[oó]n|nota(s)? de voz|podcast|grabaci[oó]n/],
  ['PDF-01', /pdf|resum|documento|libro|contrato|art[ií]culo|apuntes/],
  ['CV-01', /\bcv\b|curr[ií]cul|hoja de vida|empleo|trabajo|entrevista de trabajo|carta de presentaci[oó]n/],
  ['AHO-01', /ahorr|dinero|gasto|presupuesto|finanz|deuda|quincena|sueldo/],
  ['BIE-01', /[aá]nimo|triste|ansiedad|estr[eé]s|emoci|diario|me siento|sentimiento|bienestar/],
  ['RES-01', /reserva|cita|agenda|negocio|clientes|turno|consultorio|sal[oó]n|barber/],
  ['CNV-02', /comprimir (un )?video|video grande|2 ?gb|muchos archivos|lote/],
  ['CNV-01', /conv(ertir|ierte|ersi)|pasar a|heic|jpe?g|png|webp|mp3|mp4|wav|formato|extraer (el )?audio/],
];
const DEFAULT_TOOLS = ['CNV-01', 'IMG-01', 'PDF-01'];

export function matchTools(text) {
  const t = text.toLowerCase();
  return KEYWORDS.filter(([, re]) => re.test(t))
    .map(([id]) => id)
    .slice(0, MAX_TOOLS);
}

const priceLabel = (p) =>
  p.price === 0 ? 'Gratis, sin registro' : p.period === 'month' ? `$${p.price} al mes` : `$${p.price} pago único`;

export function catalogText(products) {
  const names = Object.fromEntries(products.map((p) => [p.id, p.name]));
  return products
    .map((p) => {
      const includes = p.includes?.length ? ` | Incluye: ${p.includes.map((id) => names[id] ?? id).join(', ')}` : '';
      return `- ${p.id} | ${p.name} | ${priceLabel(p)} | ${String(p.desc ?? '').slice(0, 220)}${includes}`;
    })
    .join('\n');
}

const systemPrompt = (products) => `Eres Monchys, la mascota de Monchys IA: un monstruo azul simpático que se "come" los archivos y los devuelve listos. Tu trabajo en este chat es ayudar al visitante a encontrar la herramienta de la tienda que le sirve para lo que quiere hacer hoy.

Catálogo (ID | nombre | precio | descripción):
${catalogText(products)}

Reglas:
- Responde siempre en español, en 1 a 3 frases cortas, con tono cálido y algún guiño de monstruo glotón sin exagerar. Sin markdown ni listas.
- Nombra las herramientas por su nombre; nunca escribas sus IDs en el texto (las tarjetas se muestran solas).
- Recomienda solo herramientas de este catálogo, como máximo ${MAX_TOOLS}, la más adecuada primero. No inventes funciones, límites ni precios.
- Si lo que pide no encaja con ninguna, dilo con honestidad y sugiere la más cercana o pregunta qué necesita.
- Si la petición es ambigua, haz una sola pregunta para aclararla.
- Si recomiendas varias herramientas incluidas en un plan, menciona que el plan sale más barato.
- Si la persona habla de cómo se siente, puedes sugerir el Diario emocional aclarando que no sustituye a un profesional.
- Si preguntan algo que no tiene que ver con la tienda, redirige con amabilidad a lo que puedes hacer.
- Termina SIEMPRE con una línea aparte con el formato exacto "HERRAMIENTAS: ID1, ID2" o "HERRAMIENTAS: ninguna".`;

function parseReply(text, validIds) {
  const match = text.match(/^\s*HERRAMIENTAS:\s*(.*)$/im);
  const tools = (match?.[1] ?? '')
    .split(/[,\s]+/)
    .map((id) => id.trim().toUpperCase())
    .filter((id) => validIds.has(id));
  const reply = text.replace(/^\s*HERRAMIENTAS:.*$/im, '').trim();
  return { reply, tools: [...new Set(tools)].slice(0, MAX_TOOLS) };
}

export function fallbackReply(text, validIds) {
  const tools = matchTools(text).filter((id) => validIds.has(id));
  if (tools.length) return { reply: '¡Ñam! Creo que esto es justo lo que buscas:', tools, fallback: true };
  return {
    reply: 'Mmm, no estoy seguro de haberte entendido. Prueba con algo como "quitar el fondo de una foto" o "resumir un PDF". Mientras, estas son las favoritas:',
    tools: DEFAULT_TOOLS.filter((id) => validIds.has(id)),
    fallback: true,
  };
}

export function createGuideRouter({ getProducts }) {
  const router = express.Router();
  const hits = new Map(); // ip -> { count, resetAt }

  function rateLimit(req, res, next) {
    const now = Date.now();
    const entry = hits.get(req.ip);
    if (!entry || entry.resetAt < now) hits.set(req.ip, { count: 1, resetAt: now + 3600_000 });
    else if (++entry.count > PER_HOUR) {
      return res.status(429).json({ error: '¡Uf, mucho chat por hoy! Descansa un poco mis mandíbulas y vuelve en un rato.' });
    }
    if (hits.size > 5000) for (const [ip, e] of hits) if (e.resetAt < now) hits.delete(ip);
    next();
  }

  router.post('/chat', rateLimit, async (req, res) => {
    const raw = Array.isArray(req.body?.messages) ? req.body.messages.slice(-MAX_MESSAGES) : [];
    const messages = raw
      .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS) }));
    while (messages[0]?.role === 'assistant') messages.shift(); // the conversation must start with the user
    const last = messages.at(-1);
    if (!last || last.role !== 'user') return res.status(400).json({ error: 'Escribe qué quieres hacer.' });

    if (isCrisis(last.content)) {
      return res.json({
        reply: 'Siento mucho que estés pasando por algo tan duro. No tienes que cargar con esto a solas: habla ahora con alguien que pueda ayudarte.',
        tools: [],
        crisis: true,
      });
    }

    const products = getProducts().filter((p) => p.published);
    const validIds = new Set(products.map((p) => p.id));
    if (!ai.available || !withinBudget(SUBJECT)) return res.json(fallbackReply(last.content, validIds));

    try {
      const text = await complete({ system: systemPrompt(products), messages, feature: 'guía', subject: SUBJECT });
      const result = parseReply(text, validIds);
      if (!result.reply) return res.json(fallbackReply(last.content, validIds));
      res.json(result);
    } catch (err) {
      // sendAiError still switches AI off on key/credit problems; the visitor gets the matcher's answer
      const sink = { status: () => sink, json: () => {} };
      if (!sendAiError(err, sink)) console.error('Chat de Monchys:', err);
      res.json(fallbackReply(last.content, validIds));
    }
  });

  return router;
}
