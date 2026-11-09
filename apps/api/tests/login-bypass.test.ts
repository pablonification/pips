import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import {
  bypassTokenMatches,
  isLoginBypassEnabled,
} from '../src/lib/login-bypass';

// Production, even with a strong bypass key set: the route must not exist and no document may list it.
const KEY = 'k'.repeat(48);
let app: Awaited<ReturnType<typeof load>>['app'];
let openApiDocument: Awaited<ReturnType<typeof load>>['openApiDocument'];
async function load() {
  usePlaceholderEnv({ APP_ENV: 'production', LOGIN_BYPASS_KEY: KEY });
  const { createApp, openApiDocument } = await import('../src/app');
  return { app: createApp(), openApiDocument };
}
before(async () => {
  ({ app, openApiDocument } = await load());
});

test('the bypass is on only for development or staging with a key of at least 32 characters', () => {
  const strong = 'x'.repeat(32);
  assert.equal(
    isLoginBypassEnabled({ APP_ENV: 'staging', LOGIN_BYPASS_KEY: strong }),
    true,
  );
  assert.equal(
    isLoginBypassEnabled({ APP_ENV: 'development', LOGIN_BYPASS_KEY: strong }),
    true,
  );
  assert.equal(
    isLoginBypassEnabled({ APP_ENV: 'production', LOGIN_BYPASS_KEY: strong }),
    false,
  );
  assert.equal(
    isLoginBypassEnabled({ APP_ENV: 'prod', LOGIN_BYPASS_KEY: strong }),
    false,
  );
  assert.equal(
    isLoginBypassEnabled({
      APP_ENV: 'staging',
      LOGIN_BYPASS_KEY: 'x'.repeat(31),
    }),
    false,
  );
  // The old default key, and no key at all.
  assert.equal(
    isLoginBypassEnabled({
      APP_ENV: 'staging',
      LOGIN_BYPASS_KEY: 'default-bypass-key',
    }),
    false,
  );
  assert.equal(isLoginBypassEnabled({ APP_ENV: 'staging' }), false);
});

test('the bypass token must match the key exactly', () => {
  assert.equal(bypassTokenMatches(KEY, KEY), true);
  assert.equal(bypassTokenMatches(KEY.slice(1), KEY), false);
  assert.equal(bypassTokenMatches(`${KEY}x`, KEY), false);
  assert.equal(bypassTokenMatches('', KEY), false);
});

test('production has no bypass route, whatever key is set', async () => {
  for (const token of [KEY, 'default-bypass-key']) {
    const res = await app.request(
      `/api/auth/login/bypass?token=${token}&nim=13525001`,
    );
    // Unknown /api routes fall through to the signed-in routes, which answer 401 before anything else.
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('set-cookie'), null);
    assert.doesNotMatch(await res.text(), /User not found|Invalid token/);
  }
  const doc = JSON.stringify(openApiDocument(app));
  assert.doesNotMatch(doc, /login\/bypass/);
});

test('production serves neither the OpenAPI document nor its viewer', async () => {
  assert.equal((await app.request('/doc')).status, 404);
  assert.equal((await app.request('/swagger')).status, 404);
});
