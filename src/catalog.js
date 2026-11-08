// Store presentation: how the catalog is grouped and what each card highlights.
// Card highlights are short facts (3 max) so cards can be scanned in a second.
export const HIGHLIGHTS = {
  'RES-01': ['Reservas 24/7', 'Chat con IA', 'Agenda en tu panel'],
  'AHO-01': ['Registro por chat', 'Presupuestos', 'Alertas de gasto'],
  'TRA-01': ['600 min al mes', 'Word, TXT y SRT', 'Resumen con IA'],
  'PDF-01': ['Hasta 300 páginas', 'Chat con el PDF', 'Resumen en segundos'],
  'CV-01': ['3 diseños', 'PDF y Word', 'Carta incluida'],
  'IMG-01': ['Hasta 4K', 'Por lotes', 'PNG transparente'],
  'CNV-01': ['HEIC, WEBP, MP4…', 'A PDF y MP3', 'Sin registro'],
  'CNV-02': ['Hasta 2 GB', 'Comprimir video', '50 a la vez'],
  'BIE-01': ['Preguntas guía', 'Ánimo en 30 días', 'Respiración'],
  'CMP-01': ['Fotos y PDF', 'Hasta 50 MB', 'Sin registro'],
  'PDE-01': ['Unir y girar gratis', 'Firmar y escribir', 'En tu dispositivo'],
  'SUB-01': ['Automáticos', 'SRT y VTT', 'Video con subtítulos'],
  'RED-01': ['6 redes', 'Con hashtags', 'Varias versiones'],
  'DES-01': ['Desde una foto', 'Mercado Libre y Amazon', 'Palabras clave'],
  'TRD-01': ['12 idiomas', 'Word con formato', 'PDF a Word'],
  'UPS-01': ['Ampliar ×2', 'Color y nitidez', 'Antes y después'],
};

// Order of the "Para ti" grid
const PERSONAL_ORDER = ['PDE-01', 'IMG-01', 'TRA-01', 'SUB-01', 'PDF-01', 'TRD-01', 'UPS-01', 'CV-01', 'CNV-02', 'AHO-01', 'BIE-01'];

export const highlightsFor = (p) => HIGHLIGHTS[p.id] ?? Object.values(p.specs ?? {}).slice(0, 3);

// Quick task links shown in the hero ("¿Qué necesitas hoy?")
export const QUICK_TASKS = [
  ['Convertir un archivo gratis', '/herramientas/convertidor'],
  ['Quitar el fondo de una foto', '/herramientas/quitar-fondo'],
  ['Pasar un audio a texto', '/herramientas/transcripcion'],
  ['Resumir un PDF', '/herramientas/resumir-pdf'],
  ['Firmar o editar un PDF', '/herramientas/editar-pdf'],
  ['Comprimir un archivo', '/herramientas/comprimir'],
  ['Hacer mi CV', '/herramientas/cv'],
  ['Agendar citas en mi negocio', '/herramientas/reservas'],
];

export function groupCatalog(products) {
  const isPlan = (p) => p.includes?.length > 0;
  const free = products.filter((p) => p.price === 0 && !isPlan(p));
  const plans = products.filter(isPlan);
  const business = products.filter((p) => !isPlan(p) && p.price > 0 && p.category === 'NEGOCIOS');
  const rank = (p) => (PERSONAL_ORDER.indexOf(p.id) + 1 || 99);
  const personal = products
    .filter((p) => !isPlan(p) && p.price > 0 && p.category !== 'NEGOCIOS')
    .sort((a, b) => rank(a) - rank(b));
  return { free, plans, business, personal };
}
