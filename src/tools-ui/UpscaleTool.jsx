import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { tool } from '../api';
import { upload, downloadBlob } from '../upload';
import { Card, DropZone, ErrorBox, UsageMeter } from './ui';

const api = tool('mejorar-foto');
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/tiff';

const Toggle = ({ checked, onChange, title, hint }) => (
  <label className="flex items-start gap-3 bg-white rounded-2xl shadow-toy px-4 py-3 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 w-5 h-5 accent-[var(--color-mouth)]" />
    <span>
      <span className="block font-display font-semibold">{title}</span>
      <span className="block text-xs text-ink/55">{hint}</span>
    </span>
  </label>
);

export default function UpscaleTool() {
  const [usage, setUsage] = useState(null);
  const [upscale, setUpscale] = useState(true);
  const [enhance, setEnhance] = useState(true);
  const [job, setJob] = useState(null); // { name, original, phase, progress, result, width, height, upscaled }
  const [compare, setCompare] = useState(50);
  const [error, setError] = useState('');
  const poll = useRef(null);

  const refresh = () => api.get().then(setUsage).catch((err) => setError(err.message));
  useEffect(() => {
    refresh();
    return () => clearTimeout(poll.current);
  }, []);

  const start = async ([file]) => {
    if (!file) return;
    setError('');
    const original = URL.createObjectURL(file);
    setJob({ name: file.name, original, phase: 'upload', progress: 0 });
    try {
      const { jobId, upscaled } = await upload('/api/tools/mejorar-foto/jobs', { upscale: String(upscale), enhance: String(enhance), file }, {
        onProgress: (p) => setJob((j) => ({ ...j, progress: p })),
      });
      setJob((j) => ({ ...j, phase: 'queued', progress: 0, upscaled }));
      const check = async () => {
        try {
          const s = await api.get(`/jobs/${jobId}`);
          if (s.status === 'error') throw new Error(s.error);
          if (s.status === 'done') {
            const res = await fetch(`/api/tools/mejorar-foto/jobs/${jobId}/file`, { credentials: 'same-origin' });
            const blob = await res.blob();
            setJob((j) => ({ ...j, phase: 'done', result: { blob, url: URL.createObjectURL(blob) }, width: s.width, height: s.height }));
            refresh();
            return;
          }
          setJob((j) => ({ ...j, phase: s.status, progress: s.progress, position: s.position }));
          poll.current = setTimeout(check, 1500);
        } catch (err) {
          setJob(null);
          setError(err.message);
        }
      };
      check();
    } catch (err) {
      setJob(null);
      setError(err.message);
    }
  };

  const reset = () => {
    if (job?.original) URL.revokeObjectURL(job.original);
    if (job?.result) URL.revokeObjectURL(job.result.url);
    setJob(null);
    setCompare(50);
  };

  if (!usage) return <p className="text-center font-bold text-ink/50">{error || 'Cargando…'}</p>;
  const ext = job?.result?.blob.type === 'image/png' ? 'png' : 'jpg';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <UsageMeter used={usage.used} limit={usage.limit} unit="fotos" />
        <Toggle checked={upscale} onChange={setUpscale} title="Ampliar ×2 con IA" hint="Para fotos pequeñas o pixeladas (hasta 0,5 megapíxeles)" />
        <Toggle checked={enhance} onChange={setEnhance} title="Mejorar color y nitidez" hint="Contraste, color y enfoque automáticos" />
      </div>

      {!job && (
        <DropZone accept={ACCEPT} onFiles={start} disabled={!upscale && !enhance} title="Sube una foto" hint="JPG, PNG, WEBP o AVIF · hasta 15 MB. Las fotos grandes solo se mejoran, sin ampliar." />
      )}
      <ErrorBox error={error} onClose={() => setError('')} />

      {job && job.phase !== 'done' && (
        <Card className="text-center max-w-xl">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-blob-deep" />
          <p className="font-display font-semibold mt-3 truncate">{job.name}</p>
          <p className="text-sm text-ink/60 mt-1">
            {job.phase === 'upload' && `Subiendo… ${Math.round(job.progress * 100)}%`}
            {job.phase === 'queued' && `En cola${job.position ? ` (${job.position} por delante)` : ''}…`}
            {job.phase === 'processing' && (job.upscaled ? `Ampliando con IA… ${Math.round(job.progress * 100)}%` : 'Mejorando la foto…')}
          </p>
          <div className="h-2 bg-cream rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-data transition-[width]" style={{ width: `${Math.max(4, job.progress * 100)}%` }} />
          </div>
          {job.upscaled && <p className="text-xs text-ink/45 mt-3">Ampliar con IA tarda de 30 segundos a 2 minutos según el tamaño.</p>}
        </Card>
      )}

      {job?.phase === 'done' && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className="font-display font-semibold text-lg">¡Foto mejorada!</p>
              <p className="text-sm text-ink/55">
                {job.width} × {job.height} px{job.upscaled ? ' · ampliada ×2' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => downloadBlob(job.result.blob, `${job.name.replace(/\.[^.]+$/, '')}-mejorada.${ext}`)} className="btn btn-red px-4 py-2">
                <Download className="w-4 h-4" /> Descargar
              </button>
              <button onClick={reset} className="btn btn-ghost px-4 py-2">
                <RotateCcw className="w-4 h-4" /> Otra foto
              </button>
            </div>
          </div>
          {/* Before/after: drag the slider to compare */}
          <div className="relative rounded-2xl overflow-hidden bg-cream select-none">
            <img src={job.result.url} alt="Después" className="w-full max-h-[70vh] object-contain" />
            <img
              src={job.original}
              alt="Antes"
              className="absolute inset-0 w-full h-full object-contain"
              style={{ clipPath: `inset(0 ${100 - compare}% 0 0)`, imageRendering: 'pixelated' }}
            />
            <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${compare}%` }} />
            <span className="absolute top-2 left-2 text-xs font-bold bg-ink/70 text-white rounded-full px-2 py-0.5">Antes</span>
            <span className="absolute top-2 right-2 text-xs font-bold bg-mouth text-white rounded-full px-2 py-0.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Después
            </span>
          </div>
          <input type="range" min="0" max="100" value={compare} onChange={(e) => setCompare(Number(e.target.value))} className="w-full mt-3 accent-[var(--color-mouth)]" aria-label="Comparar antes y después" />
        </Card>
      )}
    </div>
  );
}
