// Passkeys (Face ID, Touch ID, security keys) for the admin account.
// GET  /api/admin/passkey                                   -> { passkeys: [{ id, name, createdAt }] }  signed in
// POST /api/admin/passkey { action: 'register-options' }    -> registration options        signed in
//                         { action: 'register-verify', response, name }                    signed in
//                         { action: 'login-options' }       -> authentication options
//                         { action: 'login-verify', response }  -> starts a session
//                         { action: 'delete', id }                                         signed in
import {
  generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import {
  challengeKey, getUser, guard, isSignedIn, listPasskeys, recordFailedSignIn, relyingParty,
  removePasskey, savePasskey, signInBlocked, startSession,
} from '../_lib/admin.js';
import { readBody, store } from '../_lib/comments.js';

const CHALLENGE_SECONDS = 300;
const toBase64Url = bytes => Buffer.from(bytes).toString('base64url');
const fromBase64Url = text => new Uint8Array(Buffer.from(text, 'base64url'));

export default async function handler(req, res) {
  if (!(await guard(req, res, { signedIn: false }))) return;

  try {
    const signedIn = await isSignedIn(req);

    if (req.method === 'GET') {
      if (!signedIn) return res.status(401).json({ error: 'unauthorized' });
      const passkeys = (await listPasskeys()).map(({ id, name, createdAt }) => ({ id, name, createdAt }));
      return res.status(200).json({ passkeys });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const body = readBody(req) ?? {};
    const user = await getUser();
    if (!user) return res.status(409).json({ error: 'needs_setup' });
    const { origin, rpID } = relyingParty(req);

    // Adding and removing passkeys needs a signed-in session
    if (body.action === 'register-options' || body.action === 'register-verify' || body.action === 'delete') {
      if (!signedIn) return res.status(401).json({ error: 'unauthorized' });
    }

    if (body.action === 'register-options') {
      const existing = await listPasskeys();
      const options = await generateRegistrationOptions({
        rpName: 'Aymane · Admin',
        rpID,
        userName: user.username,
        userID: new TextEncoder().encode(user.id),
        attestationType: 'none',
        excludeCredentials: existing.map(({ id, transports }) => ({ id, transports })),
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      });
      await store.set(challengeKey('register', req), options.challenge, CHALLENGE_SECONDS);
      return res.status(200).json(options);
    }

    if (body.action === 'register-verify') {
      const expectedChallenge = await store.get(challengeKey('register', req));
      if (!expectedChallenge) return res.status(400).json({ error: 'challenge_expired' });
      await store.del(challengeKey('register', req));
      const { verified, registrationInfo } = await verifyRegistrationResponse({
        response: body.response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID,
      });
      if (!verified) return res.status(400).json({ error: 'not_verified' });
      const { credential } = registrationInfo;
      const name = String(body.name ?? '').trim().slice(0, 40) || 'Passkey';
      await savePasskey({
        id: credential.id,
        publicKey: toBase64Url(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? [],
        name,
        createdAt: new Date().toISOString(),
      });
      return res.status(201).json({ ok: true });
    }

    if (body.action === 'login-options') {
      if (await signInBlocked(req)) return res.status(429).json({ error: 'rate_limited' });
      const passkeys = await listPasskeys();
      if (!passkeys.length) return res.status(404).json({ error: 'no_passkeys' });
      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: passkeys.map(({ id, transports }) => ({ id, transports })),
        userVerification: 'preferred',
      });
      await store.set(challengeKey('login', req), options.challenge, CHALLENGE_SECONDS);
      return res.status(200).json(options);
    }

    if (body.action === 'login-verify') {
      if (await signInBlocked(req)) return res.status(429).json({ error: 'rate_limited' });
      const expectedChallenge = await store.get(challengeKey('login', req));
      if (!expectedChallenge) return res.status(400).json({ error: 'challenge_expired' });
      await store.del(challengeKey('login', req));
      const passkey = (await listPasskeys()).find(item => item.id === body.response?.id);
      if (!passkey) {
        await recordFailedSignIn(req);
        return res.status(401).json({ error: 'unknown_passkey' });
      }
      const { verified, authenticationInfo } = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: { id: passkey.id, publicKey: fromBase64Url(passkey.publicKey), counter: passkey.counter, transports: passkey.transports },
      });
      if (!verified) {
        await recordFailedSignIn(req);
        return res.status(401).json({ error: 'not_verified' });
      }
      await savePasskey({ ...passkey, counter: authenticationInfo.newCounter, lastUsedAt: new Date().toISOString() });
      await startSession(res);
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'delete') {
      await removePasskey(String(body.id ?? ''));
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'invalid_action' });
  } catch (error) {
    console.error('admin/passkey:', error);
    return res.status(400).json({ error: 'passkey_failed' });
  }
}
