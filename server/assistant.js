// Monchys chat: answers questions and runs the free tools on the visitor's files (compress,
// convert, join / rotate / extract PDF pages) through Claude tool use. Paid tools: a subscriber
// gets the text work done in the chat (posts, product copy, reading a PDF); the rest open the
// tool page. Files live 1 hour in a temp folder and are addressed by unguessable ids.
//   POST /api/asistente/archivos      multipart file=<archivo> → { id, name, size }
//   GET  /api/asistente/archivos/:id  download
//   POST /api/asistente/chat          { messages: [{ role, content, files: [id] }] } → { reply, tools, files }
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { PDFDocument, degrees } from 'pdf-lib';
import { ai, baseRequest, getClient, plainText, sendAiError, trackUsage, withinBudget } from './ai.js';
import { accessFor } from './accounts.js';
import { catalogText, fallbackReply } from './guide.js';
import { isCrisis } from './tools/diario.js';
import { compressImage, compressPdf, IMAGE_EXT, LEVELS } from './tools/compress.js';
import { convertFile, extFor, FREE_VIDEO_LIMIT_MESSAGE, kindOf, MIME, takeFreeVideo } from './converter.js';
import { CONVERT_FORMATS, FREE_MAX_MB, FREE_VIDEO_MAX_MB, PRO_FORMATS } from '../shared/constants.js';

const DIR = path.join(os.tmpdir(), 'monchys-chat');
await fs.rm(DIR, { recursive: true, force: true }).catch(() => {});
await fs.mkdir(DIR, { recursive: true });

const UPLOAD_MAX_MB = 50;
const FILE_TTL = 60 * 60_000;
const MAX_MESSAGES = 20; // history sent to the model
const MAX_USER_CHARS = 2000;
const MAX_FILES_PER_MESSAGE = 5;
const MAX_STEPS = 6; // tool rounds per message
const VISITOR_SUBJECT = 'site:asistente'; // shared monthly budget (AI_BUDGET_ASSISTANT_USD)
const LIMITS = { visitor: [20, 60], subscriber: [60, 300] }; // messages per hour, per day
const MB = 1024 * 1024;

const mb = (bytes) => `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;
const cleanName = (name) => String(name).replace(/[^\w\- .()áéíóúñüÁÉÍÓÚÑÜ]/g, '_').slice(0, 100) || 'archivo';
const extOf = (name) => path.extname(name).slice(1).toLowerCase();

// ---------- Files ----------
const files = new Map(); // id -> { path, name, size, owner, expires }

async function addFile(data, name, owner) {
  const file = path.join(DIR, crypto.randomUUID() + path.extname(name).toLowerCase().slice(0, 8));
  if (Buffer.isBuffer(data)) await fs.writeFile(file, data);
  else await fs.rename(data, file);
  const id = crypto.randomBytes(18).toString('base64url');
  const entry = { id, path: file, name, size: (await fs.stat(file)).size, owner, expires: Date.now() + FILE_TTL };
  files.set(id, entry);
  return entry;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, f] of files) {
    if (f.expires < now) {
      files.delete(id);
      fs.rm(f.path, { force: true }).catch(() => {});
    }
  }
}, 5 * 60_000).unref();

const publicFile = (f) => ({ id: f.id, name: f.name, size: f.size, url: `/api/asistente/archivos/${f.id}` });

class ToolError extends Error {}

function fileFor(id, ctx) {
  const f = files.get(String(id));
  if (!f || f.owner !== ctx.owner || f.expires < Date.now()) {
    throw new ToolError(`El archivo ${id} ya no está disponible (se borran 1 hora después de subirlos). Pide que lo suba de nuevo.`);
  }
  ctx.used.add(f.id);
  return f;
}

function kindLabel(name) {
  const ext = extOf(name);
  if (ext === 'pdf') return 'pdf';
  return kindOf(name, PRO_FORMATS) ?? 'otro';
}

const describe = (f, label) => `[${label}: id=${f.id} | ${f.name} | ${mb(f.size)} | tipo ${kindLabel(f.name)}]`;

// "1-3, 5" → [0, 1, 2, 4]; "todas" or empty → every page
function parsePages(spec, count) {
  const text = String(spec ?? '').trim().toLowerCase();
  if (!text || text === 'todas') return [...Array(count).keys()];
  const pages = [];
  for (const part of text.split(',')) {
    const m = part.trim().match(/^(\d+)\s*(?:-\s*(\d+|fin))?$/);
    if (!m) throw new ToolError(`No entiendo las páginas "${spec}". Usa algo como "1-3, 5".`);
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : m[2] === 'fin' ? count : Number(m[2]);
    if (from < 1 || to > count || from > to) throw new ToolError(`El PDF tiene ${count} páginas; "${part.trim()}" no es válido.`);
    for (let p = from; p <= to; p++) pages.push(p - 1);
  }
  return pages;
}

async function loadPdf(f) {
  try {
    return await PDFDocument.load(await fs.readFile(f.path), { updateMetadata: false });
  } catch {
    throw new ToolError(`No pude abrir ${f.name}: ¿está protegido con contraseña o dañado?`);
  }
}

// ---------- Tools Claude can call ----------
const TOOLS = [
  {
    name: 'comprimir',
    description:
      'Reduce el peso de una imagen (JPG, PNG, WEBP, HEIC…), un PDF o un video. Los videos salen en MP4 de hasta 1280 px, ideales para WhatsApp. Nunca devuelve un archivo más pesado.',
    input_schema: {
      type: 'object',
      properties: {
        archivo: { type: 'string', description: 'id del archivo' },
        nivel: { type: 'string', enum: ['ligera', 'equilibrada', 'fuerte'], description: 'Solo imágenes y PDF. Por defecto "equilibrada"; "fuerte" pesa menos con algo menos de calidad.' },
      },
      required: ['archivo'],
    },
  },
  {
    name: 'convertir',
    description:
      'Convierte un archivo a otro formato. Imágenes → jpg, png, webp, avif, gif, tiff o pdf. Audio → mp3, wav, ogg, m4a o flac. Video → mp3, m4a o wav (extrae el audio). Con el Convertidor Pro también video → mp4, webm o gif.',
    input_schema: {
      type: 'object',
      properties: {
        archivo: { type: 'string', description: 'id del archivo' },
        formato: { type: 'string', description: 'Formato de salida, en minúsculas (ej.: "jpg", "mp3", "pdf")' },
      },
      required: ['archivo', 'formato'],
    },
  },
  {
    name: 'unir_pdf',
    description: 'Une varios PDF en uno, en el orden indicado. Para unir fotos, conviértelas antes a PDF.',
    input_schema: {
      type: 'object',
      properties: { archivos: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 20, description: 'ids de los PDF en orden' } },
      required: ['archivos'],
    },
  },
  {
    name: 'girar_pdf',
    description: 'Gira páginas de un PDF en sentido horario.',
    input_schema: {
      type: 'object',
      properties: {
        archivo: { type: 'string', description: 'id del PDF' },
        grados: { type: 'integer', enum: [90, 180, 270] },
        paginas: { type: 'string', description: 'Ej.: "1-3, 5". Vacío o "todas" = todas las páginas.' },
      },
      required: ['archivo', 'grados'],
    },
  },
  {
    name: 'extraer_paginas_pdf',
    description: 'Crea un PDF nuevo solo con las páginas indicadas, en ese orden. Sirve para separar un PDF o quitar páginas.',
    input_schema: {
      type: 'object',
      properties: {
        archivo: { type: 'string', description: 'id del PDF' },
        paginas: { type: 'string', description: 'Ej.: "1-3, 5" o "4-fin"' },
      },
      required: ['archivo', 'paginas'],
    },
  },
  {
    name: 'mostrar_herramientas',
    description: 'Muestra al visitante tarjetas con enlace a herramientas del catálogo (máximo 3, la más útil primero).',
    input_schema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'IDs del catálogo, ej.: "PDF-01"' } },
      required: ['ids'],
    },
  },
];

function staticPrompt(products) {
  return `Eres Monchys, el asistente de Monchys IA (monshys.io), una tienda de herramientas online con IA en español. Eres un monstruo azul simpático que "se come" los archivos y los devuelve listos.

Qué haces en este chat:
1. Respondes dudas de la gente (archivos, formatos, celular, redes sociales, trámites digitales, cómo usar la web…) de forma breve, clara y útil.
2. Trabajas con sus archivos usando tus herramientas: comprimir, convertir, unir PDF, girar PDF y extraer páginas de un PDF. Son gratis para todos.
3. Recomiendas herramientas del catálogo cuando encajan, con mostrar_herramientas.

Catálogo (ID | nombre | precio | descripción):
${catalogText(products)}

Archivos:
- Los archivos que sube la persona aparecen en su mensaje como [Archivo: id=… | nombre | tamaño | tipo]. Los que tú generas aparecen como [Archivo generado: …] y también puedes usarlos (por ejemplo, unir y después comprimir).
- Usa los ids exactos. Si falta el archivo que necesitas, pide que lo adjunte con el clip 📎.
- Cuando una herramienta termine, la descarga aparece sola debajo de tu mensaje: no escribas enlaces ni ids; di qué hiciste y el resultado (por ejemplo, de 18 MB a 3 MB).
- Límites gratis: 50 MB por archivo, 25 MB para convertir imágenes y audio, 6 videos por hora. Para más, el Convertidor Pro.
- Si la persona pide algo con un archivo y es claro qué quiere, hazlo directamente sin preguntar. Si es ambiguo (ej.: "conviértelo" sin formato), pregunta una sola cosa.

Herramientas de pago:
- Si la persona pide algo que resuelve una herramienta de pago que NO tiene activada (escribir publicaciones, descripciones de producto, hacer un CV, traducir documentos, resumir o analizar PDF, transcribir audio, subtítulos, quitar fondo, mejorar fotos, finanzas, diario emocional, reservas), no hagas tú el trabajo completo: da una pista breve y útil, explica en una frase cómo lo resuelve la herramienta y muéstrala con mostrar_herramientas.
- Si SÍ la tiene activada, hazlo aquí mismo cuando sea trabajo de texto (publicaciones, descripciones, consejos para su CV, resumir o responder preguntas sobre un PDF adjunto) y, cuando necesite procesar audio, video o fotos, muéstrale la herramienta.
- Nunca inventes funciones, límites ni precios. Si recomiendas varias herramientas de un plan, menciona que el plan sale más barato.

Estilo:
- Español neutro, cálido, con algún guiño de monstruo glotón sin exagerar. Respuestas cortas: 1 a 4 frases, o una lista breve con guiones si son pasos.
- Sin markdown (ni negritas ni títulos). Nunca escribas los IDs del catálogo en el texto.
- No eres un asistente para trabajos largos: si piden ensayos, tareas completas o código, ayuda con una respuesta breve o un esquema y recuerda en qué eres experto.
- Si la persona cuenta que se siente mal, sé amable; puedes sugerir el Diario emocional aclarando que no sustituye a un profesional.`;
}

function accessPrompt(user, access, products) {
  const paid = products.filter((p) => p.price > 0 && access.has(p.id)).map((p) => p.name);
  if (!user) return 'La persona no ha iniciado sesión. No tiene herramientas de pago activadas.';
  return `La persona se llama ${String(user.name ?? '').slice(0, 40) || 'cliente'}. Herramientas de pago activadas: ${paid.length ? paid.join(', ') : 'ninguna'}.`;
}

// ---------- Router ----------
export function createAssistantRouter({ getProducts, userFromRequest }) {
  const router = express.Router();
  const hits = new Map(); // owner -> timestamps of messages (last 24 h)
  const uploads = new Map(); // owner -> timestamps of uploads (last hour)

  const ownerOf = (req) => {
    const user = userFromRequest(req);
    return { user, owner: user ? `user:${user.id}` : `ip:${req.ip}` };
  };

  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => fs.mkdir(DIR, { recursive: true }).then(() => cb(null, DIR), cb),
      filename: (req, file, cb) => cb(null, `up-${crypto.randomUUID()}`),
    }),
    limits: { fileSize: UPLOAD_MAX_MB * MB, files: 1, fields: 0 },
  });

  router.post('/archivos', (req, res, next) => {
    const { owner } = ownerOf(req);
    const now = Date.now();
    const recent = (uploads.get(owner) ?? []).filter((t) => now - t < 3600_000);
    if (recent.length >= 40) return res.status(429).json({ error: 'Subiste muchos archivos seguidos. Espera un rato.' });
    upload.single('file')(req, res, async (err) => {
      try {
        if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `El archivo supera ${UPLOAD_MAX_MB} MB.` });
        if (err) throw err;
        if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });
        recent.push(now);
        uploads.set(owner, recent);
        const name = cleanName(req.file.originalname);
        res.status(201).json(publicFile(await addFile(req.file.path, name, owner)));
      } catch (e) {
        if (req.file) fs.rm(req.file.path, { force: true }).catch(() => {});
        next(e);
      }
    });
  });

  router.get('/archivos/:id', (req, res) => {
    const f = files.get(req.params.id);
    if (!f || f.expires < Date.now()) return res.status(404).json({ error: 'Este archivo ya no está disponible (se borran después de 1 hora).' });
    const ext = extOf(f.name);
    res.type(MIME[ext] ?? (ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream'));
    res.download(f.path, f.name);
  });

  router.post('/chat', async (req, res, next) => {
    try {
      const { user, owner } = ownerOf(req);
      const products = getProducts().filter((p) => p.published);
      const access = accessFor(user, products);
      const subscriber = products.some((p) => p.price > 0 && access.has(p.id));
      const validIds = new Set(products.map((p) => p.id));

      // Rate limit per visitor / account
      const [perHour, perDay] = subscriber ? LIMITS.subscriber : LIMITS.visitor;
      const now = Date.now();
      const recent = (hits.get(owner) ?? []).filter((t) => now - t < 86_400_000);
      if (recent.length >= perDay || recent.filter((t) => now - t < 3600_000).length >= perHour) {
        return res.status(429).json({ error: '¡Uf, mucho chat por hoy! Descansa un poco mis mandíbulas y vuelve en un rato.' });
      }
      recent.push(now);
      hits.set(owner, recent);
      if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 86_400_000)) hits.delete(k);

      // History → Claude messages; files become text lines with their ids
      const raw = Array.isArray(req.body?.messages) ? req.body.messages.slice(-MAX_MESSAGES) : [];
      const messages = [];
      for (const m of raw) {
        if (m?.role !== 'user' && m?.role !== 'assistant') continue;
        const mine = m.role === 'user';
        const text = String(m.content ?? '').trim().slice(0, mine ? MAX_USER_CHARS : 4000);
        const notes = (Array.isArray(m.files) ? m.files : []).slice(0, MAX_FILES_PER_MESSAGE).map((id) => {
          const f = files.get(String(id));
          return f && f.owner === owner && f.expires > now ? describe(f, mine ? 'Archivo' : 'Archivo generado') : '[Archivo que ya caducó]';
        });
        const content = [text, ...notes].filter(Boolean).join('\n');
        if (!content) continue;
        if (messages.at(-1)?.role === m.role) messages.at(-1).content += `\n${content}`;
        else messages.push({ role: m.role, content });
      }
      while (messages[0]?.role === 'assistant') messages.shift();
      const last = messages.at(-1);
      if (!last || last.role !== 'user') return res.status(400).json({ error: 'Escribe qué quieres hacer.' });
      const lastText = String(raw.at(-1)?.content ?? '');

      if (isCrisis(lastText)) {
        return res.json({
          reply: 'Siento mucho que estés pasando por algo tan duro. No tienes que cargar con esto a solas: habla ahora con alguien que pueda ayudarte.',
          tools: [],
          files: [],
          crisis: true,
        });
      }

      const subject = subscriber ? `user:${user.id}:asistente` : VISITOR_SUBJECT;
      if (!ai.available || !withinBudget(subject)) return res.json({ ...fallbackReply(lastText, validIds), files: [] });

      // The newest message also shows its photos (and PDFs, with Resumidor PDF) to the model
      last.content = [{ type: 'text', text: last.content }, ...(await attachments(raw.at(-1), owner, access.has('PDF-01')))];

      const pro = access.has('CNV-02');
      const produced = [];
      const cards = new Set();
      const ctx = { owner, pro, produced, cards, validIds, used: new Set() };

      const system = [
        { type: 'text', text: staticPrompt(products), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: accessPrompt(user, access, products) },
      ];
      let convo = messages;
      let reply = '';
      for (let step = 0; step < MAX_STEPS; step++) {
        const response = await getClient().beta.messages.create({ ...baseRequest, max_tokens: 4000, system, tools: TOOLS, messages: convo });
        trackUsage('asistente', response.usage, subject);
        if (response.stop_reason === 'refusal') {
          reply = 'Mmm, con eso no puedo ayudarte. ¿Quieres que haga algo con tus archivos?';
          break;
        }
        reply = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
        const uses = response.content.filter((b) => b.type === 'tool_use');
        if (!uses.length) break;
        const results = [];
        for (const use of uses) results.push(await runTool(use, ctx));
        convo = [...convo, { role: 'assistant', content: response.content }, { role: 'user', content: results }];
      }

      reply = plainText(reply) || (produced.length ? '¡Listo! Aquí tienes:' : '¡Aquí tienes!');
      // Intermediate results (e.g. a photo turned into PDF and then joined) are not offered
      const final = produced.filter((f) => !ctx.used.has(f.id));
      res.json({ reply, tools: [...cards].slice(0, 3), files: final.map(publicFile) });
    } catch (err) {
      if (sendAiError(err, res)) return;
      next(err);
    }
  });

  return router;
}

// Photos (resized) and, for Resumidor PDF subscribers, PDFs of the newest message
async function attachments(message, owner, canReadPdf) {
  const blocks = [];
  for (const id of (Array.isArray(message?.files) ? message.files : []).slice(0, 3)) {
    const f = files.get(String(id));
    if (!f || f.owner !== owner) continue;
    const ext = extOf(f.name);
    try {
      if (IMAGE_EXT.includes(ext) && !['heic', 'heif'].includes(ext) && f.size <= 20 * MB) {
        const data = await sharp(f.path, { limitInputPixels: 100_000_000 }).rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
        blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: data.toString('base64') } });
      } else if (ext === 'pdf' && canReadPdf && f.size <= 20 * MB) {
        blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: (await fs.readFile(f.path)).toString('base64') } });
      }
    } catch {
      // unreadable: the model still sees the file line
    }
  }
  return blocks;
}

async function runTool(use, ctx) {
  try {
    const text = await TOOL_RUNNERS[use.name]?.(use.input ?? {}, ctx);
    if (text === undefined) throw new ToolError('Herramienta desconocida.');
    return { type: 'tool_result', tool_use_id: use.id, content: text };
  } catch (err) {
    if (!(err instanceof ToolError)) console.warn(`Asistente, ${use.name}:`, err.message);
    const message = err instanceof ToolError ? err.message : 'No pude procesar este archivo. ¿Está dañado o no es del tipo que indica su extensión?';
    return { type: 'tool_result', tool_use_id: use.id, content: message, is_error: true };
  }
}

async function output(ctx, data, name, before) {
  const f = await addFile(data, name, ctx.owner);
  ctx.produced.push(f);
  const saved = before ? ` (antes ${mb(before)}, ${Math.max(0, Math.round((1 - f.size / before) * 100))} % menos)` : '';
  return `Listo: ${describe(f, 'Archivo generado')}${saved}`;
}

// Runs a video job through the converter, honoring the free limits
async function videoJob(f, target, ctx) {
  if (!ctx.pro) {
    if (f.size > FREE_VIDEO_MAX_MB * MB) throw new ToolError(`El video pesa ${mb(f.size)}; gratis se procesan hasta ${FREE_VIDEO_MAX_MB} MB. Con el Convertidor Pro no hay ese límite.`);
    if (!takeFreeVideo(ctx.owner)) throw new ToolError(FREE_VIDEO_LIMIT_MESSAGE);
  }
  const out = path.join(DIR, `${crypto.randomUUID()}.${extFor(target)}`);
  try {
    await convertFile(f.path, out, target, { kind: 'video', free: !ctx.pro, timeout: 30 * 60_000 });
  } catch (err) {
    await fs.rm(out, { force: true });
    throw err;
  }
  return out;
}

const base = (name) => path.parse(name).name;

const TOOL_RUNNERS = {
  async comprimir({ archivo, nivel }, ctx) {
    const f = fileFor(archivo, ctx);
    const ext = extOf(f.name);
    const level = LEVELS[nivel] ?? LEVELS.equilibrada;
    if (ext === 'pdf' || IMAGE_EXT.includes(ext)) {
      const buffer = await fs.readFile(f.path);
      let out;
      try {
        out = ext === 'pdf' ? { data: await compressPdf(buffer, level), ext: 'pdf' } : await compressImage(buffer, ext, level);
      } catch {
        throw new ToolError(ext === 'pdf' ? 'No pude leer este PDF. ¿Está protegido con contraseña o dañado?' : 'No pude leer esta imagen. ¿Está dañada?');
      }
      const same = out.ext === (ext === 'jpeg' ? 'jpg' : ext);
      if (same && out.data.length >= f.size) return `${f.name} ya estaba optimizado: no se puede reducir más sin perder calidad. No se generó un archivo nuevo.`;
      return output(ctx, out.data, `${base(f.name)}-comprimido.${out.ext}`, f.size);
    }
    if (kindOf(f.name, PRO_FORMATS) === 'video') {
      const out = await videoJob(f, 'comprimir', ctx);
      return output(ctx, out, `${base(f.name)}-comprimido.mp4`, f.size);
    }
    throw new ToolError('Solo puedo comprimir imágenes, PDF y videos.');
  },

  async convertir({ archivo, formato }, ctx) {
    const f = fileFor(archivo, ctx);
    const target = String(formato ?? '').toLowerCase().replace(/^\./, '').replace('jpeg', 'jpg');
    if (target === 'comprimir') return TOOL_RUNNERS.comprimir({ archivo }, ctx);
    const formats = ctx.pro ? PRO_FORMATS : CONVERT_FORMATS;
    const kind = kindOf(f.name, formats);
    if (!kind) throw new ToolError(`No puedo convertir archivos .${extOf(f.name) || '?'}.`);
    if (!formats[kind].outputs.includes(target)) {
      const proHas = PRO_FORMATS[kind]?.outputs.includes(target);
      throw new ToolError(
        proHas
          ? `Pasar un ${kind === 'video' ? 'video' : 'archivo'} a ${target.toUpperCase()} es del Convertidor Pro.`
          : `Un archivo de ${kind === 'image' ? 'imagen' : kind} se puede pasar a: ${formats[kind].outputs.filter((o) => o !== 'comprimir').join(', ')}.`
      );
    }
    let out;
    if (kind === 'video') out = await videoJob(f, target, ctx);
    else {
      if (!ctx.pro && f.size > FREE_MAX_MB * MB) throw new ToolError(`Gratis se convierten archivos de hasta ${FREE_MAX_MB} MB; este pesa ${mb(f.size)}.`);
      out = path.join(DIR, `${crypto.randomUUID()}.${extFor(target)}`);
      try {
        await convertFile(f.path, out, target, { kind, free: !ctx.pro, timeout: (ctx.pro ? 30 : 2) * 60_000 });
      } catch (err) {
        await fs.rm(out, { force: true });
        throw err;
      }
    }
    return output(ctx, out, `${base(f.name)}.${extFor(target)}`);
  },

  async unir_pdf({ archivos }, ctx) {
    const list = (Array.isArray(archivos) ? archivos : []).slice(0, 20).map((id) => fileFor(id, ctx));
    if (list.length < 2) throw new ToolError('Necesito al menos 2 PDF para unir.');
    const notPdf = list.find((f) => extOf(f.name) !== 'pdf');
    if (notPdf) throw new ToolError(`${notPdf.name} no es un PDF. Si es una foto, conviértela primero a PDF.`);
    const merged = await PDFDocument.create();
    for (const f of list) {
      const pdf = await loadPdf(f);
      for (const page of await merged.copyPages(pdf, pdf.getPageIndices())) merged.addPage(page);
    }
    return output(ctx, Buffer.from(await merged.save({ useObjectStreams: true })), `${base(list[0].name)}-unido.pdf`);
  },

  async girar_pdf({ archivo, grados, paginas }, ctx) {
    const f = fileFor(archivo, ctx);
    if (extOf(f.name) !== 'pdf') throw new ToolError('Solo puedo girar páginas de un PDF.');
    const turn = [90, 180, 270].includes(Number(grados)) ? Number(grados) : 90;
    const pdf = await loadPdf(f);
    for (const i of new Set(parsePages(paginas, pdf.getPageCount()))) {
      const page = pdf.getPage(i);
      page.setRotation(degrees((page.getRotation().angle + turn) % 360));
    }
    return output(ctx, Buffer.from(await pdf.save({ useObjectStreams: true })), `${base(f.name)}-girado.pdf`);
  },

  async extraer_paginas_pdf({ archivo, paginas }, ctx) {
    const f = fileFor(archivo, ctx);
    if (extOf(f.name) !== 'pdf') throw new ToolError('Solo puedo sacar páginas de un PDF.');
    const pdf = await loadPdf(f);
    const indices = parsePages(paginas, pdf.getPageCount());
    if (!indices.length) throw new ToolError('Dime qué páginas quieres.');
    const out = await PDFDocument.create();
    for (const page of await out.copyPages(pdf, indices)) out.addPage(page);
    const label = String(paginas).replace(/\s+/g, '').replace(/[^\w,-]/g, '').slice(0, 30);
    return output(ctx, Buffer.from(await out.save({ useObjectStreams: true })), `${base(f.name)}-paginas-${label}.pdf`);
  },

  async mostrar_herramientas({ ids }, ctx) {
    const valid = (Array.isArray(ids) ? ids : []).map((id) => String(id).toUpperCase()).filter((id) => ctx.validIds.has(id));
    for (const id of valid) ctx.cards.add(id);
    return valid.length ? 'Tarjetas mostradas debajo de tu mensaje.' : 'Ningún ID válido.';
  },
};
