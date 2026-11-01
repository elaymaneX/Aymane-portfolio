// Shared by api/comments.js (public), api/subscribe.js and the admin panel's functions in api/admin/.
// Files under api/_lib are not deployed as functions.
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const MAX_NAME = 60;
export const MAX_MESSAGE = 2000;
export const MAX_PENDING = 200; // new comments are refused while this many wait for review
export const MAX_PER_POST = 500;

// The Vercel Upstash integration sets KV_REST_*; a direct Upstash setup uses UPSTASH_REDIS_REST_*
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_TOKEN = process.env.COMMENTS_ADMIN_TOKEN ?? '';
const PENDING = 'comments:pending';

async function redis(...command) {
  const response = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(command),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

const redisStore = {
  hit: async (key, seconds) => {
    const count = await redis('INCR', key);
    if (count === 1) await redis('EXPIRE', key, seconds);
    return count;
  },
  count: async key => Number((await redis('GET', key)) ?? 0),
  pendingCount: () => redis('HLEN', PENDING),
  pendingAll: async () => {
    const flat = await redis('HGETALL', PENDING);
    return flat.filter((_, i) => i % 2 === 1);
  },
  pendingGet: id => redis('HGET', PENDING, id),
  pendingAdd: (id, value) => redis('HSET', PENDING, id, value),
  pendingRemove: id => redis('HDEL', PENDING, id),
  approved: slug => redis('LRANGE', `comments:${slug}`, 0, -1),
  approve: async (slug, value) => {
    await redis('LPUSH', `comments:${slug}`, value);
    await redis('LTRIM', `comments:${slug}`, 0, MAX_PER_POST - 1);
  },
  removeApproved: (slug, value) => redis('LREM', `comments:${slug}`, 1, value),
  // Generic key/value and hash access for the admin panel (account, sessions, passkeys)
  get: key => redis('GET', key),
  set: (key, value, seconds) => (seconds ? redis('SET', key, value, 'EX', seconds) : redis('SET', key, value)),
  del: key => redis('DEL', key),
  hgetall: async key => {
    const flat = (await redis('HGETALL', key)) ?? [];
    const out = {};
    for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
    return out;
  },
  hset: (key, field, value) => redis('HSET', key, field, value),
  hdel: (key, field) => redis('HDEL', key, field),
};

// Local development without a database: everything lives in memory until the dev server restarts
const counters = new Map();
const pending = new Map();
const lists = new Map();
const values = new Map(); // key -> { value, expires }
const hashes = new Map(); // key -> Map(field -> value)
const memoryStore = {
  hit: async (key, seconds) => {
    const now = Date.now();
    const entry = counters.get(key);
    const next = entry && entry.expires > now ? { ...entry, count: entry.count + 1 } : { count: 1, expires: now + seconds * 1000 };
    counters.set(key, next);
    return next.count;
  },
  count: async key => {
    const entry = counters.get(key);
    return entry && entry.expires > Date.now() ? entry.count : 0;
  },
  pendingCount: async () => pending.size,
  pendingAll: async () => [...pending.values()],
  pendingGet: async id => pending.get(id) ?? null,
  pendingAdd: async (id, value) => pending.set(id, value),
  pendingRemove: async id => pending.delete(id),
  approved: async slug => lists.get(slug) ?? [],
  approve: async (slug, value) => lists.set(slug, [value, ...(lists.get(slug) ?? [])].slice(0, MAX_PER_POST)),
  removeApproved: async (slug, value) => lists.set(slug, (lists.get(slug) ?? []).filter(v => v !== value)),
  get: async key => {
    const entry = values.get(key);
    if (entry && (!entry.expires || entry.expires > Date.now())) return entry.value;
    values.delete(key);
    return null;
  },
  set: async (key, value, seconds) => values.set(key, { value, expires: seconds ? Date.now() + seconds * 1000 : 0 }),
  del: async key => values.delete(key),
  hgetall: async key => Object.fromEntries(hashes.get(key) ?? []),
  hset: async (key, field, value) => hashes.set(key, (hashes.get(key) ?? new Map()).set(field, value)),
  hdel: async (key, field) => hashes.get(key)?.delete(field),
};

export const store = REDIS_URL && REDIS_TOKEN ? redisStore : process.env.VERCEL ? null : memoryStore;

// Only published English posts can receive comments (vercel.json ships src/content/blog with the functions)
let slugsCache;
export async function publishedSlugs() {
  if (!slugsCache) {
    const dir = join(process.cwd(), 'src/content/blog/en');
    const slugs = [];
    for (const file of await readdir(dir)) {
      const match = file.match(/^([a-z0-9-]+)\.mdx?$/);
      if (!match) continue;
      const source = await readFile(join(dir, file), 'utf8');
      const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
      if (!/^draft:\s*true\s*$/m.test(frontmatter)) slugs.push(match[1]);
    }
    slugsCache = new Set(slugs);
  }
  return slugsCache;
}

// Drop control, zero-width and bidi-override characters (used to hide or spoof text) and cap
// stacked combining marks ("zalgo")
const INVISIBLE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F­​-‏‪-‮⁠-⁯﻿]/g;
const text = value => (typeof value === 'string' ? value : '');
export const cleanName = value =>
  text(value).normalize('NFC').replace(INVISIBLE, '').replace(/(\p{M}{2})\p{M}+/gu, '$1')
    .replace(/\s+/g, ' ').trim();
export const cleanMessage = value =>
  text(value).normalize('NFC').replace(/\r\n?/g, '\n').replace(INVISIBLE, '')
    .replace(/(\p{M}{2})\p{M}+/gu, '$1').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

// Rate limits key on a salted hash, so raw visitor IPs are never stored
export function clientKey(req) {
  const ip = String(req.headers['x-real-ip'] ?? req.headers['x-forwarded-for'] ?? 'unknown').split(',')[0].trim();
  return createHash('sha256').update(`${ip}|${ADMIN_TOKEN || REDIS_TOKEN || 'dev'}`).digest('hex').slice(0, 32);
}

// Writes are only accepted from this site's own pages (production, Vercel previews, local dev)
export function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  const allowed = [process.env.SITE_URL || 'https://aymane-portofolio-eta.vercel.app'];
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (host) allowed.push(`https://${host}`);
  }
  if (allowed.some(url => new URL(url).origin === origin)) return true;
  return !process.env.VERCEL && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export function readBody(req) {
  if (typeof req.body !== 'string') return req.body ?? {};
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return null;
  }
}

export const publicComment = ({ name, message, date }) => ({ name, message, date });
