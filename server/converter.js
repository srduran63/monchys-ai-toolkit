// File converter: images (sharp), audio and video (ffmpeg).
// POST /api/tools/convert      free: images and audio, up to FREE_MAX_MB
// POST /api/tools/convert-pro  Convertidor Pro subscribers: + video, up to PRO_MAX_MB
// Both take multipart file=<archivo>, target=<formato> and return the converted file.
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import heicConvert from 'heic-convert';
import { PDFDocument } from 'pdf-lib';
import { CONVERT_FORMATS, FREE_MAX_MB, FREE_VIDEO_MAX_MB, PRO_FORMATS, PRO_MAX_MB } from '../shared/constants.js';

const TMP_DIR = path.join(os.tmpdir(), 'monchys-convert');
await fs.mkdir(TMP_DIR, { recursive: true });

export const MIME = {
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', tiff: 'image/tiff',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
  mp4: 'video/mp4', webm: 'video/webm', comprimir: 'video/mp4', pdf: 'application/pdf',
};

// Output file extension ("comprimir" produces an MP4)
export const extFor = (target) => (target === 'comprimir' ? 'mp4' : target);

const AUDIO_ARGS = {
  mp3: ['-vn', '-codec:a', 'libmp3lame', '-q:a', '2'],
  wav: ['-vn', '-codec:a', 'pcm_s16le'],
  ogg: ['-vn', '-codec:a', 'libvorbis', '-q:a', '5'],
  m4a: ['-vn', '-codec:a', 'aac', '-b:a', '192k'],
  flac: ['-vn', '-codec:a', 'flac'],
};
const VIDEO_ARGS = {
  mp4: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart'],
  webm: ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '33', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-c:a', 'libopus', '-b:a', '128k'],
  // Animated GIF: first 15 s, max 640 px wide, with an optimized palette
  // Smaller MP4: at most 1280 px wide, higher CRF and lighter audio
  comprimir: ['-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart'],
  gif: ['-t', '15', '-vf', "fps=12,scale='min(640,iw)':-2:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse", '-an'],
};

export const kindOf = (filename, formats) => {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return Object.entries(formats).find(([, f]) => f.inputs.includes(ext))?.[0] ?? null;
};

const A4 = [595.28, 841.89]; // points
const PDF_MARGIN = 28;

// One image centered on an A4 page (portrait or landscape to match the image).
async function imageToPdf(source, output) {
  const { data, info } = await sharp(source).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
  const pdf = await PDFDocument.create();
  const [w, h] = info.width > info.height ? [A4[1], A4[0]] : A4;
  const page = pdf.addPage([w, h]);
  const image = await pdf.embedJpg(data);
  const scale = Math.min((w - 2 * PDF_MARGIN) / info.width, (h - 2 * PDF_MARGIN) / info.height, 1);
  const [iw, ih] = [info.width * scale, info.height * scale];
  page.drawImage(image, { x: (w - iw) / 2, y: (h - ih) / 2, width: iw, height: ih });
  await fs.writeFile(output, await pdf.save());
}

async function convertImage(input, output, target) {
  // HEIC/HEIF (iPhone photos): decode to PNG first, sharp's bundled libvips can't read them
  let source = input;
  if (/.(heic|heif)$/i.test(input)) {
    source = Buffer.from(await heicConvert({ buffer: await fs.readFile(input), format: 'PNG' }));
  }
  if (target === 'pdf') return imageToPdf(await sharp(source).rotate().toBuffer(), output); // rotate = apply EXIF orientation
  let img = sharp(source, { limitInputPixels: 100_000_000, animated: target === 'gif' || target === 'webp' }).rotate();
  if (target === 'jpg') img = img.flatten({ background: '#ffffff' }); // JPG has no transparency
  await img.toFormat(target === 'jpg' ? 'jpeg' : target, { quality: 85 }).toFile(output);
}

function runFfmpeg(input, output, args, timeout) {
  const fullArgs = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-protocol_whitelist', 'file', // never let a crafted file make ffmpeg open URLs or other files
    '-i', input,
    '-map_metadata', '-1',
    ...args,
    output,
  ];
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, fullArgs, { timeout, windowsHide: true }, (err, _stdout, stderr) => {
      if (err) reject(new Error(stderr?.trim() || err.message));
      else resolve();
    });
  });
}

function limiter(max, windowMs, keyOf) {
  const hits = new Map();
  return (req, res, next) => {
    const key = keyOf(req);
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return res.status(429).json({ error: 'Has hecho muchas conversiones seguidas. Espera unos minutos.' });
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

// Free video compression is heavy: one at a time for all visitors, and a few per visitor per hour
let freeVideoQueue = Promise.resolve();
const freeVideoHits = new Map();
const FREE_VIDEOS_PER_HOUR = 6;

export const FREE_VIDEO_LIMIT_MESSAGE = `Puedes procesar ${FREE_VIDEOS_PER_HOUR} videos gratis por hora. Con el Convertidor Pro no hay límite.`;

// Counts one free video for this visitor; false once they reached the hourly limit
export function takeFreeVideo(key) {
  const now = Date.now();
  const recent = (freeVideoHits.get(key) ?? []).filter((t) => now - t < 60 * 60_000);
  if (recent.length >= FREE_VIDEOS_PER_HOUR) return false;
  recent.push(now);
  freeVideoHits.set(key, recent);
  return true;
}

// Converts a file on disk (the input keeps its real extension). Free video work waits its turn.
export async function convertFile(input, output, target, { kind, free = false, timeout = 2 * 60_000 }) {
  const args = AUDIO_ARGS[target] ?? VIDEO_ARGS[target];
  if (kind === 'image') await convertImage(input, output, target);
  else if (free && kind === 'video') {
    const run = freeVideoQueue.then(() => runFfmpeg(input, output, args, 8 * 60_000));
    freeVideoQueue = run.catch(() => {});
    await run;
  } else await runFfmpeg(input, output, args, timeout);
  // An already-optimized MP4 can come out bigger: never hand back a heavier "compressed" file
  if (target === 'comprimir' && /\.mp4$/i.test(input) && (await fs.stat(output)).size >= (await fs.stat(input)).size) {
    await fs.copyFile(input, output);
  }
}

function convertHandler({ formats, maxMb, timeout, free = false }) {
  const upload = multer({
    storage: multer.diskStorage({
      // Recreated if missing (Windows cleanup tools empty the temp folder)
      destination: (req, file, cb) => fs.mkdir(TMP_DIR, { recursive: true }).then(() => cb(null, TMP_DIR), cb),
      filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase().slice(0, 8)),
    }),
    limits: { fileSize: (free ? Math.max(maxMb, FREE_VIDEO_MAX_MB) : maxMb) * 1024 * 1024, files: 1, fields: 2 },
  });

  return (req, res, next) => {
    upload.single('file')(req, res, async (uploadErr) => {
      const input = req.file?.path;
      const target = String(req.body?.target ?? '').toLowerCase();
      // ffmpeg picks the output format from the extension, so keep the real one
      const output = input ? `${input}.out.${/^[a-z0-9]+$/.test(target) ? extFor(target) : 'bin'}` : null;
      try {
        if (uploadErr?.code === 'LIMIT_FILE_SIZE') {
          if (free) return res.status(413).json({ error: `El archivo supera el límite gratis (${FREE_VIDEO_MAX_MB} MB en videos, ${maxMb} MB en lo demás). Con el Convertidor Pro puedes subir archivos más grandes.` });
          return res.status(413).json({ error: `El archivo supera el límite de ${maxMb >= 1024 ? `${maxMb / 1024} GB` : `${maxMb} MB`}.` });
        }
        if (uploadErr) throw uploadErr;
        if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });

        const kind = kindOf(req.file.originalname, formats);
        if (!kind) return res.status(400).json({ error: 'Formato de archivo no soportado.' });
        if (!formats[kind].outputs.includes(target)) {
          return res.status(400).json({ error: 'Formato de salida no válido para este archivo.' });
        }
        if (free && kind !== 'video' && req.file.size > maxMb * 1024 * 1024) {
          return res.status(413).json({ error: `El archivo supera el límite de ${maxMb} MB.` });
        }
        const freeVideo = free && kind === 'video';
        if (freeVideo && !takeFreeVideo(req.ip)) {
          return res.status(429).json({ error: FREE_VIDEO_LIMIT_MESSAGE });
        }

        try {
          await convertFile(input, output, target, { kind, free, timeout });
        } catch (err) {
          console.warn('Conversión fallida:', err.message);
          return res.status(422).json({ error: 'No pudimos convertir este archivo. ¿Está dañado o no es del tipo que indica su extensión?' });
        }

        const base = path.parse(req.file.originalname).name.replace(/[^\w\- .()áéíóúñÁÉÍÓÚÑ]/g, '_').slice(0, 80) || 'archivo';
        const filename = target === 'comprimir' ? `${base}-comprimido.mp4` : `${base}.${extFor(target)}`;
        res.setHeader('Content-Type', MIME[target]);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        await new Promise((resolve, reject) => res.sendFile(output, (err) => (err ? reject(err) : resolve())));
      } catch (err) {
        next(err);
      } finally {
        if (input) fs.rm(input, { force: true }).catch(() => {});
        if (output) fs.rm(output, { force: true }).catch(() => {});
      }
    });
  };
}

export function createConverterRouter({ requireAccess }) {
  const router = express.Router();

  router.post(
    '/convert',
    limiter(30, 10 * 60_000, (req) => req.ip),
    convertHandler({ formats: CONVERT_FORMATS, maxMb: FREE_MAX_MB, timeout: 2 * 60_000, free: true })
  );

  router.post(
    '/convert-pro',
    requireAccess('CNV-02'),
    limiter(300, 60 * 60_000, (req) => req.user.id),
    convertHandler({ formats: PRO_FORMATS, maxMb: PRO_MAX_MB, timeout: 30 * 60_000 })
  );

  return router;
}
