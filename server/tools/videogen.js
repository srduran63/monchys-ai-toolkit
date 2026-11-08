// Generar videos (VID-01): Wan 2.2 text-to-video (fast, 720p) on Replicate (Apache-2.0, commercial use
// allowed). Subscribers only. A video takes about a minute, so it runs as a job the page polls.
import crypto from 'node:crypto';
import express from 'express';
import { usedThisMonth, addUsage } from '../usage.js';
import { GenError, englishPrompt, replicateAvailable, runModel } from '../replicate.js';

export const MONTHLY_VIDEOS = 30;
const MAX_PROMPT = 600;
const RATIOS = ['16:9', '9:16'];
const KEEP_MS = 30 * 60_000; // finished videos stay downloadable for 30 minutes

const generate = (prompt, aspectRatio) =>
  runModel(
    'wan-video/wan-2.2-t2v-fast',
    // 81 frames at 16 fps ≈ 5 seconds, smoothed to 30 fps
    { prompt, aspect_ratio: aspectRatio, resolution: '720p', num_frames: 81, frames_per_second: 16, interpolate_output: true, go_fast: true },
    { timeoutMs: 5 * 60_000 }
  );

export function createVideoRouter({ requireAccess }) {
  const router = express.Router();
  const jobs = new Map(); // id -> { userId, status, prompt, error, result, type }
  router.use(requireAccess('VID-01'));

  const activeJob = (userId) => [...jobs.values()].find((j) => j.userId === userId && j.status === 'processing');

  router.get('/', (req, res) => {
    res.json({ available: replicateAvailable, used: usedThisMonth(req.user.id, 'videos'), limit: MONTHLY_VIDEOS });
  });

  router.post('/jobs', express.json({ limit: '10kb' }), (req, res) => {
    if (!replicateAvailable) return res.status(503).json({ error: 'El generador de videos todavía no está activado.' });
    const text = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const ratio = RATIOS.includes(req.body?.ratio) ? req.body.ratio : '16:9';
    if (text.length < 3) return res.status(400).json({ error: 'Describe el video que quieres.' });
    if (text.length > MAX_PROMPT) return res.status(400).json({ error: `La descripción puede tener hasta ${MAX_PROMPT} caracteres.` });
    if (usedThisMonth(req.user.id, 'videos') >= MONTHLY_VIDEOS) {
      return res.status(429).json({ error: `Llegaste al límite de ${MONTHLY_VIDEOS} videos este mes. Se renueva el día 1.` });
    }
    if (activeJob(req.user.id)) return res.status(429).json({ error: 'Espera a que termine el video anterior.' });

    const id = crypto.randomUUID();
    const job = { userId: req.user.id, status: 'processing', prompt: text };
    jobs.set(id, job);
    res.status(202).json({ jobId: id });

    (async () => {
      try {
        const prompt = await englishPrompt(text, 'video', 'videos');
        const video = await generate(prompt, ratio);
        Object.assign(job, { status: 'done', result: video.buffer, type: video.type || 'video/mp4' });
        await addUsage(job.userId, 'videos', 1);
      } catch (err) {
        if (!(err instanceof GenError)) console.error('Generar video falló:', err);
        Object.assign(job, { status: 'error', error: err instanceof GenError ? err.message : 'No pudimos crear el video. Inténtalo de nuevo.' });
      }
      setTimeout(() => jobs.delete(id), KEEP_MS);
    })();
  });

  router.get('/jobs/:id', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job || job.userId !== req.user.id) return res.status(404).json({ error: 'Video no encontrado.' });
    res.json({ status: job.status, error: job.error });
  });

  router.get('/jobs/:id/file', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job || job.userId !== req.user.id || job.status !== 'done') return res.status(404).json({ error: 'El video ya no está disponible.' });
    res.setHeader('Content-Type', job.type);
    res.send(job.result);
  });

  return router;
}
