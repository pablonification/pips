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
