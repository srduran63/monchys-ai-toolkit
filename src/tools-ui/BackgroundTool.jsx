import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Trash2, Archive, AlertTriangle, Check } from 'lucide-react';
import { tool } from '../api';
import { upload, downloadBlob } from '../upload';
import { Card, DropZone, ErrorBox, UsageMeter } from './ui';

const api = tool('quitar-fondo');
const MAX_FILES = 50;
const MAX_MB = 20;
const CHECKER = 'repeating-conic-gradient(#e8e2da 0% 25%, #ffffff 0% 50%) 50% / 18px 18px';

const BACKGROUNDS = [
  { id: 'transparent', label: 'Transparente' },
  { id: '#ffffff', label: 'Blanco' },
  { id: 'custom', label: 'Color' },
];

// Put the transparent PNG over a solid color (returns a JPG) or keep it transparent.
async function render(pngBlob, background) {
  if (background === 'transparent') return { blob: pngBlob, ext: 'png' };
  const bitmap = await createImageBitmap(pngBlob);
  const canvas = Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
  return { blob, ext: 'jpg' };
}

export default function BackgroundTool() {
  const [usage, setUsage] = useState(null);
  const [items, setItems] = useState([]); // { id, file, original, result, status, error }
  const [bg, setBg] = useState('transparent');
  const [color, setColor] = useState('#9fcdf2');
  const [error, setError] = useState('');
  const running = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const refreshUsage = () => api.get('/usage').then(setUsage).catch(() => {});
  useEffect(() => {
    refreshUsage();
  }, []);

  const update = (id, patch) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  // Process pending images one by one
  const run = async () => {
    if (running.current) return;
    running.current = true;
    let next;
    while ((next = itemsRef.current.find((it) => it.status === 'pending'))) {
      update(next.id, { status: 'working' });
      try {
        const { blob } = await upload('/api/tools/quitar-fondo', { file: next.file }, { responseType: 'blob' });
        update(next.id, { status: 'done', result: blob, resultUrl: URL.createObjectURL(blob) });
      } catch (err) {
        update(next.id, { status: 'error', error: err.message });
        if (err.status === 429) break;
      }
      await new Promise((r) => setTimeout(r, 0)); // let state flush before picking the next
    }
    running.current = false;
    refreshUsage();
  };

  const add = (files) => {
    setError('');
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length < files.length) setError('Algunos archivos no eran imágenes y se ignoraron.');
    const room = MAX_FILES - items.length;
    const accepted = images.slice(0, room).map((file) => ({
      id: crypto.randomUUID(),
      file,
      original: URL.createObjectURL(file),
      status: file.size > MAX_MB * 1024 * 1024 ? 'error' : 'pending',
      error: file.size > MAX_MB * 1024 * 1024 ? `Supera ${MAX_MB} MB` : null,
    }));
    if (images.length > room) setError(`Máximo ${MAX_FILES} imágenes por lote.`);
    setItems((list) => [...list, ...accepted]);
    setTimeout(run, 0);
  };

  const background = bg === 'custom' ? color : bg;
  const nameFor = (it, ext) => `${it.file.name.replace(/\.[^.]+$/, '')}-sin-fondo.${ext}`;

  const downloadOne = async (it) => {
    const { blob, ext } = await render(it.result, background);
    downloadBlob(blob, nameFor(it, ext));
  };

  const downloadAll = async () => {
    const { zipSync } = await import('fflate');
    const files = {};
    for (const it of items.filter((i) => i.status === 'done')) {
      const { blob, ext } = await render(it.result, background);
      files[nameFor(it, ext)] = new Uint8Array(await blob.arrayBuffer());
    }
    downloadBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), 'imagenes-sin-fondo.zip');
  };

  const done = items.filter((i) => i.status === 'done').length;
  const working = items.some((i) => i.status === 'pending' || i.status === 'working');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {usage && <UsageMeter used={usage.used} limit={usage.limit} unit="imágenes" />}
        <div className="flex flex-wrap items-center gap-2 bg-white rounded-full shadow-toy p-1">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              onClick={() => setBg(b.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${bg === b.id ? 'bg-ink text-blob' : 'hover:bg-cream'}`}
            >
              {b.label}
            </button>
          ))}
          {bg === 'custom' && (
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-9 h-9 rounded-full cursor-pointer" aria-label="Color de fondo" />
          )}
        </div>
      </div>

      <DropZone
        accept="image/jpeg,image/png,image/webp,image/avif,image/tiff,image/gif"
        multiple
        onFiles={add}
        disabled={items.length >= MAX_FILES}
        title="Arrastra tus imágenes aquí"
        hint={`JPG, PNG, WEBP, AVIF, TIFF · hasta ${MAX_MB} MB y 4K · hasta ${MAX_FILES} por lote. Cada imagen tarda unos segundos.`}
      />
      <ErrorBox error={error} onClose={() => setError('')} />

      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-bold text-ink/60">
            {done} de {items.length} listas {working && <Loader2 className="inline w-4 h-4 animate-spin ml-1" />}
          </p>
          <div className="flex gap-2">
            <button onClick={downloadAll} disabled={!done} className="btn btn-red px-4 py-2 text-sm">
              <Archive className="w-4 h-4" /> Descargar todo (ZIP)
            </button>
            <button onClick={() => setItems([])} disabled={working} className="btn btn-ghost px-4 py-2 text-sm">
              Limpiar
            </button>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <Card key={it.id} className="!p-3">
            <div className="grid grid-cols-2 gap-2">
              <img src={it.original} alt="Original" className="aspect-square object-contain rounded-xl bg-cream w-full" />
              <div className="aspect-square rounded-xl overflow-hidden flex items-center justify-center" style={{ background: background === 'transparent' ? CHECKER : background }}>
                {it.status === 'done' ? (
                  <img src={it.resultUrl} alt="Sin fondo" className="w-full h-full object-contain" />
                ) : it.status === 'error' ? (
                  <AlertTriangle className="w-6 h-6 text-mouth" />
                ) : (
                  <Loader2 className={`w-6 h-6 text-ink/40 ${it.status === 'working' ? 'animate-spin' : ''}`} />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <p className="flex-1 min-w-0 text-sm font-semibold truncate">{it.file.name}</p>
              {it.status === 'done' && (
                <>
                  <Check className="w-4 h-4 text-blob-deep" aria-label="Lista" />
                  <button onClick={() => downloadOne(it)} className="btn btn-blue w-9 h-9" aria-label="Descargar">
                    <Download className="w-4 h-4" />
                  </button>
                </>
              )}
              {it.status !== 'working' && (
                <button
                  onClick={() => setItems((l) => l.filter((x) => x.id !== it.id))}
                  className="rounded-full p-2 text-ink/30 hover:text-mouth hover:bg-mouth/10"
                  aria-label="Quitar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            {it.status === 'pending' && <p className="text-xs text-ink/50 mt-1">En espera…</p>}
            {it.status === 'working' && <p className="text-xs text-ink/50 mt-1">Quitando el fondo…</p>}
            {it.error && <p className="text-xs font-bold text-mouth mt-1">{it.error}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
