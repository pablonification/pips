import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ApiError } from '../src/api/generated';
import {
  isSignedOutError,
  sessionRetry,
  sessionRetryDelay,
} from '../src/lib/session-policy';

const apiError = (status: number) =>
  new ApiError(
    { method: 'GET', url: '/api/me' },
    { url: '/api/me', ok: false, status, statusText: '', body: {} },
    'error',
  );

// Regression: the session check used `getMe().catch(() => null)`, so a dropped request, a 503 or being offline
// signed members out. Only a 401 may.
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
