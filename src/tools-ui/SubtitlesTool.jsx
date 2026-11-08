import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Download, Film, Loader2, Save, Trash2, Check } from 'lucide-react';
import { tool } from '../api';
import { upload, downloadBlob } from '../upload';
import { Card, DropZone, ErrorBox, UsageMeter } from './ui';
import { toSrt, toVtt } from '../../shared/subtitles.js';

const api = tool('subtitulos');
const ACCEPT = 'video/*,audio/*,.mp4,.mov,.m4v,.mkv,.webm,.avi,.mp3,.wav,.m4a';

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fine = (s) => `${clock(s)}.${Math.floor((s % 1) * 10)}`;
const baseName = (name) => name.replace(/\.[^.]+$/, '');

export default function SubtitlesTool() {
  const [state, setState] = useState(null); // { usage, items }
  const [item, setItem] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null); // local preview of the file just uploaded
  const [job, setJob] = useState(null);
  const [language, setLanguage] = useState('es');
  const [error, setError] = useState('');
  const poll = useRef(null);
  const localFor = useRef(null); // { itemId, url }

  const load = () => api.get().then(setState).catch((err) => setError(err.message));
  useEffect(() => {
    load();
    return () => clearTimeout(poll.current);
  }, []);

  const open = async (id) => {
    try {
      const it = await api.get(`/items/${id}`);
      setItem(it);
      setVideoUrl(localFor.current?.itemId === id ? localFor.current.url : null);
    } catch (err) {
      setError(err.message);
    }
  };

  const start = async ([file]) => {
    if (!file) return;
    setError('');
    setJob({ phase: 'upload', progress: 0, name: file.name });
    try {
      const { jobId } = await upload('/api/tools/subtitulos/jobs', { language, file }, {
        onProgress: (p) => setJob((j) => ({ ...j, progress: p, phase: p >= 1 ? 'decode' : 'upload' })),
      });
      const check = async () => {
        try {
          const s = await api.get(`/jobs/${jobId}`);
          if (s.status === 'done') {
            setJob(null);
            localFor.current = { itemId: s.resultId, url: URL.createObjectURL(file) };
            await load();
            open(s.resultId);
            return;
          }
          if (s.status === 'error') throw new Error(s.error);
          setJob((j) => ({ ...j, phase: s.status, position: s.position, elapsed: s.elapsed }));
          poll.current = setTimeout(check, 2000);
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

  if (!state) return <p className="text-center font-bold text-ink/50">{error || 'Cargando…'}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <UsageMeter used={state.usage.used} limit={state.usage.limit} unit="min" />
        <label className="text-sm font-bold flex items-center gap-2">
          Idioma del video
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-full bg-white shadow-toy px-3 py-2 font-bold">
            <option value="es">Español</option>
            <option value="en">Inglés</option>
            <option value="auto">Detectar</option>
          </select>
        </label>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.8fr] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          {job ? (
            <Card className="text-center">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-blob-deep" />
              <p className="font-display font-semibold mt-3 truncate">{job.name}</p>
              <p className="text-sm text-ink/60 mt-1">
                {job.phase === 'upload' && `Subiendo… ${Math.round(job.progress * 100)}%`}
                {job.phase === 'decode' && 'Extrayendo el audio…'}
                {job.phase === 'queued' && `En cola${job.position ? ` (${job.position} por delante)` : ''}…`}
                {job.phase === 'processing' && `Escuchando el video y escribiendo los subtítulos… ${clock(job.elapsed ?? 0)}`}
              </p>
              {job.phase === 'upload' && (
                <div className="h-2 bg-cream rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-data" style={{ width: `${job.progress * 100}%` }} />
                </div>
              )}
              <p className="text-xs text-ink/45 mt-3">Tarda aproximadamente la mitad de lo que dura el video.</p>
            </Card>
          ) : (
            <DropZone accept={ACCEPT} onFiles={start} title="Sube tu video" hint="MP4, MOV, MKV, WEBM… hasta 500 MB y 30 minutos. También sirve un audio." />
          )}
          <ErrorBox error={error} onClose={() => setError('')} />

          <Card>
            <h3 className="font-display font-semibold text-lg mb-2">Tus subtítulos</h3>
            {state.items.length === 0 && <p className="text-sm font-bold text-ink/50">Aún no has subido ningún video.</p>}
            <ul className="space-y-1">
              {state.items.map((it) => (
                <li key={it.id}>
                  <button onClick={() => open(it.id)} className={`w-full text-left rounded-2xl px-3 py-2 ${item?.id === it.id ? 'bg-blob-soft' : 'hover:bg-cream'}`}>
                    <p className="font-semibold text-sm truncate">{it.name}</p>
                    <p className="text-xs text-ink/50 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {clock(it.duration)} · {it.cues} subtítulos · {new Date(it.createdAt).toLocaleDateString('es')}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="min-w-0">
          {item ? (
            <Editor
              key={item.id}
              item={item}
              videoUrl={videoUrl}
              onSaved={setItem}
              onDelete={async () => {
                await api.del(`/items/${item.id}`);
                setItem(null);
                load();
              }}
            />
          ) : (
            <Card className="text-center py-14">
              <Film className="w-10 h-10 mx-auto text-ink/30" />
              <p className="font-display font-semibold text-lg mt-3">Tus subtítulos aparecerán aquí</p>
              <p className="text-sm text-ink/55 mt-1">Podrás corregirlos, descargarlos o crear el video con los subtítulos puestos.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Editor({ item, videoUrl, onSaved, onDelete }) {
  const [segments, setSegments] = useState(item.segments);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(-1);
  const [burnState, setBurnState] = useState(null); // { status, jobId, error }
  const [size, setSize] = useState('m');
  const [position, setPosition] = useState('bottom');
  const [error, setError] = useState('');
  const video = useRef(null);
  const poll = useRef(null);
  useEffect(() => () => clearTimeout(poll.current), []);

  // Live preview: the edited cues as a WebVTT track over the local video
  const trackUrl = useMemo(() => URL.createObjectURL(new Blob([toVtt(segments)], { type: 'text/vtt' })), [segments]);
  useEffect(() => () => URL.revokeObjectURL(trackUrl), [trackUrl]);
  useEffect(() => {
    const t = video.current?.textTracks?.[0];
    if (t) t.mode = 'showing';
  }, [trackUrl]);

  const edit = (i, text) => {
    setSegments((list) => list.map((s, j) => (j === i ? { ...s, text } : s)));
    setDirty(true);
  };
  const remove = (i) => {
    setSegments((list) => list.filter((_, j) => j !== i));
    setDirty(true);
  };
  const seek = (s) => {
    if (!video.current) return;
    video.current.currentTime = s.start + 0.01;
    video.current.play().catch(() => {});
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const saved = await api.put(`/items/${item.id}`, { segments: segments.filter((s) => s.text.trim()) });
      setSegments(saved.segments);
      setDirty(false);
      onSaved(saved);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const burn = async () => {
    setError('');
    if (dirty && !(await save())) return;
    try {
      const { jobId } = await api.post(`/items/${item.id}/burn`, { size, position });
      setBurnState({ status: 'processing', jobId });
      const check = async () => {
        try {
          const s = await api.get(`/jobs/${jobId}`);
          if (s.status === 'error') throw new Error(s.error);
          if (s.status === 'done') return setBurnState({ status: 'done', jobId });
          setBurnState({ status: 'processing', jobId, elapsed: s.elapsed });
          poll.current = setTimeout(check, 3000);
        } catch (err) {
          setBurnState(null);
          setError(err.message);
        }
      };
      poll.current = setTimeout(check, 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  const name = baseName(item.name);
  const clean = () => segments.filter((s) => s.text.trim());

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-lg truncate">{item.name}</h3>
            <p className="text-xs text-ink/50">{segments.length} subtítulos · {clock(item.duration)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={save} disabled={!dirty || saving} className="btn btn-blue px-3 py-2 text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : dirty ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              {dirty ? 'Guardar cambios' : 'Guardado'}
            </button>
            <button onClick={() => downloadBlob(new Blob([toSrt(clean())], { type: 'text/plain' }), `${name}.srt`)} className="btn btn-ghost px-3 py-2 text-sm">
              <Download className="w-4 h-4" /> SRT
            </button>
            <button onClick={() => downloadBlob(new Blob([toVtt(clean())], { type: 'text/vtt' }), `${name}.vtt`)} className="btn btn-ghost px-3 py-2 text-sm">
              <Download className="w-4 h-4" /> VTT
            </button>
            <button onClick={onDelete} className="rounded-full p-2 text-ink/30 hover:text-mouth hover:bg-mouth/10" aria-label="Borrar">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {videoUrl && (
          <video
            ref={video}
            src={videoUrl}
            controls
            playsInline
            className="w-full max-h-96 rounded-2xl bg-ink mt-4"
            onTimeUpdate={(e) => setCurrent(segments.findIndex((s) => e.target.currentTime >= s.start && e.target.currentTime < s.end))}
          >
            <track key={trackUrl} kind="subtitles" src={trackUrl} srcLang={item.language === 'en' ? 'en' : 'es'} label="Subtítulos" default />
          </video>
        )}
        <ErrorBox error={error} onClose={() => setError('')} />
      </Card>

      {item.isVideo && (
        <Card>
          <h3 className="font-display font-semibold text-lg">Video con subtítulos incrustados</h3>
          <p className="text-sm text-ink/60 mt-1">Para Instagram, TikTok o WhatsApp, donde los subtítulos tienen que ir dentro del video.</p>
          {item.videoAvailable ? (
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <select value={size} onChange={(e) => setSize(e.target.value)} className="rounded-full bg-cream px-3 py-2 font-bold text-sm" aria-label="Tamaño de letra">
                <option value="s">Letra pequeña</option>
                <option value="m">Letra mediana</option>
                <option value="l">Letra grande</option>
              </select>
              <select value={position} onChange={(e) => setPosition(e.target.value)} className="rounded-full bg-cream px-3 py-2 font-bold text-sm" aria-label="Posición">
                <option value="bottom">Abajo</option>
                <option value="top">Arriba</option>
              </select>
              {burnState?.status === 'done' ? (
                <a href={`/api/tools/subtitulos/jobs/${burnState.jobId}/video`} className="btn btn-red px-4 py-2 text-sm">
                  <Download className="w-4 h-4" /> Descargar video
                </a>
              ) : (
                <button onClick={burn} disabled={burnState?.status === 'processing'} className="btn btn-red px-4 py-2 text-sm">
                  {burnState?.status === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
                  {burnState?.status === 'processing' ? `Creando el video… ${clock(burnState.elapsed ?? 0)}` : 'Crear video'}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm font-bold text-ink/50 mt-3">El video original se guarda solo 1 hora. Súbelo de nuevo para crear el video con subtítulos.</p>
          )}
        </Card>
      )}

      <Card className="!p-3">
        <ol className="max-h-[32rem] overflow-y-auto divide-y-2 divide-cream">
          {segments.map((s, i) => (
            <li key={i} className={`flex items-start gap-2 p-2 rounded-xl ${i === current ? 'bg-blob-soft' : ''}`}>
              <button onClick={() => seek(s)} disabled={!videoUrl} className="text-xs font-mono font-bold text-blob-deep pt-2.5 w-16 shrink-0 text-left disabled:text-ink/40" title="Ir a este momento">
                {fine(s.start)}
              </button>
              <textarea
                value={s.text}
                onChange={(e) => edit(i, e.target.value)}
                rows={s.text.length > 50 ? 2 : 1}
                className="flex-1 min-w-0 resize-none rounded-xl border-2 border-transparent bg-transparent px-2 py-1.5 text-sm hover:bg-cream focus:bg-white focus:border-blob focus:outline-none"
                aria-label={`Subtítulo ${i + 1}`}
              />
              <button onClick={() => remove(i)} className="rounded-full p-2 text-ink/25 hover:text-mouth" aria-label="Quitar subtítulo">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
