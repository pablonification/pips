import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';

// The Google redirect sign-in (`/api/login` → Google → `/api/auth/google/callback`). Google is never called.
let createApp: typeof import('../src/app').createApp;
const realFetch = globalThis.fetch;
let fetched: string[] = [];
before(async () => {
  usePlaceholderEnv();
  ({ createApp } = await import('../src/app'));
  globalThis.fetch = (async (input: string | URL | Request) => {
    fetched.push(String(input));
    return new Response('{}', { status: 500 });
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

async function start() {
  const res = await createApp().request('/api/login');
  assert.equal(res.status, 302);
  const state = new URL(res.headers.get('location')!).searchParams.get('state');
  const cookie = res.headers.get('set-cookie') ?? '';
  assert.ok(state && state.length >= 32);
  assert.match(cookie, /hmif-app\.oauth-state=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  return { state, cookie: cookie.split(';')[0] };
}

test("a callback without this browser's state is refused before Google is asked for anything", async () => {
  const { state, cookie } = await start();
  const app = createApp();
  for (const [path, headers] of [
    ['/api/auth/google/callback?code=c1', { Cookie: cookie }], // no state
    [`/api/auth/google/callback?code=c1&state=${state}`, {}], // another browser (no cookie)
    ['/api/auth/google/callback?code=c1&state=forged', { Cookie: cookie }],
  ] as const) {
    fetched = [];
    const res = await app.request(path, { headers });
    assert.equal(res.status, 400, path);
    assert.deepEqual(await res.json(), { error: 'Invalid sign-in state' });
    assert.deepEqual(fetched, []);
  }
});

test('the matching state goes on to Google', async () => {
  const { state, cookie } = await start();
  fetched = [];
  await createApp().request(
    `/api/auth/google/callback?code=c1&state=${state}`,
    {
      headers: { Cookie: cookie },
    },
  );
  assert.equal(fetched[0], 'https://accounts.google.com/o/oauth2/token');
});
