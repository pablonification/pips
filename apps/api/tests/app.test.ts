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
