// Generador de CV: stores the customer's CV and writes cover letters (Claude, or a template offline).
import express from 'express';
import { createStore } from '../store.js';
import { aiAvailableFor, complete, requireAi, requireAiBudget, sendAiError } from '../ai.js';

const MAX_JSON = 80_000;

// Keep only strings/numbers/arrays/objects, with bounded sizes.
function sanitize(value, depth = 0) {
  if (depth > 5) return null;
  if (typeof value === 'string') return value.slice(0, 3000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 40).map((v) => sanitize(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 40).map(([k, v]) => [k.slice(0, 40), sanitize(v, depth + 1)]));
  }
  return null;
}

function cvAsText(cv) {
  const p = cv.personal ?? {};
  const lines = [`${p.name ?? ''} — ${p.title ?? ''}`, cv.summary ?? ''];
  for (const e of cv.experience ?? []) lines.push(`Experiencia: ${e.role} en ${e.company} (${e.start}–${e.end || 'actual'}). ${e.description ?? ''}`);
  for (const e of cv.education ?? []) lines.push(`Estudios: ${e.degree}, ${e.school} (${e.start}–${e.end})`);
  if (cv.skills?.length) lines.push(`Habilidades: ${cv.skills.join(', ')}`);
  if (cv.languages?.length) lines.push(`Idiomas: ${cv.languages.map((l) => `${l.name} (${l.level})`).join(', ')}`);
  return lines.filter(Boolean).join('\n');
}

// Offline cover letter built from the CV fields.
function templateLetter(cv, job) {
  const p = cv.personal ?? {};
  const last = (cv.experience ?? []).find((e) => e.role || e.company);
  const skills = (cv.skills ?? []).slice(0, 3);
  const company = job.company || 'su empresa';
  const applyingFor = job.position ? `a ${job.position}` : 'al puesto ofertado';
  const lowerFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const listJoin = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : items[0]);

  let experience = '';
  if (last) {
    const where = [last.role && `como ${lowerFirst(last.role)}`, last.company && `en ${last.company}`].filter(Boolean).join(' ');
    const achievements = (last.description ?? '')
      .split('\n')
      .map((l) => l.replace(/^[•\-*]\s*/, '').replace(/\.$/, '').trim())
      .filter(Boolean)
      .map((l) => l.charAt(0).toLowerCase() + l.slice(1));
    experience = achievements.length
      ? `En mi experiencia más reciente ${where}, ${listJoin(achievements)}.`
      : `En mi experiencia más reciente ${where} desarrollé responsabilidades muy relacionadas con este puesto.`;
  }

  const paragraphs = [
    `Estimado equipo de selección de ${company}:`,
    `Me dirijo a ustedes para presentar mi candidatura ${applyingFor}. ${p.title ? `Soy ${p.title.toLowerCase()}` : 'Soy un profesional'} con ganas de aportar valor a su equipo.`,
    experience,
    skills.length ? `Entre mis fortalezas destacan ${listJoin(skills)}, que considero clave para desempeñar este rol con éxito.` : '',
    `Me encantaría conversar sobre cómo puedo contribuir a ${company}. Quedo a su disposición para una entrevista.`,
    `Atentamente,\n${p.name ?? ''}${p.phone ? `\n${p.phone}` : ''}${p.email ? `\n${p.email}` : ''}`,
  ];
  return paragraphs.filter(Boolean).join('\n\n');
}

export async function createCvRouter({ requireAccess }) {
  const store = await createStore('cvs', {});
  const router = express.Router();
  router.use(requireAccess('CV-01'));

  router.get('/', (req, res) => {
    res.json({ ai: aiAvailableFor(`user:${req.user.id}`), cv: store.data[req.user.id]?.cv ?? null });
  });

  router.put('/', async (req, res) => {
    if (JSON.stringify(req.body ?? {}).length > MAX_JSON) return res.status(413).json({ error: 'El CV es demasiado grande.' });
    store.data[req.user.id] = { cv: sanitize(req.body?.cv ?? {}), updatedAt: new Date().toISOString() };
    await store.save();
    res.json({ ok: true, updatedAt: store.data[req.user.id].updatedAt });
  });

  router.post('/letter', async (req, res, next) => {
    const cv = sanitize(req.body?.cv ?? {});
    const job = {
      company: String(req.body?.job?.company ?? '').slice(0, 120),
      position: String(req.body?.job?.position ?? '').slice(0, 120),
      offer: String(req.body?.job?.offer ?? '').slice(0, 6000),
    };
    // Without AI (or over the monthly AI budget) the letter comes from the template
    if (!aiAvailableFor(`user:${req.user.id}`)) return res.json({ letter: templateLetter(cv, job), kind: 'template' });
    try {
      const letter = await complete({
        feature: 'cv-carta',
        subject: `user:${req.user.id}`,
        system:
          'Escribes cartas de presentación profesionales en español, de 250 a 350 palabras, con tono cercano y seguro. Usa solo datos reales del CV; no inventes experiencia, títulos ni cifras. Conecta la experiencia del candidato con lo que pide la oferta. Devuelve solo el texto de la carta, sin títulos ni comentarios.',
        messages: [
          {
            role: 'user',
            content: `<cv>\n${cvAsText(cv)}\n</cv>\n<oferta empresa="${job.company}" puesto="${job.position}">\n${job.offer || '(sin descripción)'}\n</oferta>`,
          },
        ],
      });
      res.json({ letter, kind: 'ai' });
    } catch (err) {
      if (!sendAiError(err, res)) next(err);
    }
  });

  router.post('/improve', requireAi, requireAiBudget((req) => `user:${req.user.id}`), async (req, res, next) => {
    const text = String(req.body?.text ?? '').trim().slice(0, 3000);
    const kind = req.body?.kind === 'summary' ? 'summary' : 'experience';
    if (text.length < 10) return res.status(400).json({ error: 'Escribe algo primero para poder mejorarlo.' });
    try {
      const improved = await complete({
        feature: 'cv-mejorar',
        subject: `user:${req.user.id}`,
        system:
          kind === 'summary'
            ? 'Mejoras el perfil profesional de un CV en español: 2 a 4 frases, claras y en primera persona implícita, sin adornos vacíos. No inventes datos. Devuelve solo el texto.'
            : 'Mejoras la descripción de un puesto en un CV en español: reescribe lo que dice el texto como 1 a 4 líneas que empiecen con "• " y un verbo de acción. Usa solo tareas y datos que aparezcan en el texto: no añadas responsabilidades, cifras ni resultados nuevos. Devuelve solo el texto.',
        messages: [{ role: 'user', content: text }],
      });
      res.json({ text: improved });
    } catch (err) {
      if (!sendAiError(err, res)) next(err);
    }
  });

  return router;
}
