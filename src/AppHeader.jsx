import { useEffect, useState } from 'react';
import { Menu, X, Home, Crown, User, LogIn, LogOut, Lock, Check, UserPlus, Mail, MessageCircle } from 'lucide-react';
import Logo from './Logo';
import { useSession } from './session';
import { getIcon } from './icons';
import { isComingSoon } from './tools';

// Header shown on every customer page: logo, account shortcut and the hamburger menu.
export default function AppHeader({ hopKey }) {
  const session = useSession();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 bg-cream/90 backdrop-blur border-b-2 border-ink/5">
        <div className="page py-3 flex justify-between items-center gap-3">
          <Logo hopKey={hopKey} />
          <nav aria-label="Secciones" className="hidden lg:flex items-center gap-1 font-display font-semibold">
            {[
              ['Herramientas', '/#herramientas'],
              ['Chat IA', '/chat'],
              ['Gratis', '/herramientas/convertidor'],
              ['Planes', '/#planes'],
              ['Para negocios', '/#negocios'],
            ].map(([text, href]) => (
              <a key={href} href={href} className="rounded-full px-4 py-2 hover:bg-white">
                {text}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {!session.loading &&
              (session.user ? (
                <a href="/perfil" className="btn btn-ghost pl-1.5 pr-4 py-1.5 text-sm" title="Mi perfil">
                  <span className="hex w-8 h-8 bg-blob inline-flex items-center justify-center font-bold">
                    {session.user.name[0].toUpperCase()}
                  </span>
                  <span className="hidden sm:inline">{session.user.name.split(' ')[0]}</span>
                </a>
              ) : (
                <a href="/entrar" className="btn btn-ghost px-4 py-2 text-sm">
                  <LogIn className="w-4 h-4" /> <span className="hidden sm:inline">Entrar</span>
                </a>
              ))}
            <button onClick={() => setOpen(true)} className="btn btn-dark w-11 h-11" aria-label="Abrir menú">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      {open && <SideMenu onClose={() => setOpen(false)} />}
    </>
  );
}

function SideMenu({ onClose }) {
  const session = useSession();
  const path = window.location.pathname;
  const tools = session.products.filter((p) => p.toolUrl);
  const plans = session.products.filter((p) => p.includes?.length);

  const item = (href, Icon, text, extra) => (
    <a
      href={href}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 font-display font-semibold transition-colors ${
        path === href ? 'bg-blob-soft' : 'hover:bg-cream'
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="flex-1">{text}</span>
      {extra}
    </a>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/50 backdrop-blur-sm" onClick={onClose}>
      <nav
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white h-full flex flex-col sm:rounded-l-[2rem] overflow-hidden animate-slide-in"
        aria-label="Menú principal"
      >
        <div className="bg-coal text-white px-5 py-4 flex justify-between items-center">
          {session.user ? (
            <div className="flex items-center gap-3 min-w-0">
              <span className="hex w-10 h-10 bg-blob text-ink inline-flex items-center justify-center font-bold shrink-0">
                {session.user.name[0].toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="font-display font-semibold leading-tight truncate">{session.user.name}</p>
                <p className="text-xs text-white/60 truncate">{session.user.email}</p>
              </div>
            </div>
          ) : (
            <p className="font-display font-semibold text-lg">Menú</p>
          )}
          <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Cerrar menú">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {!session.user && (
            <div className="grid grid-cols-2 gap-2 p-2 pb-3">
              <a href="/entrar" className="btn btn-ghost py-2 text-sm">
                <LogIn className="w-4 h-4" /> Entrar
              </a>
              <a href="/registro" className="btn btn-red py-2 text-sm">
                <UserPlus className="w-4 h-4" /> Crear cuenta
              </a>
            </div>
          )}

          {item('/', Home, 'Inicio')}
          {session.user && item('/perfil', User, 'Mi perfil y planes')}
          {plans.map((p) => (
            <div key={p.id}>
              {item(
                '/perfil#planes',
                Crown,
                p.name.split('—')[0].trim(),
                session.access.has(p.id) ? <Check className="w-4 h-4 text-blob-deep" /> : null
              )}
            </div>
          ))}

          <p className="px-3 pt-4 pb-1 text-xs font-extrabold uppercase tracking-wider text-ink/45">Herramientas</p>
          {tools.map((p) => {
            const Icon = getIcon(p.icon);
            const badge = isComingSoon(p) ? (
              <span className="text-xs font-bold bg-cream text-ink/50 rounded-full px-2 py-0.5">Pronto</span>
            ) : p.price === 0 ? (
                <span className="text-xs font-bold bg-blob-soft text-blob-deep rounded-full px-2 py-0.5">Gratis</span>
              ) : session.access.has(p.id) ? (
                <Check className="w-4 h-4 text-blob-deep" aria-label="Activa" />
              ) : (
                <Lock className="w-4 h-4 text-ink/30" aria-label="Sin activar" />
              );
            return <div key={p.id}>{item(p.toolUrl, Icon, p.name, badge)}</div>;
          })}

          <p className="px-3 pt-4 pb-1 text-xs font-extrabold uppercase tracking-wider text-ink/45">Ayuda</p>
          {item('/chat', MessageCircle, 'Chat con Monchys')}
          {item('/contacto', Mail, 'Contacto')}
          <div className="flex gap-4 px-3 pt-2 text-sm text-ink/50">
            <a href="/privacidad" className="hover:text-ink">Privacidad</a>
            <a href="/terminos" className="hover:text-ink">Términos</a>
          </div>
        </div>

        {session.user && (
          <div className="p-3 border-t-2 border-cream">
            <button
              onClick={session.logout}
              className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 font-display font-semibold text-ink/70 hover:bg-cream"
            >
              <LogOut className="w-5 h-5" /> Cerrar sesión
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}
