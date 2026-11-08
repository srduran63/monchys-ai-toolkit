import { useRef, useState } from 'react';
import { ArrowLeftRight, Check, Download, FileAudio, FileImage, FileVideo, RefreshCw, Upload, X } from 'lucide-react';
import { CONVERT_FORMATS, FREE_MAX_MB, FREE_VIDEO_MAX_MB, formatLabel } from '../shared/constants.js';

const KIND_ICON = { image: FileImage, audio: FileAudio, video: FileVideo };
const KIND_LABEL = { image: 'Imagen', audio: 'Audio', video: 'Video (se extrae el audio)' };

const extOf = (name) => name.split('.').pop().toLowerCase();
const kindOf = (name) =>
  Object.entries(CONVERT_FORMATS).find(([, f]) => f.inputs.includes(extOf(name)))?.[0] ?? null;
const sizeLabel = (bytes) => (bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const ACCEPT = Object.values(CONVERT_FORMATS)
  .flatMap((f) => f.inputs)
  .map((e) => `.${e}`)
  .join(',');

// Upload with progress; resolves to { blob, filename } or rejects with a readable message.
function convertRequest(file, target, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('target', target);
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/tools/convert');
    xhr.responseType = 'blob';
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new Error('No se pudo conectar con el servidor.'));
    xhr.onload = async () => {
      if (xhr.status === 200) {
        const disposition = xhr.getResponseHeader('Content-Disposition') ?? '';
        const match = disposition.match(/filename\*=UTF-8''([^;]+)/);
        resolve({ blob: xhr.response, filename: match ? decodeURIComponent(match[1]) : `archivo.${target}` });
      } else {
        const data = await xhr.response?.text().then(JSON.parse).catch(() => null);
        reject(new Error(data?.error ?? `Error ${xhr.status}`));
      }
    };
    xhr.send(form);
  });
}

// Free converter: images and audio, up to FREE_MAX_MB.
// preset: output format chosen by a landing page like "Convertir WEBP a JPG"
export default function ConverterTool({ preset }) {
  const [file, setFile] = useState(null);
  const [target, setTarget] = useState('');
  const [state, setState] = useState('IDLE'); // IDLE | UPLOADING | CONVERTING | DONE | ERROR
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null); // { url, filename, size }
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const kind = file ? kindOf(file.name) : null;

  const reset = () => {
    if (result) URL.revokeObjectURL(result.url);
    setFile(null);
    setTarget('');
    setState('IDLE');
    setResult(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const pick = (f) => {
    if (!f) return;
    reset();
    const k = kindOf(f.name);
    if (!k) {
      setError('Ese formato no está soportado todavía. Prueba con una imagen o un audio.');
      setState('ERROR');
      return;
    }
    const maxMb = k === 'video' ? FREE_VIDEO_MAX_MB : FREE_MAX_MB;
    if (f.size > maxMb * 1024 * 1024) {
      setError(`El archivo pesa ${sizeLabel(f.size)}. La versión gratuita admite hasta ${maxMb} MB${k === 'video' ? ' en videos: para videos más grandes usa el Convertidor Pro (hasta 2 GB)' : ''}.`);
      setState('ERROR');
      return;
    }
    setFile(f);
    // The landing page's format, or the first output that differs from the input format
    const ext = extOf(f.name).replace('jpeg', 'jpg');
    const outputs = CONVERT_FORMATS[k].outputs;
    setTarget(preset && preset !== ext && outputs.includes(preset) ? preset : outputs.find((o) => o !== ext));
  };

  const convert = async () => {
    setError('');
    setProgress(0);
    setState('UPLOADING');
    try {
      const { blob, filename } = await convertRequest(file, target, (p) => {
        setProgress(p);
        if (p >= 1) setState('CONVERTING');
      });
      setResult({ url: URL.createObjectURL(blob), filename, size: blob.size });
      setState('DONE');
    } catch (err) {
      setError(err.message);
      setState('ERROR');
    }
  };

  const busy = state === 'UPLOADING' || state === 'CONVERTING';
  const KindIcon = KIND_ICON[kind] ?? Upload;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-[2rem] shadow-toy-lg p-6 md:p-8">
        {!file && (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files[0]);
            }}
            className={`flex flex-col items-center justify-center text-center rounded-3xl border-3 border-dashed px-6 py-12 cursor-pointer transition-colors ${
              dragging ? 'border-mouth bg-mouth/5' : 'border-blob bg-blob-soft/40 hover:bg-blob-soft'
            }`}
          >
            <div className="hex w-16 h-16 bg-blob flex items-center justify-center mb-4">
              <Upload className="w-7 h-7" />
            </div>
            <p className="font-display font-semibold text-xl">Arrastra tu archivo aquí</p>
            <p className="text-sm text-ink/60 mt-1">o haz clic para elegirlo · hasta {FREE_MAX_MB} MB ({FREE_VIDEO_MAX_MB} MB en videos)</p>
            <p className="text-xs text-ink/45 mt-4 max-w-sm">
              Imágenes JPG, PNG, WEBP, AVIF, HEIC (iPhone) → también a PDF · Audio MP3, WAV, M4A, OGG, FLAC, OPUS · Video MP4,
              MOV → comprimir o MP3
            </p>
            <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files[0])} />
          </label>
        )}

        {file && (
          <div>
            <div className="flex items-center gap-4 bg-cream rounded-2xl p-4">
              <div className="hex w-12 h-12 bg-blob flex items-center justify-center shrink-0">
                <KindIcon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold truncate">{file.name}</p>
                <p className="text-xs text-ink/55">
                  {KIND_LABEL[kind]} · {extOf(file.name).toUpperCase()} · {sizeLabel(file.size)}
                </p>
              </div>
              {!busy && (
                <button onClick={reset} className="rounded-full p-2 hover:bg-white" aria-label="Quitar archivo">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {state !== 'DONE' && (
              <>
                <p className="text-xs font-extrabold uppercase tracking-wider text-ink/50 mt-6 mb-2 flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4" /> Convertir a
                </p>
                <div className="flex flex-wrap gap-2">
                  {CONVERT_FORMATS[kind].outputs.map((fmt) => (
                    <button
                      key={fmt}
                      disabled={busy}
                      onClick={() => setTarget(fmt)}
                      className={`rounded-full px-4 py-2 font-display font-semibold text-sm uppercase transition-colors ${
                        target === fmt ? 'bg-ink text-blob' : 'bg-cream hover:bg-blob-soft'
                      }`}
                    >
                      {formatLabel(fmt)}
                    </button>
                  ))}
                </div>

                <button onClick={convert} disabled={busy || !target} className="btn btn-red w-full py-4 text-lg mt-6">
                  {busy ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      {state === 'UPLOADING' ? `Subiendo… ${Math.round(progress * 100)}%` : 'Convirtiendo…'}
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="w-5 h-5" /> Convertir a {formatLabel(target)}
                    </>
                  )}
                </button>
                {state === 'UPLOADING' && (
                  <div className="h-2 bg-cream rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-blob transition-[width]" style={{ width: `${progress * 100}%` }} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {state === 'ERROR' && error && <p className="bg-mouth/10 text-mouth rounded-xl text-sm font-bold p-3 mt-4">{error}</p>}

        {state === 'DONE' && result && (
          <div className="mt-6 text-center animate-pop-in">
            <div className="hex mx-auto w-14 h-14 bg-blob flex items-center justify-center mb-3">
              <Check className="w-7 h-7" />
            </div>
            <p className="font-display font-bold text-2xl">¡Listo!</p>
            <p className="text-sm text-ink/60 mt-1 truncate">
              {result.filename} · {sizeLabel(result.size)}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <a href={result.url} download={result.filename} className="btn btn-red flex-1 py-3.5 text-lg">
                <Download className="w-5 h-5" /> Descargar
              </a>
              <button onClick={reset} className="btn btn-ghost px-6 py-3">
                Convertir otro
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-center text-ink/45 mt-4">Tus archivos se borran del servidor en cuanto termina la conversión.</p>
    </div>
  );
}
