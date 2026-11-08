import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, RefreshCw } from 'lucide-react';
import AppHeader from './AppHeader';
import { accountApi } from './api';
import { safeNext, useSession } from './session';
import SocialLogin from './SocialLogin';

const input =
  'w-full rounded-xl border-2 border-ink/10 bg-white px-3 py-2.5 font-semibold focus:outline-none focus:border-blob focus:ring-4 focus:ring-blob/30';
const label = 'block text-xs font-extrabold uppercase tracking-wider text-ink/50 mb-1';

const nextParam = () => safeNext(new URLSearchParams(window.location.search).get('next'));
const withNext = (path) => {
  const next = nextParam();
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
};

function AuthShell({ title, subtitle, children, footer }) {
  const session = useSession();

  // Already signed in: nothing to do here
  useEffect(() => {
    if (!session.loading && session.user) window.location.replace(nextParam() ?? '/perfil');
  }, [session.loading, session.user]);

  return (
    <div className="min-h-screen bg-cream text-ink font-sans selection:bg-blob">
      <AppHeader />
      <main className="max-w-md mx-auto px-4 py-10 md:py-16">
        <div className="bg-white rounded-[2rem] shadow-toy-lg p-7 animate-pop-in">
          <h1 className="font-display font-bold text-fluid-h1">{title}</h1>
          <p className="text-ink/60 mt-1 mb-6">{subtitle}</p>
          {children}
        </div>
        <p className="text-center text-sm text-ink/60 mt-5">{footer}</p>
      </main>
    </div>
  );
}

function PasswordInput({ value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        className={`${input} pr-11`}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        minLength={8}
        required
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-ink/50 hover:bg-cream"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function useSubmit(action) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      session.apply(await action());
      window.location.href = nextParam() ?? '/perfil';
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, submit } = useSubmit(() => accountApi.login(email, password));

  return (
    <AuthShell
      title="Hola de nuevo"
      subtitle="Entra para usar tus herramientas."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <a href={withNext('/registro')} className="font-bold text-blob-deep hover:text-mouth">
            Crear cuenta
          </a>
        </>
      }
    >
      <SocialLogin next={nextParam()} />
      <div className="h-4" />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={label}>Correo electrónico</label>
          <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div>
          <label className={label}>Contraseña</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <p className="bg-mouth/10 text-mouth rounded-xl text-sm font-bold p-3">{error}</p>}
        <button disabled={busy} className="btn btn-red w-full py-3.5 text-lg">
          {busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />} Entrar
        </button>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const { busy, error, submit } = useSubmit(() => accountApi.register(form));
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Gratis. Activa solo las herramientas que necesites."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <a href={withNext('/entrar')} className="font-bold text-blob-deep hover:text-mouth">
            Entrar
          </a>
        </>
      }
    >
      <SocialLogin next={nextParam()} />
      <div className="h-4" />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={label}>Nombre</label>
          <input className={input} value={form.name} onChange={set('name')} autoComplete="name" maxLength={60} required />
        </div>
        <div>
          <label className={label}>Correo electrónico</label>
          <input className={input} type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
        </div>
        <div>
          <label className={label}>Contraseña</label>
          <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" />
          <p className="text-xs text-ink/45 mt-1">Mínimo 8 caracteres.</p>
        </div>
        {error && <p className="bg-mouth/10 text-mouth rounded-xl text-sm font-bold p-3">{error}</p>}
        <button disabled={busy} className="btn btn-red w-full py-3.5 text-lg">
          {busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />} Crear cuenta
        </button>
        <p className="text-xs text-ink/50 text-center">
          Al crear tu cuenta aceptas los <a href="/terminos" className="underline">Términos</a> y la{' '}
          <a href="/privacidad" className="underline">Política de privacidad</a>.
        </p>
      </form>
    </AuthShell>
  );
}
