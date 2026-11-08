import { Mail, MessageCircle } from 'lucide-react';
import AppHeader from './AppHeader';
import Mascot from './Mascot';

export const CONTACT_EMAIL = 'contacto@monshys.io';
const UPDATED = '28 de octubre de 2026';

const mail = <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-mouth underline">{CONTACT_EMAIL}</a>;

// Each page: title, intro and sections of [heading, ...paragraphs or lists]
const PAGES = {
  '/privacidad': {
    title: 'Política de privacidad',
    intro: 'En Monchys IA (monshys.io) cuidamos tus datos. Aquí te explicamos qué recogemos, para qué lo usamos y qué puedes hacer con ello.',
    sections: [
      ['Qué datos recogemos', [
        <><b>Cuenta:</b> tu nombre, correo electrónico y contraseña (guardada cifrada). Si entras con Google o Apple, recibimos tu nombre y correo de ese servicio; nunca tu contraseña.</>,
        <><b>Pagos:</b> los procesa Stripe. Nosotros no vemos ni guardamos los datos de tu tarjeta; solo sabemos qué plan tienes y su estado.</>,
        <><b>Lo que usas en las herramientas:</b> archivos que subes, textos que escribes y los resultados (por ejemplo, tus transcripciones, resúmenes, CV o entradas del diario).</>,
        <><b>Datos técnicos:</b> dirección IP y datos básicos del navegador, para la seguridad del sitio y para evitar abusos.</>,
      ]],
      ['Para qué los usamos', [
        'Para darte el servicio: crear tu cuenta, activar tus planes y hacer funcionar las herramientas.',
        'Para cobrar las suscripciones y enviarte recibos (a través de Stripe).',
        'Para proteger el sitio contra fraudes y usos abusivos.',
        'No vendemos ni alquilamos tus datos personales a nadie, y no usamos publicidad de terceros.',
      ]],
      ['Tus archivos', [
        'Los archivos del convertidor y del compresor, los audios de transcripción y las fotos que mejoras se borran de nuestro servidor en cuanto termina el proceso (los resultados se guardan como máximo 1 hora para que los descargues).',
        'Los videos que subes para crear subtítulos se guardan 1 hora para poder crear el video con subtítulos, y después se borran. Los documentos traducidos también se borran a la hora.',
        'Los archivos que adjuntas en el chat de Monchys, y los que el chat genera, se borran automáticamente 1 hora después.',
        'El editor de PDF funciona dentro de tu navegador: tus PDF no se suben a nuestro servidor.',
        'Los resultados que guardas en tu cuenta (transcripciones, PDF, CV, diario, ahorro) se conservan hasta que los borres o pidas eliminar tu cuenta.',
      ]],
      ['Servicios que usamos', [
        <><b>Stripe</b> (pagos), <b>Supabase</b> (inicio de sesión con Google y Apple), <b>Fly.io</b> (alojamiento del servidor en Estados Unidos), <b>Anthropic</b> (la IA de Claude) y <b>Replicate</b> (los generadores de imágenes y videos).</>,
        'Las herramientas con IA de texto (chat de Monchys, resumidor de PDF, Generador de CV, resumen de transcripciones, textos para redes, descripciones de productos y traductor) envían tu texto o la foto que subas a Anthropic para generar la respuesta. En el chat, también la lista de archivos que adjuntas, una versión reducida de tus fotos y, si tienes el Resumidor de PDF, tus PDF. Anthropic no usa esos datos para entrenar sus modelos.',
        'La transcripción de audio, los subtítulos, el quitar fondo y el mejorar fotos funcionan en nuestro propio servidor, sin enviar tus archivos a terceros.',
        'Los generadores de imágenes y videos envían tu descripción a Anthropic (para traducirla y comprobar que está permitida) y a Replicate (que crea la imagen o el video). No guardamos las imágenes; los videos se borran de nuestro servidor 30 minutos después de crearse.',
      ]],
      ['Cookies', [
        'Usamos una sola cookie necesaria para mantener tu sesión iniciada. No usamos cookies de publicidad ni de seguimiento.',
        'El navegador también guarda temporalmente la conversación del chat de Monchys mientras la pestaña está abierta.',
      ]],
      ['Tus derechos', [
        <>Puedes pedirnos en cualquier momento una copia de tus datos, corregirlos o eliminar tu cuenta y todo su contenido. Escríbenos a {mail} y respondemos en un plazo máximo de 30 días.</>,
        'Si vives en California, la ley CCPA te da además derecho a saber qué datos tenemos y a pedir su eliminación sin recibir un trato distinto por ello. No vendemos ni compartimos datos personales con fines publicitarios.',
      ]],
      ['Menores de edad', [
        'Monchys IA no está dirigido a menores de 13 años y no recogemos a sabiendas datos de ellos. Si crees que un menor nos dio sus datos, escríbenos y los borraremos.',
      ]],
      ['Seguridad y cambios', [
        'Usamos conexión cifrada (HTTPS), contraseñas cifradas y acceso restringido a los datos. Ningún sistema es 100% seguro, pero hacemos lo razonable para proteger tu información.',
        'Si cambiamos esta política, actualizaremos la fecha de esta página y te avisaremos si el cambio es importante.',
      ]],
    ],
  },
  '/terminos': {
    title: 'Términos y condiciones',
    intro: 'Estos términos regulan el uso de Monchys IA (monshys.io). Al crear una cuenta o usar las herramientas, aceptas estas condiciones.',
    sections: [
      ['El servicio', [
        'Monchys IA ofrece herramientas online, algunas gratuitas y otras de pago, para convertir archivos, transcribir audio, resumir PDF, crear CV, quitar fondos de imágenes y más.',
        'Algunas herramientas usan inteligencia artificial. Sus resultados pueden contener errores: revísalos antes de usarlos para algo importante.',
      ]],
      ['Tu cuenta', [
        'Debes tener al menos 13 años (o la edad mínima de tu país) para crear una cuenta.',
        'Eres responsable de mantener segura tu contraseña y de lo que se haga con tu cuenta.',
      ]],
      ['Planes y pagos', [
        'Los planes mensuales se renuevan automáticamente cada mes hasta que los canceles. El precio aparece antes de pagar.',
        'Puedes cancelar cuando quieras desde tu perfil: mantienes el acceso hasta el final del periodo ya pagado y no se te vuelve a cobrar.',
        'Los pagos únicos (como el Generador de CV) dan acceso indefinido a esa herramienta.',
        'Los pagos se procesan con Stripe. Podemos cambiar los precios avisándote antes; el cambio se aplica en tu siguiente renovación.',
      ]],
      ['Reembolsos', [
        <>Si una herramienta de pago no funciona como se describe y no podemos solucionarlo, te devolvemos el último pago. Escríbenos a {mail} dentro de los 14 días siguientes al cobro.</>,
        'No hacemos reembolsos parciales por cancelar a mitad de un periodo, salvo que la ley lo exija.',
      ]],
      ['Uso aceptable', [
        'No puedes usar Monchys IA para actividades ilegales, para subir contenido del que no tienes derechos, para dañar a otras personas ni para intentar saturar, copiar o atacar el servicio.',
        'Podemos suspender cuentas que incumplan estas normas.',
      ]],
      ['Tu contenido', [
        'Los archivos y textos que subes son tuyos, y también los resultados que generas. Solo los usamos para darte el servicio.',
      ]],
      ['Diario emocional', [
        'El Diario emocional es una herramienta de bienestar personal y no sustituye la ayuda de un profesional de la salud mental. Si estás en crisis, llama o escribe al 988 (Estados Unidos) o al número de emergencias de tu país.',
      ]],
      ['Responsabilidad', [
        'Ofrecemos el servicio "tal cual". Hacemos lo posible para que funcione siempre, pero no garantizamos que esté libre de interrupciones o errores.',
        'En la medida que permita la ley, nuestra responsabilidad total se limita a lo que hayas pagado en los últimos 12 meses.',
      ]],
      ['Cambios y ley aplicable', [
        'Podemos actualizar estos términos; la fecha de arriba indica la última versión. Si el cambio es importante, te avisaremos.',
        'Estos términos se rigen por las leyes de los Estados Unidos.',
        <>¿Dudas? Escríbenos a {mail}.</>,
      ]],
    ],
  },
};

export const LEGAL_PATHS = ['/privacidad', '/terminos', '/contacto'];

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-cream text-ink font-sans">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 py-12">{children}</main>
      <LegalFooter />
    </div>
  );
}

// Popular tasks linked from every page (helps visitors and search engines find them)
const POPULAR = [
  ['Unir PDF', '/herramientas/editar-pdf/unir-pdf'],
  ['Firmar PDF', '/herramientas/editar-pdf/firmar-pdf'],
  ['Comprimir PDF', '/herramientas/comprimir/comprimir-pdf'],
  ['Comprimir imagen', '/herramientas/comprimir/comprimir-imagen'],
  ['Reducir tamaño de foto', '/herramientas/comprimir/reducir-tamano-foto'],
  ['HEIC a JPG', '/herramientas/convertidor/heic-a-jpg'],
  ['JPG a PDF', '/herramientas/convertidor/jpg-a-pdf'],
  ['MP4 a MP3', '/herramientas/convertidor/mp4-a-mp3'],
  ['Comprimir video para WhatsApp', '/herramientas/convertidor/comprimir-video'],
  ['Quitar fondo', '/herramientas/quitar-fondo'],
  ['Audio a texto', '/herramientas/transcripcion'],
  ['Subtítulos para TikTok', '/herramientas/subtitulos/subtitulos-para-tiktok'],
  ['Traducir PDF al inglés', '/herramientas/traductor/traducir-pdf-al-ingles'],
  ['Mejorar foto borrosa', '/herramientas/mejorar-fotos/mejorar-foto-borrosa'],
  ['Resumir PDF', '/herramientas/resumir-pdf'],
];

export function LegalFooter() {
  return (
    <footer className="mt-20 bg-coal text-white/70 rounded-t-[2.5rem]">
      <nav aria-label="Herramientas populares" className="page pt-8 pb-2">
        <p className="text-xs font-extrabold uppercase tracking-wider text-white/40 mb-3">Herramientas populares</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {POPULAR.map(([text, href]) => (
            <li key={href}>
              <a href={href} className="hover:text-blob">
                {text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="page py-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
        <span>© 2026 Monchys IA · monshys.io</span>
        <nav aria-label="Legal" className="flex gap-6 font-semibold">
          <a href="/privacidad" className="hover:text-blob">Privacidad</a>
          <a href="/terminos" className="hover:text-blob">Términos</a>
          <a href="/contacto" className="hover:text-blob">Contacto</a>
        </nav>
      </div>
    </footer>
  );
}

function Contact() {
  return (
    <Shell>
      <div className="text-center">
        <Mascot className="w-20 mx-auto" />
        <h1 className="font-display font-bold text-fluid-h1 mt-6">Contacto</h1>
        <p className="text-ink/65 mt-2">¿Tienes una duda, un problema con un pago o una idea? Escríbenos.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mt-10">
        <a href={`mailto:${CONTACT_EMAIL}`} className="rounded-3xl bg-white border-2 border-ink/5 p-6 hover:border-mouth/40">
          <Mail className="w-7 h-7 text-mouth" />
          <h2 className="font-display font-bold text-lg mt-3">Correo</h2>
          <p className="text-ink/65 text-sm mt-1">Respondemos en 1–2 días hábiles.</p>
          <p className="font-semibold text-mouth mt-3 break-all">{CONTACT_EMAIL}</p>
        </a>
        <div className="rounded-3xl bg-white border-2 border-ink/5 p-6">
          <MessageCircle className="w-7 h-7 text-mouth" />
          <h2 className="font-display font-bold text-lg mt-3">Chat con Monchys</h2>
          <p className="text-ink/65 text-sm mt-1">Pulsa el monstruo de la esquina para que te ayude a elegir herramienta al momento.</p>
        </div>
      </div>
      <p className="text-ink/65 text-sm mt-8 text-center">
        Para pagos y facturas también puedes usar <b>Facturas y tarjeta</b> en tu <a href="/perfil" className="underline">perfil</a>.
      </p>
    </Shell>
  );
}

export default function Legal({ path }) {
  if (path === '/contacto') return <Contact />;
  const { title, intro, sections } = PAGES[path];
  return (
    <Shell>
      <h1 className="font-display font-bold text-fluid-h1">{title}</h1>
      <p className="text-ink/50 text-sm mt-2">Última actualización: {UPDATED}</p>
      <p className="text-ink/75 mt-6 text-lg">{intro}</p>
      {sections.map(([heading, items]) => (
        <section key={heading} className="mt-10">
          <h2 className="font-display font-bold text-xl">{heading}</h2>
          <ul className="mt-3 space-y-3 text-ink/75 leading-relaxed list-disc pl-5">
            {items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>
      ))}
    </Shell>
  );
}
