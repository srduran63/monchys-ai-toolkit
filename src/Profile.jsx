import { useEffect, useState } from 'react';
import { ArrowRight, Check, Crown, KeyRound, Pencil, Receipt, RefreshCw, Save, X } from 'lucide-react';
import AppHeader from './AppHeader';
import { LegalFooter } from './Legal';
import { ActivateButton, ActivateDialog } from './Activate';
import { accountApi } from './api';
import { getIcon, money, perLabel } from './icons';
import { fmtDay, useSession } from './session';
import { isComingSoon } from './tools';

const input =
  'w-full rounded-xl border-2 border-ink/10 bg-white px-3 py-2.5 font-semibold focus:outline-none focus:border-blob focus:ring-4 focus:ring-blob/30';

export default function Profile() {
  const session = useSession();

  useEffect(() => {
    if (!session.loading && !session.user) window.location.replace('/entrar?next=/perfil');
  }, [session.loading, session.user]);

  // Jump to #planes once the content exists
  useEffect(() => {
    if (!session.loading && window.location.hash) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session.loading]);

  if (session.loading || !session.user) {
    return (
      <div className="min-h-screen bg-cream">
        <AppHeader />
        <p className="p-10 text-center font-bold text-ink/50">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream text-ink font-sans selection:bg-blob">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-10">
        <PaymentReturn />
        <ProfileCard />
        <CurrentPlans />
        <AvailablePlans />
        <PasswordCard />
      </main>
      <LegalFooter />
    </div>
  );
}

// Back from Stripe Checkout (?pago=ok&session_id=…): confirm the payment and say what was unlocked.
function PaymentReturn() {
  const session = useSession();
  const [state, setState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('pago') === 'ok' && params.get('session_id') ? { status: 'checking', id: params.get('session_id') } : null;
  });

  useEffect(() => {
    if (state?.status !== 'checking') return;
    window.history.replaceState(null, '', '/perfil'); // a reload must not confirm again
    accountApi
      .confirmCheckout(state.id)
      .then((res) => {
        session.apply(res);
        setState({ status: 'ok', product: session.products.find((p) => p.id === res.productId) });
      })
      .catch((err) => setState({ status: 'error', error: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) return null;
  if (state.status === 'checking') {
    return (
      <p className="bg-white rounded-3xl shadow-toy p-5 font-bold text-ink/60 flex items-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin" /> Confirmando tu pago…
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="bg-mouth/10 text-mouth rounded-3xl p-5 font-bold" role="alert">
        {state.error} Si se hizo el cargo, tu acceso se activará en unos minutos.
      </div>
    );
  }
  const { product } = state;
  return (
    <section className="bg-coal text-white rounded-[2rem] shadow-toy-lg p-6 flex flex-wrap items-center gap-4 animate-pop-in" role="status">
      <span className="hex w-12 h-12 bg-blob text-ink grid place-items-center shrink-0">
        <Check className="w-6 h-6" />
      </span>
      <div className="flex-1 min-w-48">
        <p className="font-display font-bold text-xl">¡Pago completado!</p>
        <p className="text-white/70">{product ? `${product.name} ya está activo. ¡Ñam!` : 'Tu compra ya está activa.'}</p>
      </div>
      {product?.toolUrl && (
        <a href={product.toolUrl} className="btn btn-red px-5 py-2.5">
          <ArrowRight className="w-4 h-4" /> Abrir ahora
        </a>
      )}
    </section>
  );
}

function ProfileCard() {
  const session = useSession();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(session.user.name);
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    try {
      session.apply(await accountApi.updateProfile(name));
      setEditing(false);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="bg-white rounded-[2rem] shadow-toy p-6 flex flex-wrap items-center gap-5">
      <span className="hex w-16 h-16 bg-blob inline-flex items-center justify-center font-display font-bold text-2xl shrink-0">
        {session.user.name[0].toUpperCase()}
      </span>
      <div className="flex-1 min-w-48">
        {editing ? (
          <form onSubmit={save} className="flex gap-2">
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
            <button className="btn btn-red w-11 h-11 shrink-0" aria-label="Guardar">
              <Save className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost w-11 h-11 shrink-0" aria-label="Cancelar">
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <h1 className="font-display font-bold text-fluid-h1 flex items-center gap-2">
            {session.user.name}
            <button onClick={() => setEditing(true)} className="rounded-full p-1.5 text-ink/40 hover:bg-cream" aria-label="Editar nombre">
              <Pencil className="w-4 h-4" />
            </button>
          </h1>
        )}
        {error && <p className="text-sm font-bold text-mouth mt-1">{error}</p>}
        <p className="text-ink/60">{session.user.email}</p>
        <p className="text-xs text-ink/45 mt-1">Miembro desde el {fmtDay(session.user.createdAt)}</p>
      </div>
      <button onClick={session.logout} className="btn btn-ghost px-4 py-2 text-sm">
        Cerrar sesión
      </button>
    </section>
  );
}

function CurrentPlans() {
  const session = useSession();
  const [resume, setResume] = useState(null);
  const [error, setError] = useState('');
  const productOf = (id) => session.products.find((p) => p.id === id);
  const subs = session.subscriptions.filter((s) => productOf(s.productId));
  const monthly = subs
    .filter((s) => s.status === 'active' && s.period === 'month')
    .reduce((sum, s) => sum + productOf(s.productId).price, 0);

  const cancel = async (product, sub) => {
    if (!window.confirm(`¿Cancelar ${product.name}? Seguirás teniendo acceso hasta el ${fmtDay(sub.renewsAt)}.`)) return;
    try {
      session.apply(await accountApi.cancel(product.id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
        <h2 className="font-display font-bold text-2xl">Tu plan actual</h2>
        <div className="flex flex-wrap items-center gap-3">
          {monthly > 0 && (
            <p className="text-sm text-ink/60">
              Total mensual: <span className="font-display font-bold text-lg">{money(monthly)}</span>
            </p>
          )}
          {session.billing && <BillingPortalButton onError={setError} />}
        </div>
      </div>

      {error && <p className="bg-mouth/10 text-mouth rounded-xl text-sm font-bold p-3 mb-3">{error}</p>}

      {subs.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-toy p-8 text-center">
          <p className="font-display font-semibold text-xl">Aún no tienes ningún plan activo</p>
          <p className="text-ink/60 mt-1">Las herramientas gratuitas ya están disponibles. Mira abajo los planes.</p>
          <a href="#planes" className="btn btn-red px-5 py-2.5 mt-4">
            Ver planes
          </a>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {subs.map((sub) => {
            const product = productOf(sub.productId);
            const Icon = product.includes?.length ? Crown : getIcon(product.icon);
            const included = (product.includes ?? []).map(productOf).filter(Boolean);
            return (
              <article key={sub.productId} className="bg-white rounded-3xl shadow-toy p-5 flex flex-col">
                <div className="flex items-start gap-3">
                  <div className="hex w-12 h-12 bg-blob flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-lg leading-tight">{product.name}</h3>
                    <StatusLine sub={sub} />
                  </div>
                  <span className="font-display font-bold shrink-0">
                    {money(product.price)}
                    <span className="text-xs">{perLabel(product)}</span>
                  </span>
                </div>

                {included.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {included.map((p) => (
                      <a
                        key={p.id}
                        href={p.toolUrl}
                        className="inline-flex items-center min-h-11 text-sm font-bold bg-blob-soft text-blob-deep rounded-full px-3.5 hover:bg-blob"
                      >
                        {p.name}
                      </a>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t-2 border-cream">
                  {product.toolUrl && (
                    <a href={product.toolUrl} className="btn btn-blue px-4 py-2 text-sm">
                      <ArrowRight className="w-4 h-4" /> Abrir
                    </a>
                  )}
                  {sub.period === 'month' && sub.status === 'active' && (
                    <button onClick={() => cancel(product, sub)} className="btn btn-ghost px-4 py-2 text-sm">
                      Cancelar
                    </button>
                  )}
                  {sub.status === 'cancelled' && (
                    <button onClick={() => setResume(product)} className="btn btn-red px-4 py-2 text-sm">
                      Reanudar
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {resume && <ActivateDialog product={resume} onClose={() => setResume(null)} onActivated={() => setResume(null)} />}
    </section>
  );
}

// Stripe's customer portal: invoices, payment card and cancellations.
function BillingPortalButton({ onError }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      window.location.href = (await accountApi.billingPortal()).url;
    } catch (err) {
      onError(err.message);
      setBusy(false);
    }
  };
  return (
    <button onClick={open} disabled={busy} className="btn btn-ghost px-4 py-2 text-sm">
      {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />} Facturas y tarjeta
    </button>
  );
}

function StatusLine({ sub }) {
  if (sub.period === 'once') {
    return <p className="text-sm text-ink/60">Pago único · comprado el {fmtDay(sub.startedAt)}</p>;
  }
  if (sub.status === 'cancelled') {
    return <p className="text-sm font-bold text-mouth">Cancelada · acceso hasta el {fmtDay(sub.endsAt)}</p>;
  }
  return (
    <p className="text-sm text-ink/60 flex items-center gap-1">
      <Check className="w-3.5 h-3.5 text-blob-deep" /> Activa · se renueva el {fmtDay(sub.renewsAt)}
    </p>
  );
}

function AvailablePlans() {
  const session = useSession();
  const owned = (p) => session.access.has(p.id);
  const plans = session.products.filter((p) => p.includes?.length && !owned(p));
  const others = session.products.filter((p) => !p.includes?.length && p.price > 0 && !owned(p));
  const productOf = (id) => session.products.find((p) => p.id === id);

  if (plans.length === 0 && others.length === 0) {
    return (
      <section id="planes" className="bg-white rounded-3xl shadow-toy p-8 text-center scroll-mt-24">
        <p className="font-display font-semibold text-xl">¡Lo tienes todo activado! 🎉</p>
      </section>
    );
  }

  return (
    <section id="planes" className="scroll-mt-24">
      <h2 className="font-display font-bold text-2xl mb-4">Planes disponibles</h2>

      {plans.map((plan) => {
        const included = plan.includes.map(productOf).filter(Boolean);
        const separate = included.reduce((sum, p) => sum + p.price, 0);
        return (
          <article key={plan.id} className="bg-coal text-white rounded-[2rem] p-6 md:p-8 mb-6 grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <span className="inline-flex items-center gap-2 bg-mouth text-white font-extrabold text-xs px-3 py-1.5 rounded-full">
                <Crown className="w-4 h-4" /> Recomendado
              </span>
              <h3 className="font-display font-bold text-3xl mt-3">{plan.name}</h3>
              <p className="text-white/70 mt-1">{plan.desc}</p>
              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-4 text-sm">
                {included.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blob shrink-0" /> {p.name}
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-center md:text-right">
              {separate > plan.price && (
                <p className="text-white/50 line-through font-display">{money(separate)}/mes</p>
              )}
              <p className="font-display font-bold text-5xl text-blob">
                {money(plan.price)}
                <span className="text-lg">/mes</span>
              </p>
              <ActivateButton product={plan} withPrice={false} className="w-full md:w-auto px-8 py-3.5 text-lg mt-4" onActivated={() => {}} />
            </div>
          </article>
        );
      })}

      {others.length > 0 && (
        <>
          <h3 className="font-display font-semibold text-lg mb-3">O activa solo lo que necesites</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {others.map((p) => {
              const Icon = getIcon(p.icon);
              return (
                <article key={p.id} className="bg-white rounded-3xl shadow-toy p-5 flex flex-col">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="hex w-10 h-10 bg-blob flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-display font-semibold leading-tight">
                        {p.name}
                        {isComingSoon(p) && (
                          <span className="ml-1.5 align-middle font-sans text-xs font-bold bg-cream text-ink/55 rounded-full px-2 py-0.5">
                            Próximamente
                          </span>
                        )}
                      </h4>
                      <p className="font-display font-bold">
                        {money(p.price)}
                        <span className="text-xs">{perLabel(p) || ' pago único'}</span>
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-ink/60 mb-4 flex-1">{p.desc}</p>
                  <ActivateButton product={p} variant="secondary" withPrice={false} className="w-full py-2.5 text-sm" onActivated={() => {}} />
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function PasswordCard() {
  const session = useSession();
  const [form, setForm] = useState({ current: '', next: '' });
  const [state, setState] = useState({ busy: false, error: '', ok: false });

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: '', ok: false });
    try {
      await accountApi.changePassword(form.current, form.next);
      setForm({ current: '', next: '' });
      setState({ busy: false, error: '', ok: true });
    } catch (err) {
      setState({ busy: false, error: err.message, ok: false });
    }
  };

  return (
    <section className="bg-white rounded-[2rem] shadow-toy p-6">
      <h2 className="font-display font-bold text-xl flex items-center gap-2 mb-4">
        <KeyRound className="w-5 h-5" /> {session.user.hasPassword ? 'Cambiar contraseña' : 'Crear una contraseña'}
      </h2>
      <form onSubmit={submit} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-start">
        {session.user.hasPassword && (
        <input
          className={input}
          type="password"
          placeholder="Contraseña actual"
          value={form.current}
          onChange={(e) => setForm({ ...form, current: e.target.value })}
          autoComplete="current-password"
          required
        />
        )}
        <input
          className={input}
          type="password"
          placeholder="Nueva contraseña (mín. 8)"
          value={form.next}
          onChange={(e) => setForm({ ...form, next: e.target.value })}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <button disabled={state.busy} className="btn btn-dark px-5 py-3">
          {state.busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
        </button>
      </form>
      {state.error && <p className="text-sm font-bold text-mouth mt-2">{state.error}</p>}
      {state.ok && <p className="text-sm font-bold text-blob-deep mt-2">Contraseña actualizada.</p>}
      <input type="hidden" value={session.user.email} autoComplete="username" readOnly />
    </section>
  );
}
