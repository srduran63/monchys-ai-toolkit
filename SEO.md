# SEO de Monchys IA

Investigación: sugerencias de autocompletado de Google en español (México), octubre de 2026. El autocompletado muestra las búsquedas más frecuentes, pero **no da volumen**: para cifras exactas, valida con Google Search Console (gratis, una vez publicada la web) o con Google Keyword Planner.

Dónde vive cada cosa: textos SEO en `shared/seo.js`, etiquetas `<head>` en `server/seo-html.js`, `robots.txt` y `sitemap.xml` en `server/index.js`.

## Patrones de búsqueda

- Modificadores dominantes: **gratis**, **online**, **sin registro**, **con IA**, **sin perder calidad**, **en español**.
- Solo usamos "gratis" donde es verdad (convertidor). En herramientas de pago se usa "online" y "con IA".
- Las búsquedas de formato concreto ("convertir webp a jpg") tienen intención de uso inmediata → una página por conversión.

## Mapa de palabras clave → página

| Página | Palabra clave principal | Secundarias (en texto, H2 y FAQ) |
|---|---|---|
| `/` | herramientas online con IA | convertir archivos gratis, quitar fondo, audio a texto, resumir PDF, hacer CV |
| `/herramientas/convertidor` | convertidor de archivos online gratis | sin registro, convertir audio a mp3, convertir imagen a jpg/png |
| `/herramientas/convertidor/<x>-a-<y>` | convertir jpg a png / png a jpg / **heic a jpg / heic a png / heic a pdf** / **imagen (foto) a pdf / jpg a pdf / png a pdf** / webp a jpg / webp a png / avif a jpg / avif a png / jpg a webp / png a webp / **mp4 a mp3 / video a mp3** / wav a mp3 / m4a a mp3 / ogg a mp3 / flac a mp3 / mp3 a wav / audio a mp3 | gratis, online, sin registro, sin perder calidad, iPhone |
| `/herramientas/convertidor-pro` | convertir video a mp3 / mp4 / gif | convertidor de video, archivos grandes, por lotes |
| `/herramientas/convertidor-pro/<x>` | **comprimir video (para WhatsApp)** · mov a mp4 · video a gif | archivos grandes, para enviar por WhatsApp o correo |
| `/herramientas/quitar-fondo` | quitar fondo de imagen | eliminar fondo, borrar fondo de fotos, fondo transparente png, con IA, jpg a png sin fondo |
| `/herramientas/transcripcion` | transcribir audio a texto | pasar audio a texto, notas de voz de WhatsApp, reuniones de Zoom/Meet/Teams, a Word |
| `/herramientas/resumir-pdf` | resumir pdf con IA | resumen de pdf, preguntar a un pdf, chat con pdf, para estudiar |
| `/herramientas/cv` | hacer cv online con IA | crear currículum vitae, generador de cv, carta de presentación laboral, cv en Word |
| `/herramientas/ahorro` | control de gastos / app para ahorrar dinero | registrar gastos, presupuesto mensual, app de gastos |
| `/herramientas/diario` | diario emocional | diario de emociones, registro de emociones diarias, ejercicio de respiración |
| `/herramientas/reservas` | app para agendar citas | agenda de citas, software para barbería, chatbot para agendar citas, salón de uñas |
| `/reservar/<negocio>` | reservar cita en <negocio> | (marca del negocio cliente) |

## Lo implementado

- Título (≤ 60 caracteres) y meta description (≤ 155) únicos por página, servidos en el HTML (sin depender de JavaScript).
- Un solo H1 por página con la palabra clave; H2 "Cómo funciona", "Preguntas frecuentes", "Otras conversiones".
- 25 páginas de conversión con su propio H1, texto, formato preseleccionado y enlaces internos.
- URL canónica, Open Graph y Twitter Card con imagen `public/og-image.png` (1200×630).
- Datos estructurados: Organization + WebSite (portada), SoftwareApplication con precio y FAQPage (herramientas).
- `robots.txt`, `sitemap.xml` (28 URLs), `noindex` en admin, perfil, login, registro y la demo; 404 real en direcciones inexistentes; 301 de `/convertir`.

## Al publicar

1. Define `SITE_URL=https://tudominio.com` en `.env` (URLs canónicas y sitemap absolutos).
2. Da de alta el dominio en **Google Search Console** y envía `https://tudominio.com/sitemap.xml`.
3. Revisa en Search Console, tras 4–8 semanas, qué consultas traen impresiones y ajusta títulos.

## Oportunidades (requieren decisión de producto)

- Hecho: MP4/video a MP3 gratis (≤ 25 MB), HEIC a JPG/PNG/PDF, imagen a PDF y comprimir video (Pro).
- Aún no soportado y muy buscado: **PDF a Word**, **unir varias imágenes en un solo PDF**, **comprimir PDF**.
- Contenido de blog con intención informativa que enlace a las herramientas: "cómo hacer un CV formato Harvard", "presupuesto 50/30/20", "cómo pasar un audio de WhatsApp a texto".
