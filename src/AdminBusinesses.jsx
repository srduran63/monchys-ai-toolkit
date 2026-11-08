import { useEffect, useState } from 'react';
import { CalendarDays, ExternalLink, Pencil, Plus, RefreshCw, Save, Trash2, X, Undo2, Ban } from 'lucide-react';
import { bookingApi } from './api';

// Display Monday first; stored index is 0 = Sunday.
const WEEK = [
  [1, 'Lunes'],
  [2, 'Martes'],
  [3, 'Miércoles'],
  [4, 'Jueves'],
  [5, 'Viernes'],
  [6, 'Sábado'],
  [0, 'Domingo'],
];
const TIMEZONES = [
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Caracas',
  'America/Guatemala',
  'America/El_Salvador',
  'America/Costa_Rica',
  'America/Panama',
  'America/Santo_Domingo',
  'America/Guayaquil',
  'America/Montevideo',
  'America/Asuncion',
  'America/La_Paz',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
];
const SLOT_STEPS = [10, 15, 20, 30, 45, 60];

const EMPTY = {
  id: '',
  name: '',
  description: '',
  timezone: 'America/Mexico_City',
  slotMinutes: 30,
  hours: [[], [['09:00', '18:00']], [['09:00', '18:00']], [['09:00', '18:00']], [['09:00', '18:00']], [['09:00', '18:00']], []],
  services: [{ name: '', minutes: 30, price: '' }],
  faq: '',
  ownerEmail: '',
  active: true,
};

const input =
  'w-full rounded-xl border-2 border-ink/10 bg-white px-3 py-2 text-sm font-semibold focus:outline-none focus:border-blob focus:ring-4 focus:ring-blob/30';
const label = 'block text-xs font-extrabold uppercase tracking-wider text-ink/50 mb-1';
const fmtDate = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export default function BusinessesPanel({ onAuthError }) {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null); // { mode, form }
  const [viewing, setViewing] = useState(null); // business id for bookings
  const [error, setError] = useState('');

  const handle = (err) => (err.status === 401 ? onAuthError(err) : setError(err.message));
  const refresh = () => bookingApi.list().then(setList).catch(handle);

  useEffect(() => {
    refresh();
  }, []);

  const edit = async (id) => {
    try {
      const { bookings, today, createdAt, ...b } = await bookingApi.get(id);
      setEditing({ mode: 'edit', form: { ...b, ownerEmail: b.ownerEmail ?? '' } });
    } catch (err) {
      handle(err);
    }
  };

  const remove = async (b) => {
    if (!window.confirm(`¿Eliminar "${b.name}" y todas sus reservas? No se puede deshacer.`)) return;
    try {
      await bookingApi.remove(b.id);
      refresh();
    } catch (err) {
      handle(err);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h1 className="font-display font-bold text-3xl">
            Negocios <span className="text-ink/40">({list.length})</span>
          </h1>
          <p className="text-sm text-ink/50">Clientes del asistente de reservas. Cada uno tiene su página pública.</p>
        </div>
        <button onClick={() => setEditing({ mode: 'create', form: EMPTY })} className="btn btn-red px-4 py-2.5">
          <Plus className="w-4 h-4" /> Nuevo negocio
        </button>
      </div>

      {error && (
        <p className="bg-mouth/10 text-mouth rounded-xl text-sm font-bold p-3 mb-4 flex justify-between">
          {error}
          <button onClick={() => setError('')} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </p>
      )}

      <div className="space-y-3">
        {list.map((b) => (
          <div key={b.id} className={`bg-white rounded-2xl p-4 shadow-toy flex flex-wrap items-center gap-4 ${b.active ? '' : 'opacity-60'}`}>
            <div className="hex w-11 h-11 bg-blob flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-48">
              <p className="font-display font-semibold text-lg leading-tight">{b.name}</p>
              <a
                href={`/reservar/${b.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-blob-deep hover:text-mouth inline-flex items-center gap-1"
              >
                /reservar/{b.id} <ExternalLink className="w-3 h-3" />
              </a>
              {!b.active && <span className="ml-2 text-xs font-bold bg-ink text-white rounded-full px-2 py-0.5">Inactivo</span>}
            </div>
            <span className="text-sm font-bold bg-blob-soft text-blob-deep rounded-full px-3 py-1">
              {b.upcoming} {b.upcoming === 1 ? 'cita próxima' : 'citas próximas'}
            </span>
            <span className="text-xs font-bold text-ink/50" title="Gasto estimado del chat con IA este mes">
              IA: ${b.aiSpent.toFixed(2)} de ${b.aiLimit}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setViewing(b.id)} className="btn btn-blue px-3 py-1.5 text-sm">
                <CalendarDays className="w-4 h-4" /> Reservas
              </button>
              <button onClick={() => edit(b.id)} className="btn btn-ghost px-3 py-1.5 text-sm">
                <Pencil className="w-4 h-4" /> Editar
              </button>
              <button
                onClick={() => remove(b)}
                className="rounded-full p-2 text-ink/40 hover:text-mouth hover:bg-mouth/10"
                aria-label={`Eliminar ${b.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <p className="bg-white rounded-2xl p-10 text-center font-bold text-ink/50 shadow-toy">Aún no hay negocios.</p>
        )}
      </div>

      {editing && (
        <BusinessForm
          mode={editing.mode}
          initial={editing.form}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
          onAuthError={onAuthError}
        />
      )}
      {viewing && (
        <BookingsView
          id={viewing}
          onClose={() => {
            setViewing(null);
            refresh();
          }}
          onAuthError={onAuthError}
        />
      )}
    </div>
  );
}

function BusinessForm({ mode, initial, onClose, onSaved, onAuthError }) {
  const [form, setForm] = useState(() => structuredClone(initial));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const updateHours = (day, fn) =>
    setForm((f) => ({ ...f, hours: f.hours.map((ranges, i) => (i === day ? fn(ranges) : ranges)) }));

  const updateService = (i, field, value) =>
    setForm((f) => ({ ...f, services: f.services.map((s, j) => (j === i ? { ...s, [field]: value } : s)) }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const payload = {
      ...form,
      slotMinutes: Number(form.slotMinutes),
      services: form.services.map((s) => ({ ...s, minutes: Number(s.minutes), price: Number(s.price) })),
    };
    try {
      if (mode === 'create') await bookingApi.create(payload);
      else await bookingApi.update(form.id, payload);
      onSaved();
    } catch (err) {
      if (err.status === 401) onAuthError(err);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-ink/60 backdrop-blur-sm overflow-y-auto">
      <form onSubmit={submit} className="w-full max-w-3xl bg-white rounded-[2rem] p-6 shadow-toy-lg my-8 space-y-5 animate-pop-in">
        <div className="flex justify-between items-center">
          <h2 className="font-display font-bold text-2xl">{mode === 'create' ? 'Nuevo negocio' : `Editar ${form.name}`}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-cream" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Nombre del negocio</label>
            <input className={input} value={form.name} onChange={set('name')} maxLength={80} required />
          </div>
          <div>
            <label className={label}>Identificador (dirección de su página)</label>
            <div className="flex items-center gap-1">
              <span className="text-xs font-mono text-ink/45">/reservar/</span>
              <input
                className={`${input} font-mono lowercase disabled:bg-cream disabled:text-ink/50`}
                value={form.id}
                onChange={set('id')}
                placeholder="barberia-juan"
                disabled={mode === 'edit'}
                required
              />
            </div>
          </div>
        </div>

        <div>
          <label className={label}>Descripción corta</label>
          <input className={input} value={form.description} onChange={set('description')} maxLength={300} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Zona horaria</label>
            <input className={`${input} font-mono`} list="tz-list" value={form.timezone} onChange={set('timezone')} required />
            <datalist id="tz-list">
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={label}>Las citas empiezan cada</label>
            <select className={input} value={form.slotMinutes} onChange={set('slotMinutes')}>
              {SLOT_STEPS.map((m) => (
                <option key={m} value={m}>
                  {m} minutos
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Hours */}
        <div>
          <label className={label}>Horario de atención</label>
          <div className="bg-cream rounded-2xl p-3 space-y-2">
            {WEEK.map(([day, name]) => {
              const ranges = form.hours[day];
              return (
                <div key={day} className="flex flex-wrap items-center gap-2">
                  <label className="w-28 flex items-center gap-2 font-bold text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-mouth"
                      checked={ranges.length > 0}
                      onChange={(e) => updateHours(day, () => (e.target.checked ? [['09:00', '18:00']] : []))}
                    />
                    {name}
                  </label>
                  {ranges.length === 0 && <span className="text-xs text-ink/45">Cerrado</span>}
                  {ranges.map(([open, close], r) => (
                    <span key={r} className="flex items-center gap-1 bg-white rounded-xl px-2 py-1">
                      <input
                        type="time"
                        className="text-sm font-semibold bg-transparent"
                        value={open}
                        onChange={(e) => updateHours(day, (rs) => rs.map((x, k) => (k === r ? [e.target.value, x[1]] : x)))}
                      />
                      –
                      <input
                        type="time"
                        className="text-sm font-semibold bg-transparent"
                        value={close}
                        onChange={(e) => updateHours(day, (rs) => rs.map((x, k) => (k === r ? [x[0], e.target.value] : x)))}
                      />
                      {ranges.length > 1 && (
                        <button
                          type="button"
                          onClick={() => updateHours(day, (rs) => rs.filter((_, k) => k !== r))}
                          className="text-ink/40 hover:text-mouth"
                          aria-label="Quitar tramo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </span>
                  ))}
                  {ranges.length > 0 && ranges.length < 3 && (
                    <button
                      type="button"
                      onClick={() => updateHours(day, (rs) => [...rs, ['16:00', '20:00']])}
                      className="text-xs font-extrabold text-blob-deep hover:text-mouth"
                    >
                      + tramo
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Services */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className={label}>Servicios</label>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, services: [...f.services, { name: '', minutes: 30, price: '' }] }))}
              className="text-xs font-extrabold text-blob-deep hover:text-mouth flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Añadir
            </button>
          </div>
          <div className="space-y-2">
            {form.services.map((s, i) => (
              <div key={s.id ?? `new-${i}`} className="flex gap-2 items-center">
                <input
                  className={input}
                  placeholder="Nombre del servicio"
                  value={s.name}
                  onChange={(e) => updateService(i, 'name', e.target.value)}
                  maxLength={60}
                  required
                />
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    className={`${input} w-20`}
                    type="number"
                    min="5"
                    max="480"
                    step="5"
                    value={s.minutes}
                    onChange={(e) => updateService(i, 'minutes', e.target.value)}
                    required
                  />
                  <span className="text-xs text-ink/50">min</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-ink/50">$</span>
                  <input
                    className={`${input} w-24`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={s.price}
                    onChange={(e) => updateService(i, 'price', e.target.value)}
                    required
                  />
                </div>
                <button
                  type="button"
                  disabled={form.services.length === 1}
                  onClick={() => setForm((f) => ({ ...f, services: f.services.filter((_, j) => j !== i) }))}
                  className="rounded-full p-2 text-ink/40 hover:text-mouth hover:bg-mouth/10 disabled:opacity-30"
                  aria-label="Quitar servicio"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className={label}>Correo del dueño (cuenta de cliente)</label>
          <input
            className={input}
            type="email"
            value={form.ownerEmail}
            onChange={set('ownerEmail')}
            placeholder="dueño@negocio.com"
          />
          <p className="text-xs text-ink/45 mt-1">
            Si tiene cuenta con este correo y el asistente de reservas activo, verá su agenda en su panel.
          </p>
        </div>

        <div>
          <label className={label}>Información para el asistente</label>
          <textarea
            className={`${input} min-h-28`}
            value={form.faq}
            onChange={set('faq')}
            maxLength={3000}
            placeholder="Dirección, formas de pago, políticas de cancelación, estacionamiento, preguntas frecuentes…"
          />
          <p className="text-xs text-ink/45 mt-1">El asistente de IA usa este texto para responder preguntas de los clientes.</p>
        </div>

        <label className="flex items-center gap-2 font-bold text-sm cursor-pointer">
          <input type="checkbox" className="w-5 h-5 accent-mouth" checked={form.active} onChange={set('active')} />
          Activo (su página de reservas está visible)
        </label>

        {error && <p className="bg-mouth/10 text-mouth rounded-xl text-sm font-bold p-3">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button disabled={busy} className="btn btn-red flex-1 py-3">
            {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
          <button type="button" onClick={onClose} className="btn btn-ghost px-5 py-2.5">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

function BookingsView({ id, onClose, onAuthError }) {
  const [biz, setBiz] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    bookingApi
      .get(id)
      .then(setBiz)
      .catch((err) => (err.status === 401 ? onAuthError(err) : setError(err.message)));

  useEffect(() => {
    load();
  }, [id]);

  const setStatus = async (b, status) => {
    if (status === 'cancelled' && !window.confirm(`¿Cancelar la cita de ${b.name} (${fmtDate(b.date)} ${b.time})?`)) return;
    try {
      await bookingApi.setBookingStatus(id, b.id, status);
      load();
    } catch (err) {
      err.status === 401 ? onAuthError(err) : setError(err.message);
    }
  };

  const bookings = (biz?.bookings ?? [])
    .filter((b) => showPast || b.date >= biz.today)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-ink/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl bg-white rounded-[2rem] p-6 shadow-toy-lg my-8 animate-pop-in">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="font-display font-bold text-2xl">Reservas</h2>
            <p className="text-sm text-ink/50">{biz?.name}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-cream" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm font-bold mb-4 cursor-pointer">
          <input type="checkbox" className="accent-mouth" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          Mostrar también citas pasadas
        </label>

        {error && <p className="bg-mouth/10 text-mouth rounded-xl text-sm font-bold p-3 mb-3">{error}</p>}
        {!biz && <p className="text-ink/50 font-bold">Cargando…</p>}
        {biz && bookings.length === 0 && (
          <p className="bg-cream rounded-2xl p-8 text-center font-bold text-ink/50">No hay citas {showPast ? '' : 'próximas'}.</p>
        )}

        <div className="space-y-2">
          {bookings.map((b) => (
            <div
              key={b.id}
              className={`rounded-2xl p-3 flex flex-wrap items-center gap-3 ${b.status === 'cancelled' ? 'bg-cream opacity-60' : 'bg-cream'}`}
            >
              <div className="w-24 text-center">
                <p className="text-xs font-bold uppercase text-ink/50">{fmtDate(b.date)}</p>
                <p className="font-display font-bold text-xl">{b.time}</p>
              </div>
              <div className="flex-1 min-w-40">
                <p className="font-display font-semibold leading-tight">
                  {b.name} <span className="font-sans text-xs font-normal text-ink/50">· {b.phone}</span>
                </p>
                <p className="text-sm text-ink/70">
                  {b.serviceName} · {b.minutes} min
                  {b.notes && <span className="text-ink/50"> · “{b.notes}”</span>}
                </p>
                <p className="text-xs text-ink/45 font-mono">
                  {b.id} · {b.source === 'chat' ? 'vía asistente IA' : 'vía formulario'}
                  {b.status === 'cancelled' && <span className="ml-2 font-sans font-bold text-mouth">CANCELADA</span>}
                </p>
              </div>
              {b.status === 'confirmed' ? (
                <button onClick={() => setStatus(b, 'cancelled')} className="btn btn-ghost px-3 py-1.5 text-sm">
                  <Ban className="w-4 h-4" /> Cancelar
                </button>
              ) : (
                <button onClick={() => setStatus(b, 'confirmed')} className="btn btn-ghost px-3 py-1.5 text-sm">
                  <Undo2 className="w-4 h-4" /> Restaurar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
