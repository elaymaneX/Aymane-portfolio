// Admin sign-in state.
// GET  /api/admin/session -> { needsSetup, signedIn, username?, passkeys? }
// POST /api/admin/session { action: 'setup', setupToken, username, password }   first and only sign-up
//                         { action: 'login', username, password }
//                         { action: 'logout' }
//                         { action: 'password', current, next }                  signed in only
import {
  MIN_PASSWORD, SETUP_TOKEN, checkPassword, endSession, getUser, guard, hashPassword, isSignedIn,
  listPasskeys, newUser, recordFailedSignIn, sameSecret, saveUser, signInBlocked, startSession,
} from '../_lib/admin.js';
import { readBody } from '../_lib/comments.js';

const USERNAME = /^[a-z0-9._-]{3,40}$/;
const validPassword = value => typeof value === 'string' && value.length >= MIN_PASSWORD && value.length <= 200;

export default async function handler(req, res) {
  if (!(await guard(req, res, { signedIn: false }))) return;

  try {
    if (req.method === 'GET') {
      const user = await getUser();
      const signedIn = Boolean(user) && (await isSignedIn(req));
      return res.status(200).json({
        needsSetup: !user,
        signedIn,
        ...(signedIn && { username: user.username, passkeys: (await listPasskeys()).length }),
      });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const body = readBody(req) ?? {};
    const user = await getUser();

    if (body.action === 'setup') {
      if (user) return res.status(409).json({ error: 'already_set_up' });
      if (SETUP_TOKEN.length < 32) return res.status(503).json({ error: 'setup_disabled' });
      if (await signInBlocked(req)) return res.status(429).json({ error: 'rate_limited' });
      if (!sameSecret(body.setupToken ?? '', SETUP_TOKEN)) {
        await recordFailedSignIn(req);
        return res.status(401).json({ error: 'invalid_setup_token' });
      }
      const username = String(body.username ?? '').trim().toLowerCase();
      if (!USERNAME.test(username)) return res.status(400).json({ error: 'invalid_username' });
      if (!validPassword(body.password)) return res.status(400).json({ error: 'weak_password' });
      await saveUser(await newUser(username, body.password));
      await startSession(res);
      return res.status(201).json({ ok: true });
    }

    if (body.action === 'login') {
      if (!user) return res.status(409).json({ error: 'needs_setup' });
      if (await signInBlocked(req)) return res.status(429).json({ error: 'rate_limited' });
      const username = String(body.username ?? '').trim().toLowerCase();
      // Always run the password check so a wrong username takes as long as a wrong password
      const passwordOk = await checkPassword(String(body.password ?? ''), user.password);
      if (!passwordOk || !sameSecret(username, user.username)) {
        await recordFailedSignIn(req);
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      await startSession(res);
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'logout') {
      await endSession(req, res);
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'password') {
      if (!user || !(await isSignedIn(req))) return res.status(401).json({ error: 'unauthorized' });
      if (!(await checkPassword(String(body.current ?? ''), user.password))) {
        await recordFailedSignIn(req);
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      if (!validPassword(body.next)) return res.status(400).json({ error: 'weak_password' });
      await saveUser({ ...user, password: await hashPassword(body.next) });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'invalid_action' });
  } catch (error) {
    console.error('admin/session:', error);
    return res.status(500).json({ error: 'server_error' });
  }
}
