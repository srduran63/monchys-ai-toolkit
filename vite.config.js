import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { seoFor } from './shared/seo.js';
import { renderHtml } from './server/seo-html.js';

const API = 'http://localhost:3001';

// Dev only: same per-page <head> tags as the production server (server/index.js).
function seoHead() {
  return {
    name: 'monchys-seo-head',
    apply: 'serve',
    async transformIndexHtml(html, ctx) {
      const path = (ctx.originalUrl ?? '/').split('?')[0].replace(/\/+$/, '') || '/';
      const get = (url) => fetch(API + url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const products = (await get('/api/products')) ?? [];
      const slug = path.match(/^\/reservar\/([a-z0-9-]+)$/)?.[1];
      const business = slug ? await get(`/api/booking/${slug}`) : null;
      return renderHtml(html, seoFor(path, { products, business }), 'http://localhost:5173');
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), seoHead()],
  server: {
    proxy: {
      '/api': API,
      '/robots.txt': API,
      '/sitemap.xml': API,
      '^/convertir$': API,
    },
  },
});
