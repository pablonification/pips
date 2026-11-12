import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';

// The app is built without a server or database: settings are placeholders and nothing here queries the database.
let app: Awaited<ReturnType<typeof load>>['app'];
let openApiDocument: Awaited<ReturnType<typeof load>>['openApiDocument'];
async function load() {
  usePlaceholderEnv();
  const { createApp, openApiDocument } = await import('../src/app');
  return { app: createApp(), openApiDocument };
}
before(async () => {
  ({ app, openApiDocument } = await load());
});

test('the app answers without a server or database', async () => {
  const res = await app.request('/');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { message: 'Server runs successfully' });
});

test('signed-out requests are refused before any database call', async () => {
  for (const path of ['/api/me', '/api/calendar/me', '/api/info']) {
    const res = await app.request(path);
    assert.equal(res.status, 401, path);
  }
});

test('a signed session whose content no longer fits answers 401 and clears the cookie', async () => {
  const { sessionCookie, testUser } = await import('./support/session');
  const stale = testUser('u-nadia', { angkatan: 'x' as unknown as number });
  for (const path of ['/api/me', '/api/info']) {
    const res = await app.request(path, {
      headers: { Cookie: await sessionCookie(stale) },
    });
    assert.equal(res.status, 401, path);
    assert.match(
      res.headers.get('set-cookie') ?? '',
      /hmif-app\.access-cookie=;.*Max-Age=0/,
      path,
    );
  }
});

test('the OpenAPI document lists the API and is the same whenever it is generated', async () => {
  const doc = JSON.parse(JSON.stringify(openApiDocument(app))) as {
    paths: Record<string, unknown>;
  };
  assert.ok('/api/me' in doc.paths);
  assert.ok('/api/calendar/me' in doc.paths);
  // No default that depends on the date (see calendar-params.test.ts): the generated client must not change by month.
  assert.doesNotMatch(
    JSON.stringify(doc.paths['/api/calendar/me']),
    /"default"/,
  );
});

test('/health: 200 while the database answers, 503 when it fails or hangs', async () => {
  const { createApp } = await import('../src/app');
  const up = createApp({ checkDatabase: async () => [{ '?column?': 1 }] });
  const ok = await up.request('/health');
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { status: 'ok', database: 'ok' });

  const down = createApp({
    checkDatabase: async () => {
      throw new Error('connect ECONNREFUSED');
    },
  });
  const refused = await down.request('/health');
  assert.equal(refused.status, 503);
  assert.deepEqual(await refused.json(), {
    status: 'unavailable',
    database: 'unreachable',
  });

  const stuck = createApp({
    checkDatabase: async () => await new Promise(() => {}),
  });
  const started = Date.now();
  assert.equal((await stuck.request('/health')).status, 503);
  assert.ok(Date.now() - started < 3000, 'gives up after 2 s');
});
