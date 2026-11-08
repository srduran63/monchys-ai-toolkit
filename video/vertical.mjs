// Vertical (9:16) versions of the explainer videos for TikTok, Reels and Shorts:
//   npm run videos:vertical            (all tools)
//   npm run videos:vertical -- cv      (only some)
// Needs the horizontal videos first (npm run videos). A 1080×1920 frame is drawn in the browser
// (big question on top, monshys.io at the bottom) and ffmpeg places the 16 s video in the middle.
// Output: video/out/vertical/<tool>.mp4 (not published on the website).
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import ffmpegPath from 'ffmpeg-static';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIDEOS = path.join(ROOT, 'public', 'videos');
const OUT_DIR = path.join(ROOT, 'video', 'out', 'vertical');
const SCENE = pathToFileURL(path.join(ROOT, 'video', 'explainer.html')).href;
// Inlined: a page made with setContent cannot load file:// images
const MASCOT = `data:image/png;base64,${(await fs.readFile(path.join(ROOT, 'public', 'mascot-logo.png'))).toString('base64')}`;
const W = 1080;
const H = 1920;
const VIDEO_Y = 640; // top of the 1080×608 video
const BROWSERS = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const frameHtml = ({ title, name }) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: ${W}px; height: ${H}px; overflow: hidden; font-family: Nunito, sans-serif; color: #16181c;
    background: radial-gradient(circle at 85% 8%, #dceefb 0, rgba(220,238,251,0) 40%), #fff6ec; }
  .chip { position: absolute; left: 90px; top: 150px; padding: 14px 30px; border-radius: 999px; background: #dceefb; color: #3e6e96; font-size: 34px; font-weight: 800; }
  h1 { position: absolute; left: 90px; right: 90px; top: 250px; font-family: Fredoka, sans-serif; font-size: 96px; line-height: 1.05; font-weight: 700; }
  .slot { position: absolute; left: 0; top: ${VIDEO_Y}px; width: ${W}px; height: 608px; background: #fff; }
  .mascot { position: absolute; left: 90px; top: 1330px; height: 330px; }
  .cta { position: absolute; left: 380px; right: 90px; top: 1360px; }
  .cta p { font-size: 40px; font-weight: 800; color: #3e6e96; }
  .cta .url { margin-top: 10px; font-family: Fredoka, sans-serif; font-weight: 700; font-size: 96px; letter-spacing: -1px; }
  .cta .tool { display: inline-block; margin-top: 18px; padding: 14px 32px; border-radius: 999px; background: #e5231b; color: #fff; font-family: Fredoka; font-weight: 600; font-size: 40px; box-shadow: 0 6px 0 #b3170f; }
</style></head><body>
  <div class="chip">Tutorial · 3 pasos</div>
  <h1>${esc(title)}</h1>
  <div class="slot"></div>
  <img class="mascot" src="${MASCOT}">
  <div class="cta"><p>Pruébalo en</p><div class="url">monshys.io</div><div class="tool">${esc(name)}</div></div>
</body></html>`;

async function findBrowser() {
  for (const b of BROWSERS) {
    try {
      await fs.access(b);
      return b;
    } catch {}
  }
  throw new Error('No encontré Chrome ni Edge. Indica la ruta con BROWSER_PATH.');
}

const ffmpeg = (args) =>
  new Promise((resolve, reject) =>
    execFile(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true }, (err, _o, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve()))
  );

await fs.mkdir(OUT_DIR, { recursive: true });
const browser = await puppeteer.launch({ executablePath: await findBrowser(), headless: true, args: ['--allow-file-access-from-files'] });
try {
  const page = await browser.newPage();
  await page.goto(`${SCENE}?tool=convertidor`, { waitUntil: 'networkidle0' });
  const all = await page.evaluate(() => window.TOOLS);
  const wanted = process.argv.slice(2);
  for (const tool of wanted.length ? all.filter((t) => wanted.includes(t)) : all) {
    const source = path.join(VIDEOS, `${tool}.mp4`);
    try {
      await fs.access(source);
    } catch {
      console.warn(`✗ ${tool}: falta ${source} (ejecuta npm run videos primero)`);
      continue;
    }
    await page.goto(`${SCENE}?tool=${tool}`, { waitUntil: 'networkidle0' });
    const info = await page.evaluate(() => window.SCENE_INFO);

    const card = await browser.newPage();
    await card.setViewport({ width: W, height: H });
    await card.setContent(frameHtml(info), { waitUntil: 'networkidle0' });
    await card.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode())]));
    const background = path.join(OUT_DIR, `${tool}-fondo.png`);
    await card.screenshot({ path: background });
    await card.close();

    const out = path.join(OUT_DIR, `${tool}.mp4`);
    await ffmpeg([
      '-loop', '1', '-i', background, '-i', source,
      '-filter_complex', `[1:v]scale=${W}:-2[v];[0:v][v]overlay=0:${VIDEO_Y}:shortest=1,format=yuv420p`,
      '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-movflags', '+faststart', out,
    ]);
    await fs.rm(background, { force: true });
    const { size } = await fs.stat(out);
    console.log(`✓ ${tool}: ${(size / 1024 / 1024).toFixed(2)} MB`);
  }
} finally {
  await browser.close();
}
