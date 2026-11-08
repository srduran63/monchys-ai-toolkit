// Shared between server (validation) and client (icon picker / rendering).
export const ICON_NAMES = [
  'calendar', 'wallet', 'mic', 'file-text', 'image', 'convert', 'briefcase', 'heart', 'crown',
  'code', 'music', 'box', 'cpu', 'terminal', 'zap', 'shield', 'download',
  'minimize', 'subtitles', 'megaphone', 'languages', 'sparkles', 'tag', 'pen', 'wand', 'clapper',
];

// Billing period of a product: one-time payment or monthly membership.
export const PERIODS = ['once', 'month'];

// Free converter: accepted input extensions and possible output formats per kind.
export const FREE_MAX_MB = 25;
// Videos get more room in the free tier (compressing for WhatsApp, extracting audio)
export const FREE_VIDEO_MAX_MB = 50;
const VIDEO_INPUTS = ['mp4', 'mov', 'm4v', 'mkv', 'avi', 'wmv', 'flv', '3gp', 'mpeg', 'mpg'];
export const CONVERT_FORMATS = {
  image: {
    inputs: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'tif', 'tiff', 'heic', 'heif'],
    outputs: ['jpg', 'png', 'webp', 'avif', 'gif', 'tiff', 'pdf'],
  },
  audio: {
    inputs: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'wma', 'webm'],
    outputs: ['mp3', 'wav', 'ogg', 'm4a', 'flac'],
  },
  // Free tier: compress a small video or extract its audio ("convertir mp4 a mp3")
  video: {
    inputs: VIDEO_INPUTS,
    outputs: ['comprimir', 'mp3', 'm4a', 'wav'],
  },
};

// Convertidor Pro: everything above plus video output, bigger files and batches.
export const PRO_MAX_MB = 2048;
export const PRO_MAX_FILES = 50;
export const PRO_FORMATS = {
  image: CONVERT_FORMATS.image,
  // .webm is treated as video in Pro (it can hold either)
  audio: { ...CONVERT_FORMATS.audio, inputs: CONVERT_FORMATS.audio.inputs.filter((e) => e !== 'webm') },
  video: {
    inputs: [...VIDEO_INPUTS, 'webm'],
    // "comprimir" = smaller MP4 (max 1280 px wide, lower bitrate)
    outputs: ['mp4', 'comprimir', 'webm', 'gif', 'mp3', 'wav', 'm4a'],
  },
};

// Display name of an output format
export const formatLabel = (fmt) => (fmt === 'comprimir' ? 'MP4 comprimido' : fmt.toUpperCase());
