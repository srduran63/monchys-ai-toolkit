import { useEffect, useState } from 'react';
import { Check, Copy, ImagePlus, Loader2, Sparkles, X } from 'lucide-react';
import { tool } from '../api';
import { upload } from '../upload';
import { AiOffNotice, Card, ErrorBox, input, label } from './ui';

const api = tool('escritor');

const NETWORKS = [
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['tiktok', 'TikTok'],
  ['linkedin', 'LinkedIn'],
  ['x', 'X / Twitter'],
  ['whatsapp', 'WhatsApp'],
];
const TONES = [
  ['cercano', 'Cercano'],
  ['profesional', 'Profesional'],
  ['divertido', 'Divertido'],
  ['inspirador', 'Inspirador'],
  ['urgente', 'Oferta / urgente'],
];
const LANGS = [
  ['es', 'Español'],
  ['en', 'Inglés'],
  ['pt', 'Portugués'],
];
const PLATFORMS = [
  ['tienda', 'Mi tienda online'],
  ['mercadolibre', 'Mercado Libre'],
  ['amazon', 'Amazon'],
  ['marketplace', 'Facebook Marketplace'],
  ['instagram', 'Instagram Shopping'],
  ['etsy', 'Etsy'],
];

function useAiStatus(path) {
  const [ai, setAi] = useState(null);
  useEffect(() => {
    api.get(path).then((r) => setAi(r.ai)).catch(() => setAi(false));
  }, [path]);
  return ai;
}

function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard?.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`btn btn-ghost px-3 py-1.5 text-sm ${className}`}
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

const Select = ({ value, onChange, options, ...rest }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={input} {...rest}>
    {options.map(([id, text]) => (
      <option key={id} value={id}>
        {text}
      </option>
    ))}
  </select>
);

// ---------- Textos para redes sociales ----------
export function SocialTool() {
  const ai = useAiStatus('/redes');
  const [form, setForm] = useState({ idea: '', business: '', networks: ['instagram', 'facebook'], tone: 'cercano', language: 'es', variants: 2 });
  const [posts, setPosts] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const toggle = (id) => set('networks')(form.networks.includes(id) ? form.networks.filter((n) => n !== id) : [...form.networks, id]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setPosts((await api.post('/redes', form)).posts);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const names = Object.fromEntries(NETWORKS);
  return (
    <div className="grid lg:grid-cols-[1fr_1.3fr] gap-6 items-start">
      <Card>
        <form onSubmit={submit} className="space-y-4">
          {ai === false && <AiOffNotice />}
          <div>
            <label className={label} htmlFor="idea">¿Qué quieres publicar?</label>
            <textarea
              id="idea"
              className={`${input} min-h-28`}
              value={form.idea}
              onChange={(e) => set('idea')(e.target.value)}
              maxLength={1500}
              placeholder="Ej.: Este sábado tenemos 2x1 en pizzas medianas de 6 a 9 pm, solo en local."
              required
            />
          </div>
          <div>
            <label className={label} htmlFor="business">Tu negocio o marca (opcional)</label>
            <input id="business" className={input} value={form.business} onChange={(e) => set('business')(e.target.value)} maxLength={200} placeholder="Ej.: Pizzería Don Luigi, Monterrey" />
          </div>
          <fieldset>
            <legend className={label}>Redes</legend>
            <div className="flex flex-wrap gap-2">
              {NETWORKS.map(([id, text]) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => toggle(id)}
                  aria-pressed={form.networks.includes(id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold ${form.networks.includes(id) ? 'bg-ink text-blob' : 'bg-cream hover:bg-blob-soft'}`}
                >
                  {text}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={label} htmlFor="tone">Tono</label>
              <Select id="tone" value={form.tone} onChange={set('tone')} options={TONES} />
            </div>
            <div>
              <label className={label} htmlFor="lang">Idioma</label>
              <Select id="lang" value={form.language} onChange={set('language')} options={LANGS} />
            </div>
            <div>
              <label className={label} htmlFor="variants">Versiones</label>
              <Select id="variants" value={String(form.variants)} onChange={(v) => set('variants')(Number(v))} options={[['1', '1 por red'], ['2', '2 por red'], ['3', '3 por red']]} />
            </div>
          </div>
          <ErrorBox error={error} onClose={() => setError('')} />
          <button disabled={busy || !ai || !form.networks.length} className="btn btn-red w-full py-3">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} {busy ? 'Escribiendo…' : 'Escribir publicaciones'}
          </button>
        </form>
      </Card>

      <div className="space-y-3 min-w-0">
        {!posts && !busy && (
          <Card className="text-center py-14">
            <Sparkles className="w-10 h-10 mx-auto text-ink/30" />
            <p className="font-display font-semibold text-lg mt-3">Tus publicaciones aparecerán aquí</p>
            <p className="text-sm text-ink/55 mt-1">Listas para copiar y pegar en cada red.</p>
          </Card>
        )}
        {busy && (
          <Card className="text-center py-14">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-blob-deep" />
            <p className="font-bold text-ink/60 mt-3">Monchys está escribiendo…</p>
          </Card>
        )}
        {!busy &&
          posts?.map((p, i) => (
            <Card key={i}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-blob-deep">{names[p.network]}</span>
                <CopyButton text={p.text} />
              </div>
              <p className="whitespace-pre-line text-ink/85">{p.text}</p>
              {p.network === 'x' && <p className={`text-xs mt-2 font-bold ${p.text.length > 280 ? 'text-mouth' : 'text-ink/40'}`}>{p.text.length}/280 caracteres</p>}
            </Card>
          ))}
      </div>
    </div>
  );
}

// ---------- Descripciones de productos ----------
export function ProductCopyTool() {
  const ai = useAiStatus('/descripciones');
  const [form, setForm] = useState({ product: '', details: '', audience: '', platform: 'tienda', tone: 'cercano', language: 'es' });
  const [photo, setPhoto] = useState(null); // { file, url }
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const pickPhoto = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Sube una imagen.');
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto({ file, url: URL.createObjectURL(file) });
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setResult(await upload('/api/tools/escritor/descripciones', { ...form, ...(photo && { photo: photo.file }) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const all = result
    ? [result.title, '', result.short, '', result.long, '', ...result.bullets.map((b) => `• ${b}`), '', `Palabras clave: ${result.keywords.join(', ')}`].join('\n')
    : '';

  return (
    <div className="grid lg:grid-cols-[1fr_1.3fr] gap-6 items-start">
      <Card>
        <form onSubmit={submit} className="space-y-4">
          {ai === false && <AiOffNotice />}
          <div>
            <span className={label}>Foto del producto (opcional)</span>
            {photo ? (
              <div className="relative">
                <img src={photo.url} alt="Producto" className="w-full max-h-56 object-contain rounded-2xl bg-cream" />
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(photo.url);
                    setPhoto(null);
                  }}
                  className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow-toy"
                  aria-label="Quitar foto"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-blob bg-blob-soft/40 hover:bg-blob-soft px-4 py-4 cursor-pointer">
                <ImagePlus className="w-6 h-6 text-blob-deep" />
                <span className="text-sm font-bold">Sube una foto y Monchys describe el producto por ti</span>
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickPhoto(e.target.files[0])} />
              </label>
            )}
          </div>
          <div>
            <label className={label} htmlFor="product">Producto</label>
            <input id="product" className={input} value={form.product} onChange={(e) => set('product')(e.target.value)} maxLength={200} placeholder="Ej.: Termo de acero inoxidable 1 litro" />
          </div>
          <div>
            <label className={label} htmlFor="details">Características (opcional)</label>
            <textarea id="details" className={`${input} min-h-24`} value={form.details} onChange={(e) => set('details')(e.target.value)} maxLength={2000} placeholder="Medidas, materiales, colores, qué incluye, garantía…" />
          </div>
          <div>
            <label className={label} htmlFor="audience">¿Para quién es? (opcional)</label>
            <input id="audience" className={input} value={form.audience} onChange={(e) => set('audience')(e.target.value)} maxLength={200} placeholder="Ej.: gente que va al gimnasio, mamás primerizas…" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={label} htmlFor="platform">Dónde vendes</label>
              <Select id="platform" value={form.platform} onChange={set('platform')} options={PLATFORMS} />
            </div>
            <div>
              <label className={label} htmlFor="ptone">Tono</label>
              <Select id="ptone" value={form.tone} onChange={set('tone')} options={TONES} />
            </div>
            <div>
              <label className={label} htmlFor="plang">Idioma</label>
              <Select id="plang" value={form.language} onChange={set('language')} options={LANGS} />
            </div>
          </div>
          <ErrorBox error={error} onClose={() => setError('')} />
          <button disabled={busy || !ai || (!form.product.trim() && !photo)} className="btn btn-red w-full py-3">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} {busy ? 'Escribiendo…' : 'Escribir descripción'}
          </button>
        </form>
      </Card>

      <div className="space-y-3 min-w-0">
        {!result && !busy && (
          <Card className="text-center py-14">
            <Sparkles className="w-10 h-10 mx-auto text-ink/30" />
            <p className="font-display font-semibold text-lg mt-3">Tu descripción aparecerá aquí</p>
            <p className="text-sm text-ink/55 mt-1">Título, descripción corta y larga, viñetas y palabras clave.</p>
          </Card>
        )}
        {busy && (
          <Card className="text-center py-14">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-blob-deep" />
            <p className="font-bold text-ink/60 mt-3">{photo ? 'Monchys está mirando la foto y escribiendo…' : 'Monchys está escribiendo…'}</p>
          </Card>
        )}
        {result && !busy && (
          <>
            <div className="flex justify-end">
              <CopyButton text={all} className="bg-white shadow-toy" />
            </div>
            {[
              ['Título', result.title],
              ['Descripción corta', result.short],
              ['Descripción completa', result.long],
              ['Puntos clave', result.bullets.map((b) => `• ${b}`).join('\n')],
              ['Palabras clave', result.keywords.join(', ')],
            ]
              .filter(([, text]) => text)
              .map(([title, text]) => (
                <Card key={title}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-blob-deep">{title}</span>
                    <CopyButton text={text} />
                  </div>
                  <p className="whitespace-pre-line text-ink/85">{text}</p>
                  {title === 'Título' && <p className="text-xs mt-2 font-bold text-ink/40">{text.length} caracteres</p>}
                </Card>
              ))}
            {result.missing.length > 0 && (
              <p className="bg-cream rounded-2xl p-4 text-sm text-ink/70">
                <b>Para mejorarla, añade:</b> {result.missing.join(', ')}.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
