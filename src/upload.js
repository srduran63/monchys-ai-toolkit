// Multipart upload with progress. Resolves with JSON, or { blob, filename } when responseType is 'blob'.
export function upload(url, fields, { onProgress, responseType = 'json' } = {}) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.responseType = responseType === 'blob' ? 'blob' : 'text';
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onerror = () => reject(new Error('No se pudo conectar con el servidor.'));
    xhr.onload = async () => {
      const ok = xhr.status >= 200 && xhr.status < 300;
      const text = responseType === 'blob' ? (ok ? null : await xhr.response.text()) : xhr.response;
      if (!ok) {
        let message = `Error ${xhr.status}`;
        try {
          message = JSON.parse(text).error ?? message;
        } catch {}
        const err = new Error(message);
        err.status = xhr.status;
        return reject(err);
      }
      if (responseType === 'blob') {
        const match = (xhr.getResponseHeader('Content-Disposition') ?? '').match(/filename\*=UTF-8''([^;]+)/);
        return resolve({ blob: xhr.response, filename: match ? decodeURIComponent(match[1]) : null });
      }
      resolve(text ? JSON.parse(text) : null);
    };
    xhr.send(form);
  });
}

export const sizeLabel = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : bytes < 1024 ** 3 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024 ** 3).toFixed(2)} GB`;

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
