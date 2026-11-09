import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import type webpush from 'web-push';
import { usePlaceholderEnv } from '../scripts/placeholder-env';

type PushManager = typeof import('../src/lib/push-manager');
let pm: PushManager;
let WebPushError: typeof webpush.WebPushError;
before(async () => {
  usePlaceholderEnv();
  pm = await import('../src/lib/push-manager');
  WebPushError = (await import('web-push')).default.WebPushError;
});

const bytes = (s: string) => new TextEncoder().encode(s).length;
const sub = (i: number): webpush.PushSubscription => ({
  endpoint: `https://push.example/${i}`,
  keys: { p256dh: 'p', auth: 'a' },
});
const post = (body: string) => ({
  title: 'Pendaftaran PIXEL',
  options: { body, data: { url: '/timeline/p1' } },
});

// Regression: a post's whole text went into the push; past ~4 KB every push service refused it (413), so a long
// announcement reached nobody.
test('a long post is cut to fit, ending in "…", with its title and link kept', () => {
  const data = post('Halo semua. '.repeat(2000));
  const fitted = pm.fitPushData(data);
  const json = JSON.stringify(fitted);
  assert.ok(bytes(json) <= pm.MAX_PUSH_PAYLOAD_BYTES, String(bytes(json)));
  assert.ok(bytes(json) > pm.MAX_PUSH_PAYLOAD_BYTES - 40, 'uses the room');
  assert.equal(fitted.title, data.title);
  assert.deepEqual(fitted.options?.data, data.options.data);
  assert.match(fitted.options?.body ?? '', /^Halo semua\. Halo.*…$/s);
});

test('a short push goes out exactly as it was', () => {
  const data = post('Rapat jam 19.00.');
  assert.equal(pm.fitPushData(data), data);
});

test('multi-byte text is never cut inside a character', () => {
  for (const body of [
    'é'.repeat(3000),
    '日本語'.repeat(1000),
    '👍🏽'.repeat(1000),
    '👨‍👩‍👧'.repeat(500),
    '"\n'.repeat(2000),
  ]) {
    const fitted = pm.fitPushData(post(body));
    const out = fitted.options?.body ?? '';
    assert.ok(bytes(JSON.stringify(fitted)) <= pm.MAX_PUSH_PAYLOAD_BYTES);
    assert.ok(out.endsWith('…'));
    assert.ok(body.startsWith(out.slice(0, -1)), 'a clean prefix');
    assert.doesNotMatch(out, /�/);
    // No lone surrogate halves.
    assert.equal(out, Buffer.from(out, 'utf8').toString('utf8'));
  }
});

test('a title too long on its own is cut too', () => {
  const fitted = pm.fitPushData({ title: 'Judul '.repeat(1000) });
  assert.ok(bytes(JSON.stringify(fitted)) <= pm.MAX_PUSH_PAYLOAD_BYTES);
  assert.ok(fitted.title.endsWith('…'));
});

test('every subscription is sent the fitted payload', async () => {
  const sent: string[] = [];
  await pm.sendNotificationToAll([sub(1), sub(2)], post('x'.repeat(10_000)), {
    send: async (_s, payload) => {
      sent.push(String(payload));
      return { statusCode: 201, body: '', headers: {} };
    },
  });
  assert.equal(sent.length, 2);
  for (const p of sent) assert.ok(bytes(p) <= pm.MAX_PUSH_PAYLOAD_BYTES);
});

// Regression: every send started at once (2,000+ devices, each a TLS connection and synchronous encryption).
test('at most 50 pushes are in flight at once, and every one is sent, results in order', async () => {
  let inFlight = 0;
  let peak = 0;
  const subs = Array.from({ length: 400 }, (_, i) => sub(i));
  const results = await pm.sendNotificationToAll(subs, post('x'), {
    send: async (s) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      if (s.endpoint.endsWith('/7')) throw new Error('network');
      return { statusCode: 201, body: s.endpoint, headers: {} };
    },
  });
  assert.equal(pm.PUSH_CONCURRENCY, 50);
  assert.equal(peak, 50);
  assert.equal(results.length, 400);
  assert.equal(results[7].status, 'rejected');
  const r3 = results[3];
  assert.ok(r3.status === 'fulfilled' && r3.value.success);
  assert.equal(
    r3.status === 'fulfilled' && r3.value.success && r3.value.result.body,
    'https://push.example/3',
  );
});

// Regression: web-push had no time limit, so a stalled push service held its share of the fan-out forever.
test('a push service that never answers is given up on after the timeout', async () => {
  const started = Date.now();
  const results = await pm.sendNotificationToAll([sub(1), sub(2)], post('x'), {
    timeoutMs: 100,
    send: async (s, _payload, options) => {
      assert.equal(options?.timeout, 100, 'web-push gets the time limit too');
      if (s.endpoint.endsWith('/1')) return await new Promise(() => {});
      return { statusCode: 201, body: '', headers: {} };
    },
  });
  assert.ok(Date.now() - started < 1000);
  assert.equal(results[0].status, 'rejected');
  assert.match(
    String((results[0] as PromiseRejectedResult).reason),
    /timed out/,
  );
  assert.equal(results[1].status, 'fulfilled');
});

test('a refused push comes back with its endpoint, for pruning', async () => {
  const results = await pm.sendNotificationToAll([sub(1)], post('x'), {
    send: async () => {
      throw new WebPushError('gone', 410, {}, '', 'https://push.example/1');
    },
  });
  const r = results[0];
  assert.ok(r.status === 'fulfilled' && !r.value.success);
  assert.equal(
    r.status === 'fulfilled' && !r.value.success && r.value.endpoint,
    'https://push.example/1',
  );
});

// Regression: only 410 was pruned; a push service answering 404 for an unknown subscription kept it forever.
test('subscriptions answered 404 or 410 are pruned; other failures stay', async () => {
  const { goneEndpoints } = await import('../src/repositories/push.repo');
  const codes = [410, 404, 413, 429, 500];
  const results = await pm.sendNotificationToAll(
    [...codes.map((_, i) => sub(i)), sub(99), sub(100)],
    post('x'),
    {
      send: async (s) => {
        const i = Number(s.endpoint.split('/').pop());
        if (i === 99) return { statusCode: 201, body: '', headers: {} };
        if (i === 100) throw new Error('Socket timeout');
        throw new WebPushError('refused', codes[i], {}, '', s.endpoint);
      },
    },
  );
  assert.deepEqual(goneEndpoints(results), [
    'https://push.example/0',
    'https://push.example/1',
  ]);
});
