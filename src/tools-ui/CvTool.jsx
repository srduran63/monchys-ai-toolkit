import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Copy, FileDown, Loader2, Plus, Printer, Sparkles, Trash2, X } from 'lucide-react';
import { tool } from '../api';
import { downloadBlob } from '../upload';
import { AiOffNotice, Card, ErrorBox, input, label } from './ui';

const api = tool('cv');

export const TEMPLATES = [
  { id: 'clasico', name: 'Clásico' },
  { id: 'moderno', name: 'Moderno' },
  { id: 'minimal', name: 'Minimal' },
];
const COLORS = ['#3a86d1', '#16181c', '#e5231b', '#2f855a', '#6b46c1'];

const EMPTY_CV = {
  template: 'moderno',
  color: COLORS[0],
  personal: { name: '', title: '', email: '', phone: '', location: '', website: '' },
  summary: '',
  experience: [{ role: '', company: '', start: '', end: '', description: '' }],
  education: [{ degree: '', school: '', start: '', end: '' }],
  skills: [],
  languages: [{ name: 'Español', level: 'Nativo' }],
};

const lines = (text) => (text ?? '').split('\n').map((l) => l.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean);
const period = (a, b) => [a, b || (a ? 'Actualidad' : '')].filter(Boolean).join(' – ');

export default function CvTool() {
  const [cv, setCv] = useState(null);
  const [aiOk, setAiOk] = useState(false);
  const [tab, setTab] = useState('cv');
  const [pane, setPane] = useState('edit'); // < lg: one pane at a time
  const [saveState, setSaveState] = useState('saved'); // saved | saving | error
  const [printing, setPrinting] = useState(null); // 'cv' | { letter }
  const [error, setError] = useState('');
  const first = useRef(true);

  useEffect(() => {
    api
      .get()
      .then((r) => {
        setAiOk(r.ai);
        setCv(r.cv ? { ...EMPTY_CV, ...r.cv, personal: { ...EMPTY_CV.personal, ...r.cv.personal } } : EMPTY_CV);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Autosave 1 s after the last change
  useEffect(() => {
    if (!cv) return;
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveState('saving');
    const t = setTimeout(() => {
      api.put('', { cv }).then(() => setSaveState('saved')).catch(() => setSaveState('error'));
    }, 1000);
    return () => clearTimeout(t);
  }, [cv]);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener('afterprint', done, { once: true });
    const t = setTimeout(() => window.print(), 50);
    return () => clearTimeout(t);
  }, [printing]);

  if (!cv) return <p className="text-center font-bold text-ink/50">{error || 'Cargando…'}</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-white rounded-full p-1 shadow-toy">
          {[
            ['cv', 'Currículum'],
            ['letter', 'Carta de presentación'],
          ].map(([id, text]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-full px-4 py-2 font-display font-semibold text-sm ${tab === id ? 'bg-ink text-blob' : 'hover:bg-cream'}`}
            >
              {text}
            </button>
          ))}
        </div>
        <p className="text-xs font-bold text-ink/50 flex items-center gap-1">
          {saveState === 'saving' && (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…
            </>
          )}
          {saveState === 'saved' && (
            <>
              <Check className="w-3.5 h-3.5" /> Guardado en tu cuenta
            </>
          )}
          {saveState === 'error' && <span className="text-mouth">No se pudo guardar</span>}
        </p>
      </div>

      {tab === 'cv' ? (
        <div className="grid lg:grid-cols-[1fr_1fr] gap-6 items-start">
          {/* Below lg the editor and the preview don't fit side by side: switch between them */}
          <div className="lg:hidden sticky top-[76px] z-20 flex gap-1 bg-white rounded-full p-1 shadow-toy w-full">
            {[
              ['edit', 'Editar'],
              ['preview', 'Vista previa'],
            ].map(([id, text]) => (
              <button
                key={id}
                onClick={() => {
                  setPane(id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex-1 rounded-full py-2.5 font-display font-semibold text-sm ${pane === id ? 'bg-ink text-blob' : 'hover:bg-cream'}`}
              >
                {text}
              </button>
            ))}
          </div>
          <div className={pane === 'edit' ? 'min-w-0' : 'hidden lg:block min-w-0'}>
            <Editor cv={cv} setCv={setCv} ai={aiOk} />
          </div>
          <div className={`${pane === 'preview' ? '' : 'hidden lg:block'} lg:sticky lg:top-24 space-y-3 min-w-0`}>
            <div className="flex flex-wrap items-center gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setCv({ ...cv, template: t.id })}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold ${cv.template === t.id ? 'bg-ink text-blob' : 'bg-white shadow-toy hover:bg-cream'}`}
                >
                  {t.name}
                </button>
              ))}
              <span className="flex gap-1.5 ml-auto">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCv({ ...cv, color: c })}
                    className={`w-7 h-7 rounded-full ring-offset-2 ${cv.color === c ? 'ring-2 ring-ink' : ''}`}
                    style={{ background: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </span>
            </div>
            <Preview cv={cv} />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setPrinting('cv')} className="btn btn-red px-5 py-2.5">
                <Printer className="w-4 h-4" /> Descargar PDF
              </button>
              <button onClick={() => exportCvDocx(cv)} className="btn btn-ghost px-5 py-2.5">
                <FileDown className="w-4 h-4" /> Word
              </button>
            </div>
            <p className="text-xs text-ink/45">En "Descargar PDF" elige "Guardar como PDF" como impresora.</p>
          </div>
        </div>
      ) : (
        <Letter cv={cv} ai={aiOk} onPrint={(letter) => setPrinting({ letter })} />
      )}

      {printing &&
        createPortal(
          <div className="print-area">
            {printing === 'cv' ? <CvDocument cv={cv} /> : <LetterDocument cv={cv} text={printing.letter} />}
          </div>,
          document.body
        )}
    </div>
  );
}

// ---------- Editor ----------
function Section({ title, children, open: initial = false }) {
  const [open, setOpen] = useState(initial);
  return (
    <Card className="!p-0 overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-5 py-4 font-display font-semibold text-lg">
        {title}
        <ChevronDown className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 space-y-3">{children}</div>}
    </Card>
  );
}

function Field({ text, value, onChange, ...props }) {
  return (
    <label className="block">
      <span className={label}>{text}</span>
      <input className={input} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...props} />
    </label>
  );
}

function ImproveButton({ text, kind, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={busy || (text ?? '').trim().length < 10}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            onDone((await api.post('/improve', { text, kind })).text);
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
        className="text-xs font-extrabold text-blob-deep hover:text-mouth disabled:opacity-40 inline-flex items-center gap-1"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Mejorar con IA
      </button>
      {error && <span className="text-xs text-mouth font-bold">{error}</span>}
    </span>
  );
}

function ListEditor({ items, onChange, empty, render, addText }) {
  const update = (i, patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <>
      {items.map((it, i) => (
        <div key={i} className="bg-cream rounded-2xl p-3 space-y-2 relative">
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="absolute top-2 right-2 rounded-full p-1.5 text-ink/40 hover:text-mouth hover:bg-white"
            aria-label="Quitar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {render(it, (patch) => update(i, patch))}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { ...empty }])} className="text-sm font-extrabold text-blob-deep hover:text-mouth inline-flex items-center gap-1">
        <Plus className="w-4 h-4" /> {addText}
      </button>
    </>
  );
}

function Editor({ cv, setCv, ai }) {
  const set = (patch) => setCv({ ...cv, ...patch });
  const setPersonal = (key) => (value) => set({ personal: { ...cv.personal, [key]: value } });
  const [skill, setSkill] = useState('');

  const addSkill = () => {
    const s = skill.trim();
    if (s && !cv.skills.includes(s)) set({ skills: [...cv.skills, s].slice(0, 30) });
    setSkill('');
  };

  return (
    <div className="space-y-4 min-w-0">
      {!ai && <AiOffNotice>Las mejoras de redacción con IA no están activadas. Todo lo demás funciona.</AiOffNotice>}

      <Section title="Datos personales" open>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field text="Nombre completo" value={cv.personal.name} onChange={setPersonal('name')} maxLength={80} />
          <Field text="Puesto o profesión" value={cv.personal.title} onChange={setPersonal('title')} maxLength={80} />
          <Field text="Correo" type="email" value={cv.personal.email} onChange={setPersonal('email')} maxLength={120} />
          <Field text="Teléfono" value={cv.personal.phone} onChange={setPersonal('phone')} maxLength={40} />
          <Field text="Ciudad" value={cv.personal.location} onChange={setPersonal('location')} maxLength={80} />
          <Field text="Web o LinkedIn" value={cv.personal.website} onChange={setPersonal('website')} maxLength={120} />
        </div>
      </Section>

      <Section title="Perfil profesional" open>
        <textarea
          className={`${input} min-h-28`}
          value={cv.summary}
          onChange={(e) => set({ summary: e.target.value })}
          maxLength={1200}
          placeholder="Quién eres y qué aportas, en 2–4 frases."
        />
        {ai && <ImproveButton text={cv.summary} kind="summary" onDone={(summary) => set({ summary })} />}
      </Section>

      <Section title="Experiencia">
        <ListEditor
          items={cv.experience}
          onChange={(experience) => set({ experience })}
          empty={{ role: '', company: '', start: '', end: '', description: '' }}
          addText="Añadir experiencia"
          render={(e, update) => (
            <>
              <div className="grid sm:grid-cols-2 gap-2 pr-8">
                <Field text="Puesto" value={e.role} onChange={(role) => update({ role })} maxLength={80} />
                <Field text="Empresa" value={e.company} onChange={(company) => update({ company })} maxLength={80} />
                <Field text="Inicio" value={e.start} onChange={(start) => update({ start })} placeholder="2021" maxLength={20} />
                <Field text="Fin" value={e.end} onChange={(end) => update({ end })} placeholder="Actualidad" maxLength={20} />
              </div>
              <label className="block">
                <span className={label}>Logros y responsabilidades (uno por línea)</span>
                <textarea className={`${input} min-h-24`} value={e.description} onChange={(ev) => update({ description: ev.target.value })} maxLength={1500} />
              </label>
              {ai && <ImproveButton text={e.description} kind="experience" onDone={(description) => update({ description })} />}
            </>
          )}
        />
      </Section>

      <Section title="Estudios">
        <ListEditor
          items={cv.education}
          onChange={(education) => set({ education })}
          empty={{ degree: '', school: '', start: '', end: '' }}
          addText="Añadir estudios"
          render={(e, update) => (
            <div className="grid sm:grid-cols-2 gap-2 pr-8">
              <Field text="Título" value={e.degree} onChange={(degree) => update({ degree })} maxLength={100} />
              <Field text="Centro" value={e.school} onChange={(school) => update({ school })} maxLength={100} />
              <Field text="Inicio" value={e.start} onChange={(start) => update({ start })} maxLength={20} />
              <Field text="Fin" value={e.end} onChange={(end) => update({ end })} maxLength={20} />
            </div>
          )}
        />
      </Section>

      <Section title="Habilidades e idiomas">
        <div>
          <span className={label}>Habilidades</span>
          <div className="flex gap-2">
            <input
              className={input}
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder="Escribe y pulsa Enter"
              maxLength={40}
            />
            <button type="button" onClick={addSkill} className="btn btn-blue w-11 h-11 shrink-0" aria-label="Añadir habilidad">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {cv.skills.map((s) => (
              <span key={s} className="bg-cream rounded-full pl-3 pr-1 py-1 text-sm font-bold inline-flex items-center gap-1">
                {s}
                <button type="button" onClick={() => set({ skills: cv.skills.filter((x) => x !== s) })} className="rounded-full p-0.5 hover:bg-white" aria-label={`Quitar ${s}`}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
        <ListEditor
          items={cv.languages}
          onChange={(languages) => set({ languages })}
          empty={{ name: '', level: '' }}
          addText="Añadir idioma"
          render={(l, update) => (
            <div className="grid grid-cols-2 gap-2 pr-8">
              <Field text="Idioma" value={l.name} onChange={(name) => update({ name })} maxLength={40} />
              <Field text="Nivel" value={l.level} onChange={(level) => update({ level })} placeholder="B2, nativo…" maxLength={40} />
            </div>
          )}
        />
      </Section>
    </div>
  );
}

// ---------- Preview (A4 at 794 px, scaled to fit) ----------
function Preview({ cv }) {
  const wrap = useRef(null);
  const [scale, setScale] = useState(0.6);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 794));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={wrap} className="w-full bg-white rounded-2xl shadow-toy-lg overflow-hidden" style={{ height: 1123 * scale }}>
      <div style={{ width: 794, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <CvDocument cv={cv} />
      </div>
    </div>
  );
}

function Heading({ children, color, variant }) {
  if (variant === 'minimal') return <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#555] mb-2 mt-5">{children}</h3>;
  return (
    <h3 className="text-[15px] font-bold uppercase tracking-wider mb-2 mt-5 pb-1 border-b-2" style={{ color, borderColor: color }}>
      {children}
    </h3>
  );
}

function Experience({ cv, variant }) {
  return cv.experience
    .filter((e) => e.role || e.company)
    .map((e, i) => (
      <div key={i} className="mb-3">
        <div className="flex justify-between gap-3">
          <p className="font-bold text-[14px]">
            {e.role}
            {e.company && <span className="font-normal text-[#555]"> · {e.company}</span>}
          </p>
          <p className="text-[12px] text-[#777] shrink-0">{period(e.start, e.end)}</p>
        </div>
        <ul className={`mt-1 space-y-0.5 text-[12.5px] text-[#333] ${variant === 'minimal' ? '' : 'list-disc pl-4'}`}>
          {lines(e.description).map((l, j) => (
            <li key={j}>{l}</li>
          ))}
        </ul>
      </div>
    ));
}

function Education({ cv }) {
  return cv.education
    .filter((e) => e.degree || e.school)
    .map((e, i) => (
      <div key={i} className="mb-2 flex justify-between gap-3">
        <p className="text-[13px]">
          <span className="font-bold">{e.degree}</span>
          {e.school && <span className="text-[#555]"> · {e.school}</span>}
        </p>
        <p className="text-[12px] text-[#777] shrink-0">{period(e.start, e.end)}</p>
      </div>
    ));
}

export function CvDocument({ cv }) {
  const p = cv.personal;
  const contact = [p.email, p.phone, p.location, p.website].filter(Boolean);
  const langs = cv.languages.filter((l) => l.name);
  const font = { fontFamily: '"Nunito", Arial, sans-serif', color: '#16181c' };

  if (cv.template === 'moderno') {
    return (
      <div className="cv-page flex bg-white" style={{ ...font, minHeight: 1123 }}>
        <aside className="w-[250px] shrink-0 text-white px-7 py-10" style={{ background: cv.color }}>
          <p className="text-[28px] font-extrabold leading-tight">{p.name || 'Tu nombre'}</p>
          <p className="text-[14px] opacity-90 mt-1">{p.title}</p>
          <div className="mt-8 space-y-1.5 text-[12px] break-words">
            {contact.map((c) => (
              <p key={c}>{c}</p>
            ))}
          </div>
          {cv.skills.length > 0 && (
            <>
              <h3 className="text-[12px] font-bold uppercase tracking-widest mt-8 mb-2 opacity-80">Habilidades</h3>
              <ul className="space-y-1 text-[12.5px]">
                {cv.skills.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {langs.length > 0 && (
            <>
              <h3 className="text-[12px] font-bold uppercase tracking-widest mt-8 mb-2 opacity-80">Idiomas</h3>
              <ul className="space-y-1 text-[12.5px]">
                {langs.map((l) => (
                  <li key={l.name}>
                    {l.name} {l.level && <span className="opacity-75">· {l.level}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
        <main className="flex-1 px-9 py-10">
          {cv.summary && (
            <>
              <Heading color={cv.color}>Perfil</Heading>
              <p className="text-[13px] leading-relaxed text-[#333]">{cv.summary}</p>
            </>
          )}
          <Heading color={cv.color}>Experiencia</Heading>
          <Experience cv={cv} />
          <Heading color={cv.color}>Estudios</Heading>
          <Education cv={cv} />
        </main>
      </div>
    );
  }

  const minimal = cv.template === 'minimal';
  return (
    <div className="cv-page bg-white px-14 py-12" style={{ ...font, minHeight: 1123 }}>
      <header className={minimal ? '' : 'text-center pb-4 border-b-4'} style={minimal ? {} : { borderColor: cv.color }}>
        <p className={`font-extrabold leading-tight ${minimal ? 'text-[32px]' : 'text-[34px]'}`} style={{ color: minimal ? '#16181c' : cv.color }}>
          {p.name || 'Tu nombre'}
        </p>
        <p className="text-[15px] text-[#444] mt-1" style={minimal ? { color: cv.color } : {}}>
          {p.title}
        </p>
        <p className="text-[12px] text-[#666] mt-2">{contact.join('  ·  ')}</p>
      </header>
      {cv.summary && (
        <>
          <Heading color={cv.color} variant={cv.template}>
            Perfil
          </Heading>
          <p className="text-[13px] leading-relaxed text-[#333]">{cv.summary}</p>
        </>
      )}
      <Heading color={cv.color} variant={cv.template}>
        Experiencia
      </Heading>
      <Experience cv={cv} variant={cv.template} />
      <Heading color={cv.color} variant={cv.template}>
        Estudios
      </Heading>
      <Education cv={cv} />
      {(cv.skills.length > 0 || langs.length > 0) && (
        <div className="grid grid-cols-2 gap-8">
          {cv.skills.length > 0 && (
            <div>
              <Heading color={cv.color} variant={cv.template}>
                Habilidades
              </Heading>
              <p className="text-[12.5px] text-[#333] leading-relaxed">{cv.skills.join(' · ')}</p>
            </div>
          )}
          {langs.length > 0 && (
            <div>
              <Heading color={cv.color} variant={cv.template}>
                Idiomas
              </Heading>
              <p className="text-[12.5px] text-[#333] leading-relaxed">{langs.map((l) => `${l.name}${l.level ? ` (${l.level})` : ''}`).join(' · ')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LetterDocument({ cv, text }) {
  return (
    <div className="cv-page bg-white px-16 py-16" style={{ fontFamily: '"Nunito", Arial, sans-serif', color: '#16181c', minHeight: 1123 }}>
      <p className="text-[20px] font-extrabold" style={{ color: cv.color }}>
        {cv.personal.name}
      </p>
      <p className="text-[12px] text-[#666] mb-10">{[cv.personal.email, cv.personal.phone, cv.personal.location].filter(Boolean).join('  ·  ')}</p>
      {text.split('\n\n').map((para, i) => (
        <p key={i} className="text-[14px] leading-relaxed mb-4 whitespace-pre-line">
          {para}
        </p>
      ))}
    </div>
  );
}

// ---------- Word export ----------
async function exportCvDocx(cv) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } = await import('docx');
  const p = cv.personal;
  const color = cv.color.replace('#', '');
  const heading = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 } });
  const children = [
    new Paragraph({ children: [new TextRun({ text: p.name || 'Tu nombre', bold: true, size: 40, color })], alignment: AlignmentType.LEFT }),
    new Paragraph({ children: [new TextRun({ text: p.title, size: 26 })] }),
    new Paragraph({ children: [new TextRun({ text: [p.email, p.phone, p.location, p.website].filter(Boolean).join('  ·  '), size: 20, color: '666666' })] }),
  ];
  if (cv.summary) children.push(heading('Perfil'), new Paragraph({ text: cv.summary }));
  children.push(heading('Experiencia'));
  for (const e of cv.experience.filter((x) => x.role || x.company)) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: e.role, bold: true }), new TextRun({ text: e.company ? ` · ${e.company}` : '' }), new TextRun({ text: `   ${period(e.start, e.end)}`, color: '777777' })],
        spacing: { before: 120 },
      })
    );
    for (const l of lines(e.description)) children.push(new Paragraph({ text: l, bullet: { level: 0 } }));
  }
  children.push(heading('Estudios'));
  for (const e of cv.education.filter((x) => x.degree || x.school)) {
    children.push(new Paragraph({ children: [new TextRun({ text: e.degree, bold: true }), new TextRun({ text: e.school ? ` · ${e.school}` : '' }), new TextRun({ text: `   ${period(e.start, e.end)}`, color: '777777' })] }));
  }
  if (cv.skills.length) children.push(heading('Habilidades'), new Paragraph({ text: cv.skills.join(' · ') }));
  const langs = cv.languages.filter((l) => l.name);
  if (langs.length) children.push(heading('Idiomas'), new Paragraph({ text: langs.map((l) => `${l.name}${l.level ? ` (${l.level})` : ''}`).join(' · ') }));
  const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
  downloadBlob(blob, `CV ${p.name || 'Monchys'}.docx`);
}

// ---------- Cover letter ----------
function Letter({ cv, ai, onPrint }) {
  const [job, setJob] = useState({ company: '', position: '', offer: '' });
  const [letter, setLetter] = useState('');
  const [kind, setKind] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const generate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/letter', { cv, job });
      setLetter(r.letter);
      setKind(r.kind);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const exportDocx = async () => {
    const { Document, Packer, Paragraph } = await import('docx');
    const children = letter.split('\n').map((l) => new Paragraph({ text: l }));
    downloadBlob(await Packer.toBlob(new Document({ sections: [{ children }] })), `Carta ${job.company || 'presentación'}.docx`);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_1.3fr] gap-6 items-start">
      <Card>
        <h3 className="font-display font-semibold text-lg mb-1">La oferta</h3>
        <p className="text-sm text-ink/55 mb-4">La carta usa los datos de tu currículum.</p>
        <form onSubmit={generate} className="space-y-3">
          <Field text="Empresa" value={job.company} onChange={(company) => setJob({ ...job, company })} maxLength={120} />
          <Field text="Puesto" value={job.position} onChange={(position) => setJob({ ...job, position })} maxLength={120} />
          <label className="block">
            <span className={label}>Descripción de la oferta (opcional)</span>
            <textarea className={`${input} min-h-32`} value={job.offer} onChange={(e) => setJob({ ...job, offer: e.target.value })} maxLength={6000} placeholder="Pega aquí el texto del anuncio." />
          </label>
          {!ai && <AiOffNotice>Sin IA activada, la carta se arma con una plantilla a partir de tu CV. Podrás editarla.</AiOffNotice>}
          <ErrorBox error={error} />
          <button disabled={busy} className="btn btn-red w-full py-3">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generar carta
          </button>
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-display font-semibold text-lg">Tu carta</h3>
          {kind && (
            <span className="text-xs font-bold bg-blob-soft text-blob-deep rounded-full px-2.5 py-1">
              {kind === 'ai' ? 'Escrita con IA' : 'Plantilla'} · revísala antes de enviarla
            </span>
          )}
        </div>
        <textarea
          value={letter}
          onChange={(e) => setLetter(e.target.value)}
          placeholder="Completa los datos de la oferta y pulsa “Generar carta”."
          className="w-full min-h-[420px] rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 leading-relaxed focus:outline-none focus:border-blob focus:ring-4 focus:ring-blob/30"
        />
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            disabled={!letter}
            onClick={async () => {
              await navigator.clipboard?.writeText(letter).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="btn btn-ghost px-4 py-2 text-sm"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copiar
          </button>
          <button disabled={!letter} onClick={exportDocx} className="btn btn-ghost px-4 py-2 text-sm">
            <FileDown className="w-4 h-4" /> Word
          </button>
          <button disabled={!letter} onClick={() => onPrint(letter)} className="btn btn-red px-4 py-2 text-sm">
            <Printer className="w-4 h-4" /> PDF
          </button>
        </div>
      </Card>
    </div>
  );
}
