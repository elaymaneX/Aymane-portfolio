// Public blog comments. New comments wait for approval in /comments-admin before anyone sees them.
// GET  /api/comments?slug=<post>  -> { comments: [{ name, message, date }] }, newest first
// POST /api/comments  { slug, name, message, website }  -> 202 { status: 'pending' }
import { randomUUID } from 'node:crypto';
import {
  MAX_MESSAGE, MAX_NAME, MAX_PENDING, cleanMessage, cleanName, clientKey, isAllowedOrigin,
  publicComment, publishedSlugs, readBody, store,
} from './_lib/comments.js';

const PER_MINUTE = 3;
const PER_DAY = 10;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!store) {
    return res.status(503).json({ error: 'not_configured' });
  }

  try {
    if (req.method === 'GET') {
      const slug = String(req.query.slug ?? '');
      if (!(await publishedSlugs()).has(slug)) return res.status(404).json({ error: 'unknown_post' });

      const raw = await store.approved(slug);
      return res.status(200).json({ comments: raw.map(item => publicComment(JSON.parse(item))) });
    }

    if (req.method === 'POST') {
      if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'forbidden' });

      const body = readBody(req);
      if (!body || typeof body !== 'object') return res.status(400).json({ error: 'invalid_body' });

      // Honeypot: the "website" field is hidden from people, so only bots fill it in.
      // Answer like a success so they don't learn to skip it.
      if (body.website) return res.status(202).json({ status: 'pending' });

      const slug = String(body.slug ?? '');
      const name = cleanName(body.name);
      const message = cleanMessage(body.message);
      if (!(await publishedSlugs()).has(slug)) return res.status(404).json({ error: 'unknown_post' });
      if (!name || name.length > MAX_NAME) return res.status(400).json({ error: 'invalid_name' });
      if (!message || message.length > MAX_MESSAGE) return res.status(400).json({ error: 'invalid_message' });

      const client = clientKey(req);
      if ((await store.hit(`ratelimit:comments:min:${client}`, 60)) > PER_MINUTE ||
          (await store.hit(`ratelimit:comments:day:${client}`, 86400)) > PER_DAY) {
        return res.status(429).json({ error: 'rate_limited' });
      }
      if ((await store.pendingCount()) >= MAX_PENDING) {
        return res.status(503).json({ error: 'queue_full' });
      }

      const comment = { id: randomUUID(), slug, name, message, date: new Date().toISOString() };
      await store.pendingAdd(comment.id, JSON.stringify(comment));
      return res.status(202).json({ status: 'pending' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    console.error('comments:', error);
    return res.status(500).json({ error: 'server_error' });
  }
}
