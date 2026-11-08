import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowLeft, CalendarCheck, Check, Copy, Crown, ExternalLink, Hammer, Lock, PlayCircle, RefreshCw } from 'lucide-react';
import AppHeader from './AppHeader';
import { LegalFooter } from './Legal';
import { ActivateButton } from './Activate';
import ConverterTool from './Converter';
import AhorroTool from './tools-ui/AhorroTool';
import DiarioTool from './tools-ui/DiarioTool';
import TranscribeTool from './tools-ui/TranscribeTool';
import BackgroundTool from './tools-ui/BackgroundTool';
import PdfTool from './tools-ui/PdfTool';
import CvTool from './tools-ui/CvTool';
import ConverterProTool from './tools-ui/ConverterProTool';
import CompressTool from './tools-ui/CompressTool';
import SubtitlesTool from './tools-ui/SubtitlesTool';
import TranslateTool from './tools-ui/TranslateTool';
import UpscaleTool from './tools-ui/UpscaleTool';
import ImageGenTool from './tools-ui/ImageGenTool';
import { SocialTool, ProductCopyTool } from './tools-ui/WriterTools';
import Mascot from './Mascot';
import { accountApi } from './api';
import { getIcon, money, perLabel } from './icons';
import { includedBy, useSession } from './session';
import { FREE_PREVIEW } from './tools';
import { CONVERSIONS, TOOL_SEO, conversionBySlug, conversionSeo, mergeFaq, videoFor } from '../shared/seo.js';

// The PDF editor brings pdf.js and pdf-lib: loaded only when opened
const PdfEditorTool = lazy(() => import('./tools-ui/PdfEditorTool'));

// Tool screens that are built (keep in sync with READY_TOOLS in tools.js).
// Products whose tool is not here show "en construcción".
const TOOLS = {
  '/herramientas/convertidor': ConverterTool,
  '/herramientas/reservas': ReservasTool,
  '/herramientas/ahorro': AhorroTool,
  '/herramientas/diario': DiarioTool,
  '/herramientas/transcripcion': TranscribeTool,
  '/herramientas/quitar-fondo': BackgroundTool,
  '/herramientas/resumir-pdf': PdfTool,
  '/herramientas/cv': CvTool,
  '/herramientas/convertidor-pro': ConverterProTool,
  '/herramientas/comprimir': CompressTool,
  '/herramientas/editar-pdf': PdfEditorTool,
  '/herramientas/subtitulos': SubtitlesTool,
  '/herramientas/redes': SocialTool,
  '/herramientas/descripciones': ProductCopyTool,
  '/herramientas/traductor': TranslateTool,
  '/herramientas/mejorar-fotos': UpscaleTool,
  '/herramientas/generar-imagenes': ImageGenTool,
  // '/herramientas/generar-videos': VideoGenTool, (launch together with READY_TOOLS in tools.js)
};

export default function ToolPage({ path }) {
  const session = useSession();
  // Conversion landing pages: /herramientas/convertidor/jpg-a-png -> the converter with PNG preselected
  const [, toolName, slug] = path.match(/^\/herramientas\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/) ?? [];
  const toolUrl = `/herramientas/${toolName}`;
  const conversion = slug ? conversionBySlug(toolName, slug) : null;
  const product = slug && !conversion ? null : session.products.find((p) => p.toolUrl === toolUrl);

  return (
    <div className="min-h-screen bg-cream text-ink font-sans selection:bg-blob">
      <AppHeader />
      <main className="page py-8 md:py-12">
        {session.loading ? (
          <p className="p-10 text-center font-bold text-ink/50 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Cargando…
          </p>
        ) : !product ? (
          <div className="bg-white rounded-3xl shadow-toy p-10 text-center">
            <p className="font-display font-bold text-2xl">Esta herramienta no existe</p>
            <a href="/" className="btn btn-blue px-5 py-2.5 mt-4">
              Ver todos los servicios
            </a>
          </div>
        ) : (
          <ToolContent product={product} conversion={conversion} />
        )}
      </main>
      <LegalFooter />
    </div>
  );
}

function ToolContent({ product, conversion }) {
  const session = useSession();
  const Icon = getIcon(product.icon);
  const unlocked = product.price === 0 || session.access.has(product.id);
  const Tool = TOOLS[product.toolUrl];
  const plan = includedBy(session, product.id);
  const toolSeo = TOOL_SEO[product.toolUrl];
  const seo = conversion ? conversionSeo(conversion) : toolSeo;

  return (
    <>
      {/* Móvil: icono pequeño en línea con la categoría y título a todo el ancho. ≥ sm: icono grande a la izquierda. */}
      <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] items-start gap-x-4 gap-y-2 mb-8">
        <div className="hex w-10 h-10 sm:w-16 sm:h-16 bg-blob flex items-center justify-center shrink-0 sm:row-span-2">
          <Icon className="w-5 h-5 sm:w-7 sm:h-7" />
        </div>
        <p className="self-center sm:self-end text-xs font-extrabold uppercase tracking-wider text-blob-deep">{product.category}</p>
        <div className="col-span-2 sm:col-span-1 sm:col-start-2 min-w-0">
          <h1 className="font-display font-bold text-fluid-h1 text-balance">{seo?.h1 ?? product.name}</h1>
          <p className="text-ink/65 mt-1 max-w-3xl">{seo?.intro ?? product.desc}</p>
        </div>
        {product.price === 0 ? (
          <span className="col-span-2 sm:col-span-1 sm:col-start-3 sm:row-start-1 justify-self-start sm:justify-self-end text-sm font-bold bg-blob-soft text-blob-deep rounded-full px-3 py-1.5">
            Gratis · sin registro
          </span>
        ) : !unlocked && FREE_PREVIEW.has(product.toolUrl) ? (
          <span className="col-span-2 sm:col-span-1 sm:col-start-3 sm:row-start-1 justify-self-start sm:justify-self-end text-sm font-bold bg-blob-soft text-blob-deep rounded-full px-3 py-1.5">
            {FREE_PREVIEW.get(product.toolUrl)}
          </span>
        ) : unlocked ? (
          <span className="col-span-2 sm:col-span-1 sm:col-start-3 sm:row-start-1 justify-self-start sm:justify-self-end text-sm font-bold bg-ink text-blob rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <Check className="w-4 h-4" /> {plan ? `Incluido en ${plan.name.split('—')[0].trim()}` : 'Activo'}
          </span>
        ) : null}
      </div>

      {!unlocked && !(Tool && FREE_PREVIEW.has(product.toolUrl)) ? (
        <Locked product={product} />
      ) : Tool ? (
        <Suspense
          fallback={
            <p className="p-10 text-center font-bold text-ink/50 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" /> Cargando…
            </p>
          }
        >
          <Tool product={product} preset={conversion?.to} locked={!unlocked} />
        </Suspense>
      ) : (
        <ComingSoon product={product} />
      )}

      {conversion?.seo?.guide && <ToolArticle guide={conversion.seo.guide} />}

      {toolSeo && (
        <ToolGuide
          // Task pages: their own steps, and their questions before the tool's general ones
          seo={conversion?.seo ? { ...toolSeo, steps: conversion.seo.steps, faq: mergeFaq(conversion.seo.faq, toolSeo.faq) } : toolSeo}
          product={product}
          conversion={conversion}
        />
      )}
    </>
  );
}

function Locked({ product }) {
  const session = useSession();
  const plans = session.products.filter((p) => p.includes?.includes(product.id));

  return (
    <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6 items-start">
      <div className="bg-white rounded-[2rem] shadow-toy-lg p-6 md:p-8">
        <div className="hex w-14 h-14 bg-cream flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-ink/50" />
        </div>
        <h2 className="font-display font-bold text-2xl">Activa esta herramienta para usarla</h2>
        <p className="text-ink/70 mt-2 whitespace-pre-line">{product.details || product.desc}</p>
        {Object.keys(product.specs).length > 0 && (
          <dl className="bg-cream rounded-2xl p-4 mt-5 text-sm space-y-1.5">
            {Object.entries(product.specs).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4">
                <dt className="text-ink/50">{key}</dt>
                <dd className="font-semibold text-right">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="flex flex-wrap items-center gap-4 mt-6">
          <span className="font-display font-bold text-3xl">
            {money(product.price)}
            <span className="text-base">{perLabel(product) || ' pago único'}</span>
          </span>
          <ActivateButton product={product} withPrice={false} className="flex-1 min-w-48 py-3.5 text-lg" onActivated={() => {}} />
        </div>
        <div className="flex flex-wrap gap-x-5 mt-4">
          {videoFor(product.toolUrl) && (
            <a
              href="#como-funciona"
              onClick={() => setTimeout(() => document.querySelector('#como-funciona video')?.play(), 500)}
              className="inline-flex items-center gap-1.5 text-sm font-extrabold text-blob-deep hover:text-mouth"
            >
              <PlayCircle className="w-4 h-4" /> Ver cómo funciona (16 s)
            </a>
          )}
          {product.demoUrl && (
            <a
              href={product.demoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-extrabold text-blob-deep hover:text-mouth"
            >
              <ExternalLink className="w-4 h-4" /> Ver una demo en vivo
            </a>
          )}
        </div>
      </div>

      {plans.map((plan) => (
        <div key={plan.id} className="bg-coal text-white rounded-[2rem] p-6">
          <span className="inline-flex items-center gap-2 bg-mouth font-extrabold text-xs px-3 py-1.5 rounded-full">
            <Crown className="w-4 h-4" /> Ahorra con el plan
          </span>
          <h3 className="font-display font-bold text-2xl mt-3">{plan.name}</h3>
          <p className="text-white/70 text-sm mt-1">
            Incluye esta herramienta y {plan.includes.length - 1} más por {money(plan.price)}/mes.
          </p>
          <ActivateButton product={plan} variant="secondary" className="w-full py-3 mt-5" onActivated={() => {}} />
        </div>
      ))}
    </div>
  );
}

function ComingSoon({ product }) {
  return (
    <div className="bg-white rounded-[2rem] shadow-toy-lg p-8 md:p-12 text-center max-w-2xl mx-auto">
      <Mascot className="w-20 mx-auto" />
      <span className="inline-flex items-center gap-2 bg-blob-soft text-blob-deep font-extrabold text-xs px-3 py-1.5 rounded-full mt-5">
        <Hammer className="w-4 h-4" /> En construcción
      </span>
      <h2 className="font-display font-bold text-2xl mt-3">Monchys está construyendo esta herramienta</h2>
      <p className="text-ink/70 mt-2 whitespace-pre-line">{product.details || product.desc}</p>
      <p className="text-sm font-bold text-ink/60 mt-5">Tu acceso ya está activo: podrás usarla aquí mismo en cuanto esté lista.</p>
      <a href="/" className="btn btn-ghost px-5 py-2.5 mt-6">
        <ArrowLeft className="w-4 h-4" /> Ver otras herramientas
      </a>
    </div>
  );
}

// Booking assistant subscribers: their public page and upcoming appointments.
function ReservasTool() {
  const [businesses, setBusinesses] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    accountApi
      .businesses()
      .then(setBusinesses)
      .catch((err) => setError(err.message));
  }, []);

  const copy = async (url) => {
    await navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(url);
    setTimeout(() => setCopied(''), 1500);
  };

  if (error) return <p className="bg-mouth/10 text-mouth rounded-xl font-bold p-4">{error}</p>;
  if (!businesses) return <p className="text-center font-bold text-ink/50">Cargando tu agenda…</p>;

  if (businesses.length === 0) {
    return (
      <div className="bg-white rounded-[2rem] shadow-toy-lg p-8 md:p-10 max-w-2xl">
        <div className="hex w-14 h-14 bg-blob flex items-center justify-center mb-4">
          <CalendarCheck className="w-6 h-6" />
        </div>
        <h2 className="font-display font-bold text-2xl">Estamos preparando tu negocio</h2>
        <p className="text-ink/70 mt-2">
          Configuramos contigo los servicios, el horario y la información que usará el asistente. Cuando esté listo, aquí
          verás el enlace de tu página de reservas y tu agenda de citas.
        </p>
        <a href="/reservar/demo" target="_blank" rel="noreferrer" className="btn btn-blue px-5 py-2.5 mt-5">
          <ExternalLink className="w-4 h-4" /> Ver cómo funciona (demo)
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {businesses.map((b) => {
        const url = `${window.location.origin}/reservar/${b.id}`;
        return (
          <section key={b.id}>
            <div className="bg-coal text-white rounded-[2rem] p-6 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-56">
                <h2 className="font-display font-bold text-2xl">{b.name}</h2>
                <p className="text-sm text-white/60">Comparte este enlace con tus clientes para que reserven:</p>
                <p className="font-mono text-blob text-sm mt-1 break-all">{url}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => copy(url)} className="btn btn-blue px-4 py-2 text-sm">
                  {copied === url ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied === url ? 'Copiado' : 'Copiar'}
                </button>
                <a href={url} target="_blank" rel="noreferrer" className="btn btn-ghost px-4 py-2 text-sm">
                  <ExternalLink className="w-4 h-4" /> Abrir
                </a>
              </div>
            </div>

            <h3 className="font-display font-semibold text-xl mt-6 mb-3">
              Próximas citas <span className="text-ink/40">({b.bookings.length})</span>
            </h3>
            {b.bookings.length === 0 ? (
              <p className="bg-white rounded-2xl shadow-toy p-8 text-center font-bold text-ink/50">Todavía no hay citas.</p>
            ) : (
              <div className="space-y-2">
                {b.bookings.map((x) => (
                  <div key={x.id} className="bg-white rounded-2xl shadow-toy p-3 flex flex-wrap items-center gap-3">
                    <div className="w-24 text-center">
                      <p className="text-xs font-bold uppercase text-ink/50">
                        {x.date === b.today
                          ? 'Hoy'
                          : new Date(`${x.date}T12:00:00Z`).toLocaleDateString('es', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              timeZone: 'UTC',
                            })}
                      </p>
                      <p className="font-display font-bold text-xl">{x.time}</p>
                    </div>
                    <div className="flex-1 min-w-40">
                      <p className="font-display font-semibold leading-tight">
                        {x.name} <span className="font-sans text-xs font-normal text-ink/50">· {x.phone}</span>
                      </p>
                      <p className="text-sm text-ink/70">
                        {x.serviceName} · {x.minutes} min{x.notes && <span className="text-ink/50"> · “{x.notes}”</span>}
                      </p>
                    </div>
                    <span className="text-xs font-bold bg-cream rounded-full px-2 py-1 text-ink/60">
                      {x.source === 'chat' ? 'Asistente IA' : 'Formulario'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Longer guide for task pages that compete for a big search (e.g. "comprimir video para whatsapp")
function ToolArticle({ guide }) {
  return (
    <article className="mt-14 bg-white rounded-[2rem] shadow-toy p-6 md:p-8 max-w-4xl">
      {guide.map(([heading, text]) => (
        <section key={heading} className="mt-6 first:mt-0">
          <h2 className="font-display font-bold text-2xl">{heading}</h2>
          <p className="text-ink/75 leading-relaxed mt-2">{text}</p>
        </section>
      ))}
    </article>
  );
}

function ToolGuide({ seo, product, conversion }) {
  const related = CONVERSIONS.filter((c) => `/herramientas/${c.tool}` === product.toolUrl && c.slug !== conversion?.slug);
  return (
    <div className="mt-14 grid lg:grid-cols-2 gap-6 items-start">
      <section id="como-funciona" className="bg-white rounded-[2rem] shadow-toy p-6 scroll-mt-24">
        <h2 className="font-display font-bold text-2xl">Cómo funciona</h2>
        <ExplainerVideo toolUrl={product.toolUrl} />
        <ol className="mt-4 space-y-3">
          {seo.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="hex w-8 h-8 bg-blob shrink-0 inline-flex items-center justify-center font-display font-bold">{i + 1}</span>
              <span className="pt-1">{step}</span>
            </li>
          ))}
        </ol>
        {related.length > 0 && (
          <>
            <h2 className="font-display font-bold text-xl mt-8">{related[0].seo ? 'También puedes' : 'Otras conversiones'}</h2>
            <ul className="flex flex-wrap gap-2 mt-3">
              {related.map((c) => (
                <li key={c.slug}>
                  <a href={`/herramientas/${c.tool}/${c.slug}`} className="inline-flex items-center min-h-11 bg-cream rounded-full px-4 text-sm font-bold hover:bg-blob-soft">
                    {conversionSeo(c).h1.replace(/ (gratis|online)$/, '')}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
        {conversion && (
          <p className="text-sm text-ink/60 mt-6">
            {conversion.seo ? '¿Necesitas otra cosa?' : '¿Otro formato?'}{' '}
            <a href={product.toolUrl} className="font-bold text-blob-deep hover:text-mouth">
              {conversion.seo ? `Ver todo: ${product.name}` : `Ver el ${product.name.toLowerCase()}`}
            </a>
          </p>
        )}
      </section>
      <section className="bg-white rounded-[2rem] shadow-toy p-6">
        <h2 className="font-display font-bold text-2xl">Preguntas frecuentes</h2>
        <div className="mt-3 divide-y-2 divide-cream">
          {seo.faq.map(([q, a]) => (
            <details key={q} className="group py-3">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3 min-h-11 font-display font-semibold">
                <h3>{q}</h3>
                <span className="text-blob-deep group-open:rotate-45 transition-transform text-xl leading-none">+</span>
              </summary>
              <p className="text-ink/70 mt-2">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

// 16-second explainer with Monchys (rendered by video/render.mjs). Loads only when played.
function ExplainerVideo({ toolUrl }) {
  const video = videoFor(toolUrl);
  if (!video) return null;
  return (
    <figure className="mt-4">
      <video
        className="w-full aspect-video rounded-2xl bg-cream shadow-toy"
        src={video.src}
        poster={video.poster}
        controls
        playsInline
        preload="none"
        aria-label={video.title}
      />
      <figcaption className="sr-only">{video.title}</figcaption>
    </figure>
  );
}
