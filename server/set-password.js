// Usage:
//   npm run set-password                      (interactive)
//   npm run set-password -- <usuario> <clave>
// Writes ADMIN_USER / ADMIN_PASSWORD_HASH to .env and keeps (or creates) SESSION_SECRET.
// Changing SESSION_SECRET logs out every open admin session.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { hashPassword } from './password.js';

const ENV_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');

let [username, password] = process.argv.slice(2);
if (!username || !password) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  username = (await rl.question('Usuario admin: ')).trim();
  password = await rl.question('Contraseña (mín. 10 caracteres): ');
  rl.close();
}
if (!username || !password || password.length < 10) {
  console.error('Usuario requerido y contraseña de al menos 10 caracteres.');
  process.exit(1);
}

const env = {};
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2];
  }
}
env.ADMIN_USER = username;
env.ADMIN_PASSWORD_HASH = hashPassword(password);
env.SESSION_SECRET ||= crypto.randomBytes(32).toString('hex');

fs.writeFileSync(ENV_FILE, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
console.log(`Credenciales de admin guardadas en .env para el usuario "${username}". Reinicia el servidor.`);
