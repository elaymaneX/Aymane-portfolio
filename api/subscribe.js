// Newsletter sign-up: adds the email to Resend's contacts, inside the newsletter segment that
// broadcasts are sent to. Resend keeps the list and handles unsubscribe links, so no addresses
// are stored on this site.
// POST /api/subscribe  { email, website }  -> 200 { status: 'subscribed' }
import { clientKey, isAllowedOrigin, readBody, store } from './_lib/comments.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_SEGMENT_ID = process.env.RESEND_SEGMENT_ID;
const PER_MINUTE = 3;
const PER_DAY = 10;
// Deliberately simple: one @, a dot in the domain, no spaces. Resend validates again.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'forbidden' });

  const body = readBody(req);
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'invalid_body' });

  // Honeypot: hidden from people, so only bots fill it in. Answer like a success.
  if (body.website) return res.status(200).json({ status: 'subscribed' });

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL.test(email)) return res.status(400).json({ error: 'invalid_email' });

  try {
    // Same limits as comments when the comments database is configured
    if (store) {
      const client = clientKey(req);
      if ((await store.hit(`ratelimit:subscribe:min:${client}`, 60)) > PER_MINUTE ||
          (await store.hit(`ratelimit:subscribe:day:${client}`, 86400)) > PER_DAY) {
        return res.status(429).json({ error: 'rate_limited' });
      }
    }

    if (!RESEND_API_KEY || !RESEND_SEGMENT_ID) {
      // Local development without Resend keys: accept so the form can be tried out
      if (!process.env.VERCEL) {
        console.info('subscribe (dev, not sent to Resend):', email);
        return res.status(200).json({ status: 'subscribed' });
      }
      return res.status(503).json({ error: 'not_configured' });
    }

    const response = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, unsubscribed: false, segments: [{ id: RESEND_SEGMENT_ID }] }),
    });
    // An address that is already on the list gets the same answer, so the form never reveals who subscribed
    if (!response.ok) {
      const detail = await response.text();
      if (response.status !== 409 && !/already exists/i.test(detail)) {
        console.error('subscribe: Resend answered', response.status, detail);
        return res.status(502).json({ error: 'provider_error' });
      }
    }
    return res.status(200).json({ status: 'subscribed' });
  } catch (error) {
    console.error('subscribe:', error);
    return res.status(500).json({ error: 'server_error' });
  }
}
