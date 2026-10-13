import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  afterSignIn,
  FIRST_RUN_KEY,
  openSteps,
  readFirstRunFlag,
  writeFirstRunFlag,
} from '../src/features/masuk/first-run';
import { popupProblem, signInProblem } from '../src/features/masuk/sign-in';

/* Sign-in's error mapping and destination, and first run (P1-C brief, "Rules to unit-test"). */

test('sign-in errors: 401 is not a member, anything else can be retried', () => {
  assert.equal(signInProblem({ status: 401 }), 'bukan-anggota');
  assert.equal(signInProblem({ status: 500 }), 'gagal');
  assert.equal(signInProblem({ status: 0 }), 'gagal');
  // A network failure: fetch throws a TypeError with no status.
  assert.equal(signInProblem(new TypeError('Failed to fetch')), 'gagal');
  assert.equal(signInProblem(null), 'gagal');
});

test('Google’s popup: closed says nothing, blocked says so, anything else retries', () => {
  assert.equal(popupProblem('popup_closed'), null);
  assert.equal(popupProblem('popup_failed_to_open'), 'popup-diblokir');
  assert.equal(popupProblem('unknown'), 'gagal');
  assert.equal(popupProblem(undefined), 'gagal');
});

const fresh = { courseCount: 0, push: 'belum' as const };
const ready = { courseCount: 6, push: 'aktif' as const };

test('first run: each step is open until its signal is true', () => {
  assert.deepEqual(openSteps(fresh), ['matkul', 'notif']);
  assert.deepEqual(openSteps({ courseCount: 6, push: 'belum' }), ['notif']);
  assert.deepEqual(openSteps({ courseCount: 0, push: 'aktif' }), ['matkul']);
  assert.deepEqual(openSteps(ready), []);
  // Notifications that can't be turned on from here aren't a step left open.
  for (const push of ['diblokir', 'perlu-pasang', 'tidak-didukung'] as const)
    assert.deepEqual(openSteps({ courseCount: 6, push }), []);
});

test('destination: a shared link always wins, then first run, then Beranda', () => {
  assert.equal(
    afterSignIn({ redirect: '/pengumuman/p1', flag: null, signals: fresh }),
    '/pengumuman/p1',
  );
  assert.equal(
    afterSignIn({ redirect: null, flag: null, signals: fresh }),
    '/mulai',
  );
  assert.equal(
    afterSignIn({ redirect: null, flag: null, signals: ready }),
    '/',
  );
  // Finished or skipped on this device: never again.
  assert.equal(
    afterSignIn({ redirect: null, flag: 'selesai', signals: fresh }),
    '/',
  );
  assert.equal(
    afterSignIn({ redirect: null, flag: 'lewati', signals: fresh }),
    '/',
  );
  // The signals didn't arrive in time: Beranda.
  assert.equal(afterSignIn({ redirect: null, flag: null, signals: null }), '/');
});

test('the device flag: stored, read back, and blocked storage is harmless', () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  assert.equal(readFirstRunFlag(storage), null);
  writeFirstRunFlag(storage, 'lewati');
  assert.equal(store.get(FIRST_RUN_KEY), 'lewati');
  assert.equal(readFirstRunFlag(storage), 'lewati');
  store.set(FIRST_RUN_KEY, 'something else');
  assert.equal(readFirstRunFlag(storage), null);
  const blocked = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('SecurityError');
    },
  };
  assert.equal(readFirstRunFlag(blocked), null);
  assert.doesNotThrow(() => writeFirstRunFlag(blocked, 'selesai'));
});
