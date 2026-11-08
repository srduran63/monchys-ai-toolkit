import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Download, File, FileText, Film, Image as ImageIcon, Maximize2, MessageCircle, Music, Paperclip, RefreshCw, Send, X } from 'lucide-react';
import Mascot from './Mascot';
import HelpPanel from './HelpPanel';
import { api, assistantApi } from './api';
import { getIcon, money, perLabel } from './icons';
import { QUICK_TASKS } from './catalog';

const STORE_KEY = 'monchys-chat-v2';
const TEASER_KEY = 'monchys-chat-teaser';
const GREETING = {
  role: 'assistant',
  content: '¡Hola! Soy Monchys 👋 Pregúntame lo que quieras o adjunta un archivo con el clip 📎 y dime qué hago: comprimir, convertir, unir o separar PDF… ¡Me lo como gratis!',
};
const QUICK_REPLIES = ['¡Ñam, fácil! Esta es la tuya:', '¡Buena elección! Aquí la tienes:', '¡A comer archivos! Prueba esta:'];
const MAX_MB = 50;
const MAX_ATTACHMENTS = 5;

const storage = {
  get(key) {
    try {
      return JSON.parse(sessionStorage.getItem(key));
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode: the chat just won't survive a reload */
    }
  },
};

const linkFor = (p) => p.toolUrl || '/#planes';
const sizeLabel = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'pdf' || ext === 'docx' || ext === 'txt') return FileText;
  if (/^(jpe?g|png|webp|avif|gif|heic|heif|tiff?)$/.test(ext)) return ImageIcon;
  if (/^(mp4|mov|m4v|avi|mkv|webm|3gp|wmv)$/.test(ext)) return Film;
  if (/^(mp3|wav|ogg|oga|m4a|aac|flac|opus|wma)$/.test(ext)) return Music;
  return File;
}

function ToolSuggestion({ product }) {
  const Icon = getIcon(product.icon);
  return (
    <a
      href={linkFor(product)}
      className="flex items-center gap-3 bg-white rounded-2xl p-3 shadow-toy hover:-translate-y-0.5 transition-transform group"
    >
      <span className="hex w-10 h-10 bg-blob-soft text-blob-deep grid place-items-center shrink-0">
        <Icon className="w-5 h-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-sm leading-tight">{product.name}</span>
        <span className="block text-xs text-ink/55 font-semibold">
          {money(product.price)}
          {perLabel(product)}
          {product.period === 'once' && product.price > 0 ? ' · pago único' : ''}
        </span>
      </span>
      <ArrowRight className="w-4 h-4 text-ink/40 group-hover:text-mouth shrink-0" />
    </a>
  );
}

// A file sent by the visitor (inside their bubble)
function SentFile({ file }) {
  const Icon = fileIcon(file.name);
  return (
    <span className="flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 text-sm font-semibold">
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{file.name}</span>
      <span className="opacity-70 shrink-0">{sizeLabel(file.size)}</span>
    </span>
  );
}

// A file Monchys made: download card
function ResultFile({ file }) {
  const Icon = fileIcon(file.name);
  return (
    <a href={file.url} download={file.name} className="flex items-center gap-3 bg-white rounded-2xl p-3 shadow-toy hover:-translate-y-0.5 transition-transform group">
      <span className="w-10 h-10 rounded-xl bg-blob-soft text-blob-deep grid place-items-center shrink-0">
        <Icon className="w-5 h-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-sm leading-tight truncate">{file.name}</span>
        <span className="block text-xs text-ink/55 font-semibold">{sizeLabel(file.size)} · disponible 1 hora</span>
      </span>
      <span className="btn btn-red px-3 py-2 text-xs shrink-0">
        <Download className="w-4 h-4" /> Descargar
      </span>
    </a>
  );
}

function Bubble({ message, products }) {
  const mine = message.role === 'user';
  const tools = (message.tools ?? []).map((id) => products.find((p) => p.id === id)).filter(Boolean);
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] min-w-0 space-y-2 ${mine ? 'items-end' : ''}`}>
        {(message.content || (mine && message.files?.length > 0)) && (
          <div
            className={`px-4 py-2.5 rounded-3xl text-[15px] leading-snug whitespace-pre-line break-words space-y-1.5 ${
              mine ? 'bg-blob-deep text-white rounded-br-md' : 'bg-white text-ink shadow-toy rounded-bl-md'
            }`}
          >
            {message.content && <p>{message.content}</p>}
            {mine && message.files?.map((f) => <SentFile key={f.id} file={f} />)}
          </div>
        )}
        {message.crisis && <HelpPanel prominent />}
        {!mine && message.files?.map((f) => <ResultFile key={f.id} file={f} />)}
        {tools.map((p) => (
          <ToolSuggestion key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}

// Files picked but not sent yet: upload starts right away
function Attachment({ item, onRemove }) {
  const Icon = fileIcon(item.name);
  return (
    <span
      className={`relative overflow-hidden flex items-center gap-2 rounded-full pl-3 pr-1 py-1 text-xs font-bold max-w-[14rem] ${
        item.error ? 'bg-mouth/10 text-mouth' : 'bg-blob-soft text-blob-deep'
      }`}
      title={item.error || item.name}
    >
      {item.progress < 1 && !item.error && <span className="absolute inset-y-0 left-0 bg-blob/30" style={{ width: `${item.progress * 100}%` }} />}
      <Icon className="relative w-4 h-4 shrink-0" />
      <span className="relative truncate">{item.error || item.name}</span>
      <button type="button" onClick={onRemove} className="relative w-6 h-6 grid place-items-center rounded-full hover:bg-white/70 shrink-0" aria-label={`Quitar ${item.name}`}>
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

// The conversation: floating panel in the corner (variant "panel") or the /chat page (variant "page")
export function ChatView({ variant = 'panel', onClose }) {
  const [messages, setMessages] = useState(() => storage.get(STORE_KEY) ?? [GREETING]);
  const [products, setProducts] = useState([]);
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const page = variant === 'page';

  useEffect(() => {
    api.products().then(setProducts).catch(() => {});
    inputRef.current?.focus();
    if (!onClose) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    storage.set(STORE_KEY, messages);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const update = (key, patch) => setAttachments((list) => list.map((a) => (a.key === key ? { ...a, ...patch } : a)));

  const addFiles = (fileList) => {
    setError('');
    const picked = [...fileList].slice(0, MAX_ATTACHMENTS - attachments.length);
    if (fileList.length > picked.length) setError(`Puedes adjuntar hasta ${MAX_ATTACHMENTS} archivos por mensaje.`);
    for (const file of picked) {
      const key = `${Date.now()}-${Math.random()}`;
      const item = { key, name: file.name, size: file.size, progress: 0 };
      if (file.size > MAX_MB * 1024 * 1024) {
        setAttachments((list) => [...list, { ...item, error: `${file.name}: supera ${MAX_MB} MB` }]);
        continue;
      }
      setAttachments((list) => [...list, item]);
      assistantApi
        .upload(file, (progress) => update(key, { progress }))
        .then((saved) => update(key, { ...saved, progress: 1 }))
        .catch((err) => update(key, { error: err.message }));
    }
    inputRef.current?.focus();
  };

  const uploading = attachments.some((a) => !a.id && !a.error);
  const ready = attachments.filter((a) => a.id);

  const send = async (content) => {
    content = content.trim();
    if ((!content && !ready.length) || busy || uploading) return;
    const files = ready.map(({ id, name, size, url }) => ({ id, name, size, url }));
    const next = [...messages, { role: 'user', content, files }];
    setMessages(next);
    setText('');
    setAttachments([]);
    setError('');
    setBusy(true);
    try {
      const res = await assistantApi.chat(next.map(({ role, content, files }) => ({ role, content, files: files?.map((f) => f.id) })));
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, tools: res.tools, files: res.files, crisis: res.crisis }]);
    } catch (err) {
      setError(err.message || 'No pude responder. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  // Quick options are answered on the spot (no AI needed)
  const pickTask = ([label, url]) => {
    const product = products.find((p) => p.toolUrl === url);
    setMessages((m) => [
      ...m,
      { role: 'user', content: label },
      { role: 'assistant', content: QUICK_REPLIES[m.length % QUICK_REPLIES.length], tools: product ? [product.id] : [] },
    ]);
  };

  const restart = () => {
    setMessages([GREETING]);
    setAttachments([]);
    setError('');
  };

  const showQuick = messages.length === 1;

  const dropProps = {
    onDragOver: (e) => {
      if (![...e.dataTransfer.types].includes('Files')) return;
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: (e) => !e.currentTarget.contains(e.relatedTarget) && setDragging(false),
    onDrop: (e) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
  };

  return (
    <section
      role={page ? undefined : 'dialog'}
      aria-label="Chat con Monchys"
      {...dropProps}
      className={
        page
          ? 'relative flex flex-col h-[min(720px,calc(100dvh-9rem))] bg-cream rounded-[2rem] shadow-toy-lg overflow-hidden'
          : 'fixed z-50 inset-0 sm:inset-auto sm:bottom-24 sm:right-5 sm:w-[400px] sm:h-[min(640px,calc(100dvh-8rem))] bg-cream sm:rounded-[2rem] shadow-toy-lg flex flex-col overflow-hidden animate-pop-in'
      }
    >
      {!page && (
        <header className="flex items-center gap-3 px-4 py-3 bg-blob-soft">
          <Mascot className="w-9" />
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold leading-tight">Monchys</p>
            <p className="text-xs font-semibold text-ink/60">Pregunta o adjunta un archivo</p>
          </div>
          {messages.length > 1 && (
            <button onClick={restart} className="btn btn-ghost px-3 py-1.5 text-xs" title="Empezar de nuevo">
              <RefreshCw className="w-4 h-4" /> Nuevo
            </button>
          )}
          <a href="/chat" className="hidden sm:grid w-10 h-10 place-items-center rounded-full hover:bg-white/70" title="Abrir en pantalla completa" aria-label="Abrir en pantalla completa">
            <Maximize2 className="w-4 h-4" />
          </a>
          <button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-white/70" aria-label="Cerrar chat">
            <X className="w-5 h-5" />
          </button>
        </header>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto" aria-live="polite">
        <div className={`px-4 py-4 space-y-3 ${page ? 'max-w-3xl mx-auto w-full' : ''}`}>
          {page && messages.length > 1 && (
            <div className="flex justify-end">
              <button onClick={restart} className="btn btn-ghost px-3 py-1.5 text-xs">
                <RefreshCw className="w-4 h-4" /> Nueva conversación
              </button>
            </div>
          )}
          {messages.map((m, i) => (
            <Bubble key={i} message={m} products={products} />
          ))}
          {showQuick && (
            <div className="flex flex-wrap gap-2 pt-1">
              {QUICK_TASKS.map((task) => (
                <button
                  key={task[1]}
                  onClick={() => pickTask(task)}
                  className="px-3.5 py-2 rounded-full bg-white border-2 border-blob text-sm font-bold text-blob-deep hover:bg-blob-soft"
                >
                  {task[0]}
                </button>
              ))}
            </div>
          )}
          {busy && (
            <div className="flex items-center gap-2 text-sm font-bold text-ink/50">
              <Mascot className="w-7" chewing /> {messages.at(-1)?.files?.length ? 'Monchys se está comiendo tus archivos…' : 'Monchys está pensando…'}
            </div>
          )}
          {error && <p className="text-sm font-bold text-mouth">{error}</p>}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="bg-white border-t border-ink/10"
      >
        <div className={`p-3 space-y-2 ${page ? 'max-w-3xl mx-auto w-full' : ''}`}>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachments.map((a) => (
                <Attachment key={a.key} item={a} onRemove={() => setAttachments((list) => list.filter((x) => x.key !== a.key))} />
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={attachments.length >= MAX_ATTACHMENTS}
              className="w-12 h-12 grid place-items-center rounded-full bg-cream hover:bg-blob-soft text-ink/70 shrink-0 disabled:opacity-40"
              aria-label="Adjuntar archivo"
              title={`Adjuntar (hasta ${MAX_MB} MB)`}
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder={ready.length || uploading ? '¿Qué hago con esto? Ej.: comprímelo' : 'Pregunta algo o adjunta un archivo'}
              aria-label="Tu mensaje"
              className="flex-1 min-w-0 rounded-full bg-cream px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-blob"
            />
            <button
              type="submit"
              disabled={busy || uploading || (!text.trim() && !ready.length)}
              className="btn btn-red w-12 h-12 p-0 shrink-0"
              aria-label={uploading ? 'Subiendo archivo' : 'Enviar'}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </form>

      {dragging && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-blob-soft/90 border-4 border-dashed border-blob rounded-[inherit] pointer-events-none">
          <p className="font-display font-bold text-xl text-blob-deep">Suelta aquí y me lo como 😋</p>
        </div>
      )}
    </section>
  );
}

// Floating Monchys in the corner; opens the chat.
export default function MonchysChat() {
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);

  useEffect(() => {
    if (storage.get(TEASER_KEY)) return;
    const t = setTimeout(() => setTeaser(true), 3500);
    return () => clearTimeout(t);
  }, []);

  const hideTeaser = () => {
    setTeaser(false);
    storage.set(TEASER_KEY, true);
  };

  const toggle = () => {
    hideTeaser();
    setOpen((o) => !o);
  };

  return (
    <>
      {open && <ChatView onClose={() => setOpen(false)} />}
      <div className={`fixed z-40 bottom-4 right-4 sm:right-5 flex items-end gap-2 ${open ? 'max-sm:hidden' : ''}`}>
        {teaser && !open && (
          <div className="relative mb-10 bg-white rounded-3xl rounded-br-md shadow-toy-lg pl-4 pr-9 py-3 animate-pop-in max-w-[13rem]">
            <button onClick={toggle} className="text-left text-sm font-bold leading-snug">
              ¿Qué quieres hacer hoy? Pregúntame o pásame un archivo 😋
            </button>
            <button onClick={hideTeaser} className="absolute top-1.5 right-1.5 w-7 h-7 grid place-items-center rounded-full hover:bg-cream" aria-label="Ocultar">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <button
          onClick={toggle}
          className="relative w-16 sm:w-[4.5rem] drop-shadow-[0_6px_10px_rgba(22,24,28,0.25)] hover:-translate-y-1 transition-transform"
          aria-label={open ? 'Cerrar chat con Monchys' : 'Abrir chat con Monchys'}
          aria-expanded={open}
        >
          <Mascot />
          <span className="absolute -top-1 -left-1 w-7 h-7 rounded-full bg-mouth text-white grid place-items-center shadow-toy">
            {open ? <X className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
          </span>
        </button>
      </div>
    </>
  );
}
