import { useEffect, useState } from 'react';
import {
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  X,
  Save,
  RefreshCw,
  ArrowRight,
  Store,
  Lock,
  Package,
  CalendarDays,
  Users,
} from 'lucide-react';
import ClientsPanel from './AdminClients';
import BusinessesPanel from './AdminBusinesses';
import { api } from './api';
import { ICONS, getIcon, money, perLabel } from './icons';
import { ICON_NAMES } from '../shared/constants.js';
import Mascot from './Mascot';

const EMPTY_FORM = {
  id: '',
  name: '',
  price: '',
  period: 'month',
  category: '',
  icon: 'code',
  desc: '',
  details: '',
  toolUrl: '',
  includes: '',
  demoUrl: '',
  specs: [],
  published: true,
};

const toForm = (p) => ({ ...p, period: p.period ?? 'once', toolUrl: p.toolUrl ?? '', includes: (p.includes ?? []).join(', '), demoUrl: p.demoUrl ?? '', price: String(p.price), specs: Object.entries(p.specs).map(([key, value]) => ({ key, value })) });

const toPayload = (f) => ({
  ...f,
  includes: f.includes.split(/[s,]+/).filter(Boolean),
  price: Number(f.price),
  specs: Object.fromEntries(f.specs.filter((s) => s.key.trim() || s.value.trim()).map((s) => [s.key, s.value])),
});

const input =
  'w-full rounded-xl border-2 border-ink/10 bg-white px-3 py-2 text-sm font-semibold focus:outline-none focus:border-blob focus:ring-4 focus:ring-blob/30';
const label = 'block text-xs font-extrabold uppercase tracking-wider text-ink/50 mb-1';

export default function Admin() {
  const [auth, setAuth] = useState('CHECKING'); // CHECKING | OUT | IN

  useEffect(() => {
    api
      .me()
      .then((r) => setAuth(r.admin ? 'IN' : 'OUT'))
      .catch(() => setAuth('OUT'));
  }, []);

  return (
    <div className="min-h-screen bg-cream text-ink font-sans selection:bg-blob">
      <div className="bg-coal text-white py-3 px-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <span className="flex items-center gap-3 font-display font-semibold">
            <Mascot className="w-8" /> Panel de administración
          </span>
          <a href="/" className="flex items-center gap-1.5 text-sm font-bold text-blob hover:text-white">
            <Store className="w-4 h-4" /> Ver tienda
          </a>
        </div>
      </div>
      {auth === 'CHECKING' && <p className="p-8 text-center font-bold text-ink/50">Comprobando sesión…</p>}
      {auth === 'OUT' && <Login onSuccess={() => setAuth('IN')} />}
      {auth === 'IN' && <Dashboard onLogout={() => setAuth('OUT')} />}
    </div>
  );
}

function Login({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(username, password);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto mt-16 bg-white rounded-[2rem] p-7 shadow-toy-lg space-y-4 animate-pop-in">
      <div className="flex flex-col items-center text-center pb-2">
        <div className="hex w-16 h-16 bg-blob flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="font-display font-bold text-2xl mt-3">Acceso de admin</h1>
        <p className="text-sm text-ink/50">Solo para el dueño de la tienda.</p>
      </div>
      <div>
        <label className={label}>Usuario</label>
        <input className={input} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
      </div>
      <div>
        <label className={label}>Contraseña</label>
        <input
          className={input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      {error && <p className="bg-mouth/10 text-mouth rounded-xl text-sm font-bold p-3">{error}</p>}
      <button disabled={busy} className="btn btn-red w-full py-3">
        {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        Entrar
      </button>
    </form>
  );
}

const TABS = [
  ['products', 'Productos', Package],
  ['businesses', 'Negocios y reservas', CalendarDays],
  ['clients', 'Clientes', Users],
];

function Dashboard({ onLogout }) {
  const [tab, setTab] = useState(() => ({ '#negocios': 'businesses', '#clientes': 'clients' })[window.location.hash] ?? 'products');

  const logout = async () => {
    await api.logout().catch(() => {});
    onLogout();
  };

  const select = (id) => {
    setTab(id);
    history.replaceState(null, '', { businesses: '#negocios', clients: '#clientes' }[id] ?? '#');
  };

  return (
    <div className="page py-8">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-8">
        <div className="flex gap-1 bg-white rounded-full p-1 shadow-toy">
          {TABS.map(([id, text, Icon]) => (
            <button
              key={id}
              onClick={() => select(id)}
              className={`rounded-full px-4 py-2 font-display font-semibold text-sm flex items-center gap-2 transition-colors ${
                tab === id ? 'bg-ink text-blob' : 'hover:bg-cream'
              }`}
            >
              <Icon className="w-4 h-4" /> {text}
            </button>
          ))}
        </div>
        <button onClick={logout} className="btn btn-ghost px-4 py-2">
          <LogOut className="w-4 h-4" /> Salir
        </button>
      </div>
      {tab === 'products' && <ProductsPanel onLogout={onLogout} />}
      {tab === 'businesses' && <BusinessesPanel onAuthError={onLogout} />}
      {tab === 'clients' && <ClientsPanel onAuthError={onLogout} />}
    </div>
  );
}

function ProductsPanel({ onLogout }) {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null); // null | { mode: 'create' | 'edit', form }
  const [error, setError] = useState('');

  const handleAuthError = (err) => {
    if (err.status === 401) onLogout();
    else setError(err.message);
  };

  const refresh = () => api.adminProducts().then(setProducts).catch(handleAuthError);

  useEffect(() => {
    refresh();
  }, []);

  const togglePublished = async (p) => {
    try {
      await api.updateProduct(p.id, { ...p, published: !p.published });
      refresh();
    } catch (err) {
      handleAuthError(err);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`¿Eliminar definitivamente ${p.id} — ${p.name}?`)) return;
    try {
      await api.deleteProduct(p.id);
      refresh();
    } catch (err) {
      handleAuthError(err);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="font-display font-bold text-3xl">
          Productos <span className="text-ink/40">({products.length})</span>
        </h1>
        <button onClick={() => setEditing({ mode: 'create', form: EMPTY_FORM })} className="btn btn-red px-4 py-2.5">
          <Plus className="w-4 h-4" /> Nuevo producto
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
        {products.map((p) => {
          const Icon = getIcon(p.icon);
          return (
            <div
              key={p.id}
              className={`bg-white rounded-2xl p-4 shadow-toy flex flex-wrap items-center gap-4 ${p.published ? '' : 'opacity-60'}`}
            >
              <div className="hex w-11 h-11 bg-blob flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-48">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-mono text-ink/45">{p.id}</span>
                  <span className="font-extrabold uppercase tracking-wider text-blob-deep">{p.category}</span>
                  {!p.published && <span className="font-bold bg-ink text-white rounded-full px-2 py-0.5">Borrador</span>}
                </div>
                <p className="font-display font-semibold text-lg leading-tight">{p.name}</p>
              </div>
              <span className="bg-mouth text-white font-display font-bold px-3 py-1 rounded-full">
                {money(p.price)}
                <span className="text-xs font-semibold">{perLabel(p)}</span>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => togglePublished(p)}
                  title={p.published ? 'Ocultar de la tienda' : 'Publicar'}
                  className="btn btn-ghost px-3 py-1.5 text-sm"
                >
                  {p.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {p.published ? 'Ocultar' : 'Publicar'}
                </button>
                <button onClick={() => setEditing({ mode: 'edit', form: toForm(p) })} className="btn btn-blue px-3 py-1.5 text-sm">
                  <Pencil className="w-4 h-4" /> Editar
                </button>
                <button
                  onClick={() => remove(p)}
                  className="rounded-full p-2 text-ink/40 hover:text-mouth hover:bg-mouth/10"
                  aria-label={`Eliminar ${p.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        {products.length === 0 && (
          <p className="bg-white rounded-2xl p-10 text-center font-bold text-ink/50 shadow-toy">
            Aún no hay productos. Crea el primero.
          </p>
        )}
      </div>

      {editing && (
        <ProductForm
          mode={editing.mode}
          initial={editing.form}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
          onAuthError={handleAuthError}
        />
      )}
    </div>
  );
}

function ProductForm({ mode, initial, onClose, onSaved, onAuthError }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const setSpec = (i, field, value) =>
    setForm((f) => ({ ...f, specs: f.specs.map((s, j) => (j === i ? { ...s, [field]: value } : s)) }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = toPayload(form);
      if (mode === 'create') await api.createProduct(payload);
      else await api.updateProduct(form.id, payload);
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
      <form onSubmit={submit} className="w-full max-w-2xl bg-white rounded-[2rem] p-6 shadow-toy-lg my-8 space-y-4 animate-pop-in">
        <div className="flex justify-between items-center">
          <h2 className="font-display font-bold text-2xl">{mode === 'create' ? 'Nuevo producto' : `Editar ${form.id}`}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-cream" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className={label}>ID / Código</label>
            <input
              className={`${input} uppercase font-mono disabled:bg-cream disabled:text-ink/50`}
              value={form.id}
              onChange={set('id')}
              placeholder="DEV-05"
              disabled={mode === 'edit'}
              required
            />
          </div>
          <div>
            <label className={label}>Precio (USD)</label>
            <input className={input} type="number" min="0" step="0.01" value={form.price} onChange={set('price')} required />
          </div>
          <div>
            <label className={label}>Tipo de pago</label>
            <select className={input} value={form.period} onChange={set('period')}>
              <option value="month">Mensual</option>
              <option value="once">Pago único</option>
            </select>
          </div>
          <div>
            <label className={label}>Categoría</label>
            <input className={`${input} uppercase`} value={form.category} onChange={set('category')} placeholder="SOFTWARE" required />
          </div>
        </div>

        <div>
          <label className={label}>Nombre</label>
          <input className={input} value={form.name} onChange={set('name')} maxLength={80} required />
        </div>

        <div>
          <label className={label}>Icono</label>
          <div className="flex flex-wrap gap-2">
            {ICON_NAMES.map((name) => {
              const Icon = ICONS[name];
              const active = form.icon === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, icon: name }))}
                  title={name}
                  className={`hex w-11 h-11 flex items-center justify-center transition-colors ${
                    active ? 'bg-mouth text-white' : 'bg-blob-soft hover:bg-blob'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={label}>Descripción corta (tarjeta)</label>
          <input className={input} value={form.desc} onChange={set('desc')} maxLength={200} required />
        </div>

        <div>
          <label className={label}>Detalles (ventana de producto)</label>
          <textarea className={`${input} min-h-24`} value={form.details} onChange={set('details')} maxLength={2000} />
        </div>

        <div>
          <label className={label}>Enlace a la herramienta (opcional)</label>
          <input
            className={`${input} font-mono`}
            value={form.toolUrl}
            onChange={set('toolUrl')}
            placeholder="/herramientas/convertidor"
            maxLength={100}
          />
          <p className="text-xs text-ink/45 mt-1">Si lo rellenas, el botón del servicio abre esta página en vez de añadirlo al carrito.</p>
        </div>

        <div>
          <label className={label}>Enlace a una demo (opcional)</label>
          <input
            className={`${input} font-mono`}
            value={form.demoUrl}
            onChange={set('demoUrl')}
            placeholder="/reservar/demo"
            maxLength={100}
          />
          <p className="text-xs text-ink/45 mt-1">Muestra un botón "Ver demo" en la tarjeta del servicio.</p>
        </div>

        <div>
          <label className={label}>Servicios incluidos (solo para planes)</label>
          <input
            className={`${input} font-mono uppercase`}
            value={form.includes}
            onChange={set('includes')}
            placeholder="AHO-01, TRA-01, PDF-01"
          />
          <p className="text-xs text-ink/45 mt-1">
            IDs separados por comas. Quien active este plan tendrá acceso a todos ellos.
          </p>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className={label}>Especificaciones técnicas</label>
            <button
              type="button"
              disabled={form.specs.length >= 12}
              onClick={() => setForm((f) => ({ ...f, specs: [...f.specs, { key: '', value: '' }] }))}
              className="text-xs font-extrabold text-blob-deep hover:text-mouth disabled:opacity-40 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Añadir
            </button>
          </div>
          <div className="space-y-2">
            {form.specs.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={`${input} w-2/5 font-mono`}
                  placeholder="version"
                  value={s.key}
                  onChange={(e) => setSpec(i, 'key', e.target.value)}
                  maxLength={30}
                />
                <input
                  className={`${input} font-mono`}
                  placeholder="v1.0.0"
                  value={s.value}
                  onChange={(e) => setSpec(i, 'value', e.target.value)}
                  maxLength={100}
                />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, specs: f.specs.filter((_, j) => j !== i) }))}
                  className="rounded-full px-2.5 text-ink/40 hover:text-mouth hover:bg-mouth/10"
                  aria-label="Quitar especificación"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {form.specs.length === 0 && <p className="text-xs text-ink/40">Sin especificaciones.</p>}
          </div>
        </div>

        <label className="flex items-center gap-2 font-bold text-sm cursor-pointer">
          <input type="checkbox" className="w-5 h-5 accent-mouth" checked={form.published} onChange={set('published')} />
          Publicado (visible en la tienda)
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
