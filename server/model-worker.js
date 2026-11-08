// Child process that runs the local AI models (model-jobs.js), started by models.js.
// If a job runs out of memory, only this process dies: the web server keeps running.
import { transcribe, upscale2x } from './model-jobs.js';

const JOBS = {
  transcribe: (samples, language) => transcribe(samples, language),
  upscale2x: (buffer, options, id) =>
    upscale2x(Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength), {
      ...options,
      onProgress: (progress) => process.send({ id, progress }),
    }),
};

process.on('message', async ({ id, job, args }) => {
  try {
    const result = await JOBS[job](...args, id);
    process.send({ id, result });
  } catch (err) {
    process.send({ id, error: err?.message ?? String(err) });
  }
});

process.on('disconnect', () => process.exit(0));
