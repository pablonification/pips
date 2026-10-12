import type {
  PersistedClient,
  Persister,
} from '@tanstack/react-query-persist-client';
import { openDB, type IDBPDatabase } from 'idb';
import { isSignedInSnapshot, trimForDevice } from './persistence-policy';

const DB_NAME = 'pips-query-cache';
const STORE = 'cache';
const KEY = 'client';
/** The persisted cache is written at most once per this many milliseconds. */
export const PERSIST_THROTTLE_MS = 1000;

/** Where the persisted client lives: one record. */
export interface ClientStore {
  get(): Promise<PersistedClient | undefined>;
  put(client: PersistedClient): Promise<void>;
  delete(): Promise<void>;
}

/**
 * Writes are batched to one per `throttleMs`, and only for a signed-in member. Removing the client (at sign-out,
 * on a 401, at sign-in) also drops a write that is still waiting, so nothing of the previous member is written
 * back afterwards; a write already sent to the store lands before the delete (see `idbClientStore`).
 */
export function createThrottledPersister(
  store: ClientStore,
  throttleMs = PERSIST_THROTTLE_MS,
): Persister {
  let pending: PersistedClient | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = async () => {
    timer = null;
    const client = pending;
    pending = null;
    if (!client) return;
    try {
      await store.put({
        ...client,
        clientState: trimForDevice(client.clientState),
      });
    } catch {
      // Storage full or unavailable: carry on without persisting.
    }
  };
  return {
    persistClient(client) {
      // Signed out, or no one signed in yet: nothing is kept, and a write still waiting is dropped.
      if (!isSignedInSnapshot(client.clientState)) {
        pending = null;
        return;
      }
      pending = client;
      timer ??= setTimeout(() => void flush(), throttleMs);
    },
    async restoreClient() {
      try {
        return await store.get();
      } catch {
        return undefined;
      }
    },
    async removeClient() {
      pending = null;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      try {
        await store.delete();
      } catch {
        // Nothing stored.
      }
    },
  };
}

let db: Promise<IDBPDatabase> | null = null;
function open() {
  db ??= openDB(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(STORE);
    },
  });
  return db;
}

/**
 * IndexedDB (not localStorage: no size limit worth worrying about, and it doesn't block the main thread). If
 * IndexedDB is unavailable (private mode on some browsers), the app simply works without a persisted cache.
 * Requests on one store run in the order they are made, so a delete made after a write lands after it.
 */
export const idbClientStore: ClientStore = {
  async get() {
    return (await (await open()).get(STORE, KEY)) as
      PersistedClient | undefined;
  },
  async put(client) {
    await (await open()).put(STORE, client, KEY);
  },
  async delete() {
    await (await open()).delete(STORE, KEY);
  },
};

export const persister = createThrottledPersister(idbClientStore);

/** Forget everything persisted on this device: at sign-out, on a 401, and when someone signs in. */
export function clearPersistedQueries() {
  return persister.removeClient();
}
