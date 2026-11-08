// Shared by the generators that run on Replicate (images, videos): the API call and the
// Spanish-description -> English-prompt step, which also turns down requests that aren't allowed.
import { completeJson, aiAvailableFor, AiRefusal } from './ai.js';

export const replicateAvailable = Boolean(process.env.REPLICATE_API_TOKEN);
if (!replicateAvailable) console.warn('Generar imágenes y videos desactivado: añade REPLICATE_API_TOKEN a .env para activarlo.');

// Error with a message for the customer
export class GenError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

const RULES = `No se generan: desnudos o contenido sexual; cualquier contenido sexual o sugerente con menores; personas reales identificables (famosos, políticos o personas con nombre propio); violencia gráfica o gore; símbolos de odio; documentos falsos (DNI, billetes, recetas médicas); logotipos o marcas registradas de otras empresas.`;

// what: 'image' or 'video'. Returns the English prompt, or throws GenError if it isn't allowed.
export async function englishPrompt(text, what, feature) {
  if (!aiAvailableFor('site:imagenes')) return text; // without Claude, Replicate's own safety filter still applies
  const system = `Preparas descripciones para un generador de ${what === 'video' ? 'videos cortos (5 segundos)' : 'imágenes'}. El usuario escribe en español (o en otro idioma) lo que quiere ver.
Responde SOLO con JSON, sin texto alrededor:
- Si se puede generar: {"ok": true, "prompt": "<descripción en inglés, concreta y visual, máximo 70 palabras>"}
  Respeta la idea del usuario; añade solo detalles de estilo, luz y composición que la mejoren${what === 'video' ? ', y describe el movimiento de lo que aparece y de la cámara' : ''}. Si pide texto dentro de la imagen, mantenlo en su idioma original y entre comillas.
- Si no se debe generar: {"ok": false, "reason": "<motivo breve y amable en español>"}
${RULES}`;
  let result;
  try {
    result = await completeJson({ system, messages: [{ role: 'user', content: text }], feature, subject: 'site:imagenes' });
  } catch (err) {
    if (err instanceof AiRefusal) throw new GenError('No podemos generar eso. Prueba con otra descripción.');
    console.warn(`${feature}: no se pudo preparar el texto con IA:`, err.message);
    return text;
  }
  if (!result.ok) throw new GenError(result.reason || 'No podemos generar eso. Prueba con otra descripción.');
  return String(result.prompt || text).slice(0, 1500);
}

async function call(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(90_000),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;
  console.error('Replicate respondió', res.status, data?.detail ?? data);
  if (res.status === 402) throw new GenError('El generador no está disponible ahora mismo.', 503);
  if (res.status === 429) throw new GenError('Hay muchas personas generando ahora. Inténtalo en un minuto.', 429);
  throw new GenError('El generador tuvo un problema. Inténtalo de nuevo.', 502);
}

// Runs a model ("owner/name") and downloads its output file. Returns { buffer, type }.
export async function runModel(model, input, { timeoutMs = 90_000 } = {}) {
  let prediction = await call(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: { Prefer: 'wait=60' },
    body: JSON.stringify({ input }),
  });
  const deadline = Date.now() + timeoutMs;
  while (['starting', 'processing'].includes(prediction.status) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    prediction = await call(prediction.urls.get);
  }
  if (prediction.status !== 'succeeded') {
    console.warn(`Replicate ${model}:`, prediction.status, prediction.error);
    if (['starting', 'processing'].includes(prediction.status)) {
      call(prediction.urls.cancel, { method: 'POST' }).catch(() => {});
      throw new GenError('El generador tardó demasiado. Inténtalo de nuevo.', 504);
    }
    if (/nsfw|safety/i.test(prediction.error ?? '')) throw new GenError('Eso no está permitido. Prueba con otra descripción.');
    throw new GenError('No pudimos generarlo. Inténtalo de nuevo.', 502);
  }
  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  const file = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!file.ok) throw new GenError('No pudimos descargar el resultado. Inténtalo de nuevo.', 502);
  return { buffer: Buffer.from(await file.arrayBuffer()), type: file.headers.get('content-type') };
}
