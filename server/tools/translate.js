// Traductor de documentos (TRD-01): Word keeps its layout (each paragraph is translated in place),
// PDF text comes back as a Word document and TXT/MD as text. Claude translates in batches.
import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { extractText, getDocumentProxy } from 'unpdf';
import { Document, Packer, Paragraph, PageBreak } from 'docx';
import { aiAvailableFor, complete, requireAi, requireAiBudget, sendAiError } from '../ai.js';

const MAX_MB = 20;
const MAX_CHARS = 40_000;
const BATCH_CHARS = 5_000;
const PARALLEL = 3;
export const TRANSLATE_LANGUAGES = {
  es: 'español', en: 'inglés', pt: 'portugués', fr: 'francés', it: 'italiano', de: 'alemán',
  zh: 'chino simplificado', ja: 'japonés', ko: 'coreano', ar: 'árabe', ru: 'ruso', nl: 'neerlandés',
};
// Translations have their own monthly AI budget, apart from the customer's other AI tools
const subjectOf = (req) => `user:${req.user.id}:traductor`;

const decodeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const encodeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Translate a list of texts, keeping their order. Empty or symbol-only texts are not sent.
async function translateAll(texts, { target, subject, onProgress }) {
  const out = [...texts];
  const todo = texts.map((t, i) => [i, t]).filter(([, t]) => /\p{L}/u.test(t));
  const batches = [];
  let current = [];
  let size = 0;
  for (const entry of todo) {
    if (current.length && size + entry[1].length > BATCH_CHARS) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(entry);
    size += entry[1].length;
  }
  if (current.length) batches.push(current);

  let done = 0;
  const runBatch = async (batch) => {
    const reply = await complete({
      feature: 'traductor',
      subject,
      raw: true,
      system: `Eres traductor profesional. Traduce al ${TRANSLATE_LANGUAGES[target]} cada fragmento que te envíen, con naturalidad y respetando el registro, los nombres propios, números, URL y formato (mayúsculas, viñetas, signos). Cada fragmento empieza con una marca ⟦n⟧: conserva exactamente las mismas marcas, en el mismo orden, y escribe después de cada una solo su traducción. No añadas comentarios. Si un fragmento ya está en ${TRANSLATE_LANGUAGES[target]}, déjalo igual.`,
      messages: [{ role: 'user', content: batch.map(([i, t]) => `⟦${i}⟧ ${t}`).join('\n') }],
    });
    for (const m of reply.matchAll(/⟦(\d+)⟧[ \t]*([\s\S]*?)(?=\n?⟦\d+⟧|$)/g)) {
      const i = Number(m[1]);
      if (batch.some(([j]) => j === i) && m[2].trim()) out[i] = m[2].trim();
    }
    done++;
    onProgress?.(done / batches.length);
  };
  for (let i = 0; i < batches.length; i += PARALLEL) await Promise.all(batches.slice(i, i + PARALLEL).map(runBatch));
  return out;
}

// ---------- Word (.docx): translate paragraph by paragraph inside the XML ----------
const DOCX_PARTS = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;
const PARAGRAPH = /<w:p(?:\s[^>]*)?>(?:(?!<w:p[\s>])[\s\S])*?<\/w:p>/g; // innermost paragraphs
const TEXT_RUN = /(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g;

function docxParagraphs(files) {
  const found = []; // { part, xml, text }
  for (const name of Object.keys(files).filter((n) => DOCX_PARTS.test(n))) {
    for (const m of strFromU8(files[name]).matchAll(PARAGRAPH)) {
      const text = [...m[0].matchAll(TEXT_RUN)].map((r) => decodeXml(r[2])).join('');
      if (text.trim()) found.push({ part: name, xml: m[0], text });
    }
  }
  return found;
}

function rebuildDocx(files, paragraphs, translated) {
  const byPart = new Map();
  paragraphs.forEach((p, i) => (byPart.get(p.part) ?? byPart.set(p.part, []).get(p.part)).push([p.xml, translated[i]]));
  const out = { ...files };
  for (const [part, list] of byPart) {
    let xml = strFromU8(files[part]);
    let from = 0;
    for (const [original, text] of list) {
      const at = xml.indexOf(original, from);
      if (at < 0) continue;
      // The whole translation goes in the longest text run (so the paragraph keeps its main style); the rest are emptied
      const runs = [...original.matchAll(TEXT_RUN)].map((r) => decodeXml(r[2]).length);
      const main = runs.indexOf(Math.max(...runs));
      let n = 0;
      const replaced = original.replace(TEXT_RUN, (_m, open) => {
        const value = n++ === main ? encodeXml(text) : '';
        return `${open.includes('xml:space') ? open : open.replace('<w:t', '<w:t xml:space="preserve"')}${value}</w:t>`;
      });
      xml = xml.slice(0, at) + replaced + xml.slice(at + original.length);
      from = at + replaced.length;
    }
    out[part] = strToU8(xml);
  }
  return Buffer.from(zipSync(out));
}

// ---------- PDF: text by page, rebuilt as a simple Word document ----------
async function pdfPages(buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  // Join wrapped lines into paragraphs; blank lines separate them
  return text.map((page) =>
    page
      .split(/\n\s*\n/)
      .map((p) => p.replace(/-\n(?=\p{Ll})/gu, '').replace(/\s*\n\s*/g, ' ').trim())
      .filter(Boolean)
  );
}

async function pagesToDocx(pages) {
  const children = [];
  pages.forEach((paragraphs, i) => {
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    for (const text of paragraphs) children.push(new Paragraph({ text, spacing: { after: 160 } }));
  });
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

export function createTranslateRouter({ requireAccess }) {
  const router = express.Router();
  const jobs = new Map(); // id -> { userId, status, progress, error, result, filename, type }
  router.use(requireAccess('TRD-01'));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_MB * 1024 * 1024, files: 1, fields: 2 } });

  router.get('/', (req, res) => res.json({ ai: aiAvailableFor(subjectOf(req)), languages: TRANSLATE_LANGUAGES, maxChars: MAX_CHARS }));

  router.post('/jobs', requireAi, requireAiBudget(subjectOf), (req, res, next) => {
    upload.single('file')(req, res, async (uploadErr) => {
      try {
        if (uploadErr?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `El archivo supera ${MAX_MB} MB.` });
        if (uploadErr) throw uploadErr;
        if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });
        const target = Object.hasOwn(TRANSLATE_LANGUAGES, req.body?.target) ? req.body.target : 'en';
        const parsed = path.parse(req.file.originalname);
        const ext = parsed.ext.slice(1).toLowerCase();
        const base = parsed.name.replace(/[^\w\- .()áéíóúñÁÉÍÓÚÑ]/g, '_').slice(0, 80) || 'documento';

        // Read the document and its texts before accepting the job
        let texts, build, type, outExt;
        try {
          if (ext === 'docx') {
            const files = unzipSync(new Uint8Array(req.file.buffer));
            if (!files['word/document.xml']) throw new Error('not docx');
            const paragraphs = docxParagraphs(files);
            texts = paragraphs.map((p) => p.text);
            build = (t) => rebuildDocx(files, paragraphs, t);
            [type, outExt] = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'];
          } else if (ext === 'pdf') {
            const pages = await pdfPages(req.file.buffer);
            texts = pages.flat();
            build = (t) => {
              let k = 0;
              return pagesToDocx(pages.map((p) => p.map(() => t[k++])));
            };
            [type, outExt] = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'];
          } else if (ext === 'txt' || ext === 'md') {
            const lines = req.file.buffer.toString('utf8').split(/\r?\n/);
            texts = lines;
            build = (t) => Buffer.from(t.join('\n'), 'utf8');
            [type, outExt] = ['text/plain; charset=utf-8', ext];
          } else {
            return res.status(400).json({ error: 'Sube un documento Word (.docx), PDF o de texto (.txt).' });
          }
        } catch {
          return res.status(422).json({ error: 'No pudimos leer este documento. ¿Está protegido o dañado?' });
        }
        const chars = texts.reduce((n, t) => n + t.length, 0);
        if (!texts.some((t) => /\p{L}/u.test(t))) {
          return res.status(422).json({ error: ext === 'pdf' ? 'Este PDF no tiene texto seleccionable (parece escaneado).' : 'El documento no tiene texto para traducir.' });
        }
        if (chars > MAX_CHARS) {
          return res.status(413).json({ error: `El documento tiene ${chars.toLocaleString('es')} caracteres; el máximo por documento es ${MAX_CHARS.toLocaleString('es')} (unas 15 páginas).` });
        }

        const id = crypto.randomUUID();
        const job = { userId: req.user.id, status: 'processing', progress: 0, filename: `${base}-${target}.${outExt}`, type };
        jobs.set(id, job);
        res.status(202).json({ jobId: id, chars });

        try {
          const translated = await translateAll(texts, { target, subject: subjectOf(req), onProgress: (p) => (job.progress = p) });
          job.result = await build(translated);
          job.status = 'done';
        } catch (err) {
          job.status = 'error';
          const sink = { status: () => sink, json: (body) => (job.error = body.error) };
          if (!sendAiError(err, sink)) {
            console.error('Traducción fallida:', err);
            job.error = 'No pudimos traducir este documento.';
          }
        }
        setTimeout(() => jobs.delete(id), 60 * 60_000);
      } catch (err) {
        next(err);
      }
    });
  });

  router.get('/jobs/:id', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job || job.userId !== req.user.id) return res.status(404).json({ error: 'Trabajo no encontrado.' });
    res.json({ status: job.status, progress: job.progress, error: job.error });
  });

  router.get('/jobs/:id/file', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job || job.userId !== req.user.id || job.status !== 'done') return res.status(404).json({ error: 'El documento ya no está disponible.' });
    res.setHeader('Content-Type', job.type);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(job.filename)}`);
    res.send(job.result);
  });

  return router;
}
