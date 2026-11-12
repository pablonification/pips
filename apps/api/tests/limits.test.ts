import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import { callRouter } from './support/router';
import { sessionCookie, testUser } from './support/session';

const APP = 'http://localhost:5173';
let createApp: typeof import('../src/app').createApp;
let createInfoRouter: typeof import('../src/controllers/info.controller').createInfoRouter;
let createCommentRouter: typeof import('../src/controllers/comment.controller').createCommentRouter;
let createRateLimiter: typeof import('../src/lib/rate-limit').createRateLimiter;
let pickClientAddress: typeof import('../src/lib/rate-limit').pickClientAddress;
let EnvSchema: typeof import('../src/configs/env.schema').EnvSchema;
let CurhatMessagePayloadSchema: typeof import('../src/types/curhat.types').CurhatMessagePayloadSchema;
before(async () => {
  usePlaceholderEnv();
  ({ createApp } = await import('../src/app'));
  ({ createInfoRouter } = await import('../src/controllers/info.controller'));
  ({ createCommentRouter } =
    await import('../src/controllers/comment.controller'));
  ({ createRateLimiter, pickClientAddress } =
    await import('../src/lib/rate-limit'));
  ({ EnvSchema } = await import('../src/configs/env.schema'));
  ({ CurhatMessagePayloadSchema } = await import('../src/types/curhat.types'));
});

const nadia = testUser('u-nadia');
const raka = testUser('u-raka', { nim: '13524001' });

/** Deps that record whether the route got past validation. */
function reached() {
  const calls: string[] = [];
  const deps = new Proxy(
    {},
    {
      get: (_t, name: string) => async (data?: unknown) => {
        calls.push(name);
        if (name === 'getUserRoles') return ['admin'];
        if (name === 'canSeeInfo') return true;
        if (name === 'getCategoriesByIds')
          return [{ id: 'cat-1', rolesAllowed: null }];
        if (name === 'createInfo' || name === 'createComment')
          return { id: 'x', ...(data as object) };
        return undefined;
      },
    },
  );
  return { calls, deps: deps as any };
}

test('a post longer than the composer allows is refused with 400, and nothing is saved', async () => {
  const { calls, deps } = reached();
  const router = createInfoRouter(deps);
  const body = (title: string, content: string) => ({
    title,
    content,
    forCategories: ['cat-1'],
  });
  for (const [title, content] of [
    ['t'.repeat(101), 'isi'],
    ['judul', 'c'.repeat(1001)],
  ]) {
    const res = await callRouter(
      router,
      nadia,
      'POST',
      '/info',
      body(title, content),
    );
    assert.equal(res.status, 400);
  }
  assert.equal(calls.length, 0);
  // At the limits exactly, as the composer allows.
  const ok = await callRouter(
    router,
    nadia,
    'POST',
    '/info',
    body('t'.repeat(100), 'c'.repeat(1000)),
  );
  assert.notEqual(ok.status, 400);
  assert.ok(calls.includes('createInfo'));
});

test('a comment over 2,000 characters is refused, on posting and on editing', async () => {
  const { calls, deps } = reached();
  const router = createCommentRouter(deps);
  const long = 'k'.repeat(2001);
  const res = await callRouter(router, nadia, 'POST', '/comment', {
    content: long,
    repliedInfoId: 'i1',
  });
  assert.equal(res.status, 400);
  const edit = await callRouter(router, nadia, 'PUT', '/comment/c1', {
    content: long,
  });
  assert.equal(edit.status, 400);
  assert.equal(calls.length, 0);
  const ok = await callRouter(router, nadia, 'POST', '/comment', {
    content: 'k'.repeat(2000),
    repliedInfoId: 'i1',
  });
  assert.equal(ok.status, 201);
});

test('a Curhat message over 5,000 characters is invalid', () => {
  const msg = (n: number) => ({ chatroomId: 'r1', message: 'm'.repeat(n) });
  assert.equal(CurhatMessagePayloadSchema.safeParse(msg(5000)).success, true);
  assert.equal(CurhatMessagePayloadSchema.safeParse(msg(5001)).success, false);
});

test('a request body over 1 MiB is refused with 413 before any route reads it', async () => {
  const app = createApp();
  const res = await app.request('/api/info', {
    method: 'POST',
    headers: {
      Origin: APP,
      'Content-Type': 'application/json',
      Cookie: await sessionCookie(nadia),
    },
    body: JSON.stringify({ title: 'x', content: 'y'.repeat(1024 * 1024) }),
  });
  assert.equal(res.status, 413);
});

test('the rate limiter counts per key and per window', () => {
  let t = 0;
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
  assert.equal(limiter.hit('a').ok, true);
  assert.equal(limiter.hit('a').ok, true);
  const third = limiter.hit('a');
  assert.equal(third.ok, false);
  assert.equal(third.retryAfter, 1);
  assert.equal(limiter.hit('b').ok, true);
  t = 1000;
  assert.equal(limiter.hit('a').ok, true);
  // Old windows are swept.
  t = 5000;
  limiter.hit('c');
  assert.equal(limiter.size(), 1);
});

test('writes past the limit get 429 with Retry-After, per member; reads are not counted', async () => {
  const app = createApp({ rateLimits: { writes: 3 } });
  const logout = async (user: typeof nadia) =>
    await app.request('/api/logout', {
      method: 'POST',
      headers: { Origin: APP, Cookie: await sessionCookie(user) },
    });
  for (let i = 0; i < 3; i++) assert.equal((await logout(nadia)).status, 200);
  const limited = await logout(nadia);
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: 'Too many requests' });
  assert.ok(Number(limited.headers.get('retry-after')) >= 1);
  // Another member is unaffected.
  assert.equal((await logout(raka)).status, 200);
  // Reads aren't writes.
  const read = await app.request('/api/open-graph?url=not-an-address', {
    headers: { Cookie: await sessionCookie(nadia) },
  });
  assert.equal(read.status, 400);
});

test("a forged session cannot use up a member's writes", async () => {
  const app = createApp({ rateLimits: { writes: 2 } });
  const forged = await sessionCookie(nadia, 'not-the-secret');
  for (let i = 0; i < 5; i++) {
    await app.request('/api/logout', {
      method: 'POST',
      headers: {
        Origin: APP,
        Cookie: forged,
        'X-Forwarded-For': '203.0.113.9',
      },
    });
  }
  const res = await app.request('/api/logout', {
    method: 'POST',
    headers: { Origin: APP, Cookie: await sessionCookie(nadia) },
  });
  assert.equal(res.status, 200);
});

test('sign-in attempts past the limit get 429, per client address', async () => {
  const app = createApp({ rateLimits: { signIn: 2 } });
  const attempt = async (ip: string) =>
    await app.request('/api/auth/login/accesstoken', {
      method: 'POST',
      headers: {
        Origin: APP,
        'Content-Type': 'application/json',
        'X-Forwarded-For': ip,
      },
      body: JSON.stringify({}),
    });
  assert.equal((await attempt('198.51.100.1')).status, 400);
  assert.equal((await attempt('198.51.100.1')).status, 400);
  assert.equal((await attempt('198.51.100.1')).status, 429);
  assert.equal((await attempt('198.51.100.2')).status, 400);
});

test('regression (review): by default the address is the right-most forwarded one, which the nearest proxy appended', async () => {
  const app = createApp({ rateLimits: { signIn: 2 } });
  const attempt = async (headers: Record<string, string>) =>
    await app.request('/api/auth/login/accesstoken', {
      method: 'POST',
      headers: { Origin: APP, 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({}),
    });
  // A client writing its own addresses in front, or its own Cloudflare header, still meets one counter.
  assert.equal(
    (await attempt({ 'X-Forwarded-For': '1.1.1.1, 198.51.100.7' })).status,
    400,
  );
  assert.equal(
    (
      await attempt({
        'X-Forwarded-For': '2.2.2.2, 198.51.100.7',
        'CF-Connecting-IP': '3.3.3.3',
      })
    ).status,
    400,
  );
  assert.equal(
    (await attempt({ 'X-Forwarded-For': '4.4.4.4,198.51.100.7' })).status,
    429,
  );
});

test('the trusted source of the client address is a setting', () => {
  const headers =
    (h: Record<string, string | undefined>) =>
    (name: string): string | undefined =>
      h[name];
  const connection = () => '10.0.0.5';
  const both = headers({
    'cf-connecting-ip': '203.0.113.5',
    'x-forwarded-for': '1.1.1.1, 198.51.100.7',
  });
  assert.equal(
    pickClientAddress(both, 'x-forwarded-for', connection),
    '198.51.100.7',
  );
  assert.equal(
    pickClientAddress(both, 'cf-connecting-ip', connection),
    '203.0.113.5',
  );
  assert.equal(pickClientAddress(both, 'none', connection), '10.0.0.5');
  // The header missing, empty or not an address: the connection's address.
  for (const h of [
    {},
    { 'x-forwarded-for': ' , ' },
    { 'x-forwarded-for': 'evil' },
  ])
    assert.equal(
      pickClientAddress(headers(h), 'x-forwarded-for', connection),
      '10.0.0.5',
    );
  assert.equal(
    pickClientAddress(headers({}), 'cf-connecting-ip', () => undefined),
    'unknown',
  );
});

test('CLIENT_IP_HEADER: the three values, the right-most forwarded address by default, and never a crash', () => {
  const parse = (v?: string) =>
    EnvSchema.shape.CLIENT_IP_HEADER.parse(v) as string;
  assert.equal(parse(undefined), 'x-forwarded-for');
  assert.equal(parse('CF-Connecting-IP'), 'cf-connecting-ip');
  assert.equal(parse('none'), 'none');
  assert.equal(parse('x-real-ip'), 'x-forwarded-for');
});

test('regression (review): the limiter keeps at most maxKeys counters, however many addresses it meets', () => {
  let t = 0;
  const limiter = createRateLimiter({
    limit: 2,
    windowMs: 60_000,
    maxKeys: 3,
    now: () => t,
  });
  for (let i = 0; i < 1000; i++) {
    t += 1;
    limiter.hit(`k${i}`);
  }
  assert.ok(limiter.size() <= 3, String(limiter.size()));
  // The newest keys are still counted.
  assert.equal(limiter.hit('k999').ok, true);
  assert.equal(limiter.hit('k999').ok, false);
});
