// AI writing tools:
// - Textos para redes (RED-01): posts for each social network from an idea
// - Descripciones de productos (DES-01): titles, descriptions and bullets, optionally from a photo
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { aiAvailableFor, completeJson, requireAi, requireAiBudget, sendAiError } from '../ai.js';

const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const pick = (v, options, fallback) => (Object.hasOwn(options, v) ? v : fallback);

const NETWORKS = {
  instagram: 'Instagram (texto para el pie de foto, con saltos de línea, emojis moderados y 8-15 hashtags al final)',
  facebook: 'Facebook (cercano, 1-3 párrafos cortos, pocos hashtags)',
  tiktok: 'TikTok (gancho fuerte en la primera línea, muy breve, 3-6 hashtags)',
  linkedin: 'LinkedIn (profesional, primera línea que enganche, párrafos de una o dos frases, 3-5 hashtags)',
  x: 'X / Twitter (máximo 270 caracteres, 1-2 hashtags)',
  whatsapp: 'Estado o mensaje de WhatsApp (muy breve y directo, sin hashtags)',
};
const TONES = {
  cercano: 'cercano y amable',
  profesional: 'profesional y claro',
  divertido: 'divertido y desenfadado',
  inspirador: 'inspirador',
  urgente: 'de oferta, con urgencia y llamada a la acción',
};
const PLATFORMS = {
  tienda: 'su propia tienda online',
  mercadolibre: 'Mercado Libre',
  amazon: 'Amazon',
  marketplace: 'Facebook Marketplace',
  instagram: 'Instagram Shopping',
  etsy: 'Etsy',
};
const LANGS = { es: 'español', en: 'inglés', pt: 'portugués' };

const subjectOf = (req) => `user:${req.user.id}`;

export function createWriterRouter({ requireAccess }) {
  const router = express.Router();
  const budget = requireAiBudget(subjectOf);
  const photo = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 10 },
    fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
  });

  router.get('/redes', requireAccess('RED-01'), (req, res) => res.json({ ai: aiAvailableFor(subjectOf(req)) }));
  router.get('/descripciones', requireAccess('DES-01'), (req, res) => res.json({ ai: aiAvailableFor(subjectOf(req)) }));

  router.post('/redes', requireAccess('RED-01'), requireAi, budget, async (req, res, next) => {
    const idea = text(req.body?.idea, 1500);
    if (idea.length < 5) return res.status(400).json({ error: 'Cuéntanos de qué trata la publicación.' });
    const networks = (Array.isArray(req.body?.networks) ? req.body.networks : []).filter((n) => NETWORKS[n]).slice(0, 6);
    if (!networks.length) return res.status(400).json({ error: 'Elige al menos una red social.' });
    const tone = pick(req.body?.tone, TONES, 'cercano');
    const lang = pick(req.body?.language, LANGS, 'es');
    const business = text(req.body?.business, 200);
    const variants = Math.min(3, Math.max(1, Number(req.body?.variants) || 2));

    try {
      const out = await completeJson({
        feature: 'redes',
        subject: subjectOf(req),
        system: `Eres community manager experto. Escribes publicaciones listas para copiar y pegar, en ${LANGS[lang]}, con tono ${TONES[tone]}. Adapta cada texto a la red indicada. No inventes datos concretos (precios, fechas, direcciones, cifras) que el usuario no haya dado; si hacen falta, deja un hueco como [precio]. Responde solo con JSON válido, sin texto extra, con esta forma: {"posts":[{"network":"<id de la red>","text":"<publicación>"}]}. Devuelve ${variants} variante(s) distintas por cada red.`,
        messages: [
          {
            role: 'user',
            content: `Redes (id: descripción):\n${networks.map((n) => `- ${n}: ${NETWORKS[n]}`).join('\n')}\n\n${business ? `Negocio o marca: ${business}\n` : ''}Idea de la publicación:\n${idea}`,
          },
        ],
      });
      const posts = (Array.isArray(out.posts) ? out.posts : [])
        .filter((p) => networks.includes(p?.network) && typeof p.text === 'string')
        .map((p) => ({ network: p.network, text: p.text.trim() }));
      if (!posts.length) return res.status(502).json({ error: 'La IA no devolvió publicaciones. Inténtalo de nuevo.' });
      res.json({ posts });
    } catch (err) {
      if (!sendAiError(err, res)) next(err);
    }
  });

  router.post('/descripciones', requireAccess('DES-01'), requireAi, budget, (req, res, next) => {
    photo.single('photo')(req, res, async (uploadErr) => {
      try {
        if (uploadErr?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'La foto supera 15 MB.' });
        if (uploadErr) throw uploadErr;
        const product = text(req.body?.product, 200);
        const details = text(req.body?.details, 2000);
        if (!product && !req.file) return res.status(400).json({ error: 'Escribe el nombre del producto o sube una foto.' });
        const platform = pick(req.body?.platform, PLATFORMS, 'tienda');
        const tone = pick(req.body?.tone, TONES, 'cercano');
        const lang = pick(req.body?.language, LANGS, 'es');
        const audience = text(req.body?.audience, 200);

        const content = [];
        if (req.file) {
          let image;
          try {
            image = await sharp(req.file.buffer).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toBuffer();
          } catch {
            return res.status(422).json({ error: 'No pudimos leer la foto.' });
          }
          content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image.toString('base64') } });
        }
        content.push({
          type: 'text',
          text: [
            product && `Producto: ${product}`,
            details && `Características que da el vendedor: ${details}`,
            audience && `Público objetivo: ${audience}`,
            `Dónde se venderá: ${PLATFORMS[platform]}`,
          ]
            .filter(Boolean)
            .join('\n'),
        });

        const out = await completeJson({
          feature: 'descripciones',
          subject: subjectOf(req),
          system: `Eres redactor experto en comercio electrónico. Escribes en ${LANGS[lang]}, con tono ${TONES[tone]}, textos que venden y posicionan en buscadores, adaptados a la plataforma indicada (respeta sus costumbres: por ejemplo, títulos de Mercado Libre y Amazon con marca, modelo y atributos clave, sin emojis). Usa solo lo que se ve en la foto o lo que dice el vendedor: no inventes medidas, materiales, garantías ni cifras; si faltan datos importantes, menciónalos en "missing". Responde solo con JSON válido con esta forma: {"title":"<título, máx. 70 caracteres>","short":"<descripción corta de 1-2 frases>","long":"<descripción completa de 2-4 párrafos>","bullets":["<4-6 puntos clave>"],"keywords":["<6-10 palabras clave de búsqueda>"],"missing":["<datos que convendría añadir>"]}`,
          messages: [{ role: 'user', content }],
        });
        const list = (v, max) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((x) => x.trim()).slice(0, max) : []);
        res.json({
          title: String(out.title ?? '').trim(),
          short: String(out.short ?? '').trim(),
          long: String(out.long ?? '').trim(),
          bullets: list(out.bullets, 8),
          keywords: list(out.keywords, 12),
          missing: list(out.missing, 6),
        });
      } catch (err) {
        if (!sendAiError(err, res)) next(err);
      }
    });
  });

  return router;
}
