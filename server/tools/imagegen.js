// Generar imágenes (GEN-01): FLUX.1 [schnell] on Replicate (Apache-2.0, commercial use allowed).
// The Spanish description is turned into an English prompt by Claude, which also turns down
// requests that aren't allowed. Anyone gets a few free images a day; subscribers get a monthly quota.
import express from 'express';
import { createStore } from '../store.js';
import { usedThisMonth, addUsage } from '../usage.js';
import { GenError, englishPrompt, replicateAvailable, runModel } from '../replicate.js';

const MONTHLY_IMAGES = 200;
const FREE_PER_DAY = 3;
// Free images for all visitors together, per day: caps what the free tier can cost
const FREE_TOTAL_PER_DAY = Number(process.env.IMAGES_FREE_TOTAL_PER_DAY) || 150;
const MAX_PROMPT = 600;
const RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'];

const generate = (prompt, aspectRatio) =>
  runModel('black-forest-labs/flux-schnell', {
    prompt,
    aspect_ratio: aspectRatio,
    num_outputs: 1,
    output_format: 'webp',
    output_quality: 90,
    go_fast: true,
    megapixels: '1',
  });

export async function createImageRouter({ userFromRequest, hasAccess }) {
  const router = express.Router();
  const free = await createStore('images-free', {}); // { [day]: { total, [visitor]: count } }
  const today = () => new Date().toISOString().slice(0, 10);
  const freeDay = () => {
    const day = today();
    for (const key of Object.keys(free.data)) if (key !== day) delete free.data[key];
    return (free.data[day] ??= { total: 0 });
  };

  // Who is asking, and how many images they have left
  const quota = (req) => {
    const user = userFromRequest(req);
    if (user && hasAccess(user)) {
      const used = usedThisMonth(user.id, 'images');
      return { user, plan: true, used, limit: MONTHLY_IMAGES, left: MONTHLY_IMAGES - used };
    }
    const visitor = user ? `user:${user.id}` : `ip:${req.ip}`;
    const day = freeDay();
    const used = day[visitor] ?? 0;
    return { user, plan: false, visitor, used, limit: FREE_PER_DAY, left: Math.max(0, FREE_PER_DAY - used), soldOut: day.total >= FREE_TOTAL_PER_DAY };
  };

  router.get('/', (req, res) => {
    const q = quota(req);
    res.json({ available: replicateAvailable, plan: q.plan, used: q.used, limit: q.limit, left: q.left, soldOut: Boolean(q.soldOut) });
  });

  // One image at a time per visitor, so a double click doesn't spend two
  const busy = new Set();

  router.post('/', express.json({ limit: '10kb' }), async (req, res, next) => {
    const q = quota(req);
    const who = q.plan ? `user:${q.user.id}` : q.visitor;
    let started = false;
    try {
      if (!replicateAvailable) return res.status(503).json({ error: 'El generador de imágenes todavía no está activado.' });
      const text = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
      const ratio = RATIOS.includes(req.body?.ratio) ? req.body.ratio : '1:1';
      if (text.length < 3) return res.status(400).json({ error: 'Describe la imagen que quieres.' });
      if (text.length > MAX_PROMPT) return res.status(400).json({ error: `La descripción puede tener hasta ${MAX_PROMPT} caracteres.` });
      if (q.left <= 0) {
        return res.status(429).json({
          error: q.plan
            ? `Llegaste al límite de ${MONTHLY_IMAGES} imágenes este mes. Se renueva el día 1.`
            : `Ya usaste tus ${FREE_PER_DAY} imágenes gratis de hoy. Activa la herramienta para generar ${MONTHLY_IMAGES} al mes.`,
          upgrade: !q.plan,
        });
      }
      if (!q.plan && q.soldOut) {
        return res.status(429).json({ error: 'Se acabaron las imágenes gratis de hoy para todos. Vuelve mañana o activa la herramienta.', upgrade: true });
      }
      if (busy.has(who)) return res.status(429).json({ error: 'Espera a que termine la imagen anterior.' });
      busy.add(who);
      started = true;

      const prompt = await englishPrompt(text, 'image', 'imagenes');
      const image = await generate(prompt, ratio);
      if (q.plan) {
        await addUsage(q.user.id, 'images', 1);
      } else {
        const day = freeDay();
        day[q.visitor] = (day[q.visitor] ?? 0) + 1;
        day.total++;
        await free.save();
      }
      res.setHeader('Content-Type', image.type || 'image/webp');
      res.setHeader('X-Images-Left', String(q.left - 1));
      res.send(image.buffer);
    } catch (err) {
      if (err instanceof GenError) return res.status(err.status).json({ error: err.message });
      if (err?.name === 'TimeoutError') return res.status(504).json({ error: 'El generador tardó demasiado. Inténtalo de nuevo.' });
      next(err);
    } finally {
      if (started) busy.delete(who);
    }
  });

  return router;
}
