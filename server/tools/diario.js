// Diario emocional: daily entries with mood (1-5), emotions and free text.
// Not therapy: entries that suggest a crisis get help resources in the reply.
import crypto from 'node:crypto';
import express from 'express';
import { createStore } from '../store.js';

export const EMOTIONS = [
  'alegría', 'calma', 'gratitud', 'ilusión', 'orgullo', 'cansancio',
  'estrés', 'ansiedad', 'tristeza', 'enojo', 'soledad', 'confusión',
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ENTRIES = 3000;

// Phrases that may indicate risk of self-harm. On a match we show help lines; we never block the entry.
// (Explicit letter classes instead of \b, which ignores accented letters.)
const CRISIS_RE =
  /(^|[^a-záéíóúüñ])(suicid[a-záéíóúñ]*|quitarme la vida|matarme|no quiero (seguir )?viv(ir|iendo)|ya no quiero estar aqu[ií]|quiero morir(me)?|desaparecer para siempre|hacerme da[ñn]o|autolesi[a-záéíóúñ]*|cortarme|no vale la pena vivir|mejor sin m[ií])(?![a-záéíóúüñ])/i;

export const isCrisis = (text) => CRISIS_RE.test(text.normalize('NFC'));

export async function createDiarioRouter({ requireAccess }) {
  const store = await createStore('diario', {});
  const router = express.Router();
  router.use(requireAccess('BIE-01'));

  const userData = (req) => store.forUser(req.user.id, () => ({ entries: [] }));

  router.get('/', (req, res) => {
    const u = userData(req);
    res.json({ emotions: EMOTIONS, entries: [...u.entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  });

  router.post('/entries', async (req, res) => {
    const u = userData(req);
    if (u.entries.length >= MAX_ENTRIES) return res.status(400).json({ error: 'Has llegado al máximo de entradas.' });

    const mood = Number(req.body?.mood);
    if (!Number.isInteger(mood) || mood < 1 || mood > 5) return res.status(400).json({ error: 'Elige cómo te sientes (1 a 5).' });
    const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 5000) : '';
    const emotions = Array.isArray(req.body?.emotions) ? [...new Set(req.body.emotions.filter((e) => EMOTIONS.includes(e)))] : [];
    const date = DATE_RE.test(req.body?.date ?? '') ? req.body.date : new Date().toISOString().slice(0, 10);
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.slice(0, 200) : '';

    const entry = { id: crypto.randomUUID(), date, mood, emotions, text, prompt, createdAt: new Date().toISOString() };
    u.entries.push(entry);
    await store.save();
    res.status(201).json({ entry, crisis: isCrisis(text) });
  });

  router.delete('/entries/:id', async (req, res) => {
    const u = userData(req);
    u.entries = u.entries.filter((e) => e.id !== req.params.id);
    await store.save();
    res.status(204).end();
  });

  return router;
}
