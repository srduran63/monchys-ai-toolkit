// Generates the "Secret Key" Supabase asks for under Authentication → Providers → Apple.
// Apple accepts it for up to 6 months: run it again before it expires.
//
//   npm run apple-secret -- --key AuthKey_ABC123XYZ.p8 --team TEAMID1234 --client store.monchys.web
//
// The .p8 is read locally and never leaves this machine. Do not upload it or paste it in chats.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const keyFile = args.key;
const teamId = args.team;
const clientId = args.client;
const keyId = args.kid ?? path.basename(keyFile ?? '').match(/AuthKey_([A-Z0-9]+)\.p8$/)?.[1];

if (!keyFile || !teamId || !clientId || !keyId) {
  console.error('Uso: npm run apple-secret -- --key AuthKey_XXXX.p8 --team TEAM_ID --client SERVICES_ID [--kid KEY_ID]');
  process.exit(1);
}

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const exp = now + 180 * 24 * 3600; // Apple's maximum is ~6 months
const data = `${b64url({ alg: 'ES256', kid: keyId })}.${b64url({
  iss: teamId,
  iat: now,
  exp,
  aud: 'https://appleid.apple.com',
  sub: clientId,
})}`;
const signature = crypto.sign('sha256', Buffer.from(data), {
  key: fs.readFileSync(keyFile, 'utf8'),
  dsaEncoding: 'ieee-p1363',
});

console.log(`${data}.${signature.toString('base64url')}`);
console.error(`\nVálido hasta el ${new Date(exp * 1000).toLocaleDateString('es')}. Pégalo en Supabase → Apple → Secret Key.`);
