// Local AI models (run on this server's CPU, no external API). Runs inside the model worker
// process (model-worker.js); the rest of the server calls them through models.js.
// - Whisper for speech-to-text (MIT license)
// - Swin2SR lightweight x2 for photo upscaling (Apache-2.0)
// Models download from Hugging Face on first use and are cached in ./.models.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline, env, RawImage } from '@huggingface/transformers';
import sharp from 'sharp';

env.cacheDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.models');

const WHISPER_MODEL = process.env.WHISPER_MODEL || 'onnx-community/whisper-base';
const UPSCALE_MODEL = 'Xenova/swin2SR-lightweight-x2-64';

// onnxruntime's memory arena and pattern cache keep every intermediate buffer; without them
// models use far less memory (same output). The upscaler keeps the defaults: its small tiles
// stay low and it runs twice as fast with the cache.
const session_options = { enableCpuMemArena: false, enableMemPattern: false };

let asr = null;
let upscaler = null;
const loadAsr = () => (asr ??= pipeline('automatic-speech-recognition', WHISPER_MODEL, { dtype: 'q8', session_options }));
const loadUpscaler = () => (upscaler ??= pipeline('image-to-image', UPSCALE_MODEL, { dtype: 'fp32' }));

// samples: Float32Array, mono, 16 kHz. language: 'spanish' | 'english' | null (auto)
export async function transcribe(samples, language) {
  const model = await loadAsr();
  const out = await model(samples, {
    task: 'transcribe',
    ...(language && { language }),
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
  });
  const segments = (out.chunks ?? [])
    .map((c) => ({ start: c.timestamp[0] ?? 0, end: c.timestamp[1] ?? c.timestamp[0] ?? 0, text: c.text.trim() }))
    .filter((s) => s.text);
  return { text: out.text.trim(), segments };
}

// Doubles the resolution of an image (RGB). Works in overlapping tiles so memory stays low
// on a small server. onProgress(fraction) is called after each tile. Returns a PNG buffer.
const TILE = 128;
const OVERLAP = 8;
export async function upscale2x(buffer, { maxPixels, onProgress } = {}) {
  let img = sharp(buffer).rotate();
  const meta = await img.metadata();
  let { width, height } = meta.autoOrient ?? meta;
  if (maxPixels && width * height > maxPixels) {
    const k = Math.sqrt(maxPixels / (width * height));
    [width, height] = [Math.floor(width * k), Math.floor(height * k)];
    img = img.resize(width, height);
  }
  const { data, info } = await img.flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  ({ width, height } = info);
  const model = await loadUpscaler();
  const out = Buffer.alloc(width * 2 * height * 2 * 3);
  const xs = [];
  const ys = [];
  for (let x = 0; x < width; x += TILE) xs.push(x);
  for (let y = 0; y < height; y += TILE) ys.push(y);
  let done = 0;
  for (const y0 of ys) {
    for (const x0 of xs) {
      // Tile plus a margin on every side, cropped away after upscaling to hide seams
      const left = Math.max(0, x0 - OVERLAP);
      const top = Math.max(0, y0 - OVERLAP);
      const right = Math.min(width, x0 + TILE + OVERLAP);
      const bottom = Math.min(height, y0 + TILE + OVERLAP);
      const tw = right - left;
      const th = bottom - top;
      const tile = new Uint8ClampedArray(tw * th * 3);
      for (let row = 0; row < th; row++) {
        data.copy(Buffer.from(tile.buffer, row * tw * 3, tw * 3), 0, ((top + row) * width + left) * 3, ((top + row) * width + left + tw) * 3);
      }
      const result = await model(new RawImage(tile, tw, th, 3));
      const r = Array.isArray(result) ? result[0] : result;
      const rc = r.channels;
      const keepW = Math.min(TILE, width - x0) * 2;
      const keepH = Math.min(TILE, height - y0) * 2;
      const offX = (x0 - left) * 2;
      const offY = (y0 - top) * 2;
      for (let row = 0; row < keepH; row++) {
        for (let col = 0; col < keepW; col++) {
          const src = ((offY + row) * r.width + offX + col) * rc;
          const dst = ((y0 * 2 + row) * width * 2 + x0 * 2 + col) * 3;
          out[dst] = r.data[src];
          out[dst + 1] = r.data[src + 1];
          out[dst + 2] = r.data[src + 2];
        }
      }
      onProgress?.(++done / (xs.length * ys.length));
    }
  }
  return sharp(out, { raw: { width: width * 2, height: height * 2, channels: 3 } }).png({ compressionLevel: 6 }).toBuffer();
}
