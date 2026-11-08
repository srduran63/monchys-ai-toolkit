import { useEffect, useRef, useState } from 'react';
import { CalendarCheck, Check, Clock, MessageCircle, RefreshCw, Send, Scissors, User } from 'lucide-react';
import { bookingApi } from './api';
import Mascot from './Mascot';

const DAYS_SHOWN = 14;

const addDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const weekdayOf = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
const fmtDate = (date, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es', { ...opts, timeZone: 'UTC' });
const money = (n) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

export default function Booking({ slug }) {
  const [biz, setBiz] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [confirmed, setConfirmed] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0); // bump to reload slots after a chat booking

  useEffect(() => {
    bookingApi
      .business(slug)
      .then(setBiz)
      .catch((err) => setLoadError(err.status === 404 ? 'Este negocio no existe o no está activo.' : err.message));
  }, [slug]);

  const onBooked = (booking) => {
    setConfirmed(booking);
    setRefreshKey((k) => k + 1);
  };

  if (loadError) {
    return (
      <Shell>
        <div className="bg-white rounded-3xl p-10 text-center shadow-toy font-bold text-ink/60">{loadError}</div>
      </Shell>
    );
  }
  if (!biz) {
    return (
      <Shell>
        <div className="p-10 text-center font-bold text-ink/50 flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" /> Cargando…
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-8">
        <span className="inline-flex items-center gap-2 bg-blob-soft text-blob-deep font-extrabold text-xs px-3 py-1.5 rounded-full">
          <CalendarCheck className="w-4 h-4" /> Reserva tu cita
        </span>
        <h1 className="font-display font-bold text-fluid-hero mt-3">{biz.name}</h1>
        {biz.description && <p className="text-ink/70 mt-2 text-fluid-lead max-w-2xl">{biz.description}</p>}
      </div>

      {confirmed && <Confirmation booking={confirmed} onClose={() => setConfirmed(null)} />}

      <div className={`grid gap-6 items-start ${biz.assistant ? 'lg:grid-cols-[1.25fr_1fr]' : ''}`}>
        <BookingForm biz={biz} slug={slug} refreshKey={refreshKey} onBooked={onBooked} />
        {biz.assistant && <Chat biz={biz} slug={slug} onBooked={onBooked} />}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-cream text-ink font-sans selection:bg-blob">
      <main className="page py-8 md:py-12">{children}</main>
      <footer className="text-center text-xs text-ink/45 pb-8 flex items-center justify-center gap-2">
        <Mascot className="w-5" /> Reservas con tecnología de{' '}
        <a href="/" className="font-bold hover:text-blob-deep">
          Monchys IA
        </a>
      </footer>
    </div>
  );
}

function Step({ n, title, children, done }) {
  return (
    <section className="py-5 border-b-2 border-cream last:border-0">
      <h2 className="font-display font-semibold text-lg flex items-center gap-2 mb-3">
        <span
          className={`hex w-7 h-7 text-sm inline-flex items-center justify-center ${done ? 'bg-ink text-blob' : 'bg-blob'}`}
        >
          {done ? <Check className="w-4 h-4" /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function BookingForm({ biz, slug, refreshKey, onBooked }) {
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState(null); // null = not loaded
  const [time, setTime] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(biz.today, i));
  const service = biz.services.find((s) => s.id === serviceId);

  useEffect(() => {
    if (!serviceId || !date) return;
    setSlots(null);
    setTime('');
    bookingApi
      .slots(slug, serviceId, date)
      .then((r) => setSlots(r.slots))
      .catch((err) => {
        setSlots([]);
        setError(err.message);
      });
  }, [slug, serviceId, date, refreshKey]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const booking = await bookingApi.book(slug, { serviceId, date, time, ...form });
      onBooked(booking);
      setTime('');
      setForm({ name: '', phone: '', notes: '' });
    } catch (err) {
      setError(err.message);
      // The slot may have just been taken: reload the list
      setSlots(null);
      bookingApi.slots(slug, serviceId, date).then((r) => setSlots(r.slots)).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const input =
    'w-full rounded-xl border-2 border-ink/10 bg-white px-3 py-2.5 font-semibold focus:outline-none focus:border-blob focus:ring-4 focus:ring-blob/30';

  return (
    <form onSubmit={submit} className="min-w-0 bg-white rounded-[2rem] shadow-toy-lg px-6 py-2">
      <Step n={1} title="Elige el servicio" done={!!service}>
        <div className="grid sm:grid-cols-2 gap-2">
          {biz.services.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => setServiceId(s.id)}
              className={`text-left rounded-2xl p-3 border-2 transition-colors ${
                serviceId === s.id ? 'border-ink bg-blob-soft' : 'border-cream bg-cream/60 hover:border-blob'
              }`}
            >
              <p className="font-display font-semibold leading-tight">{s.name}</p>
              <p className="text-xs text-ink/55 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {s.minutes} min · <span className="font-bold text-mouth">{money(s.price)}</span>
              </p>
            </button>
          ))}
        </div>
      </Step>

      <Step n={2} title="Elige el día" done={!!date}>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {days.map((d) => {
            const closed = (biz.hours[weekdayOf(d)] ?? []).length === 0;
            return (
              <button
                type="button"
                key={d}
                disabled={closed}
                onClick={() => setDate(d)}
                className={`shrink-0 w-16 rounded-2xl py-2 text-center border-2 transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
                  date === d ? 'border-ink bg-ink text-blob' : 'border-cream bg-cream/60 hover:border-blob'
                }`}
              >
                <span className="block text-xs font-bold uppercase">
                  {d === biz.today ? 'Hoy' : fmtDate(d, { weekday: 'short' })}
                </span>
                <span className="block font-display font-bold text-xl leading-tight">{fmtDate(d, { day: 'numeric' })}</span>
                <span className="block text-xs">{fmtDate(d, { month: 'short' })}</span>
              </button>
            );
          })}
        </div>
      </Step>

      <Step n={3} title="Elige la hora" done={!!time}>
        {!serviceId || !date ? (
          <p className="text-sm text-ink/50">Primero elige servicio y día.</p>
        ) : slots === null ? (
          <p className="text-sm text-ink/50 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Buscando horas libres…
          </p>
        ) : slots.length === 0 ? (
          <p className="text-sm font-bold text-ink/60">No quedan horas libres ese día. Prueba con otro.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setTime(t)}
                className={`rounded-full px-4 py-2 font-display font-semibold text-sm transition-colors ${
                  time === t ? 'bg-mouth text-white' : 'bg-cream hover:bg-blob-soft'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </Step>

      <Step n={4} title="Tus datos">
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            className={input}
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            maxLength={60}
            autoComplete="name"
            required
          />
          <input
            className={input}
            placeholder="Teléfono"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            maxLength={20}
            autoComplete="tel"
            required
          />
          <input
            className={`${input} sm:col-span-2`}
            placeholder="Notas (opcional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            maxLength={300}
          />
        </div>

        {error && <p className="bg-mouth/10 text-mouth rounded-xl text-sm font-bold p-3 mt-3">{error}</p>}

        <button disabled={busy || !time} className="btn btn-red w-full py-4 text-lg mt-4">
          {busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CalendarCheck className="w-5 h-5" />}
          {time && service ? `Reservar ${service.name.toLowerCase()} · ${fmtDate(date)} ${time}` : 'Reservar'}
        </button>
      </Step>
    </form>
  );
}

function Chat({ biz, slug, onBooked }) {
  const [messages, setMessages] = useState([]); // sent to the server: alternating user/assistant text
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (content) => {
    content = content.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setText('');
    setBusy(true);
    setError('');
    try {
      const { reply, bookings } = await bookingApi.chat(slug, next);
      setMessages([...next, { role: 'assistant', content: reply }]);
      if (bookings.length) onBooked(bookings.at(-1));
    } catch (err) {
      setMessages(messages); // drop the unanswered message so the history keeps alternating
      setText(content);
      if (err.status === 503) setUnavailable(true);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const suggestions = [
    '¿Qué horas tienen libres mañana?',
    `¿Cuánto cuesta ${biz.services[0]?.name.toLowerCase() ?? 'un servicio'}?`,
    '¿Dónde están?',
  ];

  return (
    <div className="min-w-0 bg-white rounded-[2rem] shadow-toy-lg flex flex-col h-[560px] lg:sticky lg:top-6 overflow-hidden">
      <div className="bg-coal text-white px-5 py-4 flex items-center gap-3">
        <div className="hex w-9 h-9 bg-blob text-ink flex items-center justify-center">
          <MessageCircle className="w-4 h-4" />
        </div>
        <div>
          <p className="font-display font-semibold leading-tight">Asistente de reservas</p>
          <p className="text-xs text-white/60">Pregunta o reserva escribiendo</p>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        <Bubble role="assistant">¡Hola! Soy el asistente de {biz.name}. ¿Qué te gustaría reservar?</Bubble>
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role}>
            {m.content}
          </Bubble>
        ))}
        {busy && (
          <Bubble role="assistant">
            <span className="inline-flex gap-1">
              <span className="w-2 h-2 rounded-full bg-ink/30 animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-ink/30 animate-bounce [animation-delay:120ms]" />
              <span className="w-2 h-2 rounded-full bg-ink/30 animate-bounce [animation-delay:240ms]" />
            </span>
          </Bubble>
        )}
        {messages.length === 0 && !unavailable && (
          <div className="flex flex-wrap gap-2 pt-1">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs font-bold bg-blob-soft text-blob-deep rounded-full px-3 py-1.5 hover:bg-blob"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {unavailable ? (
        <p className="m-4 bg-cream rounded-xl text-sm font-bold p-3 text-ink/70">
          El asistente no está disponible ahora mismo. Puedes reservar con el formulario.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="p-3 border-t-2 border-cream flex gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe tu mensaje…"
            maxLength={1000}
            className="flex-1 rounded-full bg-cream px-4 py-2.5 font-semibold focus:outline-none focus:ring-4 focus:ring-blob/40"
          />
          <button disabled={busy || !text.trim()} className="btn btn-red w-11 h-11" aria-label="Enviar">
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
      {error && <p className="mx-4 mb-3 text-xs font-bold text-mouth">{error}</p>}
    </div>
  );
}

function Bubble({ role, children }) {
  const mine = role === 'user';
  return (
    <div className={`flex gap-2 ${mine ? 'justify-end' : ''}`}>
      {!mine && (
        <div className="hex w-7 h-7 bg-blob shrink-0 flex items-center justify-center mt-0.5">
          <Scissors className="w-3.5 h-3.5" />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line ${
          mine ? 'bg-ink text-white rounded-br-md' : 'bg-cream rounded-bl-md'
        }`}
      >
        {children}
      </div>
      {mine && (
        <div className="w-7 h-7 rounded-full bg-cream shrink-0 flex items-center justify-center mt-0.5">
          <User className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
}

function Confirmation({ booking, onClose }) {
  return (
    <div className="mb-6 bg-white rounded-[2rem] shadow-toy-lg p-6 flex flex-col sm:flex-row items-center gap-5 animate-pop-in border-4 border-blob">
      <div className="hex w-16 h-16 bg-blob flex items-center justify-center shrink-0">
        <Check className="w-8 h-8" />
      </div>
      <div className="flex-1 text-center sm:text-left">
        <p className="font-display font-bold text-2xl">¡Cita confirmada, {booking.name.split(' ')[0]}!</p>
        <p className="text-ink/70 mt-1">
          {booking.serviceName} · {fmtDate(booking.date, { weekday: 'long', day: 'numeric', month: 'long' })} a las{' '}
          {booking.time}
        </p>
        <p className="text-xs text-ink/50 mt-1">
          Código de reserva: <span className="font-mono font-bold text-mouth">{booking.id}</span>
        </p>
      </div>
      <button onClick={onClose} className="btn btn-ghost px-5 py-2">
        Cerrar
      </button>
    </div>
  );
}
