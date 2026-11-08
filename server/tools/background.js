// Quitar fondo: runs server/python/quitar_fondo.py (rembg + isnet-general-use) and returns a transparent PNG.
// Each photo gets its own short-lived Python process, so its memory is returned as soon as it ends.
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { usedThisMonth, addUsage } from '../usage.js';

const MONTHLY_IMAGES = 500;
const MAX_MB = 20;
const MAX_SIDE = 4096;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/tiff', 'image/gif'];
const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'python', 'quitar_fondo.py');
const PYTHON = process.env.PYTHON_BIN || 'python3';
const TIMEOUT_MS = 3 * 60_000;

class BackgroundError extends Error {}

function runScript(input, output) {
  return new Promise((resolve, reject) => {
    execFile(PYTHON, [SCRIPT, input, output], { timeout: TIMEOUT_MS }, (err, stdout, stderr) => {
      if (!err) return resolve();
      const reason = stderr.trim().split('\n').pop() || err.message;
      console.warn(`Quitar fondo: Python terminó (${err.signal ?? err.code}): ${reason}`);
      if (err.code === 1) return reject(new BackgroundError('No pudimos abrir esta imagen. ¿Está dañada?'));
      if (err.code === 3 || err.signal === 'SIGKILL') {
        return reject(new BackgroundError('Esta imagen necesitó más memoria de la que tenemos. Prueba con una más pequeña.'));
      }
      if (err.killed) return reject(new BackgroundError('La imagen tardó demasiado. Prueba con una más pequeña.'));
      reject(new Error(reason));
    });
  });
}

// One photo at a time keeps memory predictable on a small server
let queue = Promise.resolve();
let waiting = 0;
function removeBackground(buffer) {
  waiting++;
  const run = queue.then(async () => {
    const base = path.join(os.tmpdir(), `fondo-${randomBytes(8).toString('hex')}`);
    try {
      // sharp reads every allowed format and applies the photo's rotation; PNG keeps it lossless
      await sharp(buffer, { animated: false })
        .rotate()
        .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 1 })
        .toFile(`${base}-in.png`);
      await runScript(`${base}-in.png`, `${base}-out.png`);
      return await fs.readFile(`${base}-out.png`);
    } finally {
      await Promise.all([fs.rm(`${base}-in.png`, { force: true }), fs.rm(`${base}-out.png`, { force: true })]);
    }
  });
  queue = run.catch(() => {}).finally(() => waiting--);
  return run;
}

export function createBackgroundRouter({ requireAccess }) {
  const router = express.Router();
  router.use(requireAccess('IMG-01'));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => cb(null, TYPES.includes(file.mimetype)),
  });

  router.get('/usage', (req, res) => {
    res.json({ used: usedThisMonth(req.user.id, 'backgroundImages'), limit: MONTHLY_IMAGES, queue: waiting });
  });

  router.post('/', (req, res, next) => {
    upload.single('file')(req, res, async (uploadErr) => {
      try {
        if (uploadErr?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `La imagen supera ${MAX_MB} MB.` });
        if (uploadErr) throw uploadErr;
        if (!req.file) return res.status(400).json({ error: 'Sube una imagen JPG, PNG, WEBP, AVIF, TIFF o GIF.' });
        if (usedThisMonth(req.user.id, 'backgroundImages') >= MONTHLY_IMAGES) {
          return res.status(429).json({ error: `Llegaste al límite de ${MONTHLY_IMAGES} imágenes este mes.` });
        }

        let png;
        try {
          png = await removeBackground(req.file.buffer);
        } catch (err) {
          console.warn('Quitar fondo falló:', err.message);
          return res.status(422).json({ error: err instanceof BackgroundError ? err.message : 'No pudimos procesar esta imagen. ¿Está dañada?' });
        }
        await addUsage(req.user.id, 'backgroundImages', 1);
        res.setHeader('Content-Type', 'image/png');
        res.send(png);
      } catch (err) {
        next(err);
      }
    });
  });

  return router;
}
