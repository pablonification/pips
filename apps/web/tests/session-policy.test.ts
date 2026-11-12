import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ApiError } from '../src/api/generated';
import {
  isSignedOutError,
  sessionSettled,
  sessionRetry,
  sessionRetryDelay,
} from '../src/lib/session-policy';

const apiError = (status: number) =>
  new ApiError(
    { method: 'GET', url: '/api/me' },
    { url: '/api/me', ok: false, status, statusText: '', body: {} },
    'error',
  );

// The session check must not sign members out on a dropped request, a 503 or being offline (as
// `getMe().catch(() => null)` would). Only a 401 may.
test('only a 401 from the session check means signed out', () => {
  assert.equal(isSignedOutError(apiError(401)), true);
  for (const status of [400, 403, 404, 500, 502, 503, 504]) {
    assert.equal(isSignedOutError(apiError(status)), false, String(status));
  }
  assert.equal(isSignedOutError(new TypeError('Failed to fetch')), false);
  assert.equal(
    isSignedOutError(new DOMException('aborted', 'AbortError')),
    false,
  );
  assert.equal(isSignedOutError(undefined), false);
});

test('everything but a 401 is retried, with backoff up to 30 s', () => {
  assert.equal(sessionRetry(0, apiError(401)), false);
  assert.equal(sessionRetry(0, apiError(503)), true);
  assert.equal(sessionRetry(25, new TypeError('Failed to fetch')), true);
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 20].map(sessionRetryDelay),
    [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000],
  );
});

// A session that ended while the app was open: only the session check signs out, so a 401 from any other request
// asks it again, once for a burst of them; its answer decides.
test('a 401 from another request asks the session check again, once per burst', async () => {
  const { createSignedOutRecheck } = await import('../src/lib/session-policy');
  let now = 0;
  let checks = 0;
  let finish = () => {};
  const onError = createSignedOutRecheck({
    recheck: () => {
      checks++;
      return new Promise<void>((resolve) => (finish = resolve));
    },
    now: () => now,
  });
  onError(apiError(500));
  onError(new Error('offline'));
  assert.equal(checks, 0, 'only a 401');
  onError(apiError(401));
  onError(apiError(401));
  onError(apiError(401));
  assert.equal(checks, 1, 'one check while it is on its way');
  finish();
  await Promise.resolve();
  await Promise.resolve();
  now += 500;
  onError(apiError(401));
  assert.equal(checks, 1, 'a late 401 of the same burst asks nothing');
  now += 5_000;
  onError(apiError(401));
  assert.equal(checks, 2, 'a later 401 asks again');
});

test('a session check that fails to answer throws nothing, and its burst still asks once', async () => {
  const { createSignedOutRecheck } = await import('../src/lib/session-policy');
  let checks = 0;
  const onError = createSignedOutRecheck({
    recheck: () => {
      checks++;
      return Promise.reject(new Error('offline'));
    },
    now: () => 0,
  });
  onError(apiError(401));
  await new Promise((r) => setTimeout(r, 0));
  onError(apiError(401));
  assert.equal(checks, 1);
});

test('the session check is settled once it answered, failed once, or waits offline; not while its first try is on its way', () => {
  const q = {
    isFetchedAfterMount: false,
    isFetching: true,
    failureCount: 0,
    fetchStatus: 'fetching' as const,
  };
  assert.equal(sessionSettled(q), false, 'on its way');
  assert.equal(
    sessionSettled({
      ...q,
      isFetchedAfterMount: true,
      isFetching: false,
      fetchStatus: 'idle',
    }),
    true,
    'answered',
  );
  assert.equal(
    sessionSettled({ ...q, isFetchedAfterMount: true }),
    false,
    'asked again (a role check), on its way',
  );
  assert.equal(
    sessionSettled({ ...q, failureCount: 1 }),
    true,
    'the API down: retrying',
  );
  assert.equal(
    sessionSettled({ ...q, isFetching: false, fetchStatus: 'paused' }),
    true,
    'offline',
  );
});
