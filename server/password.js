import crypto from 'node:crypto';

// Format: scrypt:<saltHex>:<hashHex>  (":" instead of "$" so .env files never try to expand it)
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  return new Promise((resolve) => {
    const [alg, saltHex, hashHex] = String(stored).split(':');
    if (alg !== 'scrypt' || !saltHex || !hashHex) return resolve(false);
    const expected = Buffer.from(hashHex, 'hex');
    crypto.scrypt(password, Buffer.from(saltHex, 'hex'), expected.length, (err, derived) => {
      resolve(!err && crypto.timingSafeEqual(derived, expected));
    });
  });
}
