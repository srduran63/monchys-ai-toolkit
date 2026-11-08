import { useEffect, useState } from 'react';
import { Gift, Search, X } from 'lucide-react';
import { accountApi, api } from './api';
import { money } from './icons';

const fmtDay = (iso) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS = {
  active: ['Activa', 'bg-blob text-ink'],
  cancelled: ['Cancelada', 'bg-mouth/10 text-mouth'],
};

// Emails that get every tool for free (friends, family, testers)
function FreeAccessCard({ users, onAuthError }) {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    accountApi
      .adminFreeAccess()
      .then(({ emails }) => {
        setSaved(emails);
        setText(emails.join('\n'));
      })
      .catch((err) => (err.status === 401 ? onAuthError(err) : setStatus(err.message)));
  }, []);

  const save = async () => {
    setStatus('');
    try {
      const { emails } = await accountApi.saveFreeAccess(text.split(/[\s,;]+/).filter(Boolean));
      setSaved(emails);
      setText(emails.join('\n'));
      setStatus('Guardado ✓');
    } catch (err) {
      setStatus(err.message);
    }
  };

  // Listed emails whose account can't use it yet (no account, or never signed in with Google/Apple)
  const pending = (saved ?? []).filter((e) => !users?.some((u) => u.email === e && u.freeAccess));

  return (
    <details className="bg-white rounded-2xl shadow-toy p-4 mb-6">
      <summary className="cursor-pointer font-display font-semibold text-lg flex items-center gap-2">
        <Gift className="w-5 h-5 text-mouth" /> Acceso gratis a todo {saved && <span className="text-ink/40">({saved.length})</span>}
      </summary>
      <p className="text-sm text-ink/60 mt-2">
        Un correo por línea. Esas cuentas tienen todas las herramientas sin pagar. Deben entrar con <b>Google o Apple</b> usando ese mismo correo (así se
        comprueba que el correo es suyo).
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={'amiga@gmail.com\nprimo@gmail.com'}
        className="w-full mt-3 rounded-xl bg-cream p-3 font-mono text-sm focus:outline-none focus:ring-4 focus:ring-blob/40"
      />
      <div className="flex flex-wrap items-center gap-3 mt-2">
        <button onClick={save} className="btn btn-red px-5 py-2 text-sm">
          Guardar
        </button>
        {status && <span className="text-sm font-bold text-ink/60">{status}</span>}
      </div>
      {pending.length > 0 && (
        <p className="text-xs text-ink/50 mt-3">Aún sin usar (no han entrado con Google o Apple): {pending.join(', ')}</p>
      )}
    </details>
  );
}

export default function ClientsPanel({ onAuthError }) {
  const [users, setUsers] = useState(null);
  const [aiMonth, setAiMonth] = useState(0);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([accountApi.adminUsers(), api.adminProducts()])
      .then(([u, p]) => {
        setUsers(u);
        setProducts(p);
      })
      .catch((err) => (err.status === 401 ? onAuthError(err) : setError(err.message)));
    accountApi
      .adminAiUsage()
      .then((d) => setAiMonth(Object.values(d[new Date().toISOString().slice(0, 7)] ?? {}).reduce((s, f) => s + f.cost, 0)))
      .catch(() => {});
  }, []);

  const nameOf = (id) => products.find((p) => p.id === id)?.name ?? id;
  const q = query.trim().toLowerCase();
  const shown = (users ?? [])
    .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.includes(q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const all = users ?? [];
  const paying = all.filter((u) => u.subscriptions.some((s) => s.status === 'active' && s.period === 'month'));
  const mrr = all
    .flatMap((u) => u.subscriptions)
    .filter((s) => s.status === 'active' && s.period === 'month')
    .reduce((sum, s) => sum + (s.price ?? 0), 0);

  return (
    <div>
      <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
        <div>
          <h1 className="font-display font-bold text-3xl">
            Clientes <span className="text-ink/40">({all.length})</span>
          </h1>
          <p className="text-sm text-ink/50">Cuentas registradas y sus suscripciones.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white rounded-2xl shadow-toy px-4 py-2 text-center">
            <p className="text-xs font-bold text-ink/50">Con membresía</p>
            <p className="font-display font-bold text-xl">{paying.length}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-toy px-4 py-2 text-center">
            <p className="text-xs font-bold text-ink/50">Ingreso mensual (demo)</p>
            <p className="font-display font-bold text-xl text-mouth">{money(mrr)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-toy px-4 py-2 text-center">
            <p className="text-xs font-bold text-ink/50">Gasto en IA este mes</p>
            <p className="font-display font-bold text-xl">≈ ${aiMonth.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <FreeAccessCard users={users} onAuthError={onAuthError} />

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o correo"
          className="w-full rounded-full bg-white pl-9 pr-4 py-2.5 font-semibold shadow-toy focus:outline-none focus:ring-4 focus:ring-blob/40"
        />
      </div>

      {error && (
        <p className="bg-mouth/10 text-mouth rounded-xl text-sm font-bold p-3 mb-4 flex justify-between">
          {error}
          <button onClick={() => setError('')} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </p>
      )}
      {!users && !error && <p className="text-ink/50 font-bold">Cargando…</p>}
      {users && shown.length === 0 && (
        <p className="bg-white rounded-2xl p-10 text-center font-bold text-ink/50 shadow-toy">
          {all.length === 0 ? 'Aún no hay clientes registrados.' : 'Ningún cliente coincide con la búsqueda.'}
        </p>
      )}

      <div className="space-y-3">
        {shown.map((u) => (
          <div key={u.id} className="bg-white rounded-2xl p-4 shadow-toy flex flex-wrap items-start gap-4">
            <span className="hex w-11 h-11 bg-blob inline-flex items-center justify-center font-bold shrink-0">
              {u.name[0].toUpperCase()}
            </span>
            <div className="flex-1 min-w-48">
              <p className="font-display font-semibold text-lg leading-tight">{u.name}</p>
              <p className="text-sm text-ink/60">{u.email}</p>
              <p className="text-xs text-ink/45">
                Desde el {fmtDay(u.createdAt)} · IA este mes: ${u.aiSpent.toFixed(2)} de ${u.aiLimit}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 max-w-md">
              {u.freeAccess && <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-mouth text-white">Acceso gratis a todo</span>}
              {u.subscriptions.length === 0 && !u.freeAccess && <span className="text-xs font-bold text-ink/40">Sin suscripciones</span>}
              {u.subscriptions.map((s) => {
                const [text, cls] = s.period === 'once' ? ['Pago único', 'bg-cream text-ink/70'] : STATUS[s.status];
                return (
                  <span key={s.id} className={`text-xs font-bold rounded-full px-2.5 py-1 ${cls}`} title={text}>
                    {nameOf(s.productId)} · {text}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
