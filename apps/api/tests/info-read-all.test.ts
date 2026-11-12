// Tandai semua dibaca (owner, 2026-11-06): `POST /info/read-all` marks the signed-in member's own feed read, for
// them only, and says how many posts it marked. The SQL itself runs in tests/db/info-read-all.test.ts.
import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import type { InfoDeps } from '../src/controllers/info.controller';
import { callRouter } from './support/router';
import { testUser } from './support/session';

let createInfoRouter: typeof import('../src/controllers/info.controller').createInfoRouter;
before(async () => {
  usePlaceholderEnv();
  ({ createInfoRouter } = await import('../src/controllers/info.controller'));
});

function setup(marked: number) {
  const calls: unknown[][] = [];
  const router = createInfoRouter({
    markAllInfosRead: async (...args: unknown[]) => {
      calls.push(args);
      return marked;
    },
  } as unknown as InfoDeps);
  return { router, calls };
}

test('marks the signed-in member’s feed read, with their angkatan, and answers how many', async () => {
  const { router, calls } = setup(16);
  const res = await callRouter(
    router,
    testUser('u-nadia', { angkatan: 2025 }),
    'POST',
    '/info/read-all',
  );
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { marked: 16 });
  assert.deepEqual(calls, [['u-nadia', 2025]]);
});

test('nothing left to mark answers 0', async () => {
  const { router } = setup(0);
  const res = await callRouter(
    router,
    testUser('u-nadia'),
    'POST',
    '/info/read-all',
  );
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { marked: 0 });
});

test('signed out: 401, and nothing is marked', async () => {
  const { router, calls } = setup(3);
  const res = await callRouter(router, null, 'POST', '/info/read-all');
  assert.equal(res.status, 401);
  assert.deepEqual(calls, []);
});

test('marking a post that does not exist read answers 404, not 500', async () => {
  const router = createInfoRouter({
    createReadInfo: async () => {
      throw Object.assign(
        new Error(
          'insert or update on table "user_read_infos" violates foreign key constraint',
        ),
        { code: '23503' },
      );
    },
  } as unknown as InfoDeps);
  const res = await callRouter(
    router,
    testUser('u-nadia'),
    'POST',
    '/info/no-such-post/read',
    {},
  );
  assert.equal(res.status, 404);
});
