import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  PERSIST_MAX_AGE,
  isSignedInSnapshot,
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

test('any data, also after a failed refresh; a signed-out session (null) is never kept', () => {
  const q = (status: string, data: unknown, key: unknown[] = ['me']) => ({
    queryKey: key,
    state: { status, data },
  });
  assert.equal(shouldPersistQuery(q('success', { id: 'nadia' })), true);
  assert.equal(shouldPersistQuery(q('success', null)), false);
  assert.equal(shouldPersistQuery(q('pending', undefined)), false);
  assert.equal(shouldPersistQuery(q('error', undefined)), false);
  // Review m3: during an outage the agenda and feed keep their data but turn `error`; they stay on the device.
  assert.equal(shouldPersistQuery(q('error', { id: 'nadia' })), true);
  assert.equal(
    shouldPersistQuery(
      q(
        'error',
        [{ id: 'e1' }],
        ['calendar-events', { month: 10, year: 2026 }],
      ),
    ),
    true,
  );
  assert.equal(
    shouldPersistQuery(
      q('error', { pages: [[]], pageParams: [0] }, [
        'infos',
        undefined,
        undefined,
        undefined,
        undefined,
      ]),
    ),
    true,
  );
  assert.equal(shouldPersistQuery(q('error', ['x'], ['chatrooms'])), false);
});

test('only a signed-in member’s snapshot is written', () => {
  const snapshot = (...queries: [unknown[], unknown][]) =>
    ({
      mutations: [],
      queries: queries.map(([queryKey, data]) => ({
        queryKey,
        queryHash: JSON.stringify(queryKey),
        state: { data },
      })),
    }) as unknown as Parameters<typeof isSignedInSnapshot>[0];
  assert.equal(isSignedInSnapshot(snapshot([['me'], { id: 'nadia' }])), true);
  assert.equal(isSignedInSnapshot(snapshot([['me'], null])), false);
  assert.equal(
    isSignedInSnapshot(snapshot([['currentCourses'], [{ id: 'IF2010' }]])),
    false,
    'the member’s data without the member: signed out',
  );
  assert.equal(isSignedInSnapshot(snapshot()), false);
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

test('stored as plain data, without the last refresh’s error or fetch state', () => {
  const state = {
    mutations: [],
    queries: [
      {
        queryKey: ['me'],
        queryHash: 'b',
        promise: Promise.resolve(),
        state: {
          data: { id: 'nadia' },
          status: 'error',
          fetchStatus: 'fetching',
          error: new Error('503'),
          fetchFailureCount: 3,
          fetchFailureReason: new Error('503'),
        },
      },
    ],
  } as unknown as Parameters<typeof trimForDevice>[0];
  const [query] = trimForDevice(state).queries;
  assert.equal('promise' in query, false);
  assert.deepEqual(
    {
      status: query.state.status,
      fetchStatus: query.state.fetchStatus,
      error: query.state.error,
      fetchFailureCount: query.state.fetchFailureCount,
      fetchFailureReason: query.state.fetchFailureReason,
      data: query.state.data,
    },
    {
      status: 'success',
      fetchStatus: 'idle',
      error: null,
      fetchFailureCount: 0,
      fetchFailureReason: null,
      data: { id: 'nadia' },
    },
  );
});

test('kept at most 7 days', () => {
  assert.equal(PERSIST_MAX_AGE, 7 * 24 * 60 * 60 * 1000);
});
