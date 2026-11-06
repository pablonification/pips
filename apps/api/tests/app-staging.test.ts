import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';

// Staging with a strong bypass key: the route exists, checks its key, and its key never reaches the request log.
const KEY = 's'.repeat(40);
let app: Awaited<ReturnType<typeof load>>['app'];
let logger: Awaited<ReturnType<typeof load>>['logger'];
async function load() {
  usePlaceholderEnv({ APP_ENV: 'staging', LOGIN_BYPASS_KEY: KEY });
  const { createApp } = await import('../src/app');
  const { logger } = await import('../src/logger');
  return { app: createApp(), logger };
}
before(async () => {
  ({ app, logger } = await load());
});

/** Every request-log entry written while `run` runs. */
async function logged(run: () => Promise<unknown>) {
  const entries: unknown[] = [];
  const original = logger.info.bind(logger);
  (logger as any).info = (entry: unknown) => {
    entries.push(entry);
    return logger;
  };
  try {
    await run();
  } finally {
    (logger as any).info = original;
  }
  return entries;
}

test('staging refuses a wrong bypass key with 401 and no session', async () => {
  for (const token of ['default-bypass-key', KEY.slice(1), `${KEY}s`]) {
    const res = await app.request(
      `/api/auth/login/bypass?token=${token}&nim=13525001`,
    );
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: 'Invalid token' });
    assert.equal(res.headers.get('set-cookie'), null);
  }
});

test('staging accepts the right key (then looks the member up, which this test has no database for)', async () => {
  const res = await app.request(
    `/api/auth/login/bypass?token=${KEY}&nim=13525001`,
  );
  // Past the key check: the lookup fails without a database, as a generic 500.
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: 'Something went wrong' });
});

test('the request log never keeps the bypass key or an OAuth code', async () => {
  const entries = await logged(async () => {
    await app.request(`/api/auth/login/bypass?token=${KEY}&nim=13525001`);
    await app.request('/api/me?code=secret-oauth-code&state=s1');
  });
  const text = JSON.stringify(entries);
  assert.ok(entries.length >= 2);
  assert.doesNotMatch(text, new RegExp(KEY));
  assert.doesNotMatch(text, /secret-oauth-code/);
  assert.match(text, /nim=13525001/);
  assert.match(text, /token=redacted/);
});

test('staging serves the OpenAPI document, listing the bypass', async () => {
  const res = await app.request('/doc');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /login\/bypass/);
  assert.equal((await app.request('/swagger')).status, 200);
});
