// Subtítulos para videos: local Whisper makes the cues, the customer edits them, and ffmpeg
// can burn them into the video. The uploaded video is kept for VIDEO_TTL_MS so it can be burned.
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
import { decodeAudio } from './transcribe.js';
import { splitSegments, toSrt } from '../../shared/subtitles.js';

const MONTHLY_MINUTES = 300;
const MAX_MINUTES = 30;
const MAX_MB = 500;
const MAX_HISTORY = 30;
const VIDEO_TTL_MS = 60 * 60_000;
const LANGUAGES = { es: 'spanish', en: 'english', auto: null };
const TMP_DIR = path.join(os.tmpdir(), 'monchys-subtitles');
await fs.mkdir(TMP_DIR, { recursive: true });

// Burned-in look: size (font size at 288 px script height) and vertical position
const SIZES = { s: 14, m: 18, l: 24 };
const POSITIONS = { bottom: 2, top: 8 };

function burn(video, srtName, output, { size, position }) {
  const style = [
    'FontName=DejaVu Sans',
    `FontSize=${SIZES[size] ?? SIZES.m}`,
    'PrimaryColour=&H00FFFFFF',
    'OutlineColour=&H00000000',
    'BackColour=&H80000000',
    'BorderStyle=1',
    'Outline=2',
    'Shadow=0',
    'MarginV=24',
    `Alignment=${POSITIONS[position] ?? POSITIONS.bottom}`,
  ].join(',');
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-protocol_whitelist', 'file',
    '-i', path.basename(video),
    '-map_metadata', '-1',
    // Relative names: ffmpeg filter syntax breaks on Windows drive letters
    '-vf', `subtitles=${srtName}:force_style='${style}'`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
    path.basename(output),
  ];
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { cwd: TMP_DIR, timeout: 45 * 60_000, windowsHide: true }, (err, _o, stderr) =>
      err ? reject(new Error(stderr?.trim() || err.message)) : resolve()
    );
  });
}

// Customer-edited cues: numbers in range, short texts, sorted
function cleanSegments(list, duration) {
  if (!Array.isArray(list)) return null;
  return list
    .slice(0, 3000)
    .map((s) => ({
      start: Math.max(0, Math.min(Number(s?.start) || 0, duration)),
      end: Math.max(0, Math.min(Number(s?.end) || 0, duration)),
      text: String(s?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
    }))
    .filter((s) => s.text && s.end > s.start)
    .sort((a, b) => a.start - b.start);
}

export async function createSubtitlesRouter({ requireAccess }) {
  const store = await createStore('subtitulos', {});
  const jobs = new Map(); // id -> { userId, kind, status, error, resultId, output, createdAt }
  const videos = new Map(); // itemId -> { path, timer }
  const router = express.Router();
  router.use(requireAccess('SUB-01'));

  const history = (userId) => store.forUser(userId, () => ({ items: [] })).items;
  const usage = (userId) => ({ used: Math.round(usedThisMonth(userId, 'subtitleMinutes') * 10) / 10, limit: MONTHLY_MINUTES });
  const view = (item) => ({ ...item, videoAvailable: videos.has(item.id) });

  const dropVideo = (itemId) => {
    const v = videos.get(itemId);
    if (!v) return;
    clearTimeout(v.timer);
    videos.delete(itemId);
    fs.rm(v.path, { force: true }).catch(() => {});
  };
  const keepVideo = (itemId, file) => videos.set(itemId, { path: file, timer: setTimeout(() => dropVideo(itemId), VIDEO_TTL_MS) });
  const finishJob = (id) => setTimeout(() => {
    const job = jobs.get(id);
    if (job?.output) fs.rm(job.output, { force: true }).catch(() => {});
    jobs.delete(id);
  }, VIDEO_TTL_MS);

  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => fs.mkdir(TMP_DIR, { recursive: true }).then(() => cb(null, TMP_DIR), cb),
      filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8)),
    }),
    limits: { fileSize: MAX_MB * 1024 * 1024, files: 1, fields: 2 },
  });

  router.get('/', (req, res) => {
    res.json({ usage: usage(req.user.id), items: history(req.user.id).map(({ segments, ...item }) => ({ ...item, cues: segments.length, videoAvailable: videos.has(item.id) })) });
  });

  router.post('/jobs', (req, res, next) => {
    upload.single('file')(req, res, async (uploadErr) => {
      const file = req.file?.path;
      let kept = false;
      try {
        if (uploadErr?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `El video supera ${MAX_MB} MB.` });
        if (uploadErr) throw uploadErr;
        if (!file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });

        let samples;
        try {
          samples = await decodeAudio(file, MAX_MINUTES);
        } catch (err) {
          return res.status(err.message === 'too-long' ? 413 : 422).json({
            error: err.message === 'too-long' ? `El video dura más de ${MAX_MINUTES} minutos.` : 'No pudimos leer el audio de este video.',
          });
        }
        const minutes = samples.length / 16000 / 60;
        if (minutes < 1 / 60) return res.status(422).json({ error: 'El video no tiene audio o es demasiado corto.' });
        const { used } = usage(req.user.id);
        if (used + minutes > MONTHLY_MINUTES) {
          return res.status(429).json({ error: `Este video superaría tu límite de ${MONTHLY_MINUTES} minutos al mes (llevas ${Math.round(used)}).` });
        }

        const language = LANGUAGES[req.body?.language] !== undefined ? req.body.language : 'es';
        const isVideo = req.file.mimetype.startsWith('video/') || /\.(mp4|mov|m4v|mkv|webm|avi)$/i.test(req.file.originalname);
        const id = crypto.randomUUID();
        const job = { userId: req.user.id, kind: 'transcribe', status: 'queued', createdAt: Date.now() };
        jobs.set(id, job);
        kept = isVideo;
        res.status(202).json({ jobId: id });

        (async () => {
          job.status = 'processing';
          try {
            const { segments } = await transcribe(samples, LANGUAGES[language]);
            const item = {
              id: crypto.randomUUID(),
              name: (req.file.originalname || 'video').slice(0, 120),
              language,
              duration: Math.round(minutes * 60),
              segments: splitSegments(segments),
              isVideo,
              createdAt: new Date().toISOString(),
            };
            const items = history(job.userId);
            items.unshift(item);
            for (const old of items.splice(MAX_HISTORY)) dropVideo(old.id);
            await store.save();
            await addUsage(job.userId, 'subtitleMinutes', minutes);
            if (isVideo) keepVideo(item.id, file);
            job.status = 'done';
            job.resultId = item.id;
          } catch (err) {
            console.error('Subtítulos fallidos:', err);
            job.status = 'error';
            job.error = err instanceof ModelCrash ? err.message : 'No pudimos crear los subtítulos de este video.';
            fs.rm(file, { force: true }).catch(() => {});
          }
          finishJob(id);
        })();
      } catch (err) {
        next(err);
      } finally {
        if (file && !kept) fs.rm(file, { force: true }).catch(() => {});
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
    });
  });

  // Finished burned video (available for an hour)
  router.get('/jobs/:id/video', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job || job.userId !== req.user.id || job.kind !== 'burn' || job.status !== 'done') return res.status(404).json({ error: 'El video ya no está disponible.' });
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(job.filename)}`);
    res.sendFile(job.output);
  });

  router.get('/items/:id', (req, res) => {
    const item = history(req.user.id).find((i) => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Subtítulos no encontrados.' });
    res.json(view(item));
  });

  router.put('/items/:id', async (req, res) => {
    const item = history(req.user.id).find((i) => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Subtítulos no encontrados.' });
    const segments = cleanSegments(req.body?.segments, item.duration + 1);
    if (!segments?.length) return res.status(400).json({ error: 'Los subtítulos están vacíos.' });
    item.segments = segments;
    await store.save();
    res.json(view(item));
  });

  router.delete('/items/:id', async (req, res) => {
    const items = history(req.user.id);
    const index = items.findIndex((i) => i.id === req.params.id);
    if (index >= 0) {
      dropVideo(items[index].id);
      items.splice(index, 1);
    }
    await store.save();
    res.status(204).end();
  });

  router.post('/items/:id/burn', async (req, res) => {
    const item = history(req.user.id).find((i) => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Subtítulos no encontrados.' });
    const video = videos.get(item.id);
    if (!video) return res.status(410).json({ error: 'El video original ya se borró (se guarda 1 hora). Súbelo de nuevo para crear el video con subtítulos.' });
    if ([...jobs.values()].some((j) => j.userId === req.user.id && j.kind === 'burn' && (j.status === 'queued' || j.status === 'processing'))) {
      return res.status(429).json({ error: 'Ya estamos creando un video tuyo. Espera a que termine.' });
    }

    const id = crypto.randomUUID();
    const srtName = `${id}.srt`;
    const output = path.join(TMP_DIR, `${id}.mp4`);
    const job = { userId: req.user.id, kind: 'burn', status: 'processing', createdAt: Date.now(), output, filename: `${item.name.replace(/\.[^.]+$/, '')}-subtitulado.mp4` };
    jobs.set(id, job);
    res.status(202).json({ jobId: id });

    try {
      await fs.writeFile(path.join(TMP_DIR, srtName), toSrt(item.segments));
      await burn(video.path, srtName, output, { size: req.body?.size, position: req.body?.position });
      job.status = 'done';
    } catch (err) {
      console.error('Incrustar subtítulos falló:', err.message);
      job.status = 'error';
      job.error = 'No pudimos crear el video con subtítulos.';
    } finally {
      fs.rm(path.join(TMP_DIR, srtName), { force: true }).catch(() => {});
      finishJob(id);
    }
  });

  return router;
}
