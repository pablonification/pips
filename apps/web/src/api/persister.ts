import type {
  PersistedClient,
  Persister,
} from '@tanstack/react-query-persist-client';
import { openDB, type IDBPDatabase } from 'idb';
import { trimForDevice } from './persistence-policy';

const DB_NAME = 'pips-query-cache';
const STORE = 'cache';
const KEY = 'client';

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
 * Keeps the persisted query cache in IndexedDB (not localStorage: no size limit worth worrying about, and it
 * doesn't block the main thread). Writes are batched to one per second. If IndexedDB is unavailable (private
 * mode on some browsers), the app simply works without a persisted cache.
 */
export function createIdbPersister(throttleMs = 1000): Persister {
  let pending: PersistedClient | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = async () => {
    timer = null;
    const client = pending;
    pending = null;
    if (!client) return;
    try {
      await (
        await open()
      ).put(
        STORE,
        { ...client, clientState: trimForDevice(client.clientState) },
        KEY,
      );
    } catch {
      // Storage full or unavailable: carry on without persisting.
    }
  };
  return {
    persistClient(client) {
      pending = client;
      timer ??= setTimeout(() => void flush(), throttleMs);
    },
    async restoreClient() {
      try {
        return (await (await open()).get(STORE, KEY)) as
          PersistedClient | undefined;
      } catch {
        return undefined;
      }
    },
    async removeClient() {
      pending = null;
      try {
        await (await open()).delete(STORE, KEY);
      } catch {
        // Nothing stored.
      }
    },
  };
}

export const persister = createIdbPersister();

/** Forget everything persisted on this device: at sign-out, and when someone signs in. */
export function clearPersistedQueries() {
  return persister.removeClient();
}
