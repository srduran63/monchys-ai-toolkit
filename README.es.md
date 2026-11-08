# Monchys IA — herramientas por suscripción

Tienda de servicios (React + Vite + Tailwind) con cuentas de clientes, suscripciones mensuales, una pantalla por herramienta y un único acceso de administrador. Servidor Express con datos en archivos JSON.

## Arranque

```bash
npm install
npm approve-scripts ffmpeg-static onnxruntime-node   # si npm avisa de scripts bloqueados
npm run set-password            # crea/cambia el usuario y la contraseña de admin (.env)
npm run dev                     # http://localhost:5173
```

Producción: `npm run build` y `npm start` (todo en http://localhost:3001 o `PORT`). Si se sirve por HTTPS, añade `COOKIE_SECURE=true` al `.env`.

| Página | Dirección |
|---|---|
| Inicio y catálogo | `/` |
| Crear cuenta / entrar | `/registro`, `/entrar` (aceptan `?next=/ruta`) |
| Perfil, plan actual y planes | `/perfil` |
| Herramientas | `/herramientas/<nombre>` |
| Página de reservas de un negocio | `/reservar/<identificador>` (demo: `/reservar/demo`) |
| Panel de admin | `/admin` |

## Variables de `.env`

| Variable | Para qué |
|---|---|
| `ADMIN_USER`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` | Acceso de admin y firma de sesiones (`npm run set-password`) |
| `ANTHROPIC_API_KEY` | Activa las funciones con IA (Claude Opus 5.5). Sin ella todo funciona salvo lo marcado como "IA" abajo. |
| `AI_BUDGET_CUSTOMER_USD` | Opcional. Gasto máximo de IA por cliente y mes (por defecto 2). Al llegar al tope, sus funciones de IA pasan a la versión sin IA o avisan. |
| `AI_BUDGET_BUSINESS_USD` | Opcional. Gasto máximo del chat de reservas por negocio y mes (por defecto 10). Al llegar al tope, ese negocio sigue con el formulario. |
| `AI_BUDGET_GUIDE_USD` | Opcional. Gasto máximo al mes del chat de Monchys que recomienda herramientas, sumando todos los visitantes (por defecto 3). Al llegar al tope, el chat sigue respondiendo por palabras clave. |
| `STRIPE_SECRET_KEY` | Opcional. Clave secreta de Stripe (`sk_test_…` para pruebas, `sk_live_…` para cobrar de verdad). Sin ella la tienda funciona en modo demo: la activación es inmediata y sin cobro. |
| `STRIPE_WEBHOOK_SECRET` | Necesaria en producción con Stripe (`whsec_…`). Webhook en `https://tudominio.com/api/stripe/webhook` con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated` y `customer.subscription.deleted`. Sin ella, la compra se activa al volver del pago, pero no llegan las renovaciones ni los impagos. |
| `STRIPE_CURRENCY` | Opcional. Moneda de los cobros (por defecto `usd`). |
| `PDF_AI_MAX_PAGES` | Opcional. Páginas máximas para usar IA en un PDF (por defecto 50; más largos reciben el resumen automático). |
| `WHISPER_MODEL` | Opcional. Modelo de transcripción (por defecto `onnx-community/whisper-base`; `onnx-community/whisper-small` es más preciso y más lento) |
| `SITE_URL` | Dominio público, p. ej. `https://monchys.store`. Se usa en URLs canónicas, sitemap y vista previa en redes. Ver `SEO.md`. |
| `PORT`, `COOKIE_SECURE` | Opcionales |

## Herramientas

| Herramienta | Ruta | Cómo funciona | Necesita IA |
|---|---|---|---|
| Convertidor (gratis) | `/herramientas/convertidor` | `sharp` + `ffmpeg`; imágenes (incl. HEIC con `heic-convert`), imagen a PDF (`pdf-lib`), audio y video a MP3; 25 MB | No |
| Convertidor Pro | `/herramientas/convertidor-pro` | + video (MP4, WEBM, GIF, comprimir para WhatsApp), 2 GB, lotes de 50 con ZIP | No |
| Asistente de reservas | `/herramientas/reservas` + `/reservar/<negocio>` | Formulario y agenda; chat de reservas con herramientas | Solo el chat |
| Monchys Ahorro | `/herramientas/ahorro` | Entiende frases como "gasté 20 en comida", presupuestos, meta, alertas | No |
| Transcripción | `/herramientas/transcripcion` | Whisper en el propio servidor, cola en segundo plano, 600 min/mes, TXT/SRT/Word | Solo el resumen |
| Resumidor de PDFs | `/herramientas/resumir-pdf` | Con IA: resumen y preguntas al documento (también escaneados). Sin IA: resumen automático de frases clave | Preguntas y escaneados |
| Generador de CV | `/herramientas/cv` | Editor con vista previa A4, 3 diseños × 5 colores, PDF (imprimir) y Word, guardado automático | Mejoras de redacción; la carta usa plantilla sin IA |
| Quitar fondo | `/herramientas/quitar-fondo` | BiRefNet Lite en el propio servidor, 500 imágenes/mes, fondo transparente/blanco/color, ZIP | No |
| Diario emocional | `/herramientas/diario` | Ánimo, emociones, preguntas guía, gráfico de 30 días, respiración; muestra líneas de ayuda si detecta una crisis | No |

**Modelos locales** (`server/models.js`): Whisper (MIT) y BiRefNet Lite (MIT) se descargan de Hugging Face **la primera vez que se usan** (~290 MB en `.models/`), así que el servidor necesita internet en ese momento y la primera petición tarda más. Se procesa un trabajo pesado a la vez.

Licencias: `heic-convert` (ISC) usa `libheif-js` (LGPL-3.0) como librería sin modificar; el resto de dependencias son MIT/ISC/Apache.

## Cómo funciona la tienda

- **Sin carrito.** Cada servicio tiene un botón *Activar*; sin sesión lleva a crear cuenta y vuelve a la herramienta.
- **Suscripciones** (`server/accounts.js`): mensuales o de pago único; cancelar mantiene el acceso hasta fin de periodo. Los planes (campo *Servicios incluidos*, p. ej. Monchys Plus) dan acceso a lo que incluyen. Cada API de herramienta comprueba el acceso (`requireAccess`).
- **Modo demo:** no hay pasarela de pago. La activación es inmediata, sin cobro, y las renovaciones se simulan.
- Las listas de herramientas terminadas están en `src/ToolPage.jsx` (`TOOLS`) y `src/tools.js` (`READY_TOOLS`): mantenlas iguales.

## Admin

- Un único usuario definido en `.env`. Sesión `httpOnly`, 8 h. 5 intentos fallidos → bloqueo de 15 min.
- Pestañas: **Productos** (catálogo y planes), **Negocios y reservas**, **Clientes**.

## Videos explicativos

Cada herramienta tiene un video de 16 s con Monchys (`public/videos/<herramienta>.mp4` + póster `.jpg`), incrustado en "Cómo funciona" y declarado a Google como `VideoObject`. Se generan por código: la escena es `video/explainer.html` (textos y pasos en `SCENES`) y `npm run videos` la graba fotograma a fotograma con Edge/Chrome y la codifica con ffmpeg (~35 s por video). Para regenerar solo algunos: `npm run videos -- cv ahorro`. Si no encuentra el navegador, indica la ruta con `BROWSER_PATH`.

## Gasto en IA

Cada llamada a Claude anota tokens y coste estimado (precios de Claude Opus 5.5) en `server/data/ai-usage.json` (por función y mes) y `server/data/ai-budgets.json` (por cliente y negocio). El panel de admin muestra el total del mes y el gasto de cada cliente y negocio. Costes medidos: reserva por chat ~$0.06, PDF de 20 páginas ~$0.26 (+~$0.02 por pregunta), carta ~$0.02, mejora de CV ~$0.002.

## Datos

`server/data/` (se crea solo): `products.json`, `businesses.json`, `users.json`, `ahorro.json`, `diario.json`, `cvs.json`, `pdfs.json` (+ `uploads/pdf/`), `transcripciones.json`, `usage.json`.

## Pendiente

- Conectar una pasarela de pago (Stripe o Mercado Pago) en la activación y la renovación.
- Recuperación de contraseña por correo.
- Asistente de reservas por WhatsApp y recordatorios automáticos.
