/**
 * The mock layer's guard, tested on itself: what reaches no handler is aborted and reported, writes need the
 * test's own handler, and third-party requests never leave the browser.
 */
import { reply } from '../support/mock';
import { expect, test } from '../support/test';

/** Runs in the page: the response status, or 'network error' when the request was aborted. */
const fetchStatus = ([path, init]: [string, RequestInit?]) =>
  fetch(path, init).then(
    (r) => r.status,
    () => 'network error',
  );

test('a request with no handler is aborted and fails the test with its method and path', async ({
  page,
  api,
}) => {
  await page.goto('/home');
  const status = await page.evaluate(fetchStatus, [
    '/api/not-a-real-endpoint?x=1',
  ]);
  expect(status).toBe('network error');
  expect(api.problems).toEqual([
    'GET /api/not-a-real-endpoint?x=1: no handler',
  ]);
  api.problems.length = 0; // handled here, so the guard's own check after the test passes
});

test('a write is aborted unless the test registered a handler for it', async ({
  page,
  api,
}) => {
  await page.goto('/home');
  const status = await page.evaluate(fetchStatus, [
    '/api/info',
    { method: 'POST', body: '{}' },
  ]);
  expect(status).toBe('network error');
  expect(api.problems).toHaveLength(1);
  expect(api.problems[0]).toMatch(/^POST \/api\/info: a write with no handler/);
  expect(api.writes.map((w) => `${w.method} ${w.path} ${w.outcome}`)).toEqual([
    'POST /api/info unmocked-write',
  ]);
  api.problems.length = 0;

  api.on('POST /api/info', reply.json({ id: 'new' }, 201));
  const ok = await page.evaluate(fetchStatus, [
    '/api/info',
    { method: 'POST', body: '{}' },
  ]);
  expect(ok).toBe(201);
  expect(api.problems).toEqual([]);
});

test('defaults never answer writes, even where a GET default exists', async ({
  page,
  api,
}) => {
  await page.goto('/home');
  const status = await page.evaluate(fetchStatus, [
    '/api/me',
    { method: 'DELETE' },
  ]);
  expect(status).toBe('network error');
  expect(api.problems).toHaveLength(1);
  api.problems.length = 0;
});

test('third-party requests are blocked and recorded, not sent', async ({
  page,
  api,
}) => {
  await page.goto('/home');
  const status = await page.evaluate(fetchStatus, [
    'https://www.google-analytics.com/collect?v=2',
  ]);
  expect(status).toBe('network error');
  expect(api.blocked.map((r) => r.path)).toContain(
    'https://www.google-analytics.com/collect',
  );
  expect(api.problems).toEqual([]);
});

test('overrides answer with errors, delays and empty lists', async ({
  page,
  api,
}) => {
  api
    .on('GET /api/calendar/me', reply.status(503))
    .on('GET /api/user/nim', reply.delay(300, []))
    .on('GET /api/form', { forms: [] });
  await page.goto('/home');
  expect(
    await page.evaluate(fetchStatus, ['/api/calendar/me?month=10&year=2026']),
  ).toBe(503);
  const started = Date.now();
  expect(
    await page.evaluate(() =>
      fetch('/api/user/nim?search=Raka').then((r) => r.json()),
    ),
  ).toEqual([]);
  expect(Date.now() - started).toBeGreaterThanOrEqual(250);
  expect(
    await page.evaluate(() => fetch('/api/form').then((r) => r.json())),
  ).toEqual({ forms: [] });
});

test('the browser can be taken offline', async ({ page, api }) => {
  await page.goto('/home');
  await api.setOffline(true);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  expect(await page.evaluate(fetchStatus, ['/api/me'])).toBe('network error');
  await api.setOffline(false);
  expect(await page.evaluate(fetchStatus, ['/api/me'])).toBe(200);
  expect(api.problems).toEqual([]);
});
