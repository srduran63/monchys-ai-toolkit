import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Languages, Loader2, RotateCcw } from 'lucide-react';
import { tool } from '../api';
import { upload } from '../upload';
import { AiOffNotice, Card, DropZone, ErrorBox } from './ui';

const api = tool('traductor');
const ACCEPT = '.docx,.pdf,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

export default function TranslateTool({ preset }) {
  const [info, setInfo] = useState(null); // { ai, languages, maxChars }
  const [target, setTarget] = useState(preset ?? 'en');
  const [job, setJob] = useState(null); // { name, phase, progress, jobId }
  const [error, setError] = useState('');
  const poll = useRef(null);

  useEffect(() => {
    api.get().then(setInfo).catch((err) => setError(err.message));
    return () => clearTimeout(poll.current);
  }, []);

  const start = async ([file]) => {
    if (!file) return;
    setError('');
    setJob({ name: file.name, phase: 'upload', progress: 0 });
    try {
      const { jobId } = await upload('/api/tools/traductor/jobs', { target, file }, {
        onProgress: (p) => setJob((j) => ({ ...j, progress: p, phase: p >= 1 ? 'reading' : 'upload' })),
      });
      const check = async () => {
        try {
          const s = await api.get(`/jobs/${jobId}`);
          if (s.status === 'error') throw new Error(s.error);
          setJob((j) => ({ ...j, jobId, phase: s.status === 'done' ? 'done' : 'translating', progress: s.progress }));
          if (s.status !== 'done') poll.current = setTimeout(check, 2000);
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

  if (!info) return <p className="text-center font-bold text-ink/50">{error || 'Cargando…'}</p>;
  const outName = job ? `${job.name.replace(/\.[^.]+$/, '')}-${target}.${/\.(txt|md)$/i.test(job.name) ? job.name.split('.').pop() : 'docx'}` : '';

  return (
    <div className="max-w-2xl space-y-5">
      {!info.ai && <AiOffNotice />}
      <label className="flex flex-wrap items-center gap-3 font-display font-semibold text-lg">
        <Languages className="w-6 h-6 text-blob-deep" /> Traducir al
        <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={job && job.phase !== 'done'} className="rounded-full bg-white shadow-toy px-4 py-2 font-bold text-base">
          {Object.entries(info.languages).map(([id, name]) => (
            <option key={id} value={id}>
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </option>
          ))}
        </select>
      </label>

      {job ? (
        <Card className="text-center">
          {job.phase === 'done' ? (
            <>
              <FileText className="w-10 h-10 mx-auto text-blob-deep" />
              <p className="font-display font-semibold text-lg mt-3">¡Documento traducido!</p>
              <p className="text-sm text-ink/60 truncate">{outName}</p>
              <div className="flex flex-wrap justify-center gap-2 mt-5">
                <a href={`/api/tools/traductor/jobs/${job.jobId}/file`} download={outName} className="btn btn-red px-5 py-2.5">
                  <Download className="w-4 h-4" /> Descargar
                </a>
                <button onClick={() => setJob(null)} className="btn btn-ghost px-5 py-2.5">
                  <RotateCcw className="w-4 h-4" /> Traducir otro
                </button>
              </div>
              <p className="text-xs text-ink/45 mt-4">El documento traducido se borra del servidor en 1 hora.</p>
            </>
          ) : (
            <>
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-blob-deep" />
              <p className="font-display font-semibold mt-3 truncate">{job.name}</p>
              <p className="text-sm text-ink/60 mt-1">
                {job.phase === 'upload' && `Subiendo… ${Math.round(job.progress * 100)}%`}
                {job.phase === 'reading' && 'Leyendo el documento…'}
                {job.phase === 'translating' && `Traduciendo… ${Math.round(job.progress * 100)}%`}
              </p>
              <div className="h-2 bg-cream rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-data transition-[width]" style={{ width: `${Math.max(4, job.progress * 100)}%` }} />
              </div>
              <p className="text-xs text-ink/45 mt-3">Un documento de 10 páginas tarda alrededor de un minuto.</p>
            </>
          )}
        </Card>
      ) : (
        <DropZone
          accept={ACCEPT}
          onFiles={start}
          disabled={!info.ai}
          title="Sube tu documento"
          hint={`Word (.docx), PDF o texto · hasta ${info.maxChars.toLocaleString('es')} caracteres (unas 15 páginas). Los Word conservan su formato; los PDF se entregan como Word.`}
        />
      )}
      <ErrorBox error={error} onClose={() => setError('')} />
    </div>
  );
}
