import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Download, Loader2, Trash2 } from 'lucide-react';
import { tool } from '../api';
import { downloadBlob } from '../upload';
import { Card, ErrorBox, UsageMeter, label } from './ui';

const api = tool('videos');
const MAX_PROMPT = 600;
const RATIOS = [
  { id: '16:9', label: 'Horizontal', hint: 'YouTube', w: 16, h: 9 },
  { id: '9:16', label: 'Vertical', hint: 'TikTok, Reels', w: 9, h: 16 },
];
const EXAMPLES = [
  'Olas del mar rompiendo en una playa al atardecer, cámara lenta',
  'Una taza de café humeante sobre una mesa, la cámara se acerca despacio',
  'Un zorro corriendo por un bosque nevado, estilo cine',
  'Luces de neón de una ciudad de noche bajo la lluvia',
];

async function fetchVideo(jobId) {
  const res = await fetch(`/api/tools/videos/jobs/${jobId}/file`, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('El video ya no está disponible.');
  return res.blob();
}

export default function VideoGenTool() {
  const [usage, setUsage] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('9:16');
  const [job, setJob] = useState(null); // { id, prompt, ratio, started }
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [videos, setVideos] = useState([]); // { id, url, blob, prompt, ratio }
  const alive = useRef(true);

  const refresh = () => api.get().then(setUsage).catch(() => {});
  useEffect(() => {
    refresh();
    return () => {
      alive.current = false;
    };
  }, []);

  // Poll the job every 3 s until the video is ready
  useEffect(() => {
    if (!job) return;
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - job.started) / 1000)), 1000);
    const poll = setInterval(async () => {
      try {
        const s = await api.get(`/jobs/${job.id}`);
        if (s.status === 'processing') return;
        clearInterval(poll);
        if (s.status === 'error') throw new Error(s.error);
        const blob = await fetchVideo(job.id);
        if (!alive.current) return;
        setVideos((list) => [{ id: job.id, url: URL.createObjectURL(blob), blob, prompt: job.prompt, ratio: job.ratio }, ...list]);
        setJob(null);
        refresh();
      } catch (err) {
        clearInterval(poll);
        setError(err.message);
        setJob(null);
        refresh();
      }
    }, 3000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [job]);

  const start = async () => {
    const text = prompt.trim();
    if (job || text.length < 3) return;
    setError('');
    try {
      const { jobId } = await api.post('/jobs', { prompt: text, ratio });
      setElapsed(0);
      setJob({ id: jobId, prompt: text, ratio, started: Date.now() });
    } catch (err) {
      setError(err.message);
    }
  };

  if (usage && !usage.available) {
    return <p className="bg-cream rounded-xl text-sm font-bold text-ink/60 p-4">El generador de videos se está activando. Vuelve pronto.</p>;
  }
  const limitReached = usage && usage.used >= usage.limit;
  const shape = (id) => RATIOS.find((r) => r.id === id);
  const fileName = (v) =>
    `${v.prompt
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40)
      .replace(/^-|-$/g, '') || 'video'}.mp4`;

  return (
    <div className="space-y-6">
      {usage && <UsageMeter used={usage.used} limit={usage.limit} unit="videos" />}

      <Card>
        <label htmlFor="video-prompt" className={label}>
          Describe la escena
        </label>
        <textarea
          id="video-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT))}
          rows={3}
          placeholder="Ej.: un globo aerostático volando sobre montañas al amanecer, la cámara lo sigue"
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
                {r.label} <span className="font-semibold opacity-60">· {r.hint}</span>
              </button>
            ))}
          </div>
          <button onClick={start} disabled={Boolean(job) || prompt.trim().length < 3 || limitReached} className="btn btn-red px-6 py-3">
            {job ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clapperboard className="w-5 h-5" />}
            {job ? 'Creando…' : 'Generar video'}
          </button>
        </div>
        <p className="text-xs text-ink/50 mt-3">Videos de unos 5 segundos en HD. Escribe en español: lo traducimos para la IA. Cada video tarda alrededor de un minuto.</p>
      </Card>

      <ErrorBox error={error} onClose={() => setError('')} />

      {(job || videos.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4 items-start">
          {job && (
            <div
              className="bg-white rounded-[2rem] shadow-toy flex flex-col items-center justify-center gap-2 text-ink/50 font-bold text-center p-6 max-h-[70vh] mx-auto w-full"
              style={{ aspectRatio: `${shape(job.ratio).w} / ${shape(job.ratio).h}` }}
            >
              <Loader2 className="w-8 h-8 animate-spin" />
              Creando tu video… {elapsed}s
              <span className="text-xs font-semibold">Puedes seguir en esta página mientras tanto.</span>
            </div>
          )}
          {videos.map((v) => (
            <Card key={v.id} className="!p-3">
              <video src={v.url} controls loop playsInline autoPlay muted className="w-full max-h-[70vh] rounded-xl bg-ink" />
              <div className="flex items-center gap-2 mt-3">
                <p className="flex-1 min-w-0 text-sm font-semibold line-clamp-2">{v.prompt}</p>
                <button onClick={() => downloadBlob(v.blob, fileName(v))} className="btn btn-blue w-9 h-9 shrink-0" aria-label="Descargar">
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setVideos((l) => l.filter((x) => x.id !== v.id))}
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
