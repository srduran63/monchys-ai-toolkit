// Puts per-page SEO tags into index.html so crawlers see them without running JavaScript.
// Used by the production server and by the Vite dev server (vite.config.js).
import { SITE_NAME } from '../shared/seo.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Make "/x" URLs inside structured data absolute and keep the JSON safe inside <script>.
const jsonLd = (data, origin) =>
  JSON.stringify(data)
    .replace(/"(url|logo|image|thumbnailUrl|contentUrl)":"\//g, `"$1":"${origin}/`)
    .replace(/</g, '\\u003c');

export function renderHtml(template, seo, origin) {
  const url = origin + seo.path;
  const image = `${origin}/og-image.png`;
  const tags = [
    `<meta name="description" content="${esc(seo.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    seo.noindex ? '<meta name="robots" content="noindex, nofollow" />' : '<meta name="robots" content="index, follow, max-image-preview:large" />',
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    '<meta property="og:locale" content="es_MX" />',
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${esc(seo.title)}" />`,
    `<meta property="og:description" content="${esc(seo.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(seo.title)}" />`,
    `<meta name="twitter:description" content="${esc(seo.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    ...[seo.schema ?? []].flat().map((s) => `<script type="application/ld+json">${jsonLd(s, origin)}</script>`),
  ];
  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(seo.title)}</title>`)
    .replace('</head>', `    ${tags.join('\n    ')}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${bodyHtml(seo.content)}</div>`);
}

// Readable page text inside #root (React replaces it when the app starts), so search engines and
// AI crawlers read it without running JavaScript. Uses the app's classes so the first paint looks right.
function bodyHtml(c) {
  if (!c) return '';
  const h2 = (text) => `<h2 class="font-display font-bold text-2xl mt-10">${esc(text)}</h2>`;
  const parts = [
    '<header class="border-b-2 border-ink/5"><div class="page py-5"><a href="/" class="font-display font-bold text-2xl">Monchys IA</a></div></header>',
    '<main class="page py-8 md:py-12">',
    `<h1 class="font-display font-bold text-fluid-h1 text-balance">${esc(c.h1)}</h1>`,
    c.intro && `<p class="text-ink/65 mt-1 max-w-3xl">${esc(c.intro)}</p>`,
    ...(c.guide ?? []).flatMap(([heading, text]) => [h2(heading), `<p class="text-ink/75 mt-2 max-w-3xl">${esc(text)}</p>`]),
    c.steps?.length && h2('Cómo funciona'),
    c.steps?.length && `<ol class="mt-3 list-decimal pl-6 space-y-1">${c.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`,
    c.faq?.length && h2('Preguntas frecuentes'),
    ...(c.faq ?? []).map(([q, a]) => `<h3 class="font-display font-semibold mt-4">${esc(q)}</h3><p class="text-ink/70">${esc(a)}</p>`),
    c.links?.length && h2(c.links[0][2] ? 'Herramientas' : 'También puedes'),
    c.links?.length &&
      `<ul class="mt-3 space-y-1">${c.links.map(([text, href, desc]) => `<li><a href="${esc(href)}" class="font-bold text-blob-deep">${esc(text)}</a>${desc ? ` · ${esc(desc)}` : ''}</li>`).join('')}</ul>`,
    '</main>',
  ];
  return parts.filter(Boolean).join('\n');
}

// Pages change with each deploy, so the server's start date is their last-modified date
const DEPLOYED = new Date().toISOString().slice(0, 10);

export function sitemapXml(origin, paths) {
  const urls = paths.map((p) => `  <url><loc>${esc(origin + p)}</loc><lastmod>${DEPLOYED}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function robotsTxt(origin) {
  return ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /api/', 'Disallow: /perfil', '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');
}
