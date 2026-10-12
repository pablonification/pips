import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientSubscribe,
  type PersistedClient,
} from '@tanstack/react-query-persist-client';
import { shouldPersistQuery } from '../src/api/persistence-policy';
import {
  createThrottledPersister,
  type ClientStore,
} from '../src/api/persister';
import { forgetMember } from '../src/lib/forget-member';

/*
 * The persisted query cache at sign-out (review B1): the record was deleted, then the next cache event (`me`
 * becoming null) took a fresh snapshot of the member's other queries, and the throttled write put it back a
 * second later. Runs the real persist subscription against an in-memory store with fake timers.
 */

function memoryStore() {
  const store = {
    value: undefined as PersistedClient | undefined,
    get: async () => store.value,
    put: async (client: PersistedClient) => {
      store.value = client;
    },
    delete: async () => {
      store.value = undefined;
    },
  };
  return store satisfies ClientStore;
}

function memoryStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const NADIA = { id: 'nadia', fullName: 'Nadia Putri' };
const THROTTLE = 1000;

/** Nadia signed in, with her profile, courses, calendar and feed in memory, and the persist subscription on. */
function signedInDevice() {
  const store = memoryStore();
  const persister = createThrottledPersister(store, THROTTLE);
  const queryClient = new QueryClient();
  queryClient.setQueryData(['me'], NADIA);
  queryClient.setQueryData(['userAcademic'], { semester: 3 });
  queryClient.setQueryData(['currentCourses'], [{ id: 'IF2010' }]);
  queryClient.setQueryData(
    ['calendar-events', { month: 10, year: 2026 }],
    [{ id: 'e1', title: 'Kuis 2' }],
  );
  queryClient.setQueryData(
    ['infos', undefined, undefined, undefined, undefined],
    {
      pages: [['p1']],
      pageParams: [0],
    },
  );
  const unsubscribe = persistQueryClientSubscribe({
    queryClient,
    persister,
    buster: 'test',
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
  });
  return { store, persister, queryClient, unsubscribe };
}

/** Runs pending timers and the promises they start. */
async function tick(ms: number) {
  mock.timers.tick(ms);
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

beforeEach(() => {
  mock.timers.enable({
    apis: ['setTimeout'],
    now: new Date('2026-10-08T06:35:00Z'),
  });
  process.env.TZ = 'Asia/Jakarta';
});
afterEach(() => mock.timers.reset());

test('a signed-in member’s cache is written once a second', async () => {
  const { store, queryClient, unsubscribe } = signedInDevice();
  queryClient.setQueryData(
    ['currentCourses'],
    [{ id: 'IF2010' }, { id: 'IF2011' }],
  );
  assert.ok(store.value === undefined, 'not before the throttle');
  await tick(THROTTLE);
  const keys = (await store.get())?.clientState.queries.map(
    (q) => q.queryKey[0],
  );
  assert.deepEqual(keys?.sort(), [
    'calendar-events',
    'currentCourses',
    'infos',
    'me',
    'userAcademic',
  ]);
  unsubscribe();
});

test('signing out leaves nothing of the member, and nothing comes back later', async () => {
  const { store, queryClient, unsubscribe } = signedInDevice();
  queryClient.setQueryData(['userAcademic'], { semester: 3 });
  await tick(THROTTLE);
  assert.ok(store.value, 'written while signed in');
  const storage = memoryStorage({
    user: JSON.stringify(NADIA),
    userAcademic: '{"semester":3}',
  });

  await forgetMember({
    queryClient,
    removePersisted: () => store.delete(),
    storage,
  });
  // A write was also waiting when she signed out.
  await tick(THROTTLE * 5);

  assert.equal(store.value, undefined, 'the persisted cache stays empty');
  assert.deepEqual(
    queryClient
      .getQueryCache()
      .getAll()
      .map((q) => [q.queryKey, q.state.data]),
    [[['me'], null]],
    'only the signed-out session stays in memory',
  );
  assert.equal(storage.map.get('userAcademic'), undefined);
  assert.equal(storage.map.get('user'), 'null');
  unsubscribe();
});

test('a write still waiting is dropped when the cache is removed', async () => {
  const { store, persister, queryClient, unsubscribe } = signedInDevice();
  queryClient.setQueryData(['userAcademic'], { semester: 4 });
  await persister.removeClient();
  await tick(THROTTLE * 5);
  assert.equal(store.value, undefined);
  unsubscribe();
});

test('signed out, nothing is written, whatever else is still in memory', async () => {
  // The old sign-out: delete the record, then set `me` to null with the member's queries still in memory.
  const { store, persister, queryClient, unsubscribe } = signedInDevice();
  await persister.removeClient();
  queryClient.setQueryData(['me'], null);
  queryClient.setQueryData(['currentCourses'], [{ id: 'IF2010' }]);
  await tick(THROTTLE * 5);
  assert.equal(store.value, undefined);
  unsubscribe();
});

test('a member whose last refresh failed keeps their data on the device, stored as plain data', async () => {
  // Review m3: during an outage a query keeps its data but turns `error`; it was dropped from the device.
  const { store, queryClient, unsubscribe } = signedInDevice();
  const query = queryClient
    .getQueryCache()
    .find({ queryKey: ['calendar-events', { month: 10, year: 2026 }] })!;
  query.setState({
    status: 'error',
    error: new Error('503'),
    fetchFailureCount: 3,
    fetchFailureReason: new Error('503'),
  });
  queryClient.setQueryData(['userAcademic'], { semester: 3 });
  await tick(THROTTLE);
  const stored = store.value?.clientState.queries.find(
    (q) => q.queryKey[0] === 'calendar-events',
  );
  assert.ok(stored, 'kept');
  assert.deepEqual(stored.state.data, [{ id: 'e1', title: 'Kuis 2' }]);
  assert.equal(stored.state.status, 'success');
  assert.equal(stored.state.error, null);
  assert.equal(stored.state.fetchFailureReason, null);
  unsubscribe();
});
