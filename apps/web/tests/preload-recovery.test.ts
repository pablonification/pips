// web-robust 6: after a deploy, a tab still on the old build gets `vite:preloadError` for a page's code it hasn't
// loaded yet (the new service worker deleted the old files). It reloads once onto the new build, never in a loop.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  PRELOAD_RELOAD_KEY,
  shouldReloadAfterPreloadError,
} from '../src/lib/preload-recovery';

const memory = () => {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

test('the first failure reloads, and remembers when', () => {
  const s = memory();
  assert.equal(shouldReloadAfterPreloadError(s, 1_000_000, true), true);
  assert.equal(s.m.get(PRELOAD_RELOAD_KEY), '1000000');
});

test('failing again within a minute of that reload does not reload again (no loop)', () => {
  const s = memory();
  assert.equal(shouldReloadAfterPreloadError(s, 1_000_000, true), true);
  assert.equal(shouldReloadAfterPreloadError(s, 1_030_000, true), false);
  // A later deploy, hours on: it may reload again.
  assert.equal(
    shouldReloadAfterPreloadError(s, 1_000_000 + 3_600_000, true),
    true,
  );
});

test('offline it never reloads: the file can’t come anyway', () => {
  const s = memory();
  assert.equal(shouldReloadAfterPreloadError(s, 1_000_000, false), false);
  assert.equal(s.m.size, 0);
});

test('without storage (or storage that throws) it does not reload, so it can’t loop', () => {
  assert.equal(shouldReloadAfterPreloadError(null, 1, true), false);
  const throwing = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {},
  };
  assert.equal(shouldReloadAfterPreloadError(throwing, 1, true), false);
});

test('a clock that went backwards does not block the reload', () => {
  const s = memory();
  s.setItem(PRELOAD_RELOAD_KEY, '5000000');
  assert.equal(shouldReloadAfterPreloadError(s, 1_000_000, true), true);
});
