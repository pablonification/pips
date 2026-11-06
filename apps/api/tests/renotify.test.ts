import { strict as assert } from 'node:assert';
import { after, before, mock, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import {
  canRenotify,
  DEFAULT_RENOTIFY_HOURS,
  renotifyAvailableAt,
} from '../src/lib/renotify';
import type { InfoDeps } from '../src/controllers/info.controller';
import { callRouter } from './support/router';
import { testUser } from './support/session';

// 12.30 WIB; the prototype says "Bisa lagi mulai 15.30".
const sent = new Date('2026-10-08T05:30:00.000Z');
const plus = (h: number, m = 0) =>
  new Date(sent.getTime() + (h * 60 + m) * 60_000);

test('Umumkan ulang unlocks once three hours have passed', () => {
  assert.equal(DEFAULT_RENOTIFY_HOURS, 3);
  assert.equal(canRenotify(sent, plus(2, 59)), false);
  assert.equal(canRenotify(sent, new Date(plus(3).getTime() - 1)), false);
  assert.equal(canRenotify(sent, plus(3)), true);
  assert.equal(canRenotify(sent, plus(26)), true);
  assert.equal(
    renotifyAvailableAt(sent).toISOString(),
    '2026-10-08T08:30:00.000Z',
  );
});

// Regression: `dayjs().diff(lastNotifiedAt, 'hour') > 3` counted whole hours, so it stayed locked until 4 h.
test('3 h 0 min and 3 h 59 min are open', () => {
  assert.equal(canRenotify(sent, plus(3, 0)), true);
  assert.equal(canRenotify(sent, plus(3, 59)), true);
});

test('the hours can be changed, and the ISO string from the API works too', () => {
  assert.equal(canRenotify(sent, plus(4, 59), 5), false);
  assert.equal(canRenotify(sent, plus(5), 5), true);
  assert.equal(canRenotify(sent.toISOString(), plus(3)), true);
});

let canNotify: typeof import('../src/repositories/info.repo').canNotify;
let createInfoRouter: typeof import('../src/controllers/info.controller').createInfoRouter;
before(async () => {
  usePlaceholderEnv({ RENOTIFY_DIFF_HOURS: '5' });
  ({ canNotify } = await import('../src/repositories/info.repo'));
  ({ createInfoRouter } = await import('../src/controllers/info.controller'));
});
after(() => mock.timers.reset());

test("the feed's canNotify uses the rule, on the server's clock, with RENOTIFY_DIFF_HOURS", () => {
  mock.timers.enable({ apis: ['Date'], now: plus(4, 59) });
  assert.equal(canNotify({ lastNotifiedAt: sent }), false);
  mock.timers.setTime(plus(5).getTime());
  assert.equal(canNotify({ lastNotifiedAt: sent }), true);
  mock.timers.reset();
});

test('POST /info/:id/renotify: the author while open; 400 while locked; others refused', async () => {
  const author = testUser('u-author');
  const pushed: string[] = [];
  const router = (canNotifyNow: boolean) =>
    createInfoRouter({
      getInfoById: async (id: string) => ({
        id,
        creatorId: author.id,
        canNotify: canNotifyNow,
      }),
      claimRenotify: async () => canNotifyNow,
      renotifyInfo: async (info: { id: string }) => {
        pushed.push(info.id);
      },
    } as unknown as InfoDeps);

  assert.equal(
    (await callRouter(router(false), author, 'POST', '/info/p1/renotify'))
      .status,
    400,
  );
  assert.equal(
    (
      await callRouter(
        router(true),
        testUser('u-other'),
        'POST',
        '/info/p1/renotify',
      )
    ).status,
    401,
  );
  assert.deepEqual(pushed, []);
  assert.equal(
    (await callRouter(router(true), author, 'POST', '/info/p1/renotify'))
      .status,
    200,
  );
  assert.deepEqual(pushed, ['p1']);
});

// Regression (owner, 2026-11-03): opening a post by its link checked groups but not angkatan. The route now gives
// the repository the member's angkatan; tests/db/info-audience.test.ts checks the query on a real database.
test("GET /info/:id reads the post for the member's angkatan, and a post they can't see is 404", async () => {
  const seen: unknown[][] = [];
  const router = createInfoRouter({
    getInfoById: async (...args: unknown[]) => {
      seen.push(args);
      return undefined;
    },
  } as unknown as InfoDeps);
  const nadia = testUser('u-nadia');
  const res = await callRouter(router, nadia, 'GET', '/info/p1');
  assert.equal(res.status, 404);
  assert.deepEqual(seen, [['p1', 'u-nadia', 2025]]);
});

// Regression: the re-send pushed to every member inside the request and wrote `lastNotifiedAt` only afterwards, so a
// double click or a retry sent everyone the push twice.
test('POST /info/:id/renotify twice at once: one push, the other refused', async () => {
  const author = testUser('u-author');
  const pushed: string[] = [];
  let open = true;
  const router = createInfoRouter({
    getInfoById: async (id: string) => ({
      id,
      creatorId: author.id,
      canNotify: true, // both requests read the post before either claims it
    }),
    claimRenotify: async (id: string, creatorId: string) => {
      assert.equal(id, 'p1');
      assert.equal(creatorId, author.id);
      await new Promise((r) => setTimeout(r, 5));
      const won = open;
      open = false;
      return won;
    },
    renotifyInfo: async (info: { id: string }) => {
      pushed.push(info.id);
    },
  } as unknown as InfoDeps);
  const statuses = await Promise.all([
    callRouter(router, author, 'POST', '/info/p1/renotify'),
    callRouter(router, author, 'POST', '/info/p1/renotify'),
  ]).then((r) => r.map((x) => x.status).sort());
  assert.deepEqual(statuses, [200, 400]);
  assert.deepEqual(pushed, ['p1']);
});

// Regression: a stalled push service held the request open until every send finished.
test('POST /info/:id/renotify answers before the fan-out finishes, and a failed fan-out is only logged', async () => {
  const author = testUser('u-author');
  const errors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    const stalled = createInfoRouter({
      getInfoById: async (id: string) => ({
        id,
        creatorId: author.id,
        canNotify: true,
      }),
      claimRenotify: async () => true,
      renotifyInfo: async () => await new Promise(() => {}),
    } as unknown as InfoDeps);
    const res = await Promise.race([
      callRouter(stalled, author, 'POST', '/info/p1/renotify'),
      new Promise<'hung'>((r) => setTimeout(() => r('hung'), 1000)),
    ]);
    assert.notEqual(res, 'hung');
    assert.equal(res !== 'hung' && res.status, 200);

    const failing = createInfoRouter({
      getInfoById: async (id: string) => ({
        id,
        creatorId: author.id,
        canNotify: true,
      }),
      claimRenotify: async () => true,
      renotifyInfo: async () => {
        throw new Error('database went away');
      },
    } as unknown as InfoDeps);
    assert.equal(
      (await callRouter(failing, author, 'POST', '/info/p1/renotify')).status,
      200,
    );
    await new Promise((r) => setTimeout(r, 10));
  } finally {
    console.error = originalError;
  }
  assert.match(String(errors[0]?.[0]), /Re-sent post push failed:/);
});
