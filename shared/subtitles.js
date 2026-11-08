// Subtitle helpers shared by the server (burn-in) and the browser (downloads).
// A segment is { start, end, text } with times in seconds.

const MAX_SECONDS = 6;
const MAX_CHARS = 84;

// Whisper chunks can be long: split them into readable cues, sharing the time by length.
export function splitSegments(segments) {
  const out = [];
  for (const s of segments) {
    const words = s.text.trim().split(/\s+/).filter(Boolean);
    const duration = Math.max(0.5, s.end - s.start);
    const parts = Math.max(Math.ceil(duration / MAX_SECONDS), Math.ceil(s.text.length / MAX_CHARS), 1);
    if (parts === 1 || words.length < 2) {
      out.push({ start: s.start, end: Math.max(s.end, s.start + 0.5), text: s.text.trim() });
      continue;
    }
    const per = Math.ceil(words.length / parts);
    const total = s.text.length;
    let t = s.start;
    for (let i = 0; i < words.length; i += per) {
      const text = words.slice(i, i + per).join(' ');
      const end = i + per >= words.length ? s.start + duration : t + (duration * text.length) / total;
      out.push({ start: t, end, text });
      t = end;
    }
  }
  return out.filter((s) => s.text);
}

const pad = (n, size = 2) => String(n).padStart(size, '0');
function stamp(seconds, sep) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`;
}

// Two lines at most per cue, broken near the middle
function wrap(text) {
  if (text.length <= 42) return text;
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return best < 0 ? text : `${text.slice(0, best)}\n${text.slice(best + 1)}`;
}

export const toSrt = (segments) =>
  segments.map((s, i) => `${i + 1}\n${stamp(s.start, ',')} --> ${stamp(s.end, ',')}\n${wrap(s.text)}\n`).join('\n');

export const toVtt = (segments) =>
  `WEBVTT\n\n${segments.map((s) => `${stamp(s.start, '.')} --> ${stamp(s.end, '.')}\n${wrap(s.text)}\n`).join('\n')}`;
