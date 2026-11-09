import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';

// Google is never called: fetch is faked. The placeholder GOOGLE_CLIENT_ID is 'placeholder'.
let lib: typeof import('../src/lib/google-token');
let createApp: typeof import('../src/app').createApp;
let sessionCookieOptions: typeof import('../src/lib/session-cookie').sessionCookieOptions;
const realFetch = globalThis.fetch;
before(async () => {
  usePlaceholderEnv();
  lib = await import('../src/lib/google-token');
  ({ createApp } = await import('../src/app'));
  ({ sessionCookieOptions } = await import('../src/lib/session-cookie'));
});
after(() => {
  globalThis.fetch = realFetch;
});

const USER = {
  id: 'g1',
  name: 'Nadia',
  email: '13525001@std.stei.itb.ac.id',
  picture: 'https://x/p.jpg',
};

/** A fake Google: tokeninfo answers `info` (or 400 when null); userinfo answers USER. */
function google(info: Record<string, unknown> | null) {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url.split('?')[0]);
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      return info
        ? new Response(JSON.stringify(info), { status: 200 })
        : new Response('{"error":"invalid_token"}', { status: 400 });
    }
    if (url === 'https://www.googleapis.com/oauth2/v2/userinfo') {
      return new Response(JSON.stringify(USER), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
  return { impl, calls };
}

test('a token issued to PIPS! gives its Google account', async () => {
  for (const info of [
    { aud: 'pips-client', azp: 'pips-client', expires_in: '3599' },
    { aud: 'other', azp: 'pips-client', expires_in: 10 },
  ]) {
    const g = google(info);
    const user = await lib.googleUserFromAccessToken(
      'tok',
      ['pips-client'],
      g.impl,
    );
    assert.equal(user.email, USER.email);
    assert.deepEqual(g.calls, [
      'https://oauth2.googleapis.com/tokeninfo',
      'https://www.googleapis.com/oauth2/v2/userinfo',
    ]);
  }
});

test("another site's token, an expired one or one Google rejects is refused before reading the account", async () => {
  for (const info of [
    { aud: 'evil-client', azp: 'evil-client', expires_in: '3599' },
    { expires_in: '3599' },
    { aud: 'pips-client', azp: 'pips-client', expires_in: '0' },
    null,
  ]) {
    const g = google(info);
    await assert.rejects(
      lib.googleUserFromAccessToken('tok', ['pips-client'], g.impl),
      lib.InvalidGoogleTokenError,
      JSON.stringify(info),
    );
    assert.deepEqual(g.calls, ['https://oauth2.googleapis.com/tokeninfo']);
  }
});

test('extra client ids come from GOOGLE_ALLOWED_CLIENT_IDS', () => {
  assert.deepEqual(lib.allowedGoogleClientIds({ GOOGLE_CLIENT_ID: 'a' }), [
    'a',
  ]);
  assert.deepEqual(
    lib.allowedGoogleClientIds({
      GOOGLE_CLIENT_ID: 'a',
      GOOGLE_ALLOWED_CLIENT_IDS: ' b, ,c ',
    }),
    ['a', 'b', 'c'],
  );
});

test("sign-in with another client's token answers 401, sets no session and reads no member", async () => {
  const g = google({
    aud: 'evil-client',
    azp: 'evil-client',
    expires_in: '3599',
  });
  globalThis.fetch = g.impl;
  try {
    const res = await createApp().request('/api/auth/login/accesstoken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({ accessToken: 'tok' }),
    });
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: 'Invalid Google token' });
    assert.equal(res.headers.get('set-cookie'), null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('the session cookie is SameSite=Lax, Secure and HttpOnly', () => {
  const o = sessionCookieOptions();
  assert.equal(o.sameSite, 'Lax');
  assert.equal(o.secure, true);
  assert.equal(o.httpOnly, true);
});
