// Editar PDF: everything happens in the browser (pdf.js renders, pdf-lib writes), files never leave the device.
// Overlays (text, signatures, images, cover and highlight boxes) are stored in PDF coordinates of their page,
// so they stay in place when the page is rotated or moved.
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Download, Eraser, FilePlus2, Highlighter, ImagePlus,
  Loader2, Lock, Minus, MousePointer2, PenLine, Plus, RotateCcw, RotateCw, Scissors, Trash2, Type, X,
} from 'lucide-react';
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { downloadBlob } from '../upload';
import { DropZone, ErrorBox } from './ui';
import { ActivateButton } from '../Activate';
import { money } from '../icons';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PAGES = 300;
const MAX_MB = 100;
const THUMB_WIDTH = 200;
const LINE = 1.2; // text line height (matches the editor's CSS)
const BASELINE = 0.95; // first baseline below the top of a text box, in font sizes
const COLORS = ['#16181c', '#1d4ed8', '#e5231b', '#15803d'];
const uid = () => crypto.randomUUID();
const hexToRgb = (hex) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);

async function renderPage(page, { width, rotation }) {
  const base = page.getViewport({ scale: 1, rotation });
  const viewport = page.getViewport({ scale: width / base.width, rotation });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width * devicePixelRatio);
  canvas.height = Math.round(viewport.height * devicePixelRatio);
  const ctx = canvas.getContext('2d');
  ctx.scale(devicePixelRatio, devicePixelRatio);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { canvas, viewport };
}

// What to do first on each task page (/herramientas/editar-pdf/<tarea>)
const TIPS = {
  unir: 'Abre todos los PDF a la vez (o añádelos uno a uno), ordena las páginas arrastrándolas y pulsa Descargar PDF.',
  firmar: 'Pulsa Editar en la página que quieres firmar, elige Firma, dibújala y haz clic donde quieras ponerla.',
  separar: 'Marca las páginas que necesitas y pulsa "Descargar seleccionadas", o "Separar en páginas" para un archivo por página.',
  rotar: 'Usa los botones de girar de cada página que esté de lado y descarga el PDF.',
  numerar: 'La numeración de páginas ya está activada: abre tu PDF y descárgalo.',
  marca: 'Escribe el texto en "Marca de agua" y descarga el PDF.',
  escribir: 'Pulsa Editar en la página, elige Texto y haz clic donde quieras escribir.',
};

// Without the subscription: merge, reorder, rotate, delete and split are free; editing is offered here
function UpgradeCard({ product, preset }) {
  const paidTask = ['firmar', 'escribir', 'numerar', 'marca'].includes(preset);
  return (
    <div className={`rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3 ${paidTask ? 'bg-coal text-white' : 'bg-white shadow-toy'}`}>
      <Lock className={`w-5 h-5 shrink-0 ${paidTask ? 'text-blob' : 'text-ink/40'}`} />
      <p className="flex-1 min-w-56 text-sm">
        <b>Unir, ordenar, girar y separar es gratis.</b> Para escribir, firmar, tapar, resaltar, numerar páginas y poner marca de agua, activa Editar PDF por {money(product.price)}/mes.
      </p>
      <ActivateButton product={product} withPrice={false} className="px-4 py-2 text-sm" onActivated={() => {}} />
    </div>
  );
}

export default function PdfEditorTool({ preset, product, locked = false }) {
  const [docs, setDocs] = useState({}); // id -> { name, bytes, proxy }
  const [pages, setPages] = useState([]); // { key, docId, index, baseRotate, rotation, thumb, ratio, overlays, selected }
  const [loading, setLoading] = useState(null);
  const [editing, setEditing] = useState(null); // page key
  const [pageNumbers, setPageNumbers] = useState(preset === 'numerar' && !locked);
  const [watermark, setWatermark] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dragFrom = useRef(null);

  const addFiles = async (files) => {
    setError('');
    const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (pdfs.length < files.length) setError('Solo se pueden añadir archivos PDF.');
    for (const file of pdfs) {
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`${file.name} supera ${MAX_MB} MB.`);
        continue;
      }
      setLoading({ name: file.name, done: 0, total: 0 });
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const proxy = await pdfjs.getDocument({ data: bytes.slice() }).promise;
        const room = MAX_PAGES - pages.length;
        if (proxy.numPages > room) setError(`Solo se pueden editar ${MAX_PAGES} páginas a la vez.`);
        const id = uid();
        setDocs((d) => ({ ...d, [id]: { name: file.name, bytes, proxy } }));
        const total = Math.min(proxy.numPages, room);
        for (let i = 0; i < total; i++) {
          const page = await proxy.getPage(i + 1);
          const { canvas, viewport } = await renderPage(page, { width: THUMB_WIDTH, rotation: page.rotate });
          const thumb = canvas.toDataURL('image/jpeg', 0.7);
          setPages((list) => [...list, { key: uid(), docId: id, index: i, baseRotate: page.rotate, rotation: 0, thumb, ratio: viewport.height / viewport.width, overlays: [], selected: false }]);
          setLoading({ name: file.name, done: i + 1, total });
        }
      } catch (err) {
        setError(err?.name === 'PasswordException' ? `${file.name} está protegido con contraseña.` : `No pudimos abrir ${file.name}.`);
      }
    }
    setLoading(null);
  };

  const update = (key, patch) => setPages((list) => list.map((p) => (p.key === key ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p)));
  const move = (from, to) =>
    setPages((list) => {
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

  // Build the final PDF from the pages in their current order
  const build = async (subset) => {
    const out = await PDFDocument.create();
    const font = await out.embedFont(StandardFonts.Helvetica);
    const loaded = {};
    const safe = (text) => [...text].map((c) => { try { font.encodeText(c); return c; } catch { return c === '\n' ? c : '?'; } }).join('');
    const list = subset ?? pages;
    for (const [n, p] of list.entries()) {
      loaded[p.docId] ??= await PDFDocument.load(docs[p.docId].bytes, { ignoreEncryption: true });
      const [page] = await out.copyPages(loaded[p.docId], [p.index]);
      out.addPage(page);
      const total = (p.baseRotate + p.rotation) % 360;
      page.setRotation(degrees(total));
      const proxyPage = await docs[p.docId].proxy.getPage(p.index + 1);

      for (const o of p.overlays) {
        const r = (o.rot * Math.PI) / 180;
        const down = [Math.sin(r), -Math.cos(r)]; // the screen's "down" direction in PDF space
        const at = (dist) => [o.x + down[0] * dist, o.y + down[1] * dist];
        if (o.type === 'text') {
          safe(o.text)
            .split('\n')
            .forEach((line, i) => {
              const [x, y] = at(o.size * (BASELINE + i * LINE));
              page.drawText(line, { x, y, size: o.size, font, color: hexToRgb(o.color), rotate: degrees(o.rot) });
            });
        } else if (o.type === 'image') {
          const image = o.src.startsWith('data:image/png') ? await out.embedPng(o.src) : await out.embedJpg(o.src);
          const [x, y] = at(o.h);
          page.drawImage(image, { x, y, width: o.w, height: o.h, rotate: degrees(o.rot) });
        } else {
          const [x, y] = at(o.h);
          page.drawRectangle({ x, y, width: o.w, height: o.h, rotate: degrees(o.rot), color: o.type === 'cover' ? rgb(1, 1, 1) : rgb(1, 0.92, 0.23), opacity: o.type === 'cover' ? 1 : 0.4 });
        }
      }

      // Page number and watermark, placed relative to how the page is displayed
      const view = proxyPage.getViewport({ scale: 1, rotation: total });
      const pdfAt = (vx, vy) => view.convertToPdfPoint(vx, vy);
      if (pageNumbers && !locked) {
        const label = `${n + 1} / ${list.length}`;
        const size = 10;
        const [x, y] = pdfAt(view.width / 2 - font.widthOfTextAtSize(label, size) / 2, view.height - 22);
        page.drawText(label, { x, y, size, font, color: rgb(0.35, 0.35, 0.35), rotate: degrees(total) });
      }
      if (watermark.trim() && !locked) {
        const text = safe(watermark.trim()).replace(/\n/g, ' ');
        const size = Math.min(72, (Math.min(view.width, view.height) * 1.1) / Math.max(4, text.length) * 1.6);
        const width = font.widthOfTextAtSize(text, size);
        const angle = 35;
        const a = (angle * Math.PI) / 180;
        // Start point so the rotated text is centered on the page (screen coordinates, y down)
        const vx = view.width / 2 - (Math.cos(a) * width) / 2 + (Math.sin(a) * size) / 3;
        const vy = view.height / 2 + (Math.sin(a) * width) / 2 + (Math.cos(a) * size) / 3;
        const [x, y] = pdfAt(vx, vy);
        page.drawText(text, { x, y, size, font, color: rgb(0.5, 0.5, 0.5), opacity: 0.25, rotate: degrees(total + angle) });
      }
    }
    return out.save();
  };

  const baseName = () => (Object.values(docs)[0]?.name ?? 'documento.pdf').replace(/\.pdf$/i, '');

  const save = async (kind) => {
    setSaving(kind);
    setError('');
    try {
      if (kind === 'split') {
        const { zipSync } = await import('fflate');
        const files = {};
        for (const [i, p] of pages.entries()) files[`${baseName()}-pagina-${i + 1}.pdf`] = await build([p]);
        downloadBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), `${baseName()}-paginas.zip`);
      } else {
        const subset = kind === 'selected' ? pages.filter((p) => p.selected) : null;
        const bytes = await build(subset);
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${baseName()}${kind === 'selected' ? '-extracto' : '-editado'}.pdf`);
      }
    } catch (err) {
      console.error(err);
      setError('No pudimos crear el PDF. Si el original está protegido, quítale la contraseña e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const selected = pages.filter((p) => p.selected).length;
  const editIndex = pages.findIndex((p) => p.key === editing);

  if (!pages.length && !loading) {
    return (
      <div className="space-y-4">
        {locked && <UpgradeCard product={product} preset={preset} />}
        {TIPS[preset] && <p className="bg-blob-soft rounded-2xl px-4 py-3 text-sm font-bold text-blob-deep">{TIPS[preset]}</p>}
        <DropZone accept="application/pdf,.pdf" multiple onFiles={addFiles} title="Abre uno o varios PDF" hint={`Hasta ${MAX_MB} MB y ${MAX_PAGES} páginas. Si subes varios, se unen en uno. Tus archivos no salen de tu dispositivo.`} />
        <ErrorBox error={error} onClose={() => setError('')} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn btn-ghost px-4 py-2 text-sm cursor-pointer">
          <FilePlus2 className="w-4 h-4" /> Añadir otro PDF
          <input type="file" accept="application/pdf,.pdf" multiple className="sr-only" onChange={(e) => { addFiles([...e.target.files]); e.target.value = ''; }} />
        </label>
        <button onClick={() => save('split')} disabled={!!saving || pages.length < 2} className="btn btn-ghost px-4 py-2 text-sm">
          <Scissors className="w-4 h-4" /> Separar en páginas
        </button>
        <button onClick={() => save('selected')} disabled={!!saving || !selected} className="btn btn-ghost px-4 py-2 text-sm">
          <Download className="w-4 h-4" /> Descargar seleccionadas{selected ? ` (${selected})` : ''}
        </button>
        <button
          onClick={() => {
            setPages([]);
            setDocs({});
          }}
          className="btn btn-ghost px-4 py-2 text-sm"
        >
          Empezar de nuevo
        </button>
        <button onClick={() => save('all')} disabled={!!saving || !!loading} className="btn btn-red px-5 py-2.5 ml-auto">
          {saving === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Descargar PDF
        </button>
      </div>

      {locked && <UpgradeCard product={product} preset={preset} />}
      <div className={`flex flex-wrap items-center gap-4 bg-white rounded-2xl shadow-toy px-4 py-3 text-sm ${locked ? 'opacity-60' : ''}`}>
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" checked={pageNumbers} disabled={locked} onChange={(e) => setPageNumbers(e.target.checked)} className="w-4 h-4 accent-[var(--color-mouth)]" />
          Numerar páginas {locked && <Lock className="w-3.5 h-3.5" />}
        </label>
        <label className="flex items-center gap-2 font-bold flex-1 min-w-56">
          Marca de agua {locked && <Lock className="w-3.5 h-3.5" />}
          <input disabled={locked} value={watermark} onChange={(e) => setWatermark(e.target.value)} maxLength={40} placeholder="Ej.: CONFIDENCIAL" className="flex-1 rounded-xl border-2 border-ink/10 px-3 py-1.5 font-semibold focus:outline-none focus:border-blob" />
        </label>
      </div>

      {loading && (
        <p className="font-bold text-ink/60 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Abriendo {loading.name}… {loading.total ? `${loading.done} de ${loading.total} páginas` : ''}
        </p>
      )}
      <ErrorBox error={error} onClose={() => setError('')} />
      {TIPS[preset] && <p className="bg-blob-soft rounded-2xl px-4 py-3 text-sm font-bold text-blob-deep">{TIPS[preset]}</p>}
      <p className="text-sm text-ink/55">
        Arrastra las páginas para cambiar el orden. Pulsa <b>Editar</b> para escribir, firmar, tapar o resaltar. Para cambiar un texto del PDF, tápalo con <b>Tapar</b> y escribe encima.
      </p>

      <ol className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {pages.map((p, i) => (
          <li
            key={p.key}
            draggable
            onDragStart={() => (dragFrom.current = i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragFrom.current !== null) move(dragFrom.current, i);
              dragFrom.current = null;
            }}
            className={`bg-white rounded-2xl shadow-toy p-2 ${p.selected ? 'ring-4 ring-blob' : ''}`}
          >
            <div className="relative aspect-[3/4] bg-cream rounded-xl overflow-hidden flex items-center justify-center">
              <img
                src={p.thumb}
                alt={`Página ${i + 1}`}
                className="max-w-full max-h-full object-contain transition-transform"
                style={{ transform: `rotate(${p.rotation}deg)${p.rotation % 180 ? ` scale(${Math.min(1 / p.ratio, p.ratio, 1) || 1})` : ''}` }}
                draggable={false}
              />
              {p.overlays.length > 0 && <span className="absolute bottom-1 right-1 text-[10px] font-bold bg-mouth text-white rounded-full px-1.5">editada</span>}
              <label className="absolute top-1 left-1 bg-white/90 rounded-lg p-1 cursor-pointer" title="Seleccionar">
                <input type="checkbox" checked={p.selected} onChange={(e) => update(p.key, { selected: e.target.checked })} className="w-4 h-4 accent-[var(--color-mouth)] block" aria-label={`Seleccionar página ${i + 1}`} />
              </label>
              <span className="absolute top-1 right-1 text-xs font-bold bg-ink/70 text-white rounded-full px-2">{i + 1}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <button onClick={() => move(i, i - 1)} disabled={i === 0} className="p-1.5 rounded-lg hover:bg-cream disabled:opacity-30" aria-label="Mover antes">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button onClick={() => update(p.key, (x) => ({ rotation: (x.rotation + 270) % 360 }))} className="p-1.5 rounded-lg hover:bg-cream" aria-label="Girar a la izquierda">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={() => update(p.key, (x) => ({ rotation: (x.rotation + 90) % 360 }))} className="p-1.5 rounded-lg hover:bg-cream" aria-label="Girar a la derecha">
                <RotateCw className="w-4 h-4" />
              </button>
              <button onClick={() => setPages((l) => l.filter((x) => x.key !== p.key))} className="p-1.5 rounded-lg hover:bg-mouth/10 hover:text-mouth" aria-label="Eliminar página">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => move(i, i + 1)} disabled={i === pages.length - 1} className="p-1.5 rounded-lg hover:bg-cream disabled:opacity-30" aria-label="Mover después">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {locked ? (
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="btn btn-ghost w-full py-1.5 text-sm mt-1"
                title="Escribir, firmar y tapar son parte de Editar PDF"
              >
                <Lock className="w-4 h-4" /> Editar
              </button>
            ) : (
              <button onClick={() => setEditing(p.key)} className="btn btn-blue w-full py-1.5 text-sm mt-1">
                <PenLine className="w-4 h-4" /> Editar
              </button>
            )}
          </li>
        ))}
      </ol>

      {editIndex >= 0 && !locked && (
        <PageEditor
          key={editing}
          page={pages[editIndex]}
          proxy={docs[pages[editIndex].docId].proxy}
          number={editIndex + 1}
          count={pages.length}
          onChange={(overlays) => update(editing, { overlays })}
          onNavigate={(step) => setEditing(pages[editIndex + step]?.key ?? editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ---------- Single page editor ----------
const TOOLS = [
  ['select', MousePointer2, 'Mover'],
  ['text', Type, 'Texto'],
  ['signature', PenLine, 'Firma'],
  ['image', ImagePlus, 'Imagen'],
  ['cover', Eraser, 'Tapar'],
  ['highlight', Highlighter, 'Resaltar'],
];

function PageEditor({ page, proxy, number, count, onChange, onNavigate, onClose }) {
  const holder = useRef(null);
  const canvasBox = useRef(null);
  const [view, setView] = useState(null); // pdf.js viewport at the editor's scale
  const [toolId, setToolId] = useState('select');
  const [active, setActive] = useState(null); // overlay id
  const [signing, setSigning] = useState(false);
  const [pendingImage, setPendingImage] = useState(null); // data URL waiting to be placed
  const [focusId, setFocusId] = useState(null); // new text box that gets the cursor
  const overlays = page.overlays;
  const total = (page.baseRotate + page.rotation) % 360;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfPage = await proxy.getPage(page.index + 1);
      const width = Math.min(holder.current.clientWidth - 8, 900);
      const { canvas, viewport } = await renderPage(pdfPage, { width, rotation: total });
      if (cancelled) return;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvasBox.current.replaceChildren(canvas);
      setView(viewport);
    })();
    return () => {
      cancelled = true;
    };
  }, [proxy, page.index, total]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if ((e.key === 'Delete' || e.key === 'Backspace') && active && document.activeElement?.tagName !== 'TEXTAREA') {
        onChange(overlays.filter((o) => o.id !== active));
        setActive(null);
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [active, overlays, onChange, onClose]);

  // A new text box gets the cursor with its placeholder selected, so typing replaces it
  useEffect(() => {
    if (!focusId) return;
    const el = document.getElementById(`overlay-${focusId}`);
    el?.focus({ preventScroll: true });
    el?.select();
    setFocusId(null);
  }, [focusId, overlays]);

  const scale = view?.scale ?? 1;
  const toPdf = (vx, vy) => view.convertToPdfPoint(vx, vy);
  const toView = (x, y) => view.convertToViewportPoint(x, y);
  const set = (id, patch) => onChange(overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const add = (o) => {
    const item = { id: uid(), rot: total, ...o };
    onChange([...overlays, item]);
    setActive(item.id);
    if (o.type === 'text') setFocusId(item.id);
    setToolId('select');
  };

  const placeImage = (src, vx, vy) => {
    const img = new Image();
    img.onload = () => {
      const maxW = (view.width * 0.35) / scale;
      const w = Math.min(maxW, img.width / 2);
      const h = (w * img.height) / img.width;
      const [x, y] = toPdf(vx - (w * scale) / 2, vy - (h * scale) / 2);
      add({ type: 'image', src, x, y, w, h });
    };
    img.src = src;
  };

  const onPageClick = (e) => {
    if (!view || e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;
    if (toolId === 'select') return setActive(null);
    if (toolId === 'text') {
      const [x, y] = toPdf(vx, vy - 8 * scale);
      add({ type: 'text', x, y, text: 'Escribe aquí', size: 14, color: COLORS[0] });
    } else if (toolId === 'cover' || toolId === 'highlight') {
      const w = toolId === 'cover' ? 140 : 160;
      const h = toolId === 'cover' ? 24 : 16;
      const [x, y] = toPdf(vx - (w * scale) / 2, vy - (h * scale) / 2);
      add({ type: toolId, x, y, w, h });
    } else if ((toolId === 'signature' || toolId === 'image') && pendingImage) {
      placeImage(pendingImage, vx, vy);
      setPendingImage(null);
    }
  };

  const pickImage = (file) => {
    if (!file?.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let src = reader.result;
      // pdf-lib embeds PNG and JPG only: convert anything else (WEBP, GIF…) to PNG
      if (!/^data:image\/(png|jpeg)/.test(src)) {
        const bmp = await createImageBitmap(file);
        const c = Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
        c.getContext('2d').drawImage(bmp, 0, 0);
        src = c.toDataURL('image/png');
      }
      setPendingImage(src);
      setToolId('image');
    };
    reader.readAsDataURL(file);
  };

  // Drag (move) and resize with pointer events, in screen pixels converted back to PDF points
  const startDrag = (e, o, mode) => {
    e.stopPropagation();
    e.preventDefault();
    setActive(o.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const [ox, oy] = toView(o.x, o.y);
    const start = { w: o.w, h: o.h, size: o.size };
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (mode === 'move') {
        const [x, y] = toPdf(ox + dx, oy + dy);
        set(o.id, { x, y });
      } else if (o.type === 'image') {
        const w = Math.max(10, start.w + dx / scale);
        set(o.id, { w, h: (w * start.h) / start.w });
      } else {
        set(o.id, { w: Math.max(8, start.w + dx / scale), h: Math.max(6, start.h + dy / scale) });
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const current = overlays.find((o) => o.id === active);

  return (
    <div className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm flex flex-col" role="dialog" aria-modal="true" aria-label={`Editar página ${number}`}>
      <div className="shrink-0 bg-white shadow-toy px-3 py-2 flex flex-wrap items-center gap-1.5">
        {TOOLS.map(([id, Icon, text]) =>
          id === 'image' ? (
            <label key={id} className={`btn px-3 py-2 text-sm cursor-pointer ${toolId === id ? 'btn-dark' : 'btn-ghost'}`}>
              <Icon className="w-4 h-4" /> <span className="hidden sm:inline">{text}</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { pickImage(e.target.files[0]); e.target.value = ''; }} />
            </label>
          ) : (
            <button
              key={id}
              onClick={() => (id === 'signature' ? setSigning(true) : setToolId(id))}
              className={`btn px-3 py-2 text-sm ${toolId === id ? 'btn-dark' : 'btn-ghost'}`}
              aria-pressed={toolId === id}
            >
              <Icon className="w-4 h-4" /> <span className="hidden sm:inline">{text}</span>
            </button>
          )
        )}
        {current?.type === 'text' && (
          <div className="flex items-center gap-1 ml-1 pl-2 border-l-2 border-cream">
            <button onClick={() => set(current.id, { size: Math.max(6, current.size - 2) })} className="p-2 rounded-lg hover:bg-cream" aria-label="Letra más pequeña">
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold w-8 text-center">{current.size}</span>
            <button onClick={() => set(current.id, { size: Math.min(96, current.size + 2) })} className="p-2 rounded-lg hover:bg-cream" aria-label="Letra más grande">
              <Plus className="w-4 h-4" />
            </button>
            {COLORS.map((c) => (
              <button key={c} onClick={() => set(current.id, { color: c })} className={`w-6 h-6 rounded-full ${current.color === c ? 'ring-2 ring-offset-2 ring-ink' : ''}`} style={{ background: c }} aria-label={`Color ${c}`} />
            ))}
          </div>
        )}
        {current && (
          <button onClick={() => { onChange(overlays.filter((o) => o.id !== current.id)); setActive(null); }} className="btn btn-ghost px-3 py-2 text-sm text-mouth">
            <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Quitar</span>
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => onNavigate(-1)} disabled={number === 1} className="p-2 rounded-lg hover:bg-cream disabled:opacity-30" aria-label="Página anterior">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold">
            {number} / {count}
          </span>
          <button onClick={() => onNavigate(1)} disabled={number === count} className="p-2 rounded-lg hover:bg-cream disabled:opacity-30" aria-label="Página siguiente">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="btn btn-red px-4 py-2 text-sm ml-1">
            <Check className="w-4 h-4" /> Listo
          </button>
        </div>
      </div>
      {toolId !== 'select' && (
        <p className="shrink-0 bg-blob text-ink text-sm font-bold text-center py-1.5">
          {toolId === 'text' && 'Haz clic donde quieras escribir.'}
          {toolId === 'cover' && 'Haz clic sobre lo que quieras tapar; luego ajusta el tamaño desde la esquina.'}
          {toolId === 'highlight' && 'Haz clic sobre el texto que quieras resaltar.'}
          {(toolId === 'image' || toolId === 'signature') && (pendingImage ? 'Haz clic donde quieras ponerla.' : 'Elige una imagen.')}
        </p>
      )}

      <div ref={holder} className="flex-1 min-h-0 overflow-auto p-4 flex justify-center items-start">
        <div className="relative shrink-0 shadow-toy-lg bg-white" style={view ? { width: view.width, height: view.height } : undefined}>
          <div ref={canvasBox} />
          {!view && <Loader2 className="w-8 h-8 animate-spin text-ink/40 m-20" />}
          {view && (
            <div className={`absolute inset-0 ${toolId === 'select' ? '' : 'cursor-crosshair'}`} onClick={onPageClick}>
              {overlays.map((o) => {
                const [left, top] = toView(o.x, o.y);
                const turn = o.rot - total;
                const isActive = o.id === active;
                const box = { left, top, transform: turn ? `rotate(${-turn}deg)` : undefined, transformOrigin: 'top left' };
                if (o.type === 'text') {
                  return (
                    <div key={o.id} className={`absolute group ${isActive ? 'ring-2 ring-blob' : 'hover:ring-2 hover:ring-blob/50'}`} style={box} onClick={(e) => { e.stopPropagation(); setActive(o.id); }}>
                      <button onPointerDown={(e) => startDrag(e, o, 'move')} className="absolute -top-6 left-0 bg-blob text-ink rounded-t-lg px-1.5 text-xs font-bold cursor-move touch-none" aria-label="Mover texto">
                        ✥
                      </button>
                      <textarea
                        id={`overlay-${o.id}`}
                        value={o.text}
                        onChange={(e) => set(o.id, { text: e.target.value })}
                        onFocus={() => setActive(o.id)}
                        rows={o.text.split('\n').length}
                        cols={Math.max(4, ...o.text.split('\n').map((l) => l.length))}
                        className="block bg-transparent resize-none overflow-hidden outline-none p-0 m-0 border-0 whitespace-pre"
                        style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: o.size * scale, lineHeight: LINE, color: o.color }}
                        aria-label="Texto"
                      />
                    </div>
                  );
                }
                const fill = o.type === 'cover' ? { background: '#ffffff', outline: '1px dashed rgba(22,24,28,.25)' } : o.type === 'highlight' ? { background: 'rgba(255,235,59,.4)' } : {};
                return (
                  <div
                    key={o.id}
                    onPointerDown={(e) => startDrag(e, o, 'move')}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute cursor-move touch-none ${isActive ? 'ring-2 ring-blob' : ''}`}
                    style={{ ...box, width: o.w * scale, height: o.h * scale, ...fill }}
                  >
                    {o.type === 'image' && <img src={o.src} alt="" className="w-full h-full pointer-events-none" draggable={false} />}
                    {isActive && <span onPointerDown={(e) => startDrag(e, o, 'resize')} className="absolute -right-2 -bottom-2 w-4 h-4 rounded-full bg-blob border-2 border-white cursor-nwse-resize touch-none" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {signing && (
        <SignaturePad
          onCancel={() => setSigning(false)}
          onDone={(src) => {
            setSigning(false);
            setPendingImage(src);
            setToolId('signature');
          }}
        />
      )}
    </div>
  );
}

function SignaturePad({ onDone, onCancel }) {
  const canvas = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  const [color, setColor] = useState(COLORS[1]);

  useEffect(() => {
    const c = canvas.current;
    c.width = c.clientWidth * devicePixelRatio;
    c.height = c.clientHeight * devicePixelRatio;
    const ctx = c.getContext('2d');
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
  }, []);

  const point = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const down = (e) => {
    drawing.current = true;
    canvas.current.setPointerCapture(e.pointerId);
    const ctx = canvas.current.getContext('2d');
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(...point(e));
  };
  const moveTo = (e) => {
    if (!drawing.current) return;
    const ctx = canvas.current.getContext('2d');
    ctx.lineTo(...point(e));
    ctx.stroke();
    setEmpty(false);
  };
  const clear = () => {
    const c = canvas.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };

  // Crop the transparent margins around the strokes
  const finish = () => {
    const c = canvas.current;
    const { data, width, height } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    let [x0, y0, x1, y1] = [width, height, 0, 0];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (data[(y * width + x) * 4 + 3]) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    const pad = 6;
    const out = Object.assign(document.createElement('canvas'), { width: x1 - x0 + pad * 2, height: y1 - y0 + pad * 2 });
    out.getContext('2d').drawImage(c, x0 - pad, y0 - pad, out.width, out.height, 0, 0, out.width, out.height);
    onDone(out.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 z-[60] bg-ink/60 flex items-center justify-center p-4" onClick={onCancel}>
      <section className="bg-white rounded-[2rem] shadow-toy p-5 md:p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-lg">Dibuja tu firma</h3>
          <button onClick={onCancel} className="p-2 rounded-full hover:bg-cream" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>
          <canvas
            ref={canvas}
            onPointerDown={down}
            onPointerMove={moveTo}
            onPointerUp={() => (drawing.current = false)}
            className="w-full h-48 bg-cream rounded-2xl touch-none cursor-crosshair"
          />
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {COLORS.slice(0, 2).map((c) => (
              <button key={c} onClick={() => setColor(c)} className={`w-7 h-7 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-ink' : ''}`} style={{ background: c }} aria-label={`Tinta ${c}`} />
            ))}
            <button onClick={clear} className="btn btn-ghost px-3 py-2 text-sm ml-auto">
              Borrar
            </button>
            <button onClick={finish} disabled={empty} className="btn btn-red px-4 py-2 text-sm">
              <Check className="w-4 h-4" /> Usar firma
            </button>
          </div>
          <p className="text-xs text-ink/50 mt-2">Firma con el ratón o con el dedo. Después haz clic en la página donde quieras ponerla.</p>
        </div>
      </section>
    </div>
  );
}
