import { useEffect, useState } from 'react';
import { Download, Loader2, Lock, RefreshCw, Trash2, WandSparkles } from 'lucide-react';
import { ActivateButton } from '../Activate';
import { tool } from '../api';
import { money } from '../icons';
import { downloadBlob } from '../upload';
import { Card, ErrorBox, UsageMeter, label } from './ui';

const api = tool('imagenes');
const MAX_PROMPT = 600;
const RATIOS = [
  { id: '1:1', label: 'Cuadrada', w: 1, h: 1 },
  { id: '16:9', label: 'Horizontal', w: 16, h: 9 },
  { id: '9:16', label: 'Vertical', w: 9, h: 16 },
  { id: '4:3', label: '4:3', w: 4, h: 3 },
];
const EXAMPLES = [
  'Un gato astronauta flotando en el espacio, estilo ilustración',
  'Foto de producto de una taza de café sobre una mesa de madera, luz de mañana',
  'Paisaje de montañas al atardecer, colores cálidos, estilo acuarela',
  'Logo minimalista de una panadería con un croissant',
];

async function generate(prompt, ratio) {
  const res = await fetch('/api/tools/imagenes', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, ratio }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.upgrade = Boolean(data?.upgrade);
    throw err;
  }
  return res.blob();
}

export default function ImageGenTool({ product, locked = false }) {
  const [quota, setQuota] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('1:1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [upgrade, setUpgrade] = useState(false);
  const [images, setImages] = useState([]); // { id, url, blob, prompt, ratio }

  const refresh = () => api.get().then(setQuota).catch(() => {});
  useEffect(() => {
    refresh();
  }, []);

  const run = async (text = prompt, shapeId = ratio) => {
    if (busy || text.trim().length < 3) return;
    setBusy(true);
    setError('');
    setUpgrade(false);
    try {
      const blob = await generate(text.trim(), shapeId);
      setImages((list) => [{ id: crypto.randomUUID(), url: URL.createObjectURL(blob), blob, prompt: text.trim(), ratio: shapeId }, ...list]);
    } catch (err) {
      setError(err.message);
      setUpgrade(err.upgrade);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const fileName = (img) =>
    `${img.prompt
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40)
      .replace(/^-|-$/g, '') || 'imagen'}.webp`;

  if (quota && !quota.available) {
    return <p className="bg-cream rounded-xl text-sm font-bold text-ink/60 p-4">El generador de imágenes se está activando. Vuelve pronto.</p>;
  }
  const outOfFree = quota && !quota.plan && quota.left <= 0;
  const shape = RATIOS.find((r) => r.id === ratio);

  return (
    <div className="space-y-6">
      {quota &&
        (quota.plan ? (
          <UsageMeter used={quota.used} limit={quota.limit} unit="imágenes" />
        ) : (
          <div className="rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3 bg-white shadow-toy">
            <Lock className="w-5 h-5 shrink-0 text-ink/40" />
            <p className="flex-1 min-w-56 text-sm">
              <b>
                {quota.left > 0 ? `Te quedan ${quota.left} de ${quota.limit} imágenes gratis hoy.` : 'Ya usaste tus imágenes gratis de hoy.'}
              </b>{' '}
              Con la suscripción generas 200 al mes por {money(product.price)}/mes.
            </p>
            {locked && <ActivateButton product={product} withPrice={false} className="px-4 py-2 text-sm" onActivated={refresh} />}
          </div>
        ))}

      <Card>
        <label htmlFor="prompt" className={label}>
          Describe la imagen
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT))}
          onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && run()}
          rows={3}
          placeholder="Ej.: un perro con gafas de sol en la playa, estilo dibujo animado"
          className="w-full rounded-xl border-2 border-ink/10 bg-white px-3 py-2.5 font-semibold focus:outline-none focus:border-blob focus:ring-4 focus:ring-blob/30"
        />
        <div className="flex flex-wrap gap-2 mt-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setPrompt(ex)} className="text-xs font-bold bg-cream hover:bg-blob-soft rounded-full px-3 py-1.5 text-left">
              {ex}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
          <div className="flex flex-wrap items-center gap-1 bg-cream rounded-full p-1" role="radiogroup" aria-label="Formato">
            {RATIOS.map((r) => (
              <button
                key={r.id}
                role="radio"
                aria-checked={ratio === r.id}
                onClick={() => setRatio(r.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-bold flex items-center gap-1.5 ${ratio === r.id ? 'bg-ink text-blob' : 'hover:bg-white'}`}
              >
                <span className="inline-block border-2 border-current rounded-sm" style={{ width: (14 * r.w) / Math.max(r.w, r.h), height: (14 * r.h) / Math.max(r.w, r.h) }} />
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={() => run()} disabled={busy || prompt.trim().length < 3 || outOfFree} className="btn btn-red px-6 py-3">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <WandSparkles className="w-5 h-5" />}
            {busy ? 'Creando…' : 'Generar imagen'}
          </button>
        </div>
        <p className="text-xs text-ink/50 mt-3">Escribe en español: lo traducimos para la IA. Cada imagen tarda unos segundos.</p>
      </Card>

      <ErrorBox error={error} onClose={() => setError('')} />
      {upgrade && locked && (
        <div className="bg-coal text-white rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="flex-1 min-w-56 text-sm">Genera 200 imágenes al mes por {money(product.price)}/mes.</p>
          <ActivateButton product={product} withPrice={false} className="px-4 py-2 text-sm" onActivated={refresh} />
        </div>
      )}

      {(busy || images.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {busy && (
            <div
              className="bg-white rounded-[2rem] shadow-toy flex flex-col items-center justify-center gap-2 text-ink/50 font-bold"
              style={{ aspectRatio: `${shape.w} / ${shape.h}` }}
            >
              <Loader2 className="w-8 h-8 animate-spin" />
              Creando tu imagen…
            </div>
          )}
          {images.map((img) => (
            <Card key={img.id} className="!p-3">
              <img src={img.url} alt={img.prompt} className="w-full rounded-xl bg-cream" />
              <div className="flex items-center gap-2 mt-3">
                <p className="flex-1 min-w-0 text-sm font-semibold line-clamp-2">{img.prompt}</p>
                <button onClick={() => downloadBlob(img.blob, fileName(img))} className="btn btn-blue w-9 h-9 shrink-0" aria-label="Descargar">
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setPrompt(img.prompt);
                    setRatio(img.ratio);
                    run(img.prompt, img.ratio);
                  }}
                  disabled={busy || outOfFree}
                  className="rounded-full p-2 text-ink/40 hover:text-ink hover:bg-cream disabled:opacity-40"
                  aria-label="Otra versión"
                  title="Otra versión"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setImages((l) => l.filter((x) => x.id !== img.id))}
                  className="rounded-full p-2 text-ink/30 hover:text-mouth hover:bg-mouth/10"
                  aria-label="Quitar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
