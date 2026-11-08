// SEO for every public page: title (≤ 60 chars), meta description (≤ 155), H1, intro, steps and FAQ.
// Keywords come from Google autocomplete research (es-MX), see SEO.md.
// Used by the server (meta tags in the HTML) and by the React pages (H1 and visible content).

export const SITE_NAME = 'Monchys IA';
// Other ways people write the brand (the domain is spelled monshys)
const BRAND_ALIASES = ['Monchys', 'Monshys', 'Monshys IA', 'monshys.io'];
const BRAND = ' | Monchys';

export const HOME = {
  title: `${SITE_NAME}: herramientas online con IA en español`,
  description:
    'Monchys IA (monshys.io): convierte y comprime archivos gratis, edita PDF, quita fondos, transcribe audio y crea textos con IA. Sin instalar nada.',
  h1: 'Herramientas online con IA que se comen el trabajo pesado',
};

// Keyed by the product's toolUrl
export const TOOL_SEO = {
  '/herramientas/convertidor': {
    title: `Convertidor de archivos online gratis${BRAND}`,
    description:
      'Convierte gratis y sin registro: JPG a PNG, HEIC a JPG, imagen a PDF, MP4 a MP3, comprimir video y más. Rápido, en español y sin instalar nada.',
    h1: 'Convertidor de archivos online gratis',
    intro: 'Convierte imágenes, fotos del iPhone, audio y video a otro formato y comprime tus videos en segundos, gratis y sin registrarte.',
    category: 'MultimediaApplication',
    steps: [
      'Sube tu imagen, audio o video (hasta 25 MB).',
      'Elige el formato al que quieres convertirlo.',
      'Descarga el archivo convertido al instante.',
    ],
    faq: [
      ['¿El convertidor es gratis?', 'Sí. Puedes convertir imágenes y audio de hasta 25 MB gratis y sin crear una cuenta.'],
      ['¿Qué formatos puedo convertir?', 'Imágenes JPG, PNG, WEBP, AVIF, GIF, TIFF y HEIC (también a PDF), audio MP3, WAV, OGG, M4A, FLAC, AAC, OPUS y WMA, y el audio de videos MP4 y MOV.'],
      ['¿Cómo convierto un video MP4 a MP3?', 'Sube el video (hasta 50 MB gratis), elige MP3 y descarga solo el audio. Para videos más grandes usa el Convertidor Pro.'],
      ['¿Puedo comprimir un video gratis?', 'Sí. Sube un video de hasta 50 MB, elige "MP4 comprimido" y descárgalo listo para enviar por WhatsApp.'],
      ['¿Cómo abro las fotos HEIC del iPhone?', 'Súbelas aquí y conviértelas a JPG o PNG para verlas en Windows, Android o cualquier programa.'],
      ['¿Mis archivos están seguros?', 'Tus archivos se borran de nuestro servidor en cuanto termina la conversión. No los guardamos ni los compartimos.'],
      ['¿Puedo convertir videos o archivos más grandes?', 'Sí, con el Convertidor Pro: convertir video a MP4, WEBM o GIF, archivos de hasta 2 GB y hasta 50 archivos a la vez.'],
    ],
  },
  '/herramientas/convertidor-pro': {
    title: `Convertir y comprimir video online${BRAND}`,
    description:
      'Convierte y comprime videos de hasta 2 GB: MOV a MP4, video a GIF, comprimir para WhatsApp y extraer audio, hasta 50 archivos a la vez.',
    h1: 'Convertidor de video y archivos grandes',
    intro: 'Convierte videos a MP4, WEBM o GIF, comprímelos para enviarlos por WhatsApp y extrae el audio, con archivos de hasta 2 GB y varios a la vez.',
    category: 'MultimediaApplication',
    steps: [
      'Arrastra hasta 50 archivos: video, audio o imágenes de hasta 2 GB.',
      'Elige el formato de salida de cada uno.',
      'Convierte todo y descárgalo uno a uno o en un ZIP.',
    ],
    faq: [
      ['¿Cómo comprimo un video para WhatsApp?', 'Sube el video, elige "MP4 comprimido" y descárgalo: se reduce a 720p y pesa mucho menos. Si ya estaba optimizado, te devolvemos el original.'],
      ['¿Puedo convertir archivos grandes?', 'Sí, el Convertidor Pro admite archivos de hasta 2 GB, ideal para videos MOV del iPhone o grabaciones largas.'],
      ['¿Puedo convertir un video a GIF?', 'Sí. Creamos un GIF animado de hasta 15 segundos optimizado para compartir.'],
    ],
  },
  '/herramientas/quitar-fondo': {
    title: `Quitar fondo de imagen online con IA${BRAND}`,
    description:
      'Quita el fondo de tus fotos en segundos con IA y descárgalas en PNG transparente, fondo blanco o de color. Hasta 4K y por lotes, sin perder calidad.',
    h1: 'Quitar fondo de imagen con IA',
    intro: 'Elimina el fondo de fotos de productos, retratos y logos automáticamente y consigue un PNG con fondo transparente.',
    category: 'DesignApplication',
    steps: [
      'Sube una o varias fotos (JPG, PNG, WEBP…).',
      'La IA detecta el sujeto y borra el fondo automáticamente.',
      'Descarga el PNG transparente o con fondo blanco o de color.',
    ],
    faq: [
      ['¿Cómo quito el fondo de una imagen?', 'Sube la foto y la IA borra el fondo en unos segundos. Después descárgala en PNG con fondo transparente.'],
      ['¿Pierde calidad la imagen?', 'No. La imagen se procesa a su resolución original, hasta 4K.'],
      ['¿Puedo quitar el fondo de varias fotos a la vez?', 'Sí, puedes procesar hasta 50 imágenes por lote y descargarlas todas en un ZIP.'],
      ['¿Cómo convierto un JPG a PNG sin fondo?', 'Sube tu JPG aquí: al quitar el fondo obtienes directamente un PNG transparente.'],
    ],
  },
  '/herramientas/transcripcion': {
    title: `Transcribir audio a texto online con IA${BRAND}`,
    description:
      'Pasa audio a texto en minutos: notas de voz de WhatsApp, reuniones de Zoom o Meet y clases. Exporta a Word, TXT o subtítulos SRT, en español.',
    h1: 'Transcribir audio a texto',
    intro: 'Convierte audio y video a texto con marcas de tiempo: notas de voz, reuniones, entrevistas y clases, listas para copiar o descargar.',
    category: 'BusinessApplication',
    steps: [
      'Sube tu audio o video (MP3, M4A, WAV, OGG, MP4…).',
      'Elige el idioma y espera unos minutos mientras se transcribe.',
      'Copia el texto o descárgalo en Word, TXT o SRT.',
    ],
    faq: [
      ['¿Cómo paso un audio de WhatsApp a texto?', 'Guarda la nota de voz (archivo .opus u .ogg), súbela aquí y obtendrás el texto en unos minutos.'],
      ['¿Puedo transcribir reuniones de Zoom, Meet o Teams?', 'Sí. Sube la grabación de la reunión (audio o video) y te devolvemos la transcripción completa con tiempos.'],
      ['¿En qué formatos puedo descargar la transcripción?', 'En Word (DOCX), texto plano (TXT) y subtítulos SRT.'],
      ['¿Cuánto audio puedo transcribir?', 'Hasta 600 minutos al mes y 60 minutos por archivo.'],
    ],
  },
  '/herramientas/resumir-pdf': {
    title: `Resumir PDF con IA y hacerle preguntas${BRAND}`,
    description:
      'Resume PDF largos en segundos con IA y hazle preguntas al documento. Ideal para estudiar, revisar contratos o leer informes. Online y en español.',
    h1: 'Resumir PDF con IA',
    intro: 'Sube un PDF y obtén un resumen claro con sus puntos clave. Después, chatea con el documento para resolver tus dudas.',
    category: 'EducationalApplication',
    steps: [
      'Sube tu PDF (hasta 300 páginas).',
      'Recibe un resumen con las ideas principales y las cifras importantes.',
      'Haz preguntas al documento como si chatearas con él.',
    ],
    faq: [
      ['¿Cómo resumo un PDF con IA?', 'Sube el archivo y en segundos tendrás un resumen con los puntos clave del documento.'],
      ['¿Puedo hacerle preguntas a un PDF?', 'Sí, en documentos de hasta 50 páginas puedes chatear con el PDF y la IA te responde citando la página.'],
      ['¿Sirve para estudiar?', 'Sí. Es ideal para resumir apuntes, artículos y libros, y repasar preguntando por los temas que no entiendas.'],
    ],
  },
  '/herramientas/cv': {
    title: `Hacer CV online con IA y carta de presentación${BRAND}`.replace(BRAND, ''),
    description:
      'Crea tu currículum vitae profesional en minutos: diseños modernos, vista previa en vivo, descarga en PDF y Word, y carta de presentación con IA.',
    h1: 'Hacer CV online con IA',
    intro: 'Crea un currículum vitae profesional, descárgalo en PDF o Word y genera una carta de presentación adaptada a cada oferta de trabajo.',
    category: 'BusinessApplication',
    steps: [
      'Rellena tus datos, experiencia, estudios y habilidades.',
      'Elige diseño y color mientras ves tu CV en tiempo real.',
      'Descárgalo en PDF o Word y crea tu carta de presentación.',
    ],
    faq: [
      ['¿Cómo hago un CV profesional?', 'Completa cada sección, elige uno de los diseños y descárgalo en PDF. La IA puede mejorar la redacción de tu experiencia.'],
      ['¿Puedo descargar mi CV en Word?', 'Sí, puedes descargarlo en PDF y en Word (DOCX) para editarlo cuando quieras.'],
      ['¿Incluye carta de presentación?', 'Sí. Pega la oferta de trabajo y generamos una carta de presentación laboral basada en tu CV.'],
      ['¿Tengo que pagar cada mes?', 'No. El generador de CV es un pago único y tu currículum queda guardado en tu cuenta.'],
    ],
  },
  '/herramientas/ahorro': {
    title: `App de control de gastos para ahorrar dinero${BRAND}`,
    description:
      'Registra tus gastos escribiendo como en un chat ("gasté 20 en comida"), pon presupuestos por categoría y recibe alertas para ahorrar dinero.',
    h1: 'Control de gastos para ahorrar dinero',
    intro: 'Anota tus gastos e ingresos escribiendo frases normales y descubre en qué se va tu dinero cada mes.',
    category: 'FinanceApplication',
    steps: [
      'Escribe tus gastos como en un chat: "uber 85" o "gasté 120 en el súper".',
      'Define un presupuesto por categoría y tu meta de ahorro mensual.',
      'Revisa tu resumen del mes y recibe alertas antes de pasarte.',
    ],
    faq: [
      ['¿Cómo registro mis gastos?', 'Escribe frases como "gasté 20 en comida" o "cobré 15000 de sueldo" y se clasifican solas por categoría.'],
      ['¿Puedo poner un presupuesto mensual?', 'Sí, un presupuesto por categoría y una meta de ahorro. Te avisamos cuando te acercas al límite.'],
      ['¿Es asesoría financiera?', 'No. Es una herramienta de organización personal para controlar gastos e ingresos; no da consejos de inversión.'],
    ],
  },
  '/herramientas/diario': {
    title: `Diario emocional online y registro de emociones`,
    description:
      'Escribe cómo te sientes con preguntas guía, registra tus emociones diarias, mira tu ánimo de los últimos 30 días y practica ejercicios de respiración.',
    h1: 'Diario emocional online',
    intro: 'Un espacio privado para escribir cómo te sientes, registrar tus emociones diarias y entender cómo cambia tu ánimo.',
    category: 'HealthApplication',
    steps: [
      'Elige cómo te sientes hoy y las emociones que más notas.',
      'Escribe libremente con la pregunta guía del día.',
      'Mira tu ánimo de los últimos 30 días y practica la respiración guiada.',
    ],
    faq: [
      ['¿Qué es un diario emocional?', 'Un registro diario de cómo te sientes y por qué. Escribirlo ayuda a reconocer patrones y a entender tus emociones.'],
      ['¿Alguien más puede leer mi diario?', 'No. Tus entradas son privadas y solo se muestran en tu cuenta.'],
      ['¿Sustituye a un psicólogo?', 'No. Es una herramienta de bienestar personal. Si estás pasando por una crisis, contacta con los servicios de emergencia o una línea de ayuda.'],
    ],
  },
  '/herramientas/reservas': {
    title: `App para agendar citas con IA para negocios${BRAND}`,
    description:
      'Tus clientes reservan solos 24/7 desde tu página o hablando con un chatbot con IA. Ideal para barberías, salones de uñas, clínicas y consultorios.',
    h1: 'Agenda de citas online con IA para tu negocio',
    intro: 'Tu propia página de reservas con un asistente de IA que responde a tus clientes, consulta tus horarios libres y agenda citas por ti.',
    category: 'BusinessApplication',
    steps: [
      'Configuramos contigo tus servicios, precios y horarios.',
      'Compartes el enlace de tu página de reservas con tus clientes.',
      'Ellos reservan solos (por formulario o chat) y tú ves todo en tu agenda.',
    ],
    faq: [
      ['¿Cómo agendan citas mis clientes?', 'Entran a tu enlace, eligen servicio, día y hora libre, y confirman. También pueden escribirle al chatbot y él reserva por ellos.'],
      ['¿Sirve para barberías y salones de uñas?', 'Sí. Está pensado para negocios con citas: barberías, salones de belleza, uñas, clínicas, consultorios y similares.'],
      ['¿Se pueden reservar dos clientes a la misma hora?', 'No. Solo se muestran las horas realmente libres y el sistema evita citas solapadas.'],
    ],
  },
  '/herramientas/comprimir': {
    title: `Comprimir PDF e imágenes online gratis${BRAND}`,
    description:
      'Reduce el peso de tus PDF y fotos JPG, PNG o HEIC gratis y sin registro. Ideal para enviar por correo, WhatsApp o subir a formularios.',
    h1: 'Comprimir PDF e imágenes online gratis',
    intro: 'Reduce el tamaño de tus PDF y fotos en segundos para enviarlos por correo o WhatsApp, gratis y sin crear una cuenta.',
    category: 'UtilitiesApplication',
    steps: [
      'Elige el nivel de compresión: ligera, equilibrada o fuerte.',
      'Arrastra tus fotos o PDF (hasta 50 MB cada uno).',
      'Descarga cada archivo comprimido o todos juntos en un ZIP.',
    ],
    faq: [
      ['¿Cómo comprimo un PDF para enviarlo por correo?', 'Súbelo aquí con la compresión "Equilibrada" y descárgalo: reducimos el peso de las fotos que lleva dentro sin tocar el texto.'],
      ['¿Se pierde calidad al comprimir?', 'Con la compresión ligera casi no se nota. La fuerte reduce más el tamaño a cambio de algo de calidad en las fotos.'],
      ['¿Por qué mi PDF casi no bajó de peso?', 'Si el PDF es casi todo texto ya ocupa poco. Lo que más pesa en un PDF son las fotos y los escaneos.'],
      ['¿Es gratis?', 'Sí, sin registro y sin marcas de agua. Tus archivos se borran en cuanto termina la compresión.'],
    ],
  },
  '/herramientas/editar-pdf': {
    title: `Editar PDF online: firmar, escribir y unir${BRAND}`,
    description:
      'Une, ordena y gira PDF gratis. Escribe, firma, tapa o resalta texto y numera páginas con Editar PDF. Desde el navegador, sin instalar nada.',
    h1: 'Editar PDF online: escribir, firmar y unir',
    intro: 'Escribe y firma sobre tus PDF, une varios en uno y cambia el orden de las páginas. Todo pasa en tu navegador: tus archivos no se suben a ningún sitio.',
    category: 'BusinessApplication',
    steps: [
      'Abre uno o varios PDF (se unen en el orden que elijas).',
      'Ordena, gira o elimina páginas, y pulsa Editar para escribir, firmar, tapar o resaltar.',
      'Descarga el PDF terminado, solo algunas páginas o cada página por separado.',
    ],
    faq: [
      ['¿Cómo firmo un PDF?', 'Pulsa Editar en la página, elige Firma, dibújala con el ratón o el dedo y haz clic donde quieras ponerla. También puedes subir una imagen de tu firma.'],
      ['¿Puedo cambiar un texto que ya está en el PDF?', 'Usa Tapar para cubrir el texto con un recuadro blanco y escribe el nuevo encima con la herramienta Texto.'],
      ['¿Cómo uno varios PDF en uno?', 'Ábrelos todos a la vez (o añade más con "Añadir otro PDF"), ordena las páginas arrastrándolas y descarga el PDF.'],
      ['¿Mis documentos se suben a internet?', 'No. El editor funciona dentro de tu navegador y tus archivos no salen de tu dispositivo.'],
      ['¿Qué es gratis y qué es de pago?', 'Unir, ordenar, girar, eliminar y separar páginas es gratis y sin registro. Escribir, firmar, tapar, resaltar, numerar páginas y poner marca de agua forman parte de Editar PDF.'],
    ],
  },
  '/herramientas/subtitulos': {
    title: `Subtítulos automáticos para videos con IA${BRAND}`,
    description:
      'Genera subtítulos automáticos en español o inglés, corrígelos y descárgalos en SRT o crea el video con subtítulos para Instagram o TikTok.',
    h1: 'Subtítulos automáticos para tus videos',
    intro: 'Sube un video y obtén sus subtítulos en minutos. Corrígelos, descárgalos en SRT o VTT o crea el video con los subtítulos ya puestos.',
    category: 'MultimediaApplication',
    steps: [
      'Sube tu video (hasta 30 minutos) y elige su idioma.',
      'Revisa y corrige los subtítulos mientras ves el video.',
      'Descarga el archivo SRT o VTT, o crea el video con los subtítulos incrustados.',
    ],
    faq: [
      ['¿Cómo pongo subtítulos a un video de TikTok o Instagram?', 'Sube el video, revisa los subtítulos y pulsa "Crear video": te devolvemos un MP4 con los subtítulos dentro, listo para publicar.'],
      ['¿Qué es un archivo SRT?', 'Es el formato de subtítulos más usado. YouTube, Facebook, LinkedIn y casi todos los reproductores lo aceptan.'],
      ['¿En qué idiomas funciona?', 'En español e inglés, y también puede detectar el idioma automáticamente.'],
      ['¿Guardan mi video?', 'El video se borra del servidor una hora después de subirlo; los subtítulos quedan guardados en tu cuenta hasta que los borres.'],
    ],
  },
  '/herramientas/redes': {
    title: `Generador de textos para redes sociales con IA${BRAND}`,
    description:
      'Crea publicaciones para Instagram, Facebook, TikTok, LinkedIn y X a partir de una idea, con el tono que quieras y hashtags para cada red.',
    h1: 'Generador de publicaciones para redes sociales',
    intro: 'Escribe tu idea en una frase y recibe publicaciones listas para Instagram, Facebook, TikTok, LinkedIn, X y WhatsApp.',
    category: 'BusinessApplication',
    steps: [
      'Cuenta qué quieres publicar (una oferta, una novedad, un evento…).',
      'Elige las redes, el tono y el idioma.',
      'Copia la versión que más te guste y publícala.',
    ],
    faq: [
      ['¿Incluye hashtags?', 'Sí, adaptados a cada red: más en Instagram, pocos en Facebook y LinkedIn, ninguno en WhatsApp.'],
      ['¿Puedo pedir varias versiones?', 'Sí, hasta 3 versiones distintas por red para elegir la que más te guste.'],
      ['¿Inventa precios o datos?', 'No. Si falta un dato como el precio o la fecha, deja un hueco para que lo completes.'],
    ],
  },
  '/herramientas/descripciones': {
    title: `Descripciones de productos con IA para vender${BRAND}`,
    description:
      'Crea títulos y descripciones que venden para tu tienda, Mercado Libre, Amazon o Marketplace, incluso a partir de una foto del producto.',
    h1: 'Generador de descripciones de productos con IA',
    intro: 'Sube una foto o escribe el nombre del producto y recibe título, descripción, viñetas y palabras clave para venderlo online.',
    category: 'BusinessApplication',
    steps: [
      'Sube una foto del producto o escribe su nombre y características.',
      'Elige dónde lo vendes y el tono.',
      'Copia el título, la descripción y las viñetas en tu publicación.',
    ],
    faq: [
      ['¿Sirve para Mercado Libre y Amazon?', 'Sí. Adaptamos el título y la descripción a las costumbres de cada plataforma para que tu producto aparezca en las búsquedas.'],
      ['¿Puede describir un producto solo con una foto?', 'Sí. Monchys mira la foto y escribe la descripción; si faltan datos importantes como medidas o material, te avisa para que los añadas.'],
      ['¿En qué idiomas?', 'Español, inglés y portugués.'],
    ],
  },
  '/herramientas/traductor': {
    title: `Traducir documentos Word y PDF con IA${BRAND}`,
    description:
      'Traduce documentos Word y PDF a inglés, español y 10 idiomas más con IA. Los Word conservan su formato y los PDF se entregan como Word.',
    h1: 'Traductor de documentos Word y PDF',
    intro: 'Sube un documento y descárgalo traducido a otro idioma. Los Word conservan tipos de letra, tablas y estilos.',
    category: 'BusinessApplication',
    steps: [
      'Elige el idioma al que quieres traducir.',
      'Sube tu documento Word, PDF o de texto.',
      'Descarga el documento traducido.',
    ],
    faq: [
      ['¿Se mantiene el formato?', 'En los documentos Word sí: se traduce cada párrafo dentro del mismo archivo. Los PDF se entregan como un Word editable con el texto traducido.'],
      ['¿A qué idiomas puedo traducir?', 'Español, inglés, portugués, francés, italiano, alemán, chino, japonés, coreano, árabe, ruso y neerlandés.'],
      ['¿Qué tan largo puede ser el documento?', 'Hasta unas 15 páginas (40.000 caracteres) por documento.'],
      ['¿Puedo traducir un PDF escaneado?', 'No, el PDF tiene que tener texto seleccionable. Si es una foto o un escaneo, primero hay que pasarlo por un programa de reconocimiento de texto (OCR).'],
    ],
  },
  '/herramientas/mejorar-fotos': {
    title: `Mejorar calidad de fotos con IA online${BRAND}`,
    description:
      'Amplía fotos pequeñas o pixeladas al doble con inteligencia artificial y mejora su color, contraste y nitidez en segundos.',
    h1: 'Mejorar la calidad de tus fotos con IA',
    intro: 'Duplica la resolución de fotos pequeñas o pixeladas y mejora automáticamente su color y nitidez.',
    category: 'MultimediaApplication',
    steps: [
      'Elige si quieres ampliar la foto, mejorar su color y nitidez, o ambas cosas.',
      'Sube tu foto.',
      'Compara el antes y el después y descarga la foto mejorada.',
    ],
    faq: [
      ['¿Qué fotos se pueden ampliar?', 'Las fotos pequeñas, de hasta 0,5 megapíxeles (por ejemplo 800 × 600): fotos de WhatsApp, antiguas o descargadas de internet. Las fotos grandes se mejoran sin ampliar.'],
      ['¿Cuánto tarda?', 'Mejorar el color es instantáneo; ampliar con IA tarda entre 30 segundos y 2 minutos.'],
      ['¿Puede arreglar una foto muy borrosa?', 'Mejora bastante las fotos pequeñas o pixeladas, pero no puede inventar detalles que no existen en una foto totalmente desenfocada.'],
    ],
  },
  '/herramientas/generar-imagenes': {
    title: `Generar imágenes con IA gratis en español${BRAND}`,
    description:
      'Describe en español lo que imaginas y la inteligencia artificial crea la imagen en segundos. 3 imágenes gratis al día, sin instalar nada.',
    h1: 'Generar imágenes con IA a partir de texto',
    intro: 'Escribe en español lo que quieres ver y la inteligencia artificial crea la imagen en segundos.',
    category: 'MultimediaApplication',
    steps: [
      'Describe la imagen que quieres: qué aparece, el estilo y los colores.',
      'Elige el formato: cuadrada, horizontal o vertical.',
      'Pulsa "Generar imagen" y descárgala. Si no te convence, crea otra versión.',
    ],
    faq: [
      ['¿Es gratis?', 'Sí: puedes generar 3 imágenes gratis al día sin suscripción. Con la suscripción generas 200 imágenes al mes.'],
      ['¿Puedo escribir en español?', 'Sí. Escribe como hablas; Monchys traduce y mejora tu descripción para que la IA la entienda mejor.'],
      ['¿Puedo usar las imágenes en mi negocio?', 'Sí, puedes usarlas en tus redes, tu web o tus productos. Se crean con FLUX.1 [schnell], un modelo con licencia que permite el uso comercial.'],
      ['¿Qué imágenes no se pueden crear?', 'No se generan desnudos ni contenido sexual, personas reales identificables, violencia gráfica, símbolos de odio, documentos falsos ni logotipos de otras marcas.'],
      ['¿Guardan mis imágenes?', 'No. La imagen se crea, te la mostramos y no la guardamos en nuestro servidor. Descárgala antes de cerrar la página.'],
    ],
  },
  '/herramientas/generar-videos': {
    title: `Generar videos con IA a partir de texto en español${BRAND}`,
    description:
      'Describe una escena en español y la inteligencia artificial crea un video corto en HD, horizontal o vertical para TikTok, Reels y Shorts.',
    h1: 'Generar videos con IA a partir de texto',
    intro: 'Describe una escena en español y la inteligencia artificial crea un video de unos 5 segundos en HD.',
    category: 'MultimediaApplication',
    steps: [
      'Describe la escena: qué aparece, qué se mueve y cómo se mueve la cámara.',
      'Elige el formato: vertical para TikTok y Reels u horizontal para YouTube.',
      'Pulsa "Generar video", espera alrededor de un minuto y descárgalo en MP4.',
    ],
    faq: [
      ['¿Cuánto dura cada video?', 'Unos 5 segundos, en calidad HD (720p). Es ideal para clips de redes sociales, fondos animados y anuncios cortos.'],
      ['¿Cuántos videos puedo crear?', 'Con la suscripción generas 30 videos al mes. El contador se renueva el día 1.'],
      ['¿Puedo usar los videos en mi negocio?', 'Sí. Se crean con Wan 2.2, un modelo con licencia Apache-2.0 que permite el uso comercial.'],
      ['¿El video tiene sonido?', 'No, los videos se crean sin audio. Puedes añadir música o voz después en tu editor o en la app de la red social.'],
      ['¿Qué videos no se pueden crear?', 'No se generan desnudos ni contenido sexual, personas reales identificables, violencia gráfica, símbolos de odio ni logotipos de otras marcas.'],
    ],
  },
};

// Tools with an explainer video in public/videos (npm run videos)
const VIDEO_TOOLS = new Set([
  'convertidor', 'convertidor-pro', 'quitar-fondo', 'transcripcion', 'resumir-pdf', 'cv', 'ahorro', 'diario', 'reservas',
  'comprimir', 'editar-pdf', 'subtitulos', 'redes', 'descripciones', 'traductor', 'mejorar-fotos',
]);

// Explainer videos rendered by video/render.mjs (npm run videos): /videos/<tool>.mp4 + .jpg poster
export const VIDEO_DATE = '2026-10-26';
export function videoFor(toolUrl) {
  const tool = toolUrl?.replace('/herramientas/', '');
  if (!TOOL_SEO[toolUrl] || !VIDEO_TOOLS.has(tool)) return null;
  return {
    src: `/videos/${tool}.mp4`,
    poster: `/videos/${tool}.jpg`,
    title: `Cómo usar: ${TOOL_SEO[toolUrl].h1}`,
    duration: 'PT16S',
  };
}

// Landing pages for popular conversions (from autocomplete research), e.g. /herramientas/convertidor/jpg-a-png
export const CONVERSIONS = [
  // Free converter
  { slug: 'jpg-a-png', from: 'JPG', to: 'png', tool: 'convertidor' },
  { slug: 'png-a-jpg', from: 'PNG', to: 'jpg', tool: 'convertidor' },
  { slug: 'heic-a-jpg', from: 'HEIC', to: 'jpg', tool: 'convertidor' },
  { slug: 'heic-a-png', from: 'HEIC', to: 'png', tool: 'convertidor' },
  { slug: 'heic-a-pdf', from: 'HEIC', to: 'pdf', tool: 'convertidor' },
  { slug: 'imagen-a-pdf', from: 'imagen', to: 'pdf', tool: 'convertidor' },
  { slug: 'jpg-a-pdf', from: 'JPG', to: 'pdf', tool: 'convertidor' },
  { slug: 'png-a-pdf', from: 'PNG', to: 'pdf', tool: 'convertidor' },
  { slug: 'webp-a-jpg', from: 'WEBP', to: 'jpg', tool: 'convertidor' },
  { slug: 'webp-a-png', from: 'WEBP', to: 'png', tool: 'convertidor' },
  { slug: 'avif-a-jpg', from: 'AVIF', to: 'jpg', tool: 'convertidor' },
  { slug: 'avif-a-png', from: 'AVIF', to: 'png', tool: 'convertidor' },
  { slug: 'jpg-a-webp', from: 'JPG', to: 'webp', tool: 'convertidor' },
  { slug: 'png-a-webp', from: 'PNG', to: 'webp', tool: 'convertidor' },
  { slug: 'mp4-a-mp3', from: 'MP4', to: 'mp3', tool: 'convertidor' },
  { slug: 'video-a-mp3', from: 'video', to: 'mp3', tool: 'convertidor' },
  { slug: 'wav-a-mp3', from: 'WAV', to: 'mp3', tool: 'convertidor' },
  { slug: 'm4a-a-mp3', from: 'M4A', to: 'mp3', tool: 'convertidor' },
  { slug: 'ogg-a-mp3', from: 'OGG', to: 'mp3', tool: 'convertidor' },
  { slug: 'flac-a-mp3', from: 'FLAC', to: 'mp3', tool: 'convertidor' },
  { slug: 'mp3-a-wav', from: 'MP3', to: 'wav', tool: 'convertidor' },
  { slug: 'audio-a-mp3', from: 'audio', to: 'mp3', tool: 'convertidor' },
  // Free video compression (main page for "comprimir video para whatsapp")
  {
    slug: 'comprimir-video',
    from: 'video',
    to: 'comprimir',
    tool: 'convertidor',
    seo: {
      title: `Comprimir video para WhatsApp online gratis${BRAND}`,
      description:
        'Comprime videos para WhatsApp online y gratis, sin registro ni marca de agua. Sube un MP4 o MOV de hasta 50 MB y descárgalo listo para enviar.',
      h1: 'Comprimir video para WhatsApp online gratis',
      intro:
        'Sube tu video, Monchys lo hace mucho más ligero sin que pierda calidad visible y te lo devuelve en MP4, listo para enviar por WhatsApp, correo o Telegram. Gratis, sin registro y sin marca de agua.',
      steps: [
        'Sube tu video MP4, MOV o de otro formato (hasta 50 MB gratis).',
        '"MP4 comprimido" ya viene elegido: pulsa Convertir.',
        'Descarga el video comprimido y envíalo por WhatsApp.',
      ],
      guide: [
        [
          'Cómo comprimir un video para WhatsApp paso a paso',
          'Arrastra el video a la zona de arriba o pulsa para elegirlo desde tu celular o computadora. El formato "MP4 comprimido" ya viene seleccionado, así que solo tienes que pulsar Convertir y esperar unos segundos. Cuando termine, descarga el archivo y compártelo en WhatsApp como cualquier otro video. Funciona igual en Android, iPhone, Windows y Mac, directamente desde el navegador y sin instalar ninguna aplicación.',
        ],
        [
          'Límites de tamaño de video en WhatsApp',
          'WhatsApp recomprime los videos que envías y, según la versión de la app y el tipo de envío, puede tardar mucho, gastar muchos datos o rechazar los videos más pesados. Durante años el límite para enviar un video normal fue de 16 MB, y hoy los archivos de hasta 2 GB solo se pueden mandar como documento, sin vista previa en el chat. Si comprimes el video antes de enviarlo, se sube más rápido, ocupa menos espacio en el teléfono de quien lo recibe y WhatsApp apenas tiene que tocarlo, así que se ve mejor.',
        ],
        [
          'Qué hace exactamente el compresor',
          'Convertimos el video a MP4 con el códec H.264, el más compatible con WhatsApp y con cualquier celular. Si el video es más ancho de 1280 píxeles lo ajustamos a 720p, que es la calidad que WhatsApp usa al mostrarlo, y reducimos el audio a una calidad adecuada para la voz y la música. Además, lo preparamos para que empiece a reproducirse al instante. Si tu video ya estaba optimizado y no se puede reducir más, te devolvemos el original para que nunca descargues un archivo más pesado.',
        ],
        [
          'Formatos de video compatibles',
          'Puedes subir videos MP4, MOV (los que graba el iPhone), M4V, MKV, AVI, WMV, FLV, 3GP y MPEG. Siempre recibirás un MP4, el formato que WhatsApp, Instagram, Facebook y Telegram reproducen sin problemas. Si solo necesitas el sonido del video, en esta misma herramienta puedes convertirlo a MP3.',
        ],
        [
          'Consejos para que tu video se vea bien en WhatsApp',
          'Graba en horizontal o vertical, pero evita girar el teléfono a mitad del video. Si vas a recortarlo, hazlo antes de comprimir: cuanto más corto sea, más ligero quedará. Para estados de WhatsApp, divide los videos largos en clips cortos. Y si el video lleva texto o subtítulos pequeños, usa la compresión una sola vez: comprimir varias veces el mismo archivo hace que las letras se vean borrosas.',
        ],
        [
          '¿Tu video pesa más de 50 MB?',
          'La versión gratuita admite videos de hasta 50 MB, suficiente para la mayoría de clips grabados con el celular. Para videos largos o de alta resolución, el Convertidor Pro comprime archivos de hasta 2 GB y hasta 50 videos a la vez, sin límite de uso.',
        ],
      ],
      faq: [
        ['¿Es gratis comprimir videos?', 'Sí. Puedes comprimir videos de hasta 50 MB gratis, sin registrarte y sin marca de agua.'],
        ['¿El video pierde calidad?', 'Muy poca: se ajusta a 720p, la resolución con la que WhatsApp muestra los videos, así que en el celular se ve prácticamente igual.'],
        ['¿Cuánto tarda?', 'Un video corto de celular tarda entre unos segundos y un par de minutos, según su duración.'],
        ['¿Funciona en iPhone y Android?', 'Sí, desde el navegador de cualquier celular o computadora, sin instalar aplicaciones.'],
        ['¿Guardan mis videos?', 'No. El video se borra de nuestro servidor en cuanto termina la compresión.'],
      ],
    },
  },
  // Convertidor Pro (video output and big files)
  { slug: 'mov-a-mp4', from: 'MOV', to: 'mp4', tool: 'convertidor-pro' },
  { slug: 'video-a-gif', from: 'video', to: 'gif', tool: 'convertidor-pro' },
  // Task pages for other tools: own SEO text, steps and FAQ; `to` is the preset passed to the tool
  ...[
    ['comprimir', 'comprimir-pdf', 'equilibrada', {
      title: 'Comprimir PDF gratis online sin perder calidad',
      description: 'Reduce el peso de tu PDF gratis y sin registro para enviarlo por correo o subirlo a un formulario. Comprime las fotos y escaneos que lleva dentro.',
      h1: 'Comprimir PDF gratis',
      intro: 'Sube tu PDF y descárgalo mucho más ligero, listo para enviar por correo o subir a cualquier portal. Gratis, sin registro y sin marcas de agua.',
      steps: ['Elige el nivel de compresión (la equilibrada sirve para casi todo).', 'Arrastra tu PDF, de hasta 50 MB.', 'Descarga el PDF comprimido.'],
      faq: [
        ['¿Cómo reduzco un PDF a menos de 1 MB?', 'Usa la compresión "Fuerte". Si el PDF lleva muchas fotos o páginas escaneadas, suele bajar a una fracción de su tamaño.'],
        ['¿Se pierde calidad del texto?', 'No. El texto queda igual de nítido; solo se optimizan las imágenes que hay dentro del PDF.'],
        ['¿Es gratis?', 'Sí, sin registro y sin límite de archivos. El PDF se borra del servidor al terminar.'],
      ],
    }],
    ['comprimir', 'comprimir-imagen', 'equilibrada', {
      title: 'Comprimir imagen online gratis: JPG, PNG y WEBP',
      description: 'Comprime imágenes JPG, PNG, WEBP y fotos del iPhone gratis y sin registro. Pesan mucho menos y se ven igual. Hasta 30 imágenes a la vez.',
      h1: 'Comprimir imágenes online gratis',
      intro: 'Reduce el peso de tus fotos e imágenes para tu web, correo o redes sin que se note la diferencia. Gratis y de varias en varias.',
      steps: ['Elige el nivel de compresión.', 'Arrastra tus imágenes (hasta 30 a la vez).', 'Descárgalas una a una o todas en un ZIP.'],
      faq: [
        ['¿Qué formatos puedo comprimir?', 'JPG, PNG, WEBP, AVIF, TIFF y fotos HEIC del iPhone (estas salen en JPG).'],
        ['¿Las imágenes PNG mantienen la transparencia?', 'Sí, los PNG se comprimen reduciendo colores y conservan el fondo transparente.'],
      ],
    }],
    ['comprimir', 'reducir-tamano-foto', 'fuerte', {
      title: 'Reducir tamaño de foto online gratis (KB y MB)',
      description: 'Reduce el tamaño de una foto en KB o MB para subirla a formularios, trámites o enviarla por correo. Gratis, rápido y sin instalar nada.',
      h1: 'Reducir el tamaño de una foto',
      intro: '¿Un formulario o trámite no acepta tu foto porque pesa demasiado? Súbela aquí y descárgala más ligera en segundos.',
      steps: ['La compresión "Fuerte" ya viene elegida para reducir al máximo.', 'Sube tu foto.', 'Descarga la foto reducida.'],
      faq: [
        ['¿Cómo reduzco una foto a menos de 200 KB?', 'Con la compresión "Fuerte" la foto se ajusta a 1600 px y se comprime; la mayoría de fotos de celular quedan por debajo de 300 KB.'],
        ['¿Cambia el tamaño en píxeles?', 'Con la compresión fuerte las fotos muy grandes se ajustan a 1600 px de lado, suficiente para pantallas y documentos.'],
      ],
    }],
    ['comprimir', 'comprimir-jpg', 'equilibrada', {
      title: 'Comprimir JPG online gratis',
      description: 'Comprime fotos JPG gratis y sin registro: reducen su peso sin perder calidad visible. Ideal para webs, correos y redes sociales.',
      h1: 'Comprimir JPG gratis',
      intro: 'Sube tus fotos JPG y descárgalas mucho más ligeras, con la misma apariencia.',
      steps: ['Elige el nivel de compresión.', 'Arrastra tus archivos JPG.', 'Descarga los JPG comprimidos.'],
      faq: [['¿Cuánto se reduce un JPG?', 'Depende de la foto: con la compresión equilibrada suele bajar entre un 40 % y un 70 %.']],
    }],
    ['comprimir', 'comprimir-png', 'equilibrada', {
      title: 'Comprimir PNG online gratis con transparencia',
      description: 'Comprime imágenes PNG gratis manteniendo el fondo transparente. Ideal para logos, capturas de pantalla e imágenes para web.',
      h1: 'Comprimir PNG gratis',
      intro: 'Reduce el peso de tus PNG, capturas y logos sin perder la transparencia.',
      steps: ['Elige el nivel de compresión.', 'Arrastra tus archivos PNG.', 'Descarga los PNG comprimidos.'],
      faq: [['¿Se mantiene el fondo transparente?', 'Sí. El PNG sigue siendo PNG y conserva su transparencia.']],
    }],
    ['comprimir', 'comprimir-foto-para-whatsapp', 'fuerte', {
      title: 'Comprimir foto para WhatsApp y correo gratis',
      description: 'Reduce el peso de tus fotos para enviarlas por WhatsApp, correo o Telegram sin que se vean mal. Gratis y sin registro.',
      h1: 'Comprimir fotos para enviar por WhatsApp',
      intro: 'Haz tus fotos más ligeras para enviarlas rápido por WhatsApp o correo, incluso varias a la vez.',
      steps: ['La compresión "Fuerte" ya viene elegida.', 'Sube tus fotos.', 'Descárgalas y envíalas.'],
      faq: [['¿Se ven bien en el celular?', 'Sí. Se ajustan a 1600 px, más que suficiente para verlas en cualquier pantalla de celular.']],
    }],
    ['editar-pdf', 'unir-pdf', 'unir', {
      title: 'Unir PDF gratis: juntar varios PDF en uno',
      description: 'Une varios PDF en uno gratis y sin registro, y ordena sus páginas como quieras. Todo en tu navegador: tus archivos no se suben a ningún servidor.',
      h1: 'Unir PDF gratis: junta varios PDF en uno',
      intro: 'Abre varios PDF a la vez, ordena sus páginas arrastrándolas y descarga un solo PDF. Gratis, sin registro y sin marca de agua.',
      steps: ['Abre todos los PDF que quieras unir.', 'Arrastra las páginas para ordenarlas y elimina las que sobren.', 'Pulsa Descargar PDF.'],
      faq: [
        ['¿Es gratis unir PDF?', 'Sí, unir, ordenar, girar y separar PDF es gratis y no necesitas cuenta.'],
        ['¿Cuántos PDF puedo unir?', 'Los que quieras, hasta 300 páginas en total.'],
        ['¿Mis documentos se suben a internet?', 'No. La unión se hace en tu navegador y tus PDF no salen de tu dispositivo.'],
      ],
    }],
    ['editar-pdf', 'firmar-pdf', 'firmar', {
      title: 'Firmar PDF online: firma a mano o con imagen',
      description: 'Firma un PDF dibujando tu firma con el ratón o el dedo, o con una imagen de tu firma. Sin imprimir ni escanear y sin instalar nada.',
      h1: 'Firmar un PDF online',
      intro: 'Dibuja tu firma o sube una imagen de ella y colócala donde quieras en el PDF. Sin imprimir, sin escanear.',
      steps: ['Abre tu PDF y pulsa Editar en la página que quieres firmar.', 'Elige Firma, dibújala y haz clic donde quieras ponerla.', 'Descarga el PDF firmado.'],
      faq: [
        ['¿Puedo firmar desde el celular?', 'Sí, puedes dibujar la firma con el dedo directamente en la pantalla.'],
        ['¿Puedo añadir también la fecha o mi nombre?', 'Sí, con la herramienta Texto escribes donde quieras: fecha, nombre o iniciales.'],
      ],
    }],
    ['editar-pdf', 'separar-pdf', 'separar', {
      title: 'Separar PDF gratis: dividir y extraer páginas',
      description: 'Divide un PDF en páginas sueltas o extrae solo las que necesitas, gratis y sin registro, desde el navegador y sin subir tus archivos.',
      h1: 'Separar PDF y extraer páginas gratis',
      intro: 'Saca de un PDF solo las páginas que necesitas o divídelo en un archivo por página.',
      steps: ['Abre tu PDF.', 'Marca las páginas que quieres extraer, o usa "Separar en páginas".', 'Descarga las páginas elegidas o el ZIP con todas.'],
      faq: [['¿Cómo saco una sola página de un PDF?', 'Marca la casilla de esa página y pulsa "Descargar seleccionadas".']],
    }],
    ['editar-pdf', 'rotar-pdf', 'rotar', {
      title: 'Rotar PDF gratis: girar páginas de un PDF',
      description: 'Gira gratis las páginas de un PDF que salieron de lado o al revés y guárdalo así. Página por página, desde el navegador y sin registro.',
      h1: 'Rotar las páginas de un PDF gratis',
      intro: '¿Escaneaste un documento y alguna página salió de lado? Gírala aquí y guarda el PDF bien orientado.',
      steps: ['Abre tu PDF.', 'Usa los botones de girar en cada página que esté de lado.', 'Descarga el PDF corregido.'],
      faq: [['¿Puedo girar solo una página?', 'Sí, cada página tiene sus propios botones para girar a la izquierda o a la derecha.']],
    }],
    ['editar-pdf', 'numerar-paginas-pdf', 'numerar', {
      title: 'Numerar páginas de un PDF online',
      description: 'Añade números de página a tu PDF automáticamente, centrados abajo y con el total de páginas. Rápido y desde el navegador.',
      h1: 'Numerar las páginas de un PDF',
      intro: 'Añade números a todas las páginas de tu PDF en un clic, por ejemplo para un trabajo, una tesis o un informe.',
      steps: ['Abre tu PDF (la numeración ya viene activada).', 'Ordena o elimina páginas si lo necesitas.', 'Descarga el PDF numerado.'],
      faq: [['¿Cómo se ven los números?', 'Centrados en la parte de abajo de cada página, con el formato "1 / 10".']],
    }],
    ['editar-pdf', 'marca-de-agua-pdf', 'marca', {
      title: 'Poner marca de agua a un PDF online',
      description: 'Añade una marca de agua de texto como CONFIDENCIAL, BORRADOR o tu marca a todas las páginas de un PDF, desde el navegador.',
      h1: 'Añadir marca de agua a un PDF',
      intro: 'Escribe el texto de tu marca de agua y se añade en diagonal a todas las páginas del PDF.',
      steps: ['Abre tu PDF.', 'Escribe el texto en "Marca de agua".', 'Descarga el PDF con la marca de agua.'],
      faq: [['¿La marca de agua tapa el contenido?', 'No, es semitransparente y va en diagonal para que el documento se siga leyendo.']],
    }],
    ['editar-pdf', 'escribir-en-pdf', 'escribir', {
      title: 'Escribir en un PDF online y rellenarlo',
      description: 'Escribe sobre cualquier PDF para rellenar formularios, solicitudes o contratos. Elige tamaño y color del texto, sin instalar nada.',
      h1: 'Escribir en un PDF y rellenarlo',
      intro: 'Rellena formularios y documentos PDF escribiendo directamente sobre ellos, sin imprimirlos.',
      steps: ['Abre tu PDF y pulsa Editar en la página.', 'Elige Texto y haz clic donde quieras escribir.', 'Descarga el PDF relleno.'],
      faq: [['¿Puedo corregir un texto que ya está en el PDF?', 'Sí: tápalo con la herramienta Tapar y escribe el texto nuevo encima.']],
    }],
    ['subtitulos', 'subtitulos-para-tiktok', 'video', {
      title: 'Subtítulos para TikTok y Reels automáticos',
      description: 'Pon subtítulos automáticos a tus videos de TikTok, Reels y Shorts y descárgalos con los subtítulos incrustados, listos para publicar.',
      h1: 'Subtítulos automáticos para TikTok y Reels',
      intro: 'La mayoría ve los videos sin sonido: añade subtítulos automáticos a tus videos verticales y publícalos con el texto ya puesto.',
      steps: ['Sube tu video vertical.', 'Revisa y corrige el texto mientras lo ves.', 'Pulsa "Crear video" y descárgalo con subtítulos.'],
      faq: [['¿Sirve para videos verticales?', 'Sí, los subtítulos se ajustan al formato del video, vertical u horizontal.']],
    }],
    ['traductor', 'traducir-pdf-al-ingles', 'en', {
      title: 'Traducir PDF al inglés online con IA',
      description: 'Traduce un PDF o un Word del español al inglés con IA y descárgalo como documento Word editable. Hasta 15 páginas por documento.',
      h1: 'Traducir un PDF al inglés',
      intro: 'Sube tu PDF o Word en español y descárgalo traducido al inglés, listo para editar.',
      steps: ['El inglés ya viene elegido como idioma.', 'Sube tu PDF o Word.', 'Descarga el documento traducido.'],
      faq: [['¿El PDF traducido mantiene el diseño?', 'Los PDF se entregan como Word editable con el texto traducido; si subes un Word, conserva su formato original.']],
    }],
    ['mejorar-fotos', 'mejorar-foto-borrosa', 'mejorar', {
      title: 'Mejorar foto borrosa o pixelada con IA',
      description: 'Mejora fotos pequeñas, borrosas o pixeladas con IA: duplica su resolución y ajusta color y nitidez automáticamente.',
      h1: 'Mejorar una foto borrosa o pixelada',
      intro: 'Fotos de WhatsApp, antiguas o descargadas que se ven pixeladas: la IA las amplía y les devuelve nitidez.',
      steps: ['Deja activadas "Ampliar ×2" y "Mejorar color y nitidez".', 'Sube tu foto.', 'Compara el antes y el después y descárgala.'],
      faq: [['¿Funciona con fotos muy desenfocadas?', 'Mejora mucho las fotos pequeñas o pixeladas; en fotos completamente desenfocadas la mejora es más limitada.']],
    }],
  ].map(([tool, slug, to, seo]) => ({ tool, slug, to, seo: { ...seo, title: `${seo.title}${BRAND}` } })),
];

export function conversionSeo(conv) {
  if (conv.seo) return conv.seo;
  if (conv.to === 'comprimir') {
    return {
      title: `Comprimir video para WhatsApp online${BRAND}`,
      description:
        'Reduce el peso de tus videos MP4, MOV y más para enviarlos por WhatsApp o correo. Bajan a 720p y pesan mucho menos. Archivos de hasta 2 GB.',
      h1: 'Comprimir video online',
      intro: 'Sube tu video y obtén un MP4 mucho más ligero, listo para enviar por WhatsApp o correo, sin instalar programas.',
    };
  }
  const to = conv.to.toUpperCase();
  const free = conv.tool === 'convertidor';
  const generic = { audio: 'un audio', video: 'un video', imagen: 'una imagen o foto' };
  const what = generic[conv.from] ?? `un archivo ${conv.from}`;
  const extra = {
    'jpg-a-png': ' ¿Lo necesitas sin fondo? Usa Quitar fondo y obtén un PNG transparente.',
    'png-a-jpg': ' Si el PNG tiene transparencia, el fondo se vuelve blanco.',
    'mov-a-mp4': ' Ideal para los videos grabados con iPhone.',
    'mp4-a-mp3': ' Extrae solo el audio del video. Para videos de más de 25 MB, usa el Convertidor Pro.',
    'video-a-mp3': ' Extrae el audio de MP4, MOV y más. Para videos de más de 25 MB, usa el Convertidor Pro.',
    'heic-a-jpg': ' Ideal para abrir las fotos del iPhone en cualquier dispositivo.',
    'heic-a-png': ' Ideal para las fotos del iPhone.',
    'heic-a-pdf': ' Cada foto del iPhone queda en una página A4.',
    'imagen-a-pdf': ' Cada imagen se coloca centrada en una página A4.',
    'jpg-a-pdf': ' La imagen queda centrada en una página A4.',
    'png-a-pdf': ' La imagen queda centrada en una página A4.',
    'video-a-gif': ' Creamos un GIF animado de hasta 15 segundos.',
  }[conv.slug] ?? '';
  const fromLabel = conv.from === 'imagen' ? 'imagen o foto' : conv.from;
  return {
    title: free ? `Convertir ${fromLabel} a ${to} gratis online${BRAND}` : `Convertir ${fromLabel} a ${to} online${BRAND}`,
    // Whole sentences only: the long variant is used when it fits in 155 characters
    description: [
      free
        ? `Convierte ${what} a ${to} gratis, online y sin registro en segundos. Sin instalar programas y sin perder calidad.${extra}`
        : `Convierte ${what} a ${to} online, también archivos grandes de hasta 2 GB y por lotes.${extra}`,
      free ? `Convierte ${what} a ${to} gratis, online y sin registro.${extra}` : `Convierte ${what} a ${to} online.${extra}`,
    ].find((d) => d.length <= 155),
    h1: free ? `Convertir ${fromLabel} a ${to} gratis` : `Convertir ${fromLabel} a ${to} online`,
    intro: `Sube ${what}, elige ${to} y descarga el resultado en segundos.${extra}`,
  };
}

export const conversionBySlug = (tool, slug) => CONVERSIONS.find((c) => c.tool === tool && c.slug === slug);

// Pages that must not appear in search results
export const NOINDEX = ['/admin', '/perfil', '/entrar', '/registro', '/auth/callback', '/reservar/demo'];

// Legal pages: indexable, listed in the sitemap
export const LEGAL_SEO = {
  '/privacidad': { title: `Política de privacidad${' | ' + SITE_NAME}`, description: 'Qué datos recoge Monchys IA, para qué los usa y cómo puedes pedir verlos o borrarlos.' },
  '/terminos': { title: `Términos y condiciones${' | ' + SITE_NAME}`, description: 'Condiciones de uso de Monchys IA: cuentas, planes, pagos, cancelaciones y reembolsos.' },
  '/contacto': { title: `Contacto${' | ' + SITE_NAME}`, description: 'Escríbenos para dudas, pagos o ideas sobre las herramientas de Monchys IA.' },
};

// Chat with Monchys (/chat): questions + free tools on the visitor's files
export const CHAT_SEO = {
  title: `Chat con IA gratis en español | ${SITE_NAME}`,
  description: 'Pregunta lo que quieras y pásale tus archivos a Monchys: comprime videos para WhatsApp, convierte fotos y une PDF desde el chat. Gratis y sin registro.',
  h1: 'Chat con IA gratis: pregunta y pásale tus archivos',
  intro: 'Escríbele a Monchys como a un amigo que sabe de archivos. Responde tus dudas y, si adjuntas un archivo, lo comprime, lo convierte o une tus PDF ahí mismo.',
  steps: [
    'Escribe tu pregunta o adjunta un archivo con el clip (hasta 50 MB).',
    'Dile qué quieres: "comprime este video para WhatsApp", "pasa estas fotos a PDF", "une estos PDF".',
    'Descarga el resultado debajo del mensaje. Los archivos se borran después de 1 hora.',
  ],
  faq: [
    ['¿El chat es gratis?', 'Sí. Preguntar y usar las herramientas gratis (comprimir, convertir, unir, girar y separar PDF) no cuesta nada ni necesita cuenta. Hay un límite de mensajes por hora para que funcione rápido para todos.'],
    ['¿Qué puede hacer con mis archivos?', 'Comprimir fotos, PDF y videos; convertir imágenes (por ejemplo HEIC a JPG o fotos a PDF) y audio; sacar el audio de un video en MP3; y unir, girar o separar páginas de PDF.'],
    ['¿Qué pasa con mis archivos?', 'Se usan solo para hacer lo que pides y se borran automáticamente 1 hora después. No los compartimos con nadie.'],
    ['¿Puede escribir textos o resumir documentos?', 'Eso lo hacen las herramientas de pago, como el Resumidor de PDF o el Generador de publicaciones. Si las tienes activadas, Monchys las usa también dentro del chat.'],
  ],
};

export const PAGE_SEO = {
  '/entrar': { title: `Iniciar sesión${' | ' + SITE_NAME}`, description: 'Entra a tu cuenta de Monchys IA.' },
  '/registro': { title: `Crear cuenta${' | ' + SITE_NAME}`, description: 'Crea tu cuenta gratis en Monchys IA.' },
  '/perfil': { title: `Mi perfil${' | ' + SITE_NAME}`, description: 'Tu plan y tus herramientas.' },
  '/admin': { title: `Admin${' | ' + SITE_NAME}`, description: 'Panel de administración.' },
  '/auth/callback': { title: `Iniciando sesión${' | ' + SITE_NAME}`, description: 'Iniciando sesión en Monchys IA.' },
};

// Everything the HTML <head> needs for a path. `products` and `business` come from the server.
// Other landing pages of the same tool, as links
const relatedLinks = (tool, exceptSlug) =>
  CONVERSIONS.filter((c) => c.tool === tool && c.slug !== exceptSlug).map((c) => [conversionSeo(c).h1, `/herramientas/${c.tool}/${c.slug}`]);

// `content` is the readable text of the page, sent in the first HTML (server/seo-html.js) so
// search engines and AI crawlers read it without running JavaScript; React then replaces it.
// Page FAQ first, then the tool's, without repeating a question
export function mergeFaq(own = [], parent = []) {
  const seen = new Set();
  return [...own, ...parent].filter(([q]) => !seen.has(q) && seen.add(q));
}

export function seoFor(path, { products = [], business = null } = {}) {
  const noindex = NOINDEX.includes(path);
  if (path === '/') {
    const content = {
      h1: HOME.h1,
      intro: HOME.description,
      links: products.filter((p) => p.toolUrl).map((p) => [p.name, p.toolUrl, p.desc]),
    };
    return { ...HOME, path, noindex, schema: homeSchema(products), content };
  }
  if (PAGE_SEO[path]) return { ...PAGE_SEO[path], path, noindex: true };
  if (path === '/chat') {
    const { h1, intro, steps, faq } = CHAT_SEO;
    const schema = [
      { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Chat con Monchys', url: path, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Web', inLanguage: 'es', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      faqSchema(faq),
    ];
    return { ...CHAT_SEO, path, noindex, schema, content: { h1, intro, steps, faq, links: products.filter((p) => p.toolUrl && p.price === 0).map((p) => [p.name, p.toolUrl, p.desc]) } };
  }
  if (LEGAL_SEO[path]) return { ...LEGAL_SEO[path], path, noindex, content: { h1: LEGAL_SEO[path].title.split(' | ')[0], intro: LEGAL_SEO[path].description } };

  const booking = path.match(/^\/reservar\/([a-z0-9-]+)$/);
  if (booking) {
    const name = business?.name ?? 'tu negocio';
    return {
      title: `Reservar cita en ${name}`.slice(0, 60),
      description: (business?.description ? `${business.description} ` : '') + `Reserva tu cita online en ${name}: elige servicio, día y hora en segundos.`,
      path,
      noindex: noindex || !business,
      notFound: !business,
    };
  }

  const conv = path.match(/^\/herramientas\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
  if (conv) {
    const c = conversionBySlug(conv[1], conv[2]);
    if (c) {
      const seo = conversionSeo(c);
      const parent = TOOL_SEO[`/herramientas/${c.tool}`];
      const product = products.find((p) => p.toolUrl === `/herramientas/${c.tool}`);
      const faq = mergeFaq(seo.faq, parent?.faq);
      const content = { h1: seo.h1, intro: seo.intro, guide: seo.guide, steps: seo.steps ?? parent?.steps, faq, links: relatedLinks(c.tool, c.slug) };
      return { ...seo, path, noindex, content, schema: [toolSchema(seo, product, path), faq.length && faqSchema(faq), videoSchema(`/herramientas/${c.tool}`)].flat().filter(Boolean) };
    }
  }

  const tool = TOOL_SEO[path];
  if (tool) {
    const product = products.find((p) => p.toolUrl === path);
    const content = { h1: tool.h1, intro: tool.intro, steps: tool.steps, faq: tool.faq, links: relatedLinks(path.replace('/herramientas/', '')) };
    return { ...tool, path, noindex, content, schema: [toolSchema(tool, product, path), faqSchema(tool.faq), videoSchema(path)].flat().filter(Boolean) };
  }
  return { title: `Página no encontrada | ${SITE_NAME}`, description: HOME.description, path, noindex: true, notFound: true };
}

// Public URLs for the sitemap
export function sitemapPaths({ products = [], businesses = [] }) {
  const published = new Set(products.map((p) => p.toolUrl).filter(Boolean));
  return [
    '/',
    '/chat',
    ...Object.keys(TOOL_SEO).filter((p) => published.has(p)),
    ...CONVERSIONS.filter((c) => published.has(`/herramientas/${c.tool}`)).map((c) => `/herramientas/${c.tool}/${c.slug}`),
    ...Object.keys(LEGAL_SEO),
    ...businesses.filter((b) => !NOINDEX.includes(`/reservar/${b.id}`)).map((b) => `/reservar/${b.id}`),
  ];
}

// ---------- Structured data (schema.org JSON-LD) ----------
function toolSchema(seo, product, path) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: seo.h1,
    description: seo.description,
    applicationCategory: TOOL_SEO[product?.toolUrl]?.category ?? 'WebApplication',
    operatingSystem: 'Web',
    url: path,
    ...(product && {
      offers: {
        '@type': 'Offer',
        price: product.price,
        priceCurrency: 'USD',
        ...(product.period === 'month' && { category: 'subscription' }),
      },
    }),
  };
}

function videoSchema(toolUrl) {
  const v = videoFor(toolUrl);
  if (!v) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: v.title,
    description: `Video de 16 segundos: ${TOOL_SEO[toolUrl].steps.join(' ')}`,
    thumbnailUrl: v.poster,
    contentUrl: v.src,
    uploadDate: VIDEO_DATE,
    duration: v.duration,
    inLanguage: 'es',
  };
}

function faqSchema(faq) {
  if (!faq?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
}

function homeSchema() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      alternateName: BRAND_ALIASES,
      url: '/',
      logo: '/icon-512.png',
      email: 'contacto@monshys.io',
      description: 'Tienda online de herramientas con inteligencia artificial en español: convertir, comprimir y editar archivos, transcribir audio y escribir textos.',
    },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, alternateName: BRAND_ALIASES, url: '/', inLanguage: 'es' },
  ];
}
