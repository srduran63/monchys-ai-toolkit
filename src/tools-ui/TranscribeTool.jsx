import { useEffect, useRef, useState } from 'react';
import { Copy, Check, FileDown, Loader2, Sparkles, Trash2, Clock } from 'lucide-react';
import { tool } from '../api';
import { upload, downloadBlob } from '../upload';
import { AiOffNotice, Card, DropZone, ErrorBox, UsageMeter } from './ui';

const api = tool('transcribir');
const ACCEPT = 'audio/*,video/*,.mp3,.wav,.m4a,.ogg,.opus,.flac,.aac,.wma,.webm,.mp4,.mov';

const clock = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};
const srtTime = (s) => {
  const ms = Math.round((s % 1) * 1000);
  const t = Math.floor(s);
  return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};
const baseName = (name) => name.replace(/\.[^.]+$/, '');

export default function TranscribeTool() {
  const [state, setState] = useState(null); // { usage, ai, items }
  const [selected, setSelected] = useState(null);
  const [job, setJob] = useState(null); // { phase, progress, position, elapsed, name }
  const [language, setLanguage] = useState('es');
  const [error, setError] = useState('');
  const poll = useRef(null);

  const load = () => api.get().then(setState).catch((err) => setError(err.message));
  useEffect(() => {
    load();
    return () => clearTimeout(poll.current);
  }, []);

  const open = (id) => api.get(`/items/${id}`).then(setSelected).catch((err) => setError(err.message));

  const start = async ([file]) => {
    if (!file) return;
    setError('');
    setJob({ phase: 'upload', progress: 0, name: file.name });
    try {
      const { jobId } = await upload('/api/tools/transcribir/jobs', { language, file }, {
        onProgress: (p) => setJob((j) => ({ ...j, progress: p, phase: p >= 1 ? 'decode' : 'upload' })),
      });
      const check = async () => {
        try {
          const s = await api.get(`/jobs/${jobId}`);
          if (s.status === 'done') {
            setJob(null);
            await load();
            open(s.resultId);
            return;
          }
          if (s.status === 'error') throw new Error(s.error);
          setJob((j) => ({ ...j, phase: s.status, position: s.position, elapsed: s.elapsed, minutes: s.minutes }));
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
          Idioma del audio
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-full bg-white shadow-toy px-3 py-2 font-bold">
            <option value="es">Español</option>
            <option value="en">Inglés</option>
            <option value="auto">Detectar</option>
          </select>
        </label>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.6fr] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          {job ? (
            <Card className="text-center">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-blob-deep" />
              <p className="font-display font-semibold mt-3 truncate">{job.name}</p>
              <p className="text-sm text-ink/60 mt-1">
                {job.phase === 'upload' && `Subiendo… ${Math.round(job.progress * 100)}%`}
                {job.phase === 'decode' && 'Preparando el audio…'}
                {job.phase === 'queued' && `En cola${job.position ? ` (${job.position} por delante)` : ''}…`}
                {job.phase === 'processing' && `Transcribiendo ${clock((job.minutes ?? 0) * 60)} de audio… ${clock(job.elapsed ?? 0)}`}
              </p>
              {job.phase === 'upload' && (
                <div className="h-2 bg-cream rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-data" style={{ width: `${job.progress * 100}%` }} />
                </div>
              )}
              <p className="text-xs text-ink/45 mt-3">Puedes seguir usando la página. La primera transcripción tarda un poco más mientras se prepara el modelo.</p>
            </Card>
          ) : (
            <DropZone accept={ACCEPT} onFiles={start} title="Sube un audio o video" hint="MP3, WAV, M4A, OGG, FLAC, MP4… hasta 200 MB y 60 minutos por archivo." />
          )}
          <ErrorBox error={error} onClose={() => setError('')} />

          <Card>
            <h3 className="font-display font-semibold text-lg mb-2">Historial</h3>
            {state.items.length === 0 && <p className="text-sm font-bold text-ink/50">Aún no hay transcripciones.</p>}
            <ul className="space-y-1">
              {state.items.map((it) => (
                <li key={it.id}>
                  <button
                    onClick={() => open(it.id)}
                    className={`w-full text-left rounded-2xl px-3 py-2 transition-colors ${selected?.id === it.id ? 'bg-blob-soft' : 'hover:bg-cream'}`}
                  >
                    <p className="font-semibold text-sm truncate">{it.name}</p>
                    <p className="text-xs text-ink/50 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {clock(it.duration)} · {new Date(it.createdAt).toLocaleDateString('es')}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="min-w-0">
          {selected ? (
            <Transcript
              item={selected}
              ai={state.ai}
              onChange={setSelected}
              onDelete={async () => {
                await api.del(`/items/${selected.id}`);
                setSelected(null);
                load();
              }}
            />
          ) : (
            <Card className="text-center py-16">
              <p className="font-display font-semibold text-xl">Tu transcripción aparecerá aquí</p>
              <p className="text-ink/55 mt-1">Sube un archivo o elige uno del historial.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Transcript({ item, ai, onChange, onDelete }) {
  const [view, setView] = useState('text');
  const [copied, setCopied] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState('');

  const copy = async () => {
    await navigator.clipboard?.writeText(item.text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const exportTxt = () => downloadBlob(new Blob([item.text], { type: 'text/plain;charset=utf-8' }), `${baseName(item.name)}.txt`);
  const exportSrt = () => {
    const srt = item.segments.map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text}\n`).join('\n');
    downloadBlob(new Blob([srt], { type: 'application/x-subrip;charset=utf-8' }), `${baseName(item.name)}.srt`);
  };
  const exportDocx = async () => {
    const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx');
    const children = [new Paragraph({ text: baseName(item.name), heading: HeadingLevel.HEADING_1 })];
    if (item.summary) {
      children.push(new Paragraph({ text: 'Resumen', heading: HeadingLevel.HEADING_2 }));
      for (const line of item.summary.split('\n').filter(Boolean)) children.push(new Paragraph({ text: line }));
      children.push(new Paragraph({ text: 'Transcripción', heading: HeadingLevel.HEADING_2 }));
    }
    for (const s of item.segments.length ? item.segments : [{ start: 0, text: item.text }]) {
      children.push(new Paragraph({ children: [new TextRun({ text: `[${clock(s.start)}] `, color: '888888' }), new TextRun(s.text)] }));
    }
    const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
    downloadBlob(blob, `${baseName(item.name)}.docx`);
  };

  const summarize = async () => {
    setSummarizing(true);
    setError('');
    try {
      onChange(await api.post(`/items/${item.id}/summary`));
    } catch (err) {
      setError(err.message);
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-xl truncate">{item.name}</h3>
          <p className="text-xs text-ink/50">
            {clock(item.duration)} · {item.segments.length} {item.segments.length === 1 ? "fragmento" : "fragmentos"} · {new Date(item.createdAt).toLocaleString('es')}
          </p>
        </div>
        <button onClick={() => window.confirm('¿Borrar esta transcripción?') && onDelete()} className="rounded-full p-2 text-ink/40 hover:text-mouth hover:bg-mouth/10" aria-label="Borrar">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <button onClick={copy} className="btn btn-ghost px-3 py-1.5 text-sm">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiado' : 'Copiar'}
        </button>
        <button onClick={exportTxt} className="btn btn-ghost px-3 py-1.5 text-sm">
          <FileDown className="w-4 h-4" /> TXT
        </button>
        <button onClick={exportSrt} className="btn btn-ghost px-3 py-1.5 text-sm" disabled={!item.segments.length}>
          <FileDown className="w-4 h-4" /> SRT
        </button>
        <button onClick={exportDocx} className="btn btn-ghost px-3 py-1.5 text-sm">
          <FileDown className="w-4 h-4" /> Word
        </button>
      </div>

      {/* Summary */}
      <div className="mt-5">
        {item.summary ? (
          <div className="bg-blob-soft rounded-2xl p-4">
            <p className="text-xs font-extrabold uppercase tracking-wider text-blob-deep flex items-center gap-1.5 mb-2">
              <Sparkles className="w-4 h-4" /> Resumen con IA
            </p>
            <div className="text-sm whitespace-pre-line">{item.summary}</div>
          </div>
        ) : ai ? (
          <button onClick={summarize} disabled={summarizing} className="btn btn-blue px-4 py-2 text-sm">
            {summarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Resumir con IA
          </button>
        ) : (
          <AiOffNotice>El resumen automático usa IA y todavía no está activado en el servidor. La transcripción sí está completa.</AiOffNotice>
        )}
        <div className="mt-2">
          <ErrorBox error={error} />
        </div>
      </div>

      <div className="flex gap-1 bg-cream rounded-full p-1 w-fit mt-5">
        {[
          ['text', 'Texto'],
          ['segments', 'Con tiempos'],
        ].map(([id, text]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`rounded-full px-3 py-1 text-sm font-bold ${view === id ? 'bg-white shadow-toy' : 'text-ink/60'}`}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="mt-3 max-h-[520px] overflow-y-auto pr-1">
        {view === 'text' ? (
          <p className="whitespace-pre-line leading-relaxed">{item.text || '(Sin voz detectada)'}</p>
        ) : (
          <ul className="space-y-2">
            {item.segments.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="font-mono text-xs text-ink/45 shrink-0 pt-0.5 w-12">{clock(s.start)}</span>
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
