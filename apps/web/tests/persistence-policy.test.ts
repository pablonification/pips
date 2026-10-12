import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  PERSIST_MAX_AGE,
  shouldPersistKey,
  shouldPersistQuery,
  trimForDevice,
} from '../src/api/persistence-policy';

// Kamis, 8 Oktober 2026, 13.35 WIB (the harness's fixed clock). Runs in Asia/Jakarta like the app.
process.env.TZ = 'Asia/Jakarta';
const NOW = new Date('2026-10-08T13:35:00+07:00');

test('exactly the queries SPEC lists are kept on the device', () => {
  assert.equal(shouldPersistKey(['me']), true);
  assert.equal(shouldPersistKey(['userAcademic']), true);
  assert.equal(shouldPersistKey(['currentCourses']), true);
  assert.equal(
    shouldPersistKey(['infos', undefined, undefined, undefined, undefined]),
    true,
    'the feed as it opens',
  );
  for (const key of [
    ['infos', 'beasiswa', undefined, undefined, undefined],
    ['infos', undefined, true, undefined, undefined],
    ['infos', undefined, undefined, ['akademik'], undefined],
    ['info', 'detail', 'p1'],
    ['chatrooms'],
    ['nim', 'nadia'],
    ['form', 'list'],
    ['categories'],
    ['courses', 'IF'],
  ]) {
    assert.equal(shouldPersistKey(key, NOW), false, JSON.stringify(key));
  }
  assert.equal(
    shouldPersistKey(['infos', undefined, undefined, [], undefined]),
    true,
  );
});

test('calendar events: only the months that today ±7 days touch', () => {
  assert.equal(
    shouldPersistKey(['calendar-events', { month: 10, year: 2026 }], NOW),
    true,
  );
  assert.equal(
    shouldPersistKey(['calendar-events', { month: 9, year: 2026 }], NOW),
    false,
  );
  assert.equal(
    shouldPersistKey(['calendar-events', { month: 11, year: 2026 }], NOW),
    false,
  );
  const endOfMonth = new Date('2026-10-28T09:00:00+07:00');
  assert.equal(
    shouldPersistKey(
      ['calendar-events', { month: 11, year: 2026 }],
      endOfMonth,
    ),
    true,
  );
  const newYear = new Date('2027-01-03T09:00:00+07:00');
  assert.equal(
    shouldPersistKey(['calendar-events', { month: 12, year: 2026 }], newYear),
    true,
  );
  assert.equal(shouldPersistKey(['calendar-events'], NOW), false);
});

test('only successful data; a signed-out session (null) is never kept', () => {
  const q = (status: string, data: unknown) => ({
    queryKey: ['me'],
    state: { status, data },
  });
  assert.equal(shouldPersistQuery(q('success', { id: 'nadia' })), true);
  assert.equal(shouldPersistQuery(q('success', null)), false);
  assert.equal(shouldPersistQuery(q('error', { id: 'nadia' })), false);
  assert.equal(shouldPersistQuery(q('pending', undefined)), false);
});

test('announcements keep only their first page', () => {
  const state = {
    mutations: [],
    queries: [
      {
        queryKey: ['infos', undefined, undefined, undefined, undefined],
        queryHash: 'a',
        state: {
          data: { pages: [['p1'], ['p2'], ['p3']], pageParams: [0, 1, 2] },
        },
      },
      { queryKey: ['me'], queryHash: 'b', state: { data: { id: 'nadia' } } },
    ],
  } as unknown as Parameters<typeof trimForDevice>[0];
  const trimmed = trimForDevice(state);
  assert.deepEqual(trimmed.queries[0].state.data, {
    pages: [['p1']],
    pageParams: [0],
  });
  assert.deepEqual(trimmed.queries[1].state.data, { id: 'nadia' });
});

test('kept at most 7 days', () => {
  assert.equal(PERSIST_MAX_AGE, 7 * 24 * 60 * 60 * 1000);
});
