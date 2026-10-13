/**
 * Form drafts on this device, in exactly the format today's screen writes with `bungkus` 1.3.7 (its
 * `dist/bungkus.es.js`): IndexedDB `keyval-store`, object store `keyval`, key `bungkus-<key>`, the answers with each
 * string as "🔒" + the reversed base64 of its URI encoding, and `_timestamp` (ms). A draft older than its lifetime is
 * deleted when read. Same format, so drafts saved by today's screen restore in the new one; written here directly so a
 * write still waiting when the member leaves the screen isn't lost (bungkus writes inside a React state update).
 */
import type { Answers } from './rules';

const DB = 'keyval-store';
const STORE = 'keyval';
const LOCK = '🔒';
const TIMESTAMP = '_timestamp';

const lock = (s: string) =>
  LOCK + btoa(encodeURIComponent(s)).split('').reverse().join('');
const unlock = (s: string) => {
  try {
    return decodeURIComponent(
      atob(s.slice(LOCK.length).split('').reverse().join('')),
    );
  } catch {
    return s;
  }
};

/** The stored record for some answers, saved at `now`. */
export function encodeDraft(
  answers: Answers,
  now: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(answers))
    out[k] = typeof v === 'string' ? lock(v) : v;
  out[TIMESTAMP] = now;
  return out;
}

/** The answers in a stored record, or null when there is none or it is older than `maxHours`. */
export function decodeDraft(
  record: unknown,
  now: number,
  maxHours: number,
): Answers | null {
  if (!record || typeof record !== 'object') return null;
  const r = record as Record<string, unknown>;
  const at = typeof r[TIMESTAMP] === 'number' ? r[TIMESTAMP] : NaN;
  if (!(now - at <= maxHours * 3600_000)) return null;
  const out: Answers = {};
  for (const [k, v] of Object.entries(r)) {
    if (k === TIMESTAMP) continue;
    if (typeof v === 'string') out[k] = v.startsWith(LOCK) ? unlock(v) : v;
    else if (Array.isArray(v) && v.every((x) => typeof x === 'string'))
      out[k] = v as string[];
  }
  return Object.keys(out).length ? out : null;
}

let db: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (db) return db;
  db = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      req.result.onclose = () => (db = null);
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
  db.catch(() => (db = null));
  return db;
}

function run<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = tx.onabort = () => reject(tx.error);
      }),
  );
}

const storeKey = (key: string) => `bungkus-${key}`;

/** Reads a draft; an expired one is deleted. Any storage failure counts as no draft. */
export async function readDraft(
  key: string,
  maxHours: number,
  now = Date.now(),
): Promise<Answers | null> {
  try {
    const record = await run('readonly', (s) => s.get(storeKey(key)));
    const answers = decodeDraft(record, now, maxHours);
    if (record && !answers) await deleteDraft(key);
    return answers;
  } catch {
    return null;
  }
}

export async function writeDraft(
  key: string,
  answers: Answers,
  now = Date.now(),
): Promise<boolean> {
  try {
    await run('readwrite', (s) =>
      s.put(encodeDraft(answers, now), storeKey(key)),
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteDraft(key: string): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(storeKey(key)));
  } catch {
    // Nothing to do: a draft that can't be deleted expires on its own.
  }
}
