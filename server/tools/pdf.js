// Resumidor de PDFs: summary (Claude, or an offline extractive summary) and Q&A with the document (Claude).
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { extractText, getDocumentProxy } from 'unpdf';
import { createStore, uploadsDir } from '../store.js';
import { ai, aiAvailableFor, baseRequest, getClient, AiRefusal, plainText, requireAi, requireAiBudget, sendAiError, trackUsage } from '../ai.js';

const MAX_MB = 32;
const MAX_PAGES = 300;
// Cost grows with pages (~$0.013 per page), so AI is used only up to this size.
const AI_MAX_PAGES = Number(process.env.PDF_AI_MAX_PAGES) || 50;
const MAX_DOCS = 100;
const MAX_TURNS = 40; // stored chat messages per document
const DIR = uploadsDir('pdf');

const STOPWORDS = new Set(
  ('a al algo algunos ante antes como con contra cual cuando de del desde donde durante e el ella ellos en entre era es esa ese eso esta este esto estos fue ha hay la las le les lo los mas me mi muy no nos o otra otro para pero por porque que se ser si sin sobre su sus también tambien te tiene todo tras un una uno unos y ya the of and to in is it that for on as with was are be by this an or from at which not have has but were its their they can also more')
    .split(' ')
);

// Offline summary: the most representative sentences, in their original order.
function extractiveSummary(text, count = 6) {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 600);
  const words = (s) => s.toLowerCase().match(/[a-záéíóúñü]{3,}/g)?.filter((w) => !STOPWORDS.has(w)) ?? [];
  const freq = new Map();
  for (const s of sentences) for (const w of words(s)) freq.set(w, (freq.get(w) ?? 0) + 1);
  const scored = sentences.map((s, i) => {
    const ws = words(s);
    const score = ws.reduce((sum, w) => sum + freq.get(w), 0) / Math.max(ws.length, 1) + (i < 3 ? 1 : 0);
    return { s, i, score };
  });
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, count).sort((a, b) => a.i - b.i);
  const keyTerms = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);
  return { points: top.map((t) => t.s), keyTerms };
}

const SUMMARY_PROMPT =
  'Resume este documento en el mismo idioma en que está escrito. Formato: un párrafo breve con la idea general y después de 4 a 8 viñetas con los puntos clave (empieza cada viñeta con "- "). Incluye cifras y fechas importantes. No inventes nada que no esté en el documento.';

// Shared by the summary and the questions: identical system + document keeps the prompt cache warm.
const PDF_SYSTEM =
  'Trabajas con el documento PDF adjunto. Respondes en el idioma del usuario, básate solo en el documento y, si algo no está en él, dilo. Responde a las preguntas de forma breve. Escribe en texto plano, sin negritas ni encabezados markdown. Menciona la página cuando sea útil.';

const documentBlock = (base64) => ({
  type: 'document',
  source: { type: 'base64', media_type: 'application/pdf', data: base64 },
  cache_control: { type: 'ephemeral' }, // the same PDF is re-sent with every question
});

export async function createPdfRouter({ requireAccess }) {
  const store = await createStore('pdfs', {});
  await fs.mkdir(DIR, { recursive: true });
  const router = express.Router();
  router.use(requireAccess('PDF-01'));

  const docs = (req) => store.forUser(req.user.id, () => ({ docs: [] })).docs;
  const fileOf = (doc) => path.join(DIR, `${doc.id}.pdf`);
  const subjectOf = (req) => `user:${req.user.id}`;
  // Per-document flag for the UI: can this document use AI questions?
  const withAi = (d) => ({ ...d, aiAllowed: d.pages <= AI_MAX_PAGES });
  const listView = (d) => ({ id: d.id, name: d.name, pages: d.pages, createdAt: d.createdAt, summaryKind: d.summaryKind });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 } });

  router.get('/', (req, res) =>
    res.json({ ai: aiAvailableFor(subjectOf(req)), aiMaxPages: AI_MAX_PAGES, docs: docs(req).map(listView) })
  );

  router.post('/', (req, res, next) => {
    upload.single('file')(req, res, async (uploadErr) => {
      try {
        if (uploadErr?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `El PDF supera ${MAX_MB} MB.` });
        if (uploadErr) throw uploadErr;
        const buffer = req.file?.buffer;
        if (!buffer || buffer.subarray(0, 5).toString() !== '%PDF-') return res.status(400).json({ error: 'Sube un archivo PDF.' });
        if (docs(req).length >= MAX_DOCS) return res.status(400).json({ error: `Puedes guardar hasta ${MAX_DOCS} documentos. Borra alguno.` });

        let pages;
        let text;
        try {
          const pdf = await getDocumentProxy(new Uint8Array(buffer));
          ({ totalPages: pages, text } = await extractText(pdf, { mergePages: true }));
        } catch {
          return res.status(422).json({ error: 'No pudimos abrir este PDF. ¿Está protegido con contraseña o dañado?' });
        }
        if (pages > MAX_PAGES) return res.status(413).json({ error: `El PDF tiene ${pages} páginas; el máximo es ${MAX_PAGES}.` });
        const hasText = text.replace(/\s/g, '').length > 200;

        const doc = {
          id: crypto.randomUUID(),
          name: (req.file.originalname || 'documento.pdf').slice(0, 120),
          pages,
          createdAt: new Date().toISOString(),
          summary: '',
          summaryKind: null,
          keyTerms: [],
          chat: [],
        };

        if (aiAvailableFor(subjectOf(req)) && pages <= AI_MAX_PAGES) {
          try {
            const response = await getClient().beta.messages.create({
              ...baseRequest,
              system: PDF_SYSTEM,
              messages: [{ role: 'user', content: [documentBlock(buffer.toString('base64')), { type: 'text', text: SUMMARY_PROMPT }] }],
            });
            trackUsage('pdf-resumen', response.usage, subjectOf(req));
            if (response.stop_reason === 'refusal') throw new AiRefusal('La IA no puede resumir este documento.');
            doc.summary = plainText(response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n'));
            doc.summaryKind = 'ai';
          } catch (err) {
            if (!hasText) {
              if (!sendAiError(err, res)) throw err;
              return;
            }
            console.warn('Resumen con IA falló, uso el resumen automático:', err.message);
          }
        }
        if (!doc.summaryKind) {
          if (!hasText) {
            return res.status(422).json({
              error:
                pages > AI_MAX_PAGES
                  ? `Este PDF parece escaneado (sin texto seleccionable). Solo podemos leer escaneados de hasta ${AI_MAX_PAGES} páginas.`
                  : 'Este PDF parece escaneado (sin texto seleccionable). Para leerlo hace falta la IA, que no está disponible ahora mismo.',
            });
          }
          const { points, keyTerms } = extractiveSummary(text);
          doc.summary = points.map((p) => `- ${p}`).join('\n');
          doc.keyTerms = keyTerms;
          doc.summaryKind = 'extractive';
        }

        await fs.writeFile(fileOf(doc), buffer);
        docs(req).unshift(doc);
        await store.save();
        res.status(201).json(withAi(doc));
      } catch (err) {
        next(err);
      }
    });
  });

  router.get('/:id', (req, res) => {
    const doc = docs(req).find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });
    res.json(withAi(doc));
  });

  router.delete('/:id', async (req, res) => {
    const list = docs(req);
    const index = list.findIndex((d) => d.id === req.params.id);
    if (index >= 0) {
      await fs.rm(fileOf(list[index]), { force: true });
      list.splice(index, 1);
      await store.save();
    }
    res.status(204).end();
  });

  router.post('/:id/ask', requireAi, requireAiBudget(subjectOf), async (req, res, next) => {
    const doc = docs(req).find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });
    if (doc.pages > AI_MAX_PAGES) {
      return res.status(400).json({ error: `Las preguntas con IA están disponibles para documentos de hasta ${AI_MAX_PAGES} páginas.` });
    }
    const question = typeof req.body?.question === 'string' ? req.body.question.trim().slice(0, 1000) : '';
    if (!question) return res.status(400).json({ error: 'Escribe tu pregunta.' });
    if (doc.chat.length >= MAX_TURNS) return res.status(400).json({ error: 'Esta conversación es muy larga. Borra el chat para seguir.' });

    try {
      const base64 = (await fs.readFile(fileOf(doc))).toString('base64');
      // Same opening as the summary request (document + summary prompt), so the cached document is reused.
      const turns = [
        { role: 'user', content: SUMMARY_PROMPT },
        { role: 'assistant', content: doc.summary },
        ...doc.chat,
        { role: 'user', content: question },
      ];
      const messages = turns.map((t, i) =>
        i === 0 ? { role: 'user', content: [documentBlock(base64), { type: 'text', text: t.content }] } : { role: t.role, content: t.content }
      );
      const response = await getClient().beta.messages.create({
        ...baseRequest,
        system: PDF_SYSTEM,
        messages,
      });
      trackUsage('pdf-preguntas', response.usage, subjectOf(req));
      if (response.stop_reason === 'refusal') throw new AiRefusal('La IA no puede responder a esta pregunta.');
      const answer = plainText(response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n'));
      doc.chat.push({ role: 'user', content: question }, { role: 'assistant', content: answer || 'No encontré la respuesta en el documento.' });
      await store.save();
      res.json(withAi(doc));
    } catch (err) {
      if (!sendAiError(err, res)) next(err);
    }
  });

  router.delete('/:id/chat', async (req, res) => {
    const doc = docs(req).find((d) => d.id === req.params.id);
    if (doc) {
      doc.chat = [];
      await store.save();
    }
    res.json(doc ? withAi(doc) : {});
  });

  return router;
}
