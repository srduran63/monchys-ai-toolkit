// Local AI models (Whisper, Swin2SR: see model-jobs.js), run in a child process
// (model-worker.js) so a job that runs out of memory can't take the web server down with it.
// One job at a time; the worker stops after a while idle to give its memory back.
import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'model-worker.js');
const IDLE_MS = 10 * 60_000;

export class ModelCrash extends Error {}

let worker = null;
let idleTimer = null;
let nextId = 1;
const pending = new Map(); // id -> { resolve, reject, onProgress }

function startWorker() {
  // execArgv: [] so the dev server's --watch isn't inherited; fewer malloc arenas keep RSS low on Linux
  const child = fork(WORKER, [], { serialization: 'advanced', execArgv: [], env: { ...process.env, MALLOC_ARENA_MAX: '2' } });
  child.on('message', ({ id, result, error, progress }) => {
    const job = pending.get(id);
    if (!job) return;
    if (progress !== undefined) return job.onProgress?.(progress);
    pending.delete(id);
    if (error) job.reject(new Error(error));
    else job.resolve(result);
  });
  child.on('exit', (code, signal) => {
    if (worker === child) worker = null;
    if (pending.size) console.error(`Modelos de IA: el proceso terminó (${signal ?? code}), probablemente sin memoria.`);
    for (const job of pending.values()) {
      job.reject(new ModelCrash('Este archivo necesitó más memoria de la que tenemos. Prueba con uno más pequeño o inténtalo de nuevo.'));
    }
    pending.clear();
  });
  return child;
}

function call(job, args, onProgress) {
  clearTimeout(idleTimer);
  worker ??= startWorker();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    worker.send({ id, job, args });
  }).finally(() => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => worker?.kill(), IDLE_MS);
    idleTimer.unref();
  });
}

// One heavy job at a time so the server stays responsive.
let queue = Promise.resolve();
let waiting = 0;
export const queueLength = () => waiting;

function exclusive(fn) {
  waiting++;
  const run = queue.then(() => fn());
  queue = run.catch(() => {}).finally(() => waiting--);
  return run;
}

const toBuffer = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);

// samples: Float32Array, mono, 16 kHz. language: 'spanish' | 'english' | null (auto)
export const transcribe = (samples, language) => exclusive(() => call('transcribe', [samples, language ?? null]));

// Doubles the resolution of an image. onProgress(fraction) is called after each tile. Returns a PNG buffer.
export const upscale2x = (buffer, { maxPixels, onProgress } = {}) =>
  exclusive(async () => toBuffer(await call('upscale2x', [buffer, { maxPixels }], onProgress)));
