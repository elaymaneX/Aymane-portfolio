// Newsletter subscribers from Resend, for the admin panel (signed-in session required).
// GET  /api/admin/subscribers -> { subscribers: [{ id, email, createdAt, unsubscribed }] }
// POST /api/admin/subscribers { action: 'remove', id }  deletes the contact from Resend
import { guard } from '../_lib/admin.js';
import { readBody } from '../_lib/comments.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_SEGMENT_ID = process.env.RESEND_SEGMENT_ID;
const MAX_PAGES = 20; // 100 per page

const resend = (path, init = {}) =>
  fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  });

export default async function handler(req, res) {
  if (!(await guard(req, res))) return;
  if (!RESEND_API_KEY || !RESEND_SEGMENT_ID) return res.status(503).json({ error: 'not_configured' });

  try {
    if (req.method === 'GET') {
      const subscribers = [];
      let after = '';
      for (let page = 0; page < MAX_PAGES; page++) {
        const response = await resend(`/segments/${RESEND_SEGMENT_ID}/contacts?limit=100${after && `&after=${after}`}`);
        if (!response.ok) {
          console.error('admin/subscribers: Resend answered', response.status, await response.text());
          return res.status(502).json({ error: 'provider_error' });
        }
        const { data = [], has_more: hasMore } = await response.json();
        subscribers.push(...data.map(c => ({ id: c.id, email: c.email, createdAt: c.created_at, unsubscribed: c.unsubscribed })));
        if (!hasMore || !data.length) break;
        after = data.at(-1).id;
      }
      return res.status(200).json({ subscribers });
    }

    if (req.method === 'POST') {
      const body = readBody(req) ?? {};
      const id = String(body.id ?? '');
      if (body.action !== 'remove' || !/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'invalid_action' });
      const response = await resend(`/contacts/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        console.error('admin/subscribers: Resend answered', response.status, await response.text());
        return res.status(502).json({ error: 'provider_error' });
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    console.error('admin/subscribers:', error);
    return res.status(500).json({ error: 'server_error' });
  }
}
