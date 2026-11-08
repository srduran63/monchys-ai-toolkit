import { ArrowRight, Check, ChevronRight, Crown, ExternalLink, Sparkles, Zap, CalendarX, ShieldCheck, RefreshCw } from 'lucide-react';
import { getIcon, money, perLabel } from './icons';
import AppHeader from './AppHeader';
import { ActivateButton } from './Activate';
import { includedBy, useSession } from './session';
import { CONVERSIONS, conversionSeo } from '../shared/seo.js';
import { QUICK_TASKS, groupCatalog, highlightsFor } from './catalog';
import { LegalFooter } from './Legal';

const TRUST = [
  { icon: Zap, text: 'Sin instalar nada' },
  { icon: CalendarX, text: 'Cancela cuando quieras' },
  { icon: ShieldCheck, text: 'Tus archivos se borran al terminar' },
];

// Shared section heading
function SectionTitle({ id, eyebrow, title, text }) {
  return (
    <div id={id} className="scroll-mt-24 mb-6">
      <p className="text-xs font-extrabold uppercase tracking-wider text-blob-deep">{eyebrow}</p>
      <h2 className="font-display font-bold text-fluid-h2 mt-1">{title}</h2>
      {text && <p className="text-ink/60 mt-1 max-w-2xl">{text}</p>}
    </div>
  );
}

// Price as plain dark text (red is reserved for actions)
function PriceText({ product, plan }) {
  if (product.price === 0) return <span className="font-display font-bold text-lg">Gratis</span>;
  return (
    <span className="leading-tight">
      <span className="font-display font-bold text-lg">
        {money(product.price)}
        <span className="text-sm font-semibold text-ink/60">{perLabel(product) || ' pago único'}</span>
      </span>
      {plan && <span className="block text-xs font-bold text-blob-deep">o incluido en {plan.name.split('—')[0].trim()}</span>}
    </span>
  );
}

// Compact, fully clickable card: what it is → one-line benefit → 3 facts → price + one action
function ToolCard({ product, plans }) {
  const session = useSession();
  const Icon = getIcon(product.icon);
  const owned = product.price > 0 && session.access.has(product.id);
  const viaPlan = owned && includedBy(session, product.id);
  const plan = plans.find((p) => p.includes?.includes(product.id));
  const badge = owned ? (viaPlan ? 'Incluido en tu plan' : 'Activa') : null;

  return (
    <a
      href={product.toolUrl}
      className={`group bg-white rounded-3xl p-5 shadow-toy flex flex-col transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blob ${
        owned ? 'ring-2 ring-blob' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="hex w-11 h-11 bg-blob flex items-center justify-center shrink-0 transition-colors group-hover:bg-ink group-hover:text-blob">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-lg leading-tight">{product.name}</h3>
          <p className="text-sm text-ink/65 mt-0.5 line-clamp-2">{product.desc}</p>
        </div>
        {badge && (
          <span className={`shrink-0 text-xs font-bold rounded-full px-2 py-0.5 ${owned ? 'bg-ink text-blob' : 'bg-blob-soft text-blob-deep'}`}>
            {badge}
          </span>
        )}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm font-semibold text-ink/75">
        {highlightsFor(product).map((h) => (
          <li key={h} className="flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-blob-deep shrink-0" /> {h}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-4 flex items-end justify-between gap-3">
        <PriceText product={product} plan={!owned && plan} />
        <span className="inline-flex items-center gap-1 font-display font-semibold text-blob-deep group-hover:text-ink">
          {owned ? 'Abrir' : 'Ver herramienta'} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </a>
  );
}

// Closes the "Para ti" grid and points to the plan band
function PlanTeaser({ plan }) {
  return (
    <a
      href="#planes"
      className="group rounded-3xl p-5 border-3 border-dashed border-blob bg-blob-soft/50 flex flex-col justify-between hover:bg-blob-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blob"
    >
      <div className="flex items-center gap-3">
        <div className="hex w-11 h-11 bg-ink text-blob flex items-center justify-center shrink-0">
          <Crown className="w-5 h-5" />
        </div>
        <p className="font-display font-bold text-lg leading-tight">¿Quieres varias? Ahorra con {plan.name.split('—')[0].trim()}</p>
      </div>
      <p className="text-sm text-ink/65 mt-2">{plan.includes.length} herramientas por {money(plan.price)}/mes.</p>
      <span className="mt-4 inline-flex items-center gap-1 font-display font-semibold text-blob-deep group-hover:text-ink">
        Ver el plan <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </a>
  );
}

export default function Store() {
  const session = useSession();
  const { free, plans, business, personal } = groupCatalog(session.products);
  const converter = free[0];
  const freeConversions = CONVERSIONS.filter((c) => c.tool === 'convertidor');
  const proConversions = CONVERSIONS.filter((c) => c.tool === 'convertidor-pro');
  const chipLabel = (c) => conversionSeo(c).h1.replace(/^Convertir /, '').replace(/ (gratis|online)$/, '');

  return (
    <div className="min-h-screen bg-cream text-ink font-sans selection:bg-blob selection:text-ink">
      <AppHeader />

      {/* HERO: value + one primary action, task shortcuts on the right */}
      <section className="page pt-8 md:pt-12">
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 items-center">
          <div>
            <span className="inline-flex items-center gap-2 bg-blob-soft text-blob-deep font-extrabold text-xs px-3 py-1.5 rounded-full">
              <Sparkles className="w-4 h-4" /> Herramientas con inteligencia artificial
            </span>
            <h1 className="font-display font-bold text-fluid-hero mt-4">
              Herramientas online con IA que se <span className="text-mouth">comen</span> el trabajo pesado
            </h1>
            <p className="mt-4 text-fluid-lead text-ink/70 max-w-xl">
              Convierte archivos gratis, quita fondos, pasa audio a texto, resume PDF y haz tu CV. En español y sin instalar nada.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <a href="/herramientas/convertidor" className="btn btn-red px-6 py-3 text-lg">
                Convertir un archivo gratis
              </a>
              <a href="#herramientas" className="btn btn-ghost px-6 py-3 text-lg">
                Ver herramientas
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 mt-6 text-sm font-semibold text-ink/65">
              {TRUST.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-1.5">
                  <Icon className="w-4 h-4 text-blob-deep" /> {text}
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="Accesos rápidos" className="bg-white rounded-[2rem] shadow-toy p-5">
            <p className="font-display font-semibold text-lg px-2 mb-2">¿Qué necesitas hoy?</p>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-1 sm:gap-x-4 divide-y-2 sm:divide-y-0 lg:divide-y-2 divide-cream">
              {QUICK_TASKS.map(([text, href]) => (
                <li key={href}>
                  <a href={href} className="flex items-center justify-between gap-3 rounded-xl px-2 min-h-11 font-semibold hover:bg-cream">
                    {text} <ChevronRight className="w-4 h-4 text-blob-deep shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      {session.loading && (
        <p className="page mt-14 font-bold text-ink/50 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" /> Cargando herramientas…
        </p>
      )}
      {session.error && (
        <p className="page mt-14 font-bold text-mouth">No pudimos conectar con el servidor. Inténtalo de nuevo en un momento.</p>
      )}

      {/* FREE: the converter, featured */}
      {converter && (
        <section className="page mt-16">
          <SectionTitle eyebrow="Gratis · sin registro" title="Convierte cualquier archivo" />
          <div className="bg-white rounded-[2rem] shadow-toy p-6 md:p-8 grid md:grid-cols-[1fr_1.3fr] gap-6 items-center">
            <div>
              <div className="flex items-center gap-3">
                <div className="hex w-12 h-12 bg-blob flex items-center justify-center">{(() => { const Icon = getIcon(converter.icon); return <Icon className="w-5 h-5" />; })()}</div>
                <h3 className="font-display font-bold text-2xl">{converter.name}</h3>
              </div>
              <p className="text-ink/70 mt-3">{converter.desc}</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm font-semibold text-ink/75">
                {highlightsFor(converter).map((h) => (
                  <li key={h} className="flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-blob-deep" /> {h}
                  </li>
                ))}
              </ul>
              <a href={converter.toolUrl} className="btn btn-blue px-6 py-3 mt-5">
                Convertir gratis <ArrowRight className="w-4 h-4" />
              </a>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-wider text-ink/50 mb-2">Conversiones más buscadas</p>
              <ul className="flex md:flex-wrap gap-2 overflow-x-auto pb-2 -mx-1 px-1 md:overflow-visible">
                {freeConversions.map((c) => (
                  <li key={c.slug} className="shrink-0">
                    <a href={`/herramientas/${c.tool}/${c.slug}`} className="inline-flex items-center min-h-11 bg-cream rounded-full px-4 text-sm font-bold hover:bg-blob-soft whitespace-nowrap">
                      {chipLabel(c)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* FOR YOU */}
      {personal.length > 0 && (
        <section className="page mt-16">
          <SectionTitle id="herramientas" eyebrow="Para ti" title="Herramientas online con IA" text="Activa solo lo que necesitas, mes a mes. Toca una herramienta para ver cómo funciona." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {personal.map((p) => (
              <ToolCard key={p.id} product={p} plans={plans} />
            ))}
            {plans[0] && !session.access.has(plans[0].id) && <PlanTeaser plan={plans[0]} />}
          </div>
        </section>
      )}

      {/* PLANS */}
      {plans.map((plan) => {
        const included = plan.includes.map((id) => session.products.find((p) => p.id === id)).filter(Boolean);
        const separate = included.reduce((s, p) => s + p.price, 0);
        return (
          <section key={plan.id} id="planes" className="scroll-mt-24 page mt-16">
            <div className="bg-coal text-white rounded-[2rem] p-6 md:p-10 grid md:grid-cols-[1.4fr_1fr] gap-8 items-center">
              <div>
                <span className="inline-flex items-center gap-2 bg-white/10 text-blob font-extrabold text-xs px-3 py-1.5 rounded-full">
                  <Crown className="w-4 h-4" /> Plan todo incluido
                </span>
                <h2 className="font-display font-bold text-fluid-h2 mt-3">{plan.name}</h2>
                <p className="text-white/70 mt-2">{plan.desc}</p>
                <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-5 text-sm">
                  {included.map((p) => (
                    <li key={p.id} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-blob shrink-0" /> {p.name}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="md:text-right">
                {separate > plan.price && <p className="text-white/50 line-through font-display">{money(separate)}/mes por separado</p>}
                <p className="font-display font-bold text-5xl text-blob">
                  {money(plan.price)}
                  <span className="text-lg">/mes</span>
                </p>
                <ActivateButton product={plan} className="w-full md:w-auto px-7 py-3.5 text-lg mt-4" />
                <p className="text-xs text-white/50 mt-2">Cancela cuando quieras desde tu perfil.</p>
              </div>
            </div>
          </section>
        );
      })}

      {/* BUSINESS */}
      {business.map((p) => (
        <section key={p.id} className="page mt-16">
          <SectionTitle id="negocios" eyebrow="Para tu negocio" title="Agenda de citas online con IA" />
          <div className="bg-white rounded-[2rem] shadow-toy p-6 md:p-8 grid md:grid-cols-[1.4fr_1fr] gap-6 items-center">
            <div>
              <div className="flex items-center gap-3">
                <div className="hex w-12 h-12 bg-blob flex items-center justify-center">{(() => { const Icon = getIcon(p.icon); return <Icon className="w-5 h-5" />; })()}</div>
                <h3 className="font-display font-bold text-2xl">{p.name}</h3>
              </div>
              <p className="text-ink/70 mt-3">{p.details?.split('\n')[0] || p.desc}</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm font-semibold text-ink/75">
                {highlightsFor(p).map((h) => (
                  <li key={h} className="flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-blob-deep" /> {h}
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:text-right">
              <PriceText product={p} />
              <div className="flex flex-wrap md:justify-end gap-2 mt-4">
                {p.demoUrl && (
                  <a href={p.demoUrl} target="_blank" rel="noreferrer" className="btn btn-red px-5 py-3">
                    <ExternalLink className="w-4 h-4" /> Ver la demo
                  </a>
                )}
                <a href={p.toolUrl} className="btn btn-ghost px-5 py-3">
                  Precios y detalles
                </a>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* Video & large files conversions (Pro), small link row */}
      {proConversions.length > 0 && (
        <section className="page mt-12">
          <p className="text-sm font-bold text-ink/60">
            Video y archivos grandes:{' '}
            {proConversions.map((c, i) => (
              <span key={c.slug}>
                {i > 0 && ' · '}
                <a href={`/herramientas/${c.tool}/${c.slug}`} className="text-blob-deep hover:text-mouth">
                  {conversionSeo(c).h1.replace(/ online$/, '')}
                </a>
              </span>
            ))}
          </p>
        </section>
      )}

      <LegalFooter />
    </div>
  );
}
