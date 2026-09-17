import {createHmac, createHash, randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';

export const SESSION_SECONDS = 8 * 60 * 60;
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function validPasswordHash(hash) { return /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash || ''); }
export function verifyPassword(password, hash) {
  if (!validPasswordHash(hash)) return false;
  const [salt, expected] = hash.split(':');
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(expected, 'hex'));
}
function signature(payload, secret) { return createHmac('sha256', secret).update(payload).digest('base64url'); }
function credentialVersion(username, hash) { return createHash('sha256').update(username + ':' + hash).digest('hex'); }
export function issueSession(username, hash, secret, now = Date.now()) {
  if (secret.length < 32) throw new Error('Missing session key');
  const payload = Buffer.from(JSON.stringify({user: username, version: credentialVersion(username, hash), expires: now + SESSION_SECONDS * 1000, nonce: randomBytes(16).toString('hex')})).toString('base64url');
  return payload + '.' + signature(payload, secret);
}
export function verifySession(token, username, hash, secret, now = Date.now()) {
  if (!token || token.length > 2048 || !secret || secret.length < 32 || !validPasswordHash(hash)) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const expected = Buffer.from(signature(parts[0], secret));
    const actual = Buffer.from(parts[1]);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    return data.user === username && data.version === credentialVersion(username, hash) && Number.isFinite(data.expires) && data.expires > now && data.expires <= now + SESSION_SECONDS * 1000;
  } catch { return false; }
}
