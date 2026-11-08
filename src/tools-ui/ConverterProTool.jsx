import { useRef, useState } from 'react';
import { Archive, Check, Download, FileAudio, FileImage, FileVideo, Loader2, Play, Trash2, AlertTriangle } from 'lucide-react';
import { upload, downloadBlob, sizeLabel } from '../upload';
import { Card, DropZone, ErrorBox } from './ui';
import { PRO_FORMATS, PRO_MAX_FILES, PRO_MAX_MB, formatLabel } from '../../shared/constants.js';

const ICONS = { image: FileImage, audio: FileAudio, video: FileVideo };
const LABELS = { image: 'Imagen', audio: 'Audio', video: 'Video' };
const extOf = (name) => name.split('.').pop().toLowerCase();
const kindOf = (name) => Object.entries(PRO_FORMATS).find(([, f]) => f.inputs.includes(extOf(name)))?.[0] ?? null;
const ACCEPT = Object.values(PRO_FORMATS).flatMap((f) => f.inputs).map((e) => `.${e}`).join(',');
const suggest = (kind, name, preset) => {
  const ext = extOf(name).replace('jpeg', 'jpg');
  const outputs = PRO_FORMATS[kind].outputs;
  return preset && preset !== ext && outputs.includes(preset) ? preset : outputs.find((o) => o !== ext);
};

export default function ConverterProTool({ preset }) {
  const [items, setItems] = useState([]); // { id, file, kind, target, status, progress, result, filename, error }
  const [error, setError] = useState('');
  const running = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const update = (id, patch) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const add = (files) => {
    setError('');
    const room = PRO_MAX_FILES - items.length;
    const added = [];
    const rejected = [];
    for (const file of files.slice(0, room)) {
      const kind = kindOf(file.name);
      if (!kind) rejected.push(file.name);
      else
        added.push({
          id: crypto.randomUUID(),
          file,
          kind,
          target: suggest(kind, file.name, preset),
          status: file.size > PRO_MAX_MB * 1024 * 1024 ? 'error' : 'ready',
          error: file.size > PRO_MAX_MB * 1024 * 1024 ? 'Supera 2 GB' : null,
        });
    }
    if (rejected.length) setError(`Formato no soportado: ${rejected.slice(0, 3).join(', ')}${rejected.length > 3 ? '…' : ''}`);
    else if (files.length > room) setError(`Máximo ${PRO_MAX_FILES} archivos por lote.`);
    setItems((list) => [...list, ...added]);
  };

  const convertAll = async () => {
    if (running.current) return;
    running.current = true;
    setItems((list) => list.map((it) => (it.status === 'ready' ? { ...it, status: 'pending' } : it)));
    await new Promise((r) => setTimeout(r, 0));
    let next;
    while ((next = itemsRef.current.find((it) => it.status === 'pending'))) {
      const { id, file, target } = next;
      update(id, { status: 'uploading', progress: 0 });
      try {
        const { blob, filename } = await upload(
          '/api/tools/convert-pro',
          { target, file },
          { responseType: 'blob', onProgress: (p) => update(id, p >= 1 ? { status: 'converting', progress: 1 } : { progress: p }) }
        );
        update(id, { status: 'done', result: blob, filename: filename ?? `${file.name.replace(/\.[^.]+$/, '')}.${target}` });
      } catch (err) {
        update(id, { status: 'error', error: err.message });
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    running.current = false;
  };

  const downloadAll = async () => {
    const { zipSync } = await import('fflate');
    const files = {};
    for (const it of itemsRef.current.filter((i) => i.status === 'done')) {
      let name = it.filename;
      for (let n = 2; files[name]; n++) name = it.filename.replace(/(\.[^.]+)$/, ` (${n})$1`);
      files[name] = new Uint8Array(await it.result.arrayBuffer());
    }
    downloadBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), 'convertidos.zip');
  };

  const busy = items.some((i) => ['pending', 'uploading', 'converting'].includes(i.status));
  const ready = items.filter((i) => i.status === 'ready').length;
  const done = items.filter((i) => i.status === 'done').length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <DropZone
        accept={ACCEPT}
        multiple
        onFiles={add}
        disabled={items.length >= PRO_MAX_FILES}
        title="Arrastra tus archivos aquí"
        hint={`Imágenes, audio y video (MP4, MOV, MKV, AVI, WEBM…) · convierte, comprime o pasa a GIF · hasta 2 GB por archivo y ${PRO_MAX_FILES} a la vez.`}
      />
      <ErrorBox error={error} onClose={() => setError('')} />

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-bold text-ink/60">
              {items.length} archivos · {done} convertidos {busy && <Loader2 className="inline w-4 h-4 animate-spin ml-1" />}
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={convertAll} disabled={busy || !ready} className="btn btn-red px-4 py-2 text-sm">
                <Play className="w-4 h-4" /> Convertir {ready > 0 ? `(${ready})` : ''}
              </button>
              <button onClick={downloadAll} disabled={!done || busy} className="btn btn-blue px-4 py-2 text-sm">
                <Archive className="w-4 h-4" /> Descargar todo (ZIP)
              </button>
              <button onClick={() => setItems([])} disabled={busy} className="btn btn-ghost px-4 py-2 text-sm">
                Limpiar
              </button>
            </div>
          </div>

          <Card className="!p-2">
            <ul className="divide-y-2 divide-cream">
              {items.map((it) => {
                const Icon = ICONS[it.kind];
                return (
                  <li key={it.id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="hex w-10 h-10 bg-blob flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-40">
                      <p className="font-semibold text-sm truncate">{it.file.name}</p>
                      <p className="text-xs text-ink/50">
                        {LABELS[it.kind]} · {sizeLabel(it.file.size)}
                        {it.status === 'uploading' && ` · subiendo ${Math.round(it.progress * 100)}%`}
                        {it.status === 'converting' && ' · convirtiendo…'}
                        {it.status === 'pending' && ' · en espera'}
                        {it.error && <span className="text-mouth font-bold"> · {it.error}</span>}
                      </p>
                      {it.status === 'uploading' && (
                        <div className="h-1.5 bg-cream rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-data" style={{ width: `${it.progress * 100}%` }} />
                        </div>
                      )}
                    </div>
                    <label className="text-xs font-bold text-ink/50 flex items-center gap-1.5">
                      a
                      <select
                        value={it.target}
                        disabled={it.status !== 'ready' && it.status !== 'error'}
                        onChange={(e) => update(it.id, { target: e.target.value, status: 'ready', error: null })}
                        className="rounded-full bg-cream px-3 py-1.5 font-display font-semibold text-sm uppercase text-ink"
                      >
                        {PRO_FORMATS[it.kind].outputs.map((o) => (
                          <option key={o} value={o}>
                            {o === 'gif' && it.kind === 'video' ? 'GIF (15 s)' : formatLabel(o)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {it.status === 'done' ? (
                      <button onClick={() => downloadBlob(it.result, it.filename)} className="btn btn-blue w-9 h-9" aria-label="Descargar">
                        <Download className="w-4 h-4" />
                      </button>
                    ) : ['uploading', 'converting'].includes(it.status) ? (
                      <Loader2 className="w-5 h-5 animate-spin text-ink/40" />
                    ) : it.status === 'error' ? (
                      <AlertTriangle className="w-5 h-5 text-mouth" aria-label="Error" />
                    ) : (
                      <span className="w-9" />
                    )}
                    {it.status === 'done' && <Check className="w-4 h-4 text-blob-deep -ml-1" aria-label="Convertido" />}
                    <button
                      onClick={() => setItems((l) => l.filter((x) => x.id !== it.id))}
                      disabled={['uploading', 'converting'].includes(it.status)}
                      className="rounded-full p-2 text-ink/30 hover:text-mouth hover:bg-mouth/10 disabled:opacity-30"
                      aria-label="Quitar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
