// Tiny JSON-file store with serialized atomic writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');

export async function createStore(name, initial = {}) {
  const file = path.join(DATA_DIR, `${name}.json`);
  let data;
  try {
    data = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    data = structuredClone(initial);
  }

  let queue = Promise.resolve();
  const save = () => {
    const snapshot = JSON.stringify(data, null, 2);
    queue = queue.catch(() => {}).then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(`${file}.tmp`, snapshot);
      await fs.rename(`${file}.tmp`, file);
    });
    return queue;
  };

  return {
    get data() {
      return data;
    },
    save,
    // Per-user record, created on first use
    forUser(userId, init) {
      data[userId] ??= init();
      return data[userId];
    },
  };
}

export const uploadsDir = (name) => path.join(DATA_DIR, 'uploads', name);
