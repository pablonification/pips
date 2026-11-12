import { strict as assert } from 'node:assert';
import { afterEach, test } from 'node:test';
import { ApiClient, ApiError } from '../src/api/generated';
import {
  REQUEST_TIMEOUT_MS,
  RequestTimeoutError,
  timedHttpRequest,
} from '../src/api/timed-request';

/*
 * Every API request has a time limit (web-robust 1): on a stalled network or a hung API a request used to wait for
 * the browser to give up, often minutes, with the screen's button stuck on "Mengirim…". Runs the generated client
 * on a fake `fetch` that never answers until it is aborted.
 */

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** A fetch that never answers; it records whether the request was aborted. */
function hangingFetch() {
  const seen = { aborted: false, calls: 0 };
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    seen.calls++;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        seen.aborted = true;
        reject(new DOMException('aborted', 'AbortError'));
      });
    });
  }) as typeof fetch;
  return seen;
}

const client = (ms?: number) =>
  new ApiClient({ BASE: 'https://api.test' }, timedHttpRequest(ms));

test('the limit is between 20 and 30 seconds', () => {
  assert.ok(REQUEST_TIMEOUT_MS >= 20_000 && REQUEST_TIMEOUT_MS <= 30_000);
});

test('a request with no answer fails with RequestTimeoutError and aborts its fetch', async () => {
  const seen = hangingFetch();
  const started = Date.now();
  await assert.rejects(client(50).auth.logout(), (e: unknown) => {
    assert.ok(e instanceof RequestTimeoutError);
    assert.ok(!(e instanceof ApiError));
    return true;
  });
  assert.ok(Date.now() - started < 2_000);
  assert.equal(seen.calls, 1);
  assert.equal(seen.aborted, true);
});

test('an answer in time resolves as before, and an HTTP error is still an ApiError', async () => {
  let status = 200;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: true }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
  assert.deepEqual(await client(1_000).auth.logout(), { ok: true });
  status = 401;
  await assert.rejects(
    client(1_000).auth.logout(),
    (e: unknown) => e instanceof ApiError && e.status === 401,
  );
});

test('a slow body counts against the limit too', async () => {
  globalThis.fetch = ((_url: string, init?: RequestInit) =>
    Promise.resolve(
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode('{"ok":'));
            init?.signal?.addEventListener('abort', () =>
              c.error(new DOMException('aborted', 'AbortError')),
            );
          },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    )) as typeof fetch;
  await assert.rejects(
    client(50).auth.logout(),
    (e: unknown) => e instanceof RequestTimeoutError,
  );
});

test('cancelling still cancels, and clears the time limit', async () => {
  const seen = hangingFetch();
  const p = client(50).auth.logout();
  await new Promise((r) => setTimeout(r, 5));
  p.cancel();
  await assert.rejects(p, (e: unknown) => (e as Error).name === 'CancelError');
  assert.equal(seen.aborted, true);
  // Nothing fires after the limit would have passed.
  await new Promise((r) => setTimeout(r, 80));
});

test("the app's client sends an id as one part of the path", async () => {
  // An id from the address bar is any text; `/` or `?` in it must not reach another route.
  const { api } = await import('../src/api/client');
  const urls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    urls.push(String(url));
    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  await api.info.getInfoById({ infoId: '../me?' });
  assert.deepEqual(urls, ['/api/info/..%2Fme%3F']);
});
