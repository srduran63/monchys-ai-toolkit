import { useState } from 'react';
import { ArrowRight, Check, Crown, Lock, RefreshCw, X, Zap } from 'lucide-react';
import { accountApi } from './api';
import { getIcon, money, perLabel } from './icons';
import { goToLogin, includedBy, subscriptionFor, useSession } from './session';
import { isComingSoon } from './tools';

const isPlan = (p) => p.includes?.length > 0;
const destination = (p) => p.toolUrl || '/perfil#planes';

// "Activar Plus · $12/mes", "Activar · $5/mes", "Comprar · $9" (verb + result, price included)
export function activateLabel(product, withPrice = true) {
  const verb = isPlan(product) ? `Activar ${product.name.split('—')[0].replace('Monchys', '').trim() || 'plan'}` : perLabel(product) ? 'Activar' : 'Comprar';
  return withPrice ? `${verb} · ${money(product.price)}${perLabel(product)}` : verb;
}

// Main call-to-action for a product, depending on what the visitor already has.
// variant: 'primary' (red, one per section) or 'secondary' (blue) so two red buttons never compete.
export function ActivateButton({ product, className = '', onActivated, variant = 'primary', withPrice = true }) {
  const session = useSession();
  const [dialog, setDialog] = useState(false);

  if (product.price === 0) {
    return (
      <a href={product.toolUrl} className={`btn btn-blue ${className}`}>
        <ArrowRight className="w-4 h-4" /> Usar gratis
      </a>
    );
  }

  const plan = includedBy(session, product.id);
  if (session.access.has(product.id)) {
    if (isPlan(product)) {
      return (
        <a href="/perfil#planes" className={`btn btn-blue ${className}`}>
          <Check className="w-4 h-4" /> Tu plan actual
        </a>
      );
    }
    return (
      <a href={product.toolUrl} className={`btn btn-blue ${className}`}>
        <ArrowRight className="w-4 h-4" /> {plan && !subscriptionFor(session, product.id) ? `Incluido en tu plan · Abrir` : 'Abrir'}
      </a>
    );
  }

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!session.user) goToLogin(destination(product));
          else setDialog(true);
        }}
        className={`btn ${variant === 'primary' ? 'btn-red' : 'btn-blue'} ${className}`}
      >
        <Zap className="w-4 h-4" /> {activateLabel(product, withPrice)}
      </button>
      {dialog && (
        <ActivateDialog
          product={product}
          onClose={() => setDialog(false)}
          onActivated={() => {
            setDialog(false);
            onActivated ? onActivated() : (window.location.href = destination(product));
          }}
        />
      )}
    </>
  );
}

export function ActivateDialog({ product, onClose, onActivated }) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const Icon = isPlan(product) ? Crown : getIcon(product.icon);
  const included = (product.includes ?? []).map((id) => session.products.find((p) => p.id === id)).filter(Boolean);
  const resuming = subscriptionFor(session, product.id)?.status === 'cancelled';

  const activate = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await accountApi.activate(product.id, window.location.pathname);
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl; // pay on Stripe, then back to /perfil
        return;
      }
      session.apply(res);
      onActivated();
    } catch (err) {
      if (err.status === 401) goToLogin(destination(product));
      else setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation();
        if (!busy) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-white rounded-[2rem] p-6 shadow-toy-lg animate-pop-in"
        role="dialog"
        aria-modal="true"
      >
        <button onClick={onClose} className="absolute top-4 right-4 rounded-full p-2 hover:bg-cream" aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>

        <div className="hex w-14 h-14 bg-blob flex items-center justify-center mb-4">
          <Icon className="w-6 h-6" />
        </div>
        <h2 className="font-display font-bold text-2xl leading-tight pr-8">
          {resuming ? 'Reanudar' : 'Activar'} {product.name}
        </h2>
        <p className="text-ink/65 mt-1">{product.desc}</p>

        {included.length > 0 && (
          <ul className="mt-4 bg-cream rounded-2xl p-3 space-y-1.5 text-sm">
            {included.map((p) => (
              <li key={p.id} className="flex items-center gap-2 font-semibold">
                <Check className="w-4 h-4 text-blob-deep shrink-0" /> {p.name}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-baseline justify-between mt-5 font-display">
          <span className="font-semibold text-ink/70">{perLabel(product) ? 'Membresía mensual' : 'Pago único'}</span>
          <span className="font-bold text-3xl text-mouth">
            {money(product.price)}
            <span className="text-base">{perLabel(product)}</span>
          </span>
        </div>
        {perLabel(product) && <p className="text-xs text-ink/50 mt-1">Se renueva cada mes. Cancela cuando quieras desde tu perfil.</p>}

        {isComingSoon(product) && (
          <p className="text-xs font-bold bg-cream text-ink/70 rounded-xl p-2.5 mt-4">
            Esta herramienta está en construcción: tu acceso quedará activo para cuando esté lista.
          </p>
        )}
        {included.some(isComingSoon) && (
          <p className="text-xs font-bold bg-cream text-ink/70 rounded-xl p-2.5 mt-4">
            Algunas herramientas del plan están en construcción ({included.filter(isComingSoon).length} de{' '}
            {included.length}). Tendrás acceso a cada una en cuanto esté lista.
          </p>
        )}
        {session.payments === 'stripe' ? (
          !resuming && (
            <p className="text-xs font-bold bg-blob-soft text-blob-deep rounded-xl p-2.5 mt-4 flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0" /> Pago seguro con Stripe: tarjeta, Apple Pay o Google Pay. No guardamos los datos de tu tarjeta.
            </p>
          )
        ) : (
          <p className="text-xs font-bold bg-blob-soft text-blob-deep rounded-xl p-2.5 mt-4">
            Modo demo: la activación es inmediata y no se realiza ningún cobro.
          </p>
        )}

        {error && <p className="bg-mouth/10 text-mouth rounded-xl text-sm font-bold p-3 mt-3">{error}</p>}

        <button onClick={activate} disabled={busy} className="btn btn-red w-full py-3.5 text-lg mt-5">
          {busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
          {resuming ? 'Reanudar' : session.payments === 'stripe' ? 'Ir a pagar' : 'Activar ahora'}
        </button>
      </div>
    </div>
  );
}
