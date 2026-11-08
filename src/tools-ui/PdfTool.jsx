import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Send, Sparkles, Trash2, Eraser } from 'lucide-react';
import { tool } from '../api';
import { upload } from '../upload';
import { AiOffNotice, Card, DropZone, ErrorBox } from './ui';

const api = tool('pdf');

export default function PdfTool() {
  const [state, setState] = useState(null); // { ai, docs }
  const [doc, setDoc] = useState(null);
  const [uploading, setUploading] = useState(null); // { name, progress }
  const [error, setError] = useState('');

  const load = () => api.get().then(setState).catch((err) => setError(err.message));
  useEffect(() => {
    load();
  }, []);

  const open = (id) => api.get(`/${id}`).then(setDoc).catch((err) => setError(err.message));

  const add = async ([file]) => {
    if (!file) return;
    setError('');
    setUploading({ name: file.name, progress: 0 });
    try {
      const created = await upload('/api/tools/pdf', { file }, { onProgress: (p) => setUploading((u) => ({ ...u, progress: p })) });
      setDoc(created);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(null);
    }
  };

  if (!state) return <p className="text-center font-bold text-ink/50">{error || 'Cargando…'}</p>;

  return (
    <div className="grid lg:grid-cols-[1fr_1.7fr] gap-6 items-start">
      <div className="space-y-4 min-w-0">
        {uploading ? (
          <Card className="text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-blob-deep" />
            <p className="font-display font-semibold mt-3 truncate">{uploading.name}</p>
            <p className="text-sm text-ink/60 mt-1">
              {uploading.progress < 1 ? `Subiendo… ${Math.round(uploading.progress * 100)}%` : 'Leyendo y resumiendo el documento…'}
            </p>
          </Card>
        ) : (
          <DropZone
            accept="application/pdf,.pdf"
            onFiles={add}
            title="Sube un PDF"
            hint={`Hasta 300 páginas y 32 MB. Resumen y preguntas con IA en documentos de hasta ${state.aiMaxPages} páginas.`}
          />
        )}
        <ErrorBox error={error} onClose={() => setError('')} />
        {!state.ai && (
          <AiOffNotice>
            Ahora mismo el resumen se hace automáticamente con las frases más importantes del texto. Las preguntas al
            documento y los PDF escaneados necesitan IA.
          </AiOffNotice>
        )}

        <Card>
          <h3 className="font-display font-semibold text-lg mb-2">Tus documentos</h3>
          {state.docs.length === 0 && <p className="text-sm font-bold text-ink/50">Aún no has subido ningún PDF.</p>}
          <ul className="space-y-1">
            {state.docs.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => open(d.id)}
                  className={`w-full text-left rounded-2xl px-3 py-2 flex items-center gap-3 transition-colors ${doc?.id === d.id ? 'bg-blob-soft' : 'hover:bg-cream'}`}
                >
                  <FileText className="w-5 h-5 shrink-0 text-ink/50" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-sm truncate">{d.name}</span>
                    <span className="block text-xs text-ink/50">
                      {d.pages} págs · {new Date(d.createdAt).toLocaleDateString('es')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="min-w-0">
        {doc ? (
          <DocView
            doc={doc}
            ai={state.ai}
            aiMaxPages={state.aiMaxPages}
            onChange={setDoc}
            onDelete={async () => {
              await api.del(`/${doc.id}`);
              setDoc(null);
              load();
            }}
          />
        ) : (
          <Card className="text-center py-16">
            <p className="font-display font-semibold text-xl">El resumen aparecerá aquí</p>
            <p className="text-ink/55 mt-1">Sube un PDF o elige uno de tu lista.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Summary({ text }) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return (
    <div className="space-y-2">
      {lines.map((line, i) =>
        /^[-•*]\s/.test(line) ? (
          <p key={i} className="flex gap-2 text-sm">
            <span className="text-blob-deep font-bold">•</span>
            <span>{line.replace(/^[-•*]\s+/, '').replace(/\*\*/g, '')}</span>
          </p>
        ) : (
          <p key={i} className="text-sm font-semibold">
            {line.replace(/\*\*/g, '').replace(/^#+\s*/, '')}
          </p>
        )
      )}
    </div>
  );
}

function DocView({ doc, ai, aiMaxPages, onChange, onDelete }) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const chatRef = useRef(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [doc.chat.length, busy]);

  const ask = async (e) => {
    e.preventDefault();
    if (!question.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      onChange(await api.post(`/${doc.id}/ask`, { question }));
      setQuestion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-xl truncate">{doc.name}</h3>
            <p className="text-xs text-ink/50">{doc.pages} páginas</p>
          </div>
          <button onClick={() => window.confirm('¿Borrar este documento?') && onDelete()} className="rounded-full p-2 text-ink/40 hover:text-mouth hover:bg-mouth/10" aria-label="Borrar documento">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs font-extrabold uppercase tracking-wider text-blob-deep flex items-center gap-1.5 mt-4 mb-2">
          {doc.summaryKind === 'ai' ? (
            <>
              <Sparkles className="w-4 h-4" /> Resumen con IA
            </>
          ) : (
            'Resumen automático · frases clave del documento'
          )}
        </p>
        <Summary text={doc.summary} />
        {doc.keyTerms?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {doc.keyTerms.map((t) => (
              <span key={t} className="text-xs font-bold bg-cream rounded-full px-2.5 py-1 text-ink/70">
                {t}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-lg">Pregúntale al documento</h3>
          {doc.chat.length > 0 && (
            <button onClick={() => api.del(`/${doc.id}/chat`).then(onChange)} className="text-xs font-bold text-ink/50 hover:text-mouth flex items-center gap-1">
              <Eraser className="w-3.5 h-3.5" /> Borrar chat
            </button>
          )}
        </div>
        {!doc.aiAllowed ? (
          <AiOffNotice>Las preguntas con IA están disponibles para documentos de hasta {aiMaxPages} páginas. Este tiene {doc.pages}.</AiOffNotice>
        ) : !ai ? (
          <AiOffNotice>Las preguntas al documento usan IA, que no está disponible ahora mismo.</AiOffNotice>
        ) : (
          <>
            <div ref={chatRef} className="max-h-96 overflow-y-auto space-y-3 mb-3">
              {doc.chat.length === 0 && <p className="text-sm text-ink/50">Ejemplo: "¿Cuáles son las conclusiones?" o "¿Qué fechas importantes menciona?"</p>}
              {doc.chat.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : ''}`}>
                  <p className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line ${m.role === 'user' ? 'bg-ink text-white rounded-br-md' : 'bg-cream rounded-bl-md'}`}>
                    {m.content}
                  </p>
                </div>
              ))}
              {busy && <Loader2 className="w-5 h-5 animate-spin text-ink/40" />}
            </div>
            <form onSubmit={ask} className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={1000}
                placeholder="Escribe tu pregunta…"
                className="flex-1 rounded-full bg-cream px-4 py-2.5 font-semibold focus:outline-none focus:ring-4 focus:ring-blob/40"
              />
              <button disabled={busy || !question.trim()} className="btn btn-red w-11 h-11" aria-label="Preguntar">
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="mt-2">
              <ErrorBox error={error} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
