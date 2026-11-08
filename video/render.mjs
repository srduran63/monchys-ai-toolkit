// Renders the explainer videos: npm run videos            (all tools)
//                               npm run videos -- cv ahorro (only some)
// Opens video/explainer.html in a headless browser, draws every frame with renderAt(t),
// and pipes the screenshots into ffmpeg. Output: public/videos/<tool>.mp4 + <tool>.jpg (poster).
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import ffmpegPath from 'ffmpeg-static';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'videos');
const SCENE = pathToFileURL(path.join(ROOT, 'video', 'explainer.html')).href;
const FPS = 30;
const BROWSERS = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

async function findBrowser() {
  for (const b of BROWSERS) {
    try {
      await fs.access(b);
      return b;
    } catch {}
  }
  throw new Error('No encontré Chrome ni Edge. Indica la ruta con BROWSER_PATH.');
}

function encoder(out) {
  const ff = spawn(
    ffmpegPath,
    ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
    { stdio: ['pipe', 'inherit', 'inherit'] }
  );
  const done = new Promise((resolve, reject) => ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg salió con ${code}`)))));
  return { stdin: ff.stdin, done };
}

const write = (stream, buf) => new Promise((resolve) => (stream.write(buf) ? resolve() : stream.once('drain', resolve)));

async function renderTool(page, tool) {
  await page.goto(`${SCENE}?tool=${tool}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => window.ready);
  const { duration, poster } = await page.evaluate(() => ({ duration: window.DURATION, poster: window.POSTER_TIME }));
  const out = path.join(OUT_DIR, `${tool}.mp4`);
  const { stdin, done } = encoder(out);
  const frames = Math.round(duration * FPS);
  const started = Date.now();
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.renderAt(t), f / FPS);
    await write(stdin, await page.screenshot({ type: 'jpeg', quality: 92 }));
  }
  stdin.end();
  await done;
  await page.evaluate((t) => window.renderAt(t), poster);
  await page.screenshot({ type: 'jpeg', quality: 85, path: path.join(OUT_DIR, `${tool}.jpg`) });
  const { size } = await fs.stat(out);
  console.log(`✓ ${tool}: ${frames} fotogramas, ${(size / 1024 / 1024).toFixed(2)} MB, ${((Date.now() - started) / 1000).toFixed(0)} s`);
}

await fs.mkdir(OUT_DIR, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: await findBrowser(),
  headless: true,
  args: ['--allow-file-access-from-files', '--force-device-scale-factor=1'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('Error en la escena:', e.message));
  await page.goto(`${SCENE}?tool=convertidor`, { waitUntil: 'networkidle0' });
  const all = await page.evaluate(() => window.TOOLS);
  const wanted = process.argv.slice(2);
  for (const tool of wanted.length ? all.filter((t) => wanted.includes(t)) : all) await renderTool(page, tool);
} finally {
  await browser.close();
}
