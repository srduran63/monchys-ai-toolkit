import { useRef, useState } from 'react';
import { Archive, Check, Download, Loader2, Trash2, AlertTriangle, FileText } from 'lucide-react';
import { upload, downloadBlob, sizeLabel } from '../upload';
import { Card, DropZone, ErrorBox } from './ui';

const MAX_MB = 50;
const MAX_FILES = 30;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/tiff,.heic,.heif,application/pdf,.pdf';
const LEVELS = [
  { id: 'ligera', label: 'Ligera', hint: 'Casi sin perder calidad' },
  { id: 'equilibrada', label: 'Equilibrada', hint: 'Recomendada' },
  { id: 'fuerte', label: 'Fuerte', hint: 'El archivo más pequeño' },
];

export default function CompressTool({ preset }) {
  const [items, setItems] = useState([]); // { id, file, status, result, filename, error }
  const [level, setLevel] = useState(LEVELS.some((l) => l.id === preset) ? preset : 'equilibrada');
  const [error, setError] = useState('');
  const running = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const levelRef = useRef(level);
  levelRef.current = level;

  const update = (id, patch) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const run = async () => {
    if (running.current) return;
    running.current = true;
    let next;
    while ((next = itemsRef.current.find((it) => it.status === 'pending'))) {
      update(next.id, { status: 'working' });
      try {
        const { blob, filename } = await upload('/api/tools/comprimir', { level: levelRef.current, file: next.file }, { responseType: 'blob' });
        update(next.id, { status: 'done', result: blob, filename });
      } catch (err) {
        update(next.id, { status: 'error', error: err.message });
        if (err.status === 429) break;
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    running.current = false;
  };

  const add = (files) => {
    setError('');
    const room = MAX_FILES - items.length;
    if (files.length > room) setError(`Máximo ${MAX_FILES} archivos a la vez.`);
    const accepted = files.slice(0, room).map((file) => {
      const tooBig = file.size > MAX_MB * 1024 * 1024;
      return { id: crypto.randomUUID(), file, preview: /^image\/(jpeg|png|webp|avif)$/.test(file.type) ? URL.createObjectURL(file) : null, status: tooBig ? 'error' : 'pending', error: tooBig ? `Supera ${MAX_MB} MB` : null };
    });
    setItems((list) => [...list, ...accepted]);
    setTimeout(run, 0);
  };

  const retryAll = () => {
    setItems((list) => list.map((it) => (it.status === 'done' || (it.status === 'error' && it.file.size <= MAX_MB * 1024 * 1024) ? { ...it, status: 'pending', result: null, error: null } : it)));
    setTimeout(run, 0);
  };

  const downloadAll = async () => {
    const { zipSync } = await import('fflate');
    const files = {};
    for (const it of items.filter((i) => i.status === 'done')) files[it.filename] = new Uint8Array(await it.result.arrayBuffer());
    downloadBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), 'archivos-comprimidos.zip');
  };

  const done = items.filter((i) => i.status === 'done');
  const working = items.some((i) => i.status === 'pending' || i.status === 'working');
  const before = done.reduce((n, i) => n + i.file.size, 0);
  const after = done.reduce((n, i) => n + i.result.size, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Nivel de compresión">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            role="radio"
            aria-checked={level === l.id}
            onClick={() => setLevel(l.id)}
            className={`rounded-2xl px-4 py-2 text-left ${level === l.id ? 'bg-ink text-white' : 'bg-white shadow-toy hover:bg-blob-soft'}`}
          >
            <span className="block font-display font-semibold">{l.label}</span>
            <span className={`block text-xs ${level === l.id ? 'text-white/70' : 'text-ink/50'}`}>{l.hint}</span>
          </button>
        ))}
        {done.length > 0 && !working && (
          <button onClick={retryAll} className="btn btn-ghost px-4 text-sm self-center">
            Volver a comprimir con este nivel
          </button>
        )}
      </div>

      <DropZone
        accept={ACCEPT}
        multiple
        onFiles={add}
        disabled={items.length >= MAX_FILES}
        title="Arrastra tus fotos o PDF aquí"
        hint={`JPG, PNG, WEBP, HEIC y PDF · hasta ${MAX_MB} MB cada uno · hasta ${MAX_FILES} a la vez. Los archivos se borran al terminar.`}
      />
      <ErrorBox error={error} onClose={() => setError('')} />

      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-bold text-ink/60">
            {done.length} de {items.length} listos
            {done.length > 0 && before > after && (
              <span className="text-blob-deep"> · ahorraste {sizeLabel(before - after)} ({Math.round((1 - after / before) * 100)}%)</span>
            )}
            {working && <Loader2 className="inline w-4 h-4 animate-spin ml-2" />}
          </p>
          <div className="flex gap-2">
            <button onClick={downloadAll} disabled={!done.length} className="btn btn-red px-4 py-2 text-sm">
              <Archive className="w-4 h-4" /> Descargar todo (ZIP)
            </button>
            <button onClick={() => setItems([])} disabled={working} className="btn btn-ghost px-4 py-2 text-sm">
              Limpiar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map((it) => {
          const saved = it.status === 'done' ? 1 - it.result.size / it.file.size : 0;
          return (
            <Card key={it.id} className="!p-3 flex items-center gap-3">
              <span className="hex w-10 h-10 bg-cream shrink-0 inline-flex items-center justify-center">
                {it.preview ? (
                  <img src={it.preview} alt="" className="w-10 h-10 object-cover hex" />
                ) : (
                  <FileText className="w-5 h-5 text-ink/50" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{it.file.name}</p>
                <p className="text-xs text-ink/55">
                  {sizeLabel(it.file.size)}
                  {it.status === 'done' &&
                    (saved > 0.01 ? (
                      <>
                        {' → '}
                        <b className="text-ink">{sizeLabel(it.result.size)}</b> <span className="font-bold text-blob-deep">−{Math.round(saved * 100)}%</span>
                      </>
                    ) : (
                      ' · ya estaba optimizado'
                    ))}
                  {it.status === 'working' && ' · comprimiendo…'}
                  {it.status === 'pending' && ' · en espera…'}
                </p>
                {it.error && <p className="text-xs font-bold text-mouth">{it.error}</p>}
              </div>
              {it.status === 'working' && <Loader2 className="w-5 h-5 animate-spin text-ink/40" />}
              {it.status === 'error' && <AlertTriangle className="w-5 h-5 text-mouth" />}
              {it.status === 'done' && (
                <>
                  <Check className="w-4 h-4 text-blob-deep" aria-label="Listo" />
                  <button onClick={() => downloadBlob(it.result, it.filename)} className="btn btn-blue w-9 h-9" aria-label="Descargar">
                    <Download className="w-4 h-4" />
                  </button>
                </>
              )}
              {it.status !== 'working' && (
                <button onClick={() => setItems((l) => l.filter((x) => x.id !== it.id))} className="rounded-full p-2 text-ink/30 hover:text-mouth hover:bg-mouth/10" aria-label="Quitar">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
