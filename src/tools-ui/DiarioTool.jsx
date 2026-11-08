import { useEffect, useMemo, useRef, useState } from 'react';
import { Save, Trash2, Wind } from 'lucide-react';
import HelpPanel from '../HelpPanel';
import { tool } from '../api';
import { Card, ErrorBox, localToday } from './ui';

const api = tool('diario');

const MOODS = [
  { value: 1, face: '😢', label: 'Muy mal' },
  { value: 2, face: '😕', label: 'Mal' },
  { value: 3, face: '😐', label: 'Normal' },
  { value: 4, face: '🙂', label: 'Bien' },
  { value: 5, face: '😄', label: 'Muy bien' },
];

const PROMPTS = [
  '¿Qué fue lo mejor de tu día?',
  '¿Qué te preocupa ahora mismo y qué parte está en tus manos?',
  'Escribe tres cosas por las que hoy sientes gratitud.',
  '¿Qué necesitas hoy para sentirte un poco mejor?',
  '¿Qué emoción se repitió más hoy? ¿Qué la provocó?',
  '¿Con quién te gustaría hablar esta semana y por qué?',
  '¿Qué hiciste hoy que tu yo de hace un año valoraría?',
  'Si hoy fuera un color o un clima, ¿cuál sería?',
  '¿Qué te dirías a ti si fueras tu mejor amigo?',
  '¿Qué pequeño paso puedes dar mañana?',
];

const addDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const dayLabel = (date, opts = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es', { ...opts, timeZone: 'UTC' });
const promptFor = (date) => PROMPTS[Math.floor(Date.parse(`${date}T12:00:00Z`) / 86400000) % PROMPTS.length];

export default function DiarioTool() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [crisis, setCrisis] = useState(false);

  const load = () => api.get().then(setData).catch((err) => setError(err.message));
  useEffect(() => {
    load();
  }, []);

  if (!data) return <p className="text-center font-bold text-ink/50">{error || 'Cargando…'}</p>;

  return (
    <div className="space-y-6">
      {crisis && <HelpPanel prominent onClose={() => setCrisis(false)} />}
      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <EntryForm
            emotions={data.emotions}
            onSaved={(isCrisis) => {
              setCrisis(isCrisis);
              load();
              if (isCrisis) window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
          <MoodChart entries={data.entries} />
        </div>
        <div className="space-y-6 min-w-0">
          <Breathing />
          <Entries entries={data.entries} onDelete={(id) => api.del(`/entries/${id}`).then(load)} />
          <HelpPanel />
        </div>
      </div>
    </div>
  );
}

function EntryForm({ emotions, onSaved }) {
  const today = localToday();
  const prompt = promptFor(today);
  const [mood, setMood] = useState(0);
  const [picked, setPicked] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const toggle = (e) => setPicked((p) => (p.includes(e) ? p.filter((x) => x !== e) : [...p, e]));

  const save = async (e) => {
    e.preventDefault();
    if (!mood) return setError('Elige cómo te sientes.');
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/entries', { mood, emotions: picked, text, prompt, date: today });
      setMood(0);
      setPicked([]);
      setText('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved(res.crisis);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <p className="text-xs font-extrabold uppercase tracking-wider text-blob-deep capitalize">{dayLabel(today)}</p>
      <h2 className="font-display font-bold text-2xl mt-1">¿Cómo te sientes hoy?</h2>
      <form onSubmit={save} className="mt-4 space-y-5">
        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Estado de ánimo">
          {MOODS.map((m) => (
            <button
              type="button"
              key={m.value}
              role="radio"
              aria-checked={mood === m.value}
              onClick={() => setMood(m.value)}
              className={`rounded-2xl py-3 flex flex-col items-center gap-1 border-2 transition-colors ${
                mood === m.value ? 'border-ink bg-blob-soft' : 'border-cream bg-cream/60 hover:border-blob'
              }`}
            >
              <span className="text-3xl leading-none">{m.face}</span>
              <span className="text-xs font-bold">{m.label}</span>
            </button>
          ))}
        </div>

        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-ink/50 mb-2">Emociones (opcional)</p>
          <div className="flex flex-wrap gap-2">
            {emotions.map((e) => (
              <button
                type="button"
                key={e}
                onClick={() => toggle(e)}
                aria-pressed={picked.includes(e)}
                className={`rounded-full px-3 py-1.5 text-sm font-bold capitalize transition-colors ${
                  picked.includes(e) ? 'bg-ink text-blob' : 'bg-cream hover:bg-blob-soft'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="font-display font-semibold mb-2">{prompt}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={5000}
            rows={5}
            placeholder="Escribe libremente. Nadie más lo verá."
            className="w-full rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 focus:outline-none focus:border-blob focus:ring-4 focus:ring-blob/30"
          />
        </div>

        <ErrorBox error={error} />
        <button disabled={busy} className="btn btn-red w-full py-3.5 text-lg">
          <Save className="w-5 h-5" /> {saved ? '¡Guardado!' : 'Guardar entrada'}
        </button>
      </form>
    </Card>
  );
}

// Last 30 days, one bar per day (latest entry of the day). Single series: one hue, no legend.
function MoodChart({ entries }) {
  const [hover, setHover] = useState(null);
  const days = useMemo(() => {
    const today = localToday();
    const latest = {};
    for (const e of [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) latest[e.date] = e.mood;
    return Array.from({ length: 30 }, (_, i) => {
      const date = addDays(today, i - 29);
      return { date, mood: latest[date] ?? null };
    });
  }, [entries]);
  const logged = days.filter((d) => d.mood);
  const avg = logged.length ? logged.reduce((s, d) => s + d.mood, 0) / logged.length : null;

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
        <div>
          <h3 className="font-display font-semibold text-lg">Tu ánimo en los últimos 30 días</h3>
          <p className="text-xs text-ink/50">1 = muy mal · 5 = muy bien</p>
        </div>
        {avg && (
          <p className="text-sm text-ink/60">
            Promedio: <span className="font-display font-bold text-ink text-lg">{avg.toFixed(1)}</span> {MOODS[Math.round(avg) - 1].face}
          </p>
        )}
      </div>
      {logged.length === 0 ? (
        <p className="text-sm font-bold text-ink/50">Aún no hay registros. Tu primera entrada aparecerá aquí.</p>
      ) : (
        <div className="relative">
          <div className="flex items-end gap-[2px] h-36 border-b-2 border-ink/10" role="img" aria-label={`Ánimo diario, promedio ${avg.toFixed(1)}`}>
            {days.map((d) => (
              <div
                key={d.date}
                className="flex-1 h-full flex items-end relative"
                onMouseEnter={() => setHover(d)}
                onMouseLeave={() => setHover(null)}
              >
                {d.mood ? (
                  <div className="w-full bg-data rounded-t-[4px]" style={{ height: `${(d.mood / 5) * 100}%` }} />
                ) : (
                  <div className="w-full h-1 bg-cream rounded" />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-ink/45 mt-1">
            <span>{dayLabel(days[0].date, { day: 'numeric', month: 'short' })}</span>
            <span>Hoy</span>
          </div>
          {hover && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-ink text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 pointer-events-none whitespace-nowrap">
              {dayLabel(hover.date, { weekday: 'short', day: 'numeric', month: 'short' })}:{' '}
              {hover.mood ? `${MOODS[hover.mood - 1].face} ${MOODS[hover.mood - 1].label}` : 'sin registro'}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Entries({ entries, onDelete }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? entries : entries.slice(0, 5);
  return (
    <Card>
      <h3 className="font-display font-semibold text-lg mb-3">Tus entradas</h3>
      {entries.length === 0 && <p className="text-sm font-bold text-ink/50">Todavía no has escrito nada.</p>}
      <ul className="space-y-3">
        {shown.map((e) => (
          <li key={e.id} className="bg-cream rounded-2xl p-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{MOODS[e.mood - 1].face}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold capitalize">{dayLabel(e.date, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                {e.emotions.length > 0 && <p className="text-xs text-ink/55 truncate">{e.emotions.join(' · ')}</p>}
              </div>
              <button
                onClick={() => window.confirm('¿Borrar esta entrada?') && onDelete(e.id)}
                className="rounded-full p-1.5 text-ink/30 hover:text-mouth hover:bg-white"
                aria-label="Borrar entrada"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {e.text && <p className="text-sm text-ink/75 mt-2 whitespace-pre-line line-clamp-4">{e.text}</p>}
          </li>
        ))}
      </ul>
      {entries.length > 5 && (
        <button onClick={() => setShowAll((v) => !v)} className="text-sm font-bold text-blob-deep hover:text-mouth mt-3">
          {showAll ? 'Ver menos' : `Ver todas (${entries.length})`}
        </button>
      )}
    </Card>
  );
}

// Box breathing: 4 s in, 4 s hold, 4 s out, 4 s hold.
const PHASES = [
  { text: 'Inhala', scale: 1 },
  { text: 'Mantén', scale: 1 },
  { text: 'Exhala', scale: 0.55 },
  { text: 'Mantén', scale: 0.55 },
];

function Breathing() {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [count, setCount] = useState(4);
  const timer = useRef(null);

  useEffect(() => {
    if (!running) return;
    setPhase(0);
    setCount(4);
    let tick = 0;
    timer.current = setInterval(() => {
      tick++;
      setCount(4 - (tick % 4));
      if (tick % 4 === 0) setPhase((p) => (p + 1) % 4);
    }, 1000);
    return () => clearInterval(timer.current);
  }, [running]);

  return (
    <Card className="text-center">
      <h3 className="font-display font-semibold text-lg flex items-center justify-center gap-2">
        <Wind className="w-5 h-5" /> Respiración 4-4-4-4
      </h3>
      <div className="h-44 flex items-center justify-center">
        <div
          className="w-36 h-36 rounded-full bg-blob flex flex-col items-center justify-center"
          style={{
            transform: `scale(${running ? PHASES[phase].scale : 0.7})`,
            transition: 'transform 4s ease-in-out',
          }}
        >
          <span className="font-display font-bold text-lg">{running ? PHASES[phase].text : 'Listo'}</span>
          {running && <span className="font-display text-3xl font-bold">{count}</span>}
        </div>
      </div>
      <button onClick={() => setRunning((r) => !r)} className={`btn ${running ? 'btn-ghost' : 'btn-blue'} px-6 py-2.5`}>
        {running ? 'Detener' : 'Empezar'}
      </button>
    </Card>
  );
}
