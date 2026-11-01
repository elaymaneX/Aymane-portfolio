// Comment moderation for the admin panel (signed-in session required).
// GET  /api/admin/comments -> { pending: [comment], approved: { [slug]: [comment] } }
// POST /api/admin/comments { action: 'approve' | 'reject', id }  or  { action: 'delete', slug, id }
import { guard } from '../_lib/admin.js';
import { publishedSlugs, readBody, store } from '../_lib/comments.js';

export default async function handler(req, res) {
  if (!(await guard(req, res))) return;

  try {
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
      const body = readBody(req) ?? {};
      const id = String(body.id ?? '');

      if (body.action === 'approve' || body.action === 'reject') {
        const raw = await store.pendingGet(id);
        if (!raw) return res.status(404).json({ error: 'not_found' });
        if (body.action === 'approve') {
          const { slug, ...comment } = JSON.parse(raw);
          await store.approve(slug, JSON.stringify(comment));
        }
        await store.pendingRemove(id);
        return res.status(200).json({ ok: true });
      }

      if (body.action === 'delete') {
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
    console.error('admin/comments:', error);
    return res.status(500).json({ error: 'server_error' });
  }
}
