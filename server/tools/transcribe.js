// Transcripción de audio: local Whisper model, background jobs, history and an optional AI summary.
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import ffmpegPath from 'ffmpeg-static';
import { createStore } from '../store.js';
import { transcribe, queueLength, ModelCrash } from '../models.js';
import { usedThisMonth, addUsage } from '../usage.js';
import { aiAvailableFor, complete, requireAi, requireAiBudget, sendAiError } from '../ai.js';

const MONTHLY_MINUTES = 600;
const MAX_FILE_MINUTES = 60;
const MAX_MB = 200;
const MAX_HISTORY = 50;
const LANGUAGES = { es: 'spanish', en: 'english', auto: null };
const TMP_DIR = path.join(os.tmpdir(), 'monchys-transcribe');
await fs.mkdir(TMP_DIR, { recursive: true });

// Decode any audio/video file to mono 16 kHz float samples (what Whisper expects).
export function decodeAudio(file, maxMinutes = MAX_FILE_MINUTES) {
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath,
      ['-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file', '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'],
      { encoding: 'buffer', maxBuffer: (maxMinutes + 1) * 60 * 16000 * 4, timeout: 5 * 60_000, windowsHide: true },
      (err, stdout) => {
        if (err) return reject(new Error(err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? 'too-long' : 'decode'));
        resolve(new Float32Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.byteLength / 4)));
      }
    );
  });
}

export async function createTranscribeRouter({ requireAccess }) {
  const store = await createStore('transcripciones', {});
  const jobs = new Map(); // id -> { userId, status, error, resultId, name, minutes, createdAt }
  const router = express.Router();
  router.use(requireAccess('TRA-01'));

  const history = (req) => store.forUser(req.user.id, () => ({ items: [] })).items;
  const usage = (userId) => ({ used: Math.round(usedThisMonth(userId, 'transcriptionMinutes') * 10) / 10, limit: MONTHLY_MINUTES });

  const upload = multer({
    storage: multer.diskStorage({
      // Recreated if missing (Windows cleanup tools empty the temp folder)
      destination: (req, file, cb) => fs.mkdir(TMP_DIR, { recursive: true }).then(() => cb(null, TMP_DIR), cb),
      filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase().slice(0, 8)),
    }),
    limits: { fileSize: MAX_MB * 1024 * 1024, files: 1, fields: 2 },
  });

  router.get('/', (req, res) => {
    res.json({
      usage: usage(req.user.id),
      ai: aiAvailableFor(`user:${req.user.id}`),
      items: history(req).map(({ segments, text, ...item }) => ({ ...item, preview: text.slice(0, 160) })),
    });
  });

  router.post('/jobs', (req, res, next) => {
    upload.single('file')(req, res, async (uploadErr) => {
      const file = req.file?.path;
      try {
        if (uploadErr?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `El archivo supera ${MAX_MB} MB.` });
        if (uploadErr) throw uploadErr;
        if (!file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });

        let samples;
        try {
          samples = await decodeAudio(file);
        } catch (err) {
          return res.status(err.message === 'too-long' ? 413 : 422).json({
            error: err.message === 'too-long' ? `El audio dura más de ${MAX_FILE_MINUTES} minutos.` : 'No pudimos leer el audio de este archivo.',
          });
        }
        const minutes = samples.length / 16000 / 60;
        if (minutes < 1 / 60) return res.status(422).json({ error: 'El audio está vacío o es demasiado corto.' });
        const { used } = usage(req.user.id);
        if (used + minutes > MONTHLY_MINUTES) {
          return res.status(429).json({ error: `Este audio superaría tu límite de ${MONTHLY_MINUTES} minutos al mes (llevas ${Math.round(used)}).` });
        }

        const language = LANGUAGES[req.body?.language] !== undefined ? req.body.language : 'es';
        const name = (req.file.originalname || 'audio').slice(0, 120);
        const id = crypto.randomUUID();
        const job = { userId: req.user.id, status: 'queued', name, minutes, createdAt: Date.now() };
        jobs.set(id, job);
        res.status(202).json({ jobId: id, position: queueLength() });

        // Run in the background
        (async () => {
          job.status = 'processing';
          try {
            const { text, segments } = await transcribe(samples, LANGUAGES[language]);
            const item = {
              id: crypto.randomUUID(),
              name,
              language,
              duration: Math.round(minutes * 60),
              text,
              segments,
              summary: null,
              createdAt: new Date().toISOString(),
            };
            const items = store.forUser(job.userId, () => ({ items: [] })).items;
            items.unshift(item);
            items.splice(MAX_HISTORY);
            await store.save();
            await addUsage(job.userId, 'transcriptionMinutes', minutes);
            job.status = 'done';
            job.resultId = item.id;
          } catch (err) {
            console.error('Transcripción fallida:', err);
            job.status = 'error';
            job.error = err instanceof ModelCrash ? err.message : 'No pudimos transcribir este audio.';
          }
          setTimeout(() => jobs.delete(id), 60 * 60_000);
        })();
      } catch (err) {
        next(err);
      } finally {
        if (file) fs.rm(file, { force: true }).catch(() => {});
      }
    });
  });

  router.get('/jobs/:id', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job || job.userId !== req.user.id) return res.status(404).json({ error: 'Trabajo no encontrado.' });
    res.json({
      status: job.status,
      error: job.error,
      resultId: job.resultId,
      position: job.status === 'queued' ? queueLength() : 0,
      elapsed: Math.round((Date.now() - job.createdAt) / 1000),
      minutes: job.minutes,
    });
  });

  router.get('/items/:id', (req, res) => {
    const item = history(req).find((i) => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Transcripción no encontrada.' });
    res.json(item);
  });

  router.delete('/items/:id', async (req, res) => {
    const items = history(req);
    const index = items.findIndex((i) => i.id === req.params.id);
    if (index >= 0) items.splice(index, 1);
    await store.save();
    res.status(204).end();
  });

  router.post('/items/:id/summary', requireAi, requireAiBudget((req) => `user:${req.user.id}`), async (req, res, next) => {
    const item = history(req).find((i) => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Transcripción no encontrada.' });
    try {
      item.summary = await complete({
        feature: 'transcripcion-resumen',
        subject: `user:${req.user.id}`,
        system:
          'Resumes transcripciones de audio. Escribe en el mismo idioma de la transcripción. Formato: una frase de resumen general y después de 3 a 8 viñetas con los puntos clave (empieza cada viñeta con "- "). Si hay tareas o acuerdos, añádelos al final bajo "Pendientes:". No inventes nada que no esté en el texto.',
        messages: [{ role: 'user', content: `<transcripcion>\n${item.text.slice(0, 400_000)}\n</transcripcion>` }],
      });
      await store.save();
      res.json(item);
    } catch (err) {
      if (!sendAiError(err, res)) next(err);
    }
  });

  return router;
}
