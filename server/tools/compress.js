// Comprimir imágenes y PDF (free, no account): re-encodes images with sharp and, inside PDFs,
// the embedded photos (JPEG and plain RGB/gray bitmaps). Never returns a heavier file.
import zlib from 'node:zlib';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFArray } from 'pdf-lib';

export const COMPRESS_MAX_MB = 50;
export const LEVELS = {
  fuerte: { quality: 55, maxSide: 1600, pdfSide: 1200 },
  equilibrada: { quality: 72, maxSide: 2560, pdfSide: 1800 },
  ligera: { quality: 85, maxSide: 4096, pdfSide: 2600 },
};
export const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif', 'tif', 'tiff'];

export async function compressImage(buffer, ext, level) {
  let source = buffer;
  if (ext === 'heic' || ext === 'heif') source = Buffer.from(await heicConvert({ buffer, format: 'JPEG', quality: 1 }));
  const img = sharp(source, { limitInputPixels: 100_000_000 })
    .rotate()
    .resize({ width: level.maxSide, height: level.maxSide, fit: 'inside', withoutEnlargement: true });
  // PNG keeps transparency (palette quantization); everything else becomes the same format or JPG
  if (ext === 'png') return { data: await img.png({ palette: true, quality: level.quality + 10, compressionLevel: 9, effort: 8 }).toBuffer(), ext: 'png' };
  if (ext === 'webp') return { data: await img.webp({ quality: level.quality }).toBuffer(), ext: 'webp' };
  if (ext === 'avif') return { data: await img.avif({ quality: level.quality - 10 }).toBuffer(), ext: 'avif' };
  return { data: await img.flatten({ background: '#ffffff' }).jpeg({ quality: level.quality, mozjpeg: true }).toBuffer(), ext: 'jpg' };
}

const nameOf = (dict, key) => {
  const v = dict.lookup(PDFName.of(key));
  if (v instanceof PDFArray) return v.size() === 1 ? v.lookup(0)?.toString() : 'multi';
  return v?.toString();
};

// Re-encode the photos embedded in a PDF. Returns the number of images made smaller.
async function compressPdfImages(pdf, level) {
  let changed = 0;
  for (const [ref, obj] of pdf.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    if (nameOf(dict, 'Subtype') !== '/Image') continue;
    const filter = nameOf(dict, 'Filter');
    const colorSpace = nameOf(dict, 'ColorSpace');
    const bits = dict.lookup(PDFName.of('BitsPerComponent'))?.asNumber?.();
    const width = dict.lookup(PDFName.of('Width'))?.asNumber?.();
    const height = dict.lookup(PDFName.of('Height'))?.asNumber?.();
    // Masks, CMYK, inverted (Decode) and predictor-filtered images are left as they are
    if (!width || !height || dict.has(PDFName.of('Decode')) || dict.has(PDFName.of('DecodeParms')) || dict.has(PDFName.of('ImageMask'))) continue;
    const gray = colorSpace === '/DeviceGray';
    if (!gray && colorSpace !== '/DeviceRGB' && !String(dict.lookup(PDFName.of('ColorSpace'))).includes('ICCBased')) continue;
    if (width * height < 150 * 150) continue; // icons and lines: not worth it

    let input;
    try {
      if (filter === '/DCTDecode') {
        input = sharp(Buffer.from(obj.contents));
      } else if (filter === '/FlateDecode' && bits === 8) {
        const channels = gray ? 1 : 3;
        const raw = zlib.inflateSync(Buffer.from(obj.contents));
        if (raw.length !== width * height * channels) continue;
        input = sharp(raw, { raw: { width, height, channels } });
      } else continue;

      const resized = input.resize({ width: level.pdfSide, height: level.pdfSide, fit: 'inside', withoutEnlargement: true });
      const { data, info } = await (gray ? resized.toColourspace('b-w') : resized.toColourspace('srgb'))
        .jpeg({ quality: level.quality, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      if (data.length >= obj.contents.length) continue;

      const newDict = dict.clone(pdf.context);
      newDict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
      newDict.set(PDFName.of('Width'), PDFNumber.of(info.width));
      newDict.set(PDFName.of('Height'), PDFNumber.of(info.height));
      newDict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
      newDict.set(PDFName.of('ColorSpace'), PDFName.of(info.channels === 1 ? 'DeviceGray' : 'DeviceRGB'));
      newDict.set(PDFName.of('Length'), PDFNumber.of(data.length));
      pdf.context.assign(ref, PDFRawStream.of(newDict, new Uint8Array(data)));
      changed++;
    } catch {
      // An image sharp can't read stays untouched
    }
  }
  return changed;
}

export async function compressPdf(buffer, level) {
  const pdf = await PDFDocument.load(buffer, { updateMetadata: false });
  await compressPdfImages(pdf, level);
  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}

function limiter(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return res.status(429).json({ error: 'Has comprimido muchos archivos seguidos. Espera unos minutos.' });
    recent.push(now);
    hits.set(req.ip, recent);
    next();
  };
}

export function createCompressRouter() {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: COMPRESS_MAX_MB * 1024 * 1024, files: 1, fields: 2 } });

  router.post('/', limiter(60, 10 * 60_000), (req, res, next) => {
    upload.single('file')(req, res, async (uploadErr) => {
      try {
        if (uploadErr?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `El archivo supera ${COMPRESS_MAX_MB} MB.` });
        if (uploadErr) throw uploadErr;
        if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });
        const level = LEVELS[req.body?.level] ?? LEVELS.equilibrada;
        const parsed = path.parse(req.file.originalname);
        const ext = parsed.ext.slice(1).toLowerCase();
        const isPdf = ext === 'pdf';
        if (!isPdf && !IMAGE_EXT.includes(ext)) return res.status(400).json({ error: 'Sube una imagen (JPG, PNG, WEBP, HEIC…) o un PDF.' });

        let out;
        try {
          out = isPdf ? { data: await compressPdf(req.file.buffer, level), ext: 'pdf' } : await compressImage(req.file.buffer, ext, level);
        } catch (err) {
          console.warn('Compresión fallida:', err.message);
          return res.status(422).json({ error: isPdf ? 'No pudimos leer este PDF. ¿Está protegido con contraseña o dañado?' : 'No pudimos leer esta imagen. ¿Está dañada?' });
        }
        // Already optimized: hand back the original instead of a heavier file
        const keep = out.data.length >= req.file.size && out.ext === (ext === 'jpeg' ? 'jpg' : ext);
        const data = keep ? req.file.buffer : out.data;
        const base = parsed.name.replace(/[^\w\- .()áéíóúñÁÉÍÓÚÑ]/g, '_').slice(0, 80) || 'archivo';
        const filename = `${base}-comprimido.${keep ? ext : out.ext}`;
        res.setHeader('Content-Type', isPdf ? 'application/pdf' : `image/${out.ext === 'jpg' ? 'jpeg' : out.ext}`);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.send(data);
      } catch (err) {
        next(err);
      }
    });
  });

  return router;
}
