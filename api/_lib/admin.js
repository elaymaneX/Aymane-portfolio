// Admin panel account, sessions and passkeys. There is one account: it is created once with the
// setup token (COMMENTS_ADMIN_TOKEN), after which sign-up is closed for good.
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { clientKey, isAllowedOrigin, store } from './comments.js';

const scrypt = promisify(scryptCallback);
export const SETUP_TOKEN = process.env.COMMENTS_ADMIN_TOKEN ?? '';
export const MIN_PASSWORD = 12;
const USER = 'admin:user';
const PASSKEYS = 'admin:passkeys';
const COOKIE = 'admin_session';
const SESSION_SECONDS = 7 * 86400;

const sha256 = value => createHash('sha256').update(value).digest('hex');
// Compares secrets of any length in constant time
export const sameSecret = (a, b) =>
  timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest());

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
export async function checkPassword(password, stored) {
  const [, salt, key] = String(stored).split('$');
  if (!salt || !key) return false;
  const derived = await scrypt(String(password), Buffer.from(salt, 'base64'), 64);
  return timingSafeEqual(derived, Buffer.from(key, 'base64'));
}

export const getUser = async () => JSON.parse((await store.get(USER)) ?? 'null');
export const saveUser = user => store.set(USER, JSON.stringify(user));
export const newUser = async (username, password) =>
  ({ id: randomUUID(), username, password: await hashPassword(password), createdAt: new Date().toISOString() });

// Sessions: a random token in an HttpOnly cookie scoped to /api/admin; only its hash is stored
const readCookie = req =>
  String(req.headers.cookie ?? '').split(';').map(part => part.trim().split('='))
    .find(([name]) => name === COOKIE)?.[1] ?? '';
const cookie = (value, maxAge) =>
  `${COOKIE}=${value}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.VERCEL ? '; Secure' : ''}`;

export async function startSession(res) {
  const token = randomBytes(32).toString('base64url');
  await store.set(`admin:session:${sha256(token)}`, '1', SESSION_SECONDS);
  res.setHeader('Set-Cookie', cookie(token, SESSION_SECONDS));
}
export async function endSession(req, res) {
  const token = readCookie(req);
  if (token) await store.del(`admin:session:${sha256(token)}`);
  res.setHeader('Set-Cookie', cookie('', 0));
}
export async function isSignedIn(req) {
  const token = readCookie(req);
  return Boolean(token && (await store.get(`admin:session:${sha256(token)}`)));
}

// Every admin function starts here: storage present, writes only from this site, a signed-in session
export async function guard(req, res, { signedIn = true } = {}) {
  res.setHeader('Cache-Control', 'no-store');
  if (!store) return void res.status(503).json({ error: 'not_configured' });
  if (req.method !== 'GET' && !isAllowedOrigin(req)) return void res.status(403).json({ error: 'forbidden' });
  if (signedIn && !(await isSignedIn(req))) return void res.status(401).json({ error: 'unauthorized' });
  return true;
}

// Failed sign-ins: 10 per visitor and 50 overall per 15 minutes, then everyone waits
const WINDOW = 900;
const failureKeys = req => [`ratelimit:adminlogin:${clientKey(req)}`, 'ratelimit:adminlogin:all'];
export async function signInBlocked(req) {
  const [mine, all] = failureKeys(req);
  return (await store.count(mine)) >= 10 || (await store.count(all)) >= 50;
}
export async function recordFailedSignIn(req) {
  for (const key of failureKeys(req)) await store.hit(key, WINDOW);
}

// Passkeys, keyed by credential id; public keys are stored as base64url
export const listPasskeys = async () => Object.values(await store.hgetall(PASSKEYS)).map(item => JSON.parse(item));
export const savePasskey = passkey => store.hset(PASSKEYS, passkey.id, JSON.stringify(passkey));
export const removePasskey = id => store.hdel(PASSKEYS, id);

// The relying party is the page's own host, so passkeys only work on the domain they were made on
export function relyingParty(req) {
  const origin = String(req.headers.origin ?? '');
  return { origin, rpID: new URL(origin).hostname };
}
// One pending challenge per purpose (and per visitor for sign-in), valid for 5 minutes
export const challengeKey = (purpose, req) => `admin:challenge:${purpose}:${clientKey(req)}`;
