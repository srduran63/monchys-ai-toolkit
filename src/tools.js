// Tool pages that are already built (keep in sync with TOOLS in ToolPage.jsx).
const READY_TOOLS = new Set([
  '/herramientas/convertidor',
  '/herramientas/reservas',
  '/herramientas/ahorro',
  '/herramientas/diario',
  '/herramientas/transcripcion',
  '/herramientas/quitar-fondo',
  '/herramientas/resumir-pdf',
  '/herramientas/cv',
  '/herramientas/convertidor-pro',
  '/herramientas/comprimir',
  '/herramientas/editar-pdf',
  '/herramientas/subtitulos',
  '/herramientas/redes',
  '/herramientas/descripciones',
  '/herramientas/traductor',
  '/herramientas/mejorar-fotos',
  '/herramientas/generar-imagenes',
  // '/herramientas/generar-videos': ready (VideoGenTool), shown as "próximamente" until it's launched
]);

// Plans (no tool page of their own) and built tools are ready; the rest are "próximamente".
// Paid tools whose basic features anyone can use (the tool gets locked={true} and hides the rest)
// (the value is the badge shown on the tool page)
export const FREE_PREVIEW = new Map([
  ['/herramientas/editar-pdf', 'Unir y ordenar gratis'],
  ['/herramientas/generar-imagenes', '3 imágenes gratis al día'],
]);

export const isComingSoon = (product) => Boolean(product.toolUrl) && !READY_TOOLS.has(product.toolUrl);
