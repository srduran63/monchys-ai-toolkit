// Mejorar fotos (UPS-01): small photos are doubled in resolution with a local AI model;
// every photo can also get automatic contrast, color and sharpness. Runs as background jobs.
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { upscale2x, queueLength, ModelCrash } from '../models.js';
import { usedThisMonth, addUsage } from '../usage.js';

const MONTHLY_PHOTOS = 200;
const MAX_MB = 15;
// The AI enlargement is for small photos: above this size it would take minutes on the server
export const UPSCALE_MAX_PIXELS = 500_000;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/tiff', 'image/heic', 'image/heif'];

const enhance = (img) => img.normalise({ lower: 1, upper: 99 }).modulate({ saturation: 1.08 }).sharpen({ sigma: 1, m1: 0.6, m2: 2 });

export function createUpscaleRouter({ requireAccess }) {
  const router = express.Router();
  const jobs = new Map(); // id -> { userId, status, progress, error, result, type, width, height, upscaled }
  router.use(requireAccess('UPS-01'));
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MB * 1024 * 1024, files: 1, fields: 3 },
    fileFilter: (req, file, cb) => cb(null, TYPES.includes(file.mimetype)),
  });

  router.get('/', (req, res) => res.json({ used: usedThisMonth(req.user.id, 'upscalePhotos'), limit: MONTHLY_PHOTOS, maxPixels: UPSCALE_MAX_PIXELS }));

  router.post('/jobs', (req, res, next) => {
    upload.single('file')(req, res, async (uploadErr) => {
      try {
        if (uploadErr?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `La foto supera ${MAX_MB} MB.` });
        if (uploadErr) throw uploadErr;
        if (!req.file) return res.status(400).json({ error: 'Sube una foto JPG, PNG, WEBP o AVIF.' });
        if (usedThisMonth(req.user.id, 'upscalePhotos') >= MONTHLY_PHOTOS) {
          return res.status(429).json({ error: `Llegaste al límite de ${MONTHLY_PHOTOS} fotos este mes.` });
        }
        let meta;
        try {
          meta = await sharp(req.file.buffer).metadata();
        } catch {
          return res.status(422).json({ error: 'No pudimos leer esta foto. ¿Está dañada?' });
        }
        const wantUpscale = req.body?.upscale !== 'false';
        const wantEnhance = req.body?.enhance !== 'false';
        const upscaled = wantUpscale && meta.width * meta.height <= UPSCALE_MAX_PIXELS;
        if (!upscaled && !wantEnhance) {
          return res.status(400).json({ error: 'Esta foto ya es grande para ampliarla: activa "Mejorar color y nitidez".' });
        }
        const png = req.file.mimetype === 'image/png';

        const id = crypto.randomUUID();
        const job = { userId: req.user.id, status: 'queued', progress: 0, upscaled };
        jobs.set(id, job);
        res.status(202).json({ jobId: id, upscaled, position: queueLength() });

        try {
          let buffer = req.file.buffer;
          if (upscaled) {
            buffer = await upscale2x(buffer, {
              onProgress: (p) => {
                job.status = 'processing';
                job.progress = p;
              },
            });
          }
          job.status = 'processing';
          let img = sharp(buffer).rotate();
          if (wantEnhance) img = enhance(img);
          const { data, info } = await (png ? img.png({ compressionLevel: 8 }) : img.flatten({ background: '#ffffff' }).jpeg({ quality: 92, mozjpeg: true })).toBuffer({ resolveWithObject: true });
          Object.assign(job, { status: 'done', progress: 1, result: data, type: png ? 'image/png' : 'image/jpeg', width: info.width, height: info.height });
          await addUsage(job.userId, 'upscalePhotos', 1);
        } catch (err) {
          console.error('Mejorar foto falló:', err.message);
          job.status = 'error';
          job.error = err instanceof ModelCrash ? err.message : 'No pudimos mejorar esta foto.';
        }
        setTimeout(() => jobs.delete(id), 30 * 60_000);
      } catch (err) {
        next(err);
      }
    });
  });

  router.get('/jobs/:id', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job || job.userId !== req.user.id) return res.status(404).json({ error: 'Trabajo no encontrado.' });
    res.json({ status: job.status, progress: job.progress, error: job.error, width: job.width, height: job.height, upscaled: job.upscaled, position: job.status === 'queued' ? queueLength() : 0 });
  });

  router.get('/jobs/:id/file', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job || job.userId !== req.user.id || job.status !== 'done') return res.status(404).json({ error: 'La foto ya no está disponible.' });
    res.setHeader('Content-Type', job.type);
    res.send(job.result);
  });

  return router;
}
