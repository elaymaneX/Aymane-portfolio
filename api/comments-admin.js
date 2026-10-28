// Comment moderation for /comments-admin. Every request needs `Authorization: Bearer <COMMENTS_ADMIN_TOKEN>`.
// GET  /api/comments-admin  -> { pending: [comment], approved: { [slug]: [comment] } }
// POST /api/comments-admin  { action: 'approve' | 'reject', id }  or  { action: 'delete', slug, id }
import { clientKey, isAdmin, isAllowedOrigin, publishedSlugs, readBody, store } from './_lib/comments.js';

const FAILED_LOGINS = 10; // per visitor per 15 minutes

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!store) return res.status(503).json({ error: 'not_configured' });

  try {
    const failures = `ratelimit:admin:${clientKey(req)}`;
    if ((await store.count(failures)) >= FAILED_LOGINS) {
      return res.status(429).json({ error: 'rate_limited' });
    }
    if (!isAdmin(req)) {
      await store.hit(failures, 900);
      return res.status(401).json({ error: 'unauthorized' });
    }

    if (req.method === 'GET') {
      const pending = (await store.pendingAll()).map(item => JSON.parse(item));
      pending.sort((a, b) => a.date.localeCompare(b.date));
      const approved = {};
      for (const slug of await publishedSlugs()) {
        approved[slug] = (await store.approved(slug)).map(item => JSON.parse(item));
      }
      return res.status(200).json({ pending, approved });
    }

    if (req.method === 'POST') {
      if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'forbidden' });
      const body = readBody(req);
      const id = String(body?.id ?? '');

      if (body?.action === 'approve' || body?.action === 'reject') {
        const raw = await store.pendingGet(id);
        if (!raw) return res.status(404).json({ error: 'not_found' });
        if (body.action === 'approve') {
          const { slug, ...comment } = JSON.parse(raw);
          await store.approve(slug, JSON.stringify(comment));
        }
        await store.pendingRemove(id);
        return res.status(200).json({ ok: true });
      }

      if (body?.action === 'delete') {
        const slug = String(body.slug ?? '');
        if (!(await publishedSlugs()).has(slug)) return res.status(404).json({ error: 'not_found' });
        const raw = (await store.approved(slug)).find(item => JSON.parse(item).id === id);
        if (!raw) return res.status(404).json({ error: 'not_found' });
        await store.removeApproved(slug, raw);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'invalid_action' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    console.error('comments-admin:', error);
    return res.status(500).json({ error: 'server_error' });
  }
}
