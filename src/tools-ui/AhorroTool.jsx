import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, PiggyBank, Send, Settings2, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { tool } from '../api';
import { Card, ErrorBox, input, label, localToday, money } from './ui';

const api = tool('ahorro');
const EXAMPLES = ['gasté 120 en el súper', 'uber 85', 'cobré 15000 de sueldo', 'ayer netflix 199'];

const monthLabel = (m) => {
  const s = new Date(`${m}-15T12:00:00Z`).toLocaleDateString('es', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const shiftMonth = (m, n) => {
  const d = new Date(`${m}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
const dayLabel = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export default function AhorroTool() {
  const [data, setData] = useState(null);
  const [month, setMonth] = useState(localToday().slice(0, 7));
  const [text, setText] = useState('');
  const [reply, setReply] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api.get().then(setData).catch((err) => setError(err.message));
  }, []);

  const send = async (value) => {
    value = value.trim();
    if (!value || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/entries', { text: value, today: localToday() });
      setData(res);
      setReply(res.reply);
      setText('');
      setMonth(res.entry.date.slice(0, 7));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const summary = useMemo(() => {
    if (!data) return null;
    const entries = data.entries.filter((e) => e.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const spent = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const income = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const byCategory = {};
    for (const e of entries) if (e.type === 'expense') byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    return { entries, spent, income, saved: income - spent, byCategory };
  }, [data, month]);

  if (!data) return <p className="text-center font-bold text-ink/50">{error || 'Cargando…'}</p>;

  return (
    <div className="grid lg:grid-cols-[1.35fr_1fr] gap-6 items-start">
      <div className="space-y-6 min-w-0">
        {/* Chat-style input */}
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
            className="flex gap-2"
          >
            <input
              className={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='Escribe un gasto o ingreso: "gasté 20 en comida"'
              maxLength={300}
              autoFocus
            />
            <button disabled={busy || !text.trim()} className="btn btn-red w-12 h-12 shrink-0" aria-label="Anotar">
              <Send className="w-5 h-5" />
            </button>
          </form>
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => send(ex)} className="text-xs font-bold bg-blob-soft text-blob-deep rounded-full px-3 py-1.5 hover:bg-blob">
                {ex}
              </button>
            ))}
          </div>
          {reply && (
            <div className="mt-4 space-y-2 animate-pop-in">
              <p className="bg-cream rounded-2xl rounded-tl-md px-4 py-2.5 text-sm font-semibold">{reply.text}</p>
              {reply.alert && (
                <p className="bg-mouth/10 text-mouth rounded-2xl px-4 py-2.5 text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {reply.alert}
                </p>
              )}
            </div>
          )}
          <div className="mt-3">
            <ErrorBox error={error} onClose={() => setError('')} />
          </div>
        </Card>

        {/* Month */}
        <div className="flex items-center justify-between">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="btn btn-ghost w-10 h-10" aria-label="Mes anterior">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="font-display font-bold text-2xl">{monthLabel(month)}</h2>
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="btn btn-ghost w-10 h-10" aria-label="Mes siguiente">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Stat tiles */}
        <div className="grid sm:grid-cols-3 gap-3">
          <Stat icon={TrendingDown} title="Gastado" value={money(summary.spent)} />
          <Stat icon={TrendingUp} title="Ingresos" value={money(summary.income)} />
          <Stat
            icon={PiggyBank}
            title="Ahorrado"
            value={money(summary.saved)}
            negative={summary.saved < 0}
            footer={
              data.goal > 0 && (
                <GoalBar saved={Math.max(0, summary.saved)} goal={data.goal} />
              )
            }
          />
        </div>

        <CategoryChart categories={data.categories} byCategory={summary.byCategory} budgets={data.budgets} />
      </div>

      <div className="space-y-6 min-w-0">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-lg">Presupuestos y meta</h3>
            <button onClick={() => setEditing((v) => !v)} className="btn btn-ghost px-3 py-1.5 text-sm">
              <Settings2 className="w-4 h-4" /> {editing ? 'Cerrar' : 'Editar'}
            </button>
          </div>
          {editing ? (
            <BudgetEditor data={data} onSaved={(d) => (setData(d), setEditing(false))} />
          ) : (
            <p className="text-sm text-ink/60">
              {Object.keys(data.budgets).length
                ? `${Object.keys(data.budgets).length} presupuestos por categoría`
                : 'Aún no tienes presupuestos.'}{' '}
              · Meta de ahorro mensual: {data.goal ? money(data.goal) : 'sin definir'}
            </p>
          )}
        </Card>

        <Card>
          <h3 className="font-display font-semibold text-lg mb-3">
            Movimientos <span className="text-ink/40">({summary.entries.length})</span>
          </h3>
          {summary.entries.length === 0 ? (
            <p className="text-sm text-ink/50 font-bold">Sin movimientos este mes.</p>
          ) : (
            <ul className="divide-y-2 divide-cream max-h-[560px] overflow-y-auto -mx-1 px-1">
              {summary.entries.map((e) => (
                <li key={e.id} className="py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" title={e.note}>
                      {e.note || data.categories[e.category] || 'Ingreso'}
                    </p>
                    <p className="text-xs text-ink/50 flex items-center gap-1.5">
                      {dayLabel(e.date)} ·
                      {e.type === 'expense' ? (
                        <select
                          value={e.category}
                          onChange={(ev) => api.patch(`/entries/${e.id}`, { category: ev.target.value }).then(setData)}
                          className="bg-transparent font-bold text-ink/60 rounded focus:outline-none focus:ring-2 focus:ring-blob"
                          aria-label="Categoría"
                        >
                          {Object.entries(data.categories).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-bold">Ingreso</span>
                      )}
                    </p>
                  </div>
                  <span className={`font-display font-bold shrink-0 ${e.type === 'income' ? 'text-blob-deep' : ''}`}>
                    {e.type === 'income' ? '+' : '−'}
                    {money(e.amount)}
                  </span>
                  <button
                    onClick={() => api.del(`/entries/${e.id}`).then(setData)}
                    className="rounded-full p-1.5 text-ink/30 hover:text-mouth hover:bg-mouth/10"
                    aria-label="Borrar movimiento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, title, value, negative, footer }) {
  return (
    <div className="bg-white rounded-2xl shadow-toy p-4">
      <p className="text-xs font-bold text-ink/50 flex items-center gap-1.5">
        <Icon className="w-4 h-4" /> {title}
      </p>
      <p className={`font-display font-bold text-2xl mt-1 ${negative ? 'text-mouth' : ''}`}>{value}</p>
      {footer}
    </div>
  );
}

function GoalBar({ saved, goal }) {
  const pct = Math.min(100, (saved / goal) * 100);
  return (
    <div className="mt-2">
      <div className="h-1.5 bg-cream rounded-full overflow-hidden">
        <div className="h-full bg-data rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-ink/50 mt-1">
        {Math.round(pct)}% de tu meta de {money(goal)}
      </p>
    </div>
  );
}

// Spending per category: one hue (single measure), budget shown as a tick; overspend in red with icon + text.
function CategoryChart({ categories, byCategory, budgets }) {
  const [hover, setHover] = useState(null);
  const rows = Object.keys(categories)
    .filter((k) => byCategory[k] || budgets[k])
    .map((k) => ({ key: k, name: categories[k], spent: byCategory[k] ?? 0, budget: budgets[k] ?? 0 }))
    .sort((a, b) => b.spent - a.spent);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.spent, r.budget)));

  return (
    <Card>
      <h3 className="font-display font-semibold text-lg">Gasto por categoría</h3>
      <p className="text-xs text-ink/50 mb-4">La línea vertical marca tu presupuesto.</p>
      {rows.length === 0 ? (
        <p className="text-sm text-ink/50 font-bold">Anota tu primer gasto para ver el reparto.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const over = r.budget > 0 && r.spent > r.budget;
            const withinPct = (Math.min(r.spent, r.budget || r.spent) / max) * 100;
            const overPct = over ? ((r.spent - r.budget) / max) * 100 : 0;
            return (
              <li
                key={r.key}
                className="relative"
                onMouseEnter={() => setHover(r.key)}
                onMouseLeave={() => setHover(null)}
              >
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-bold">{r.name}</span>
                  <span className="font-semibold text-ink/70">
                    {money(r.spent)}
                    {r.budget > 0 && <span className="text-ink/45"> / {money(r.budget)}</span>}
                    {over && (
                      <span className="ml-2 inline-flex items-center gap-1 text-mouth font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" /> Excedido
                      </span>
                    )}
                  </span>
                </div>
                <div className="relative h-3 bg-cream rounded-full">
                  <div
                    className={`absolute inset-y-0 left-0 bg-data rounded-l-full ${over ? '' : 'rounded-r-full'}`}
                    style={{ width: `${withinPct}%` }}
                  />
                  {over && (
                    <div
                      className="absolute inset-y-0 bg-mouth rounded-r-full"
                      style={{ left: `calc(${withinPct}% + 2px)`, width: `calc(${overPct}% - 2px)` }}
                    />
                  )}
                  {r.budget > 0 && (
                    <div className="absolute -top-1 -bottom-1 w-0.5 bg-ink rounded" style={{ left: `calc(${(r.budget / max) * 100}% - 1px)` }} />
                  )}
                </div>
                {hover === r.key && (
                  <div className="absolute right-0 -top-9 z-10 bg-ink text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 shadow-toy pointer-events-none">
                    {r.name}: {money(r.spent)}
                    {r.budget > 0 && ` de ${money(r.budget)} (${Math.round((r.spent / r.budget) * 100)}%)`}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function BudgetEditor({ data, onSaved }) {
  const [budgets, setBudgets] = useState(() =>
    Object.fromEntries(Object.keys(data.categories).map((k) => [k, data.budgets[k] ? String(data.budgets[k]) : '']))
  );
  const [goal, setGoal] = useState(data.goal ? String(data.goal) : '');
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    try {
      onSaved(await api.put('/settings', { budgets, goal: Number(goal) || 0 }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={save} className="space-y-3">
      <div>
        <label className={label}>Meta de ahorro mensual</label>
        <input className={input} type="number" min="0" step="0.01" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="0" />
      </div>
      <p className={label}>Presupuesto mensual por categoría</p>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(data.categories).map(([k, name]) => (
          <label key={k} className="text-sm font-bold">
            {name}
            <input
              className={`${input} mt-1`}
              type="number"
              min="0"
              step="0.01"
              value={budgets[k]}
              onChange={(e) => setBudgets({ ...budgets, [k]: e.target.value })}
              placeholder="Sin límite"
            />
          </label>
        ))}
      </div>
      <ErrorBox error={error} />
      <button className="btn btn-red w-full py-3">Guardar</button>
    </form>
  );
}
