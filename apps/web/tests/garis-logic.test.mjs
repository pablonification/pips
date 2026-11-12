// Logic behind the Garis components: toast timing, the pixel reactions, the halftone and the theme rules.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createToastStore,
  MAX_TOASTS,
  SUCCESS_MS,
  SUCCESS_WITH_ACTION_MS,
  toastDuration,
} from '../src/components/garis/toast-store.ts';
import {
  PIXEL_REACTION_KEYS,
  PIXEL_REACTION_LABELS,
  PIXEL_REACTIONS,
  pixelRuns,
} from '../src/components/garis/pixel-art.ts';
import { halftoneSquares } from '../src/components/garis/halftone-geometry.ts';
import {
  parsePreference,
  resolveTheme,
  THEME_COLORS,
  THEME_STORAGE_KEY,
} from '../src/lib/theme/theme-core.mjs';

/** Fake timers: run() fires everything due by `now`. */
function clock() {
  let now = 0;
  let id = 0;
  const due = new Map();
  return {
    timers: {
      set: (fn, ms) => (due.set(++id, { at: now + ms, fn }), id),
      clear: (h) => due.delete(h),
    },
    advance(ms) {
      now += ms;
      for (const [h, t] of [...due]) if (t.at <= now) (due.delete(h), t.fn());
    },
  };
}

test('success toasts stay at least 5 s, 8 s with an undo, and longer if asked; errors stay until dismissed', () => {
  assert.equal(SUCCESS_MS, 5000);
  assert.equal(toastDuration('success', false), 5000);
  assert.equal(toastDuration('success', false, 2000), 5000);
  assert.equal(toastDuration('success', false, 9000), 9000);
  assert.equal(toastDuration('success', true), SUCCESS_WITH_ACTION_MS);
  assert.equal(toastDuration('error', false), null);
});

test('a success toast leaves after 5 s, not before; an error toast never leaves by itself', () => {
  const c = clock();
  const store = createToastStore(c.timers);
  store.success('Komentar terkirim.');
  store.error('Komentar gagal terkirim.');
  c.advance(4999);
  assert.deepEqual(
    store.get().map((t) => t.message),
    ['Komentar terkirim.', 'Komentar gagal terkirim.'],
  );
  c.advance(1);
  assert.deepEqual(
    store.get().map((t) => t.message),
    ['Komentar gagal terkirim.'],
  );
  c.advance(10 * 60_000);
  assert.equal(store.get().length, 1);
  store.dismiss(store.get()[0].id);
  assert.equal(store.get().length, 0);
});

test("the app's own timers call setTimeout as a plain function, as browsers require", () => {
  // Browsers throw "Illegal invocation" when setTimeout runs as another object's method; Node doesn't, so the stand-ins
  // throw the same way. The store used to call `timers.set(...)` with `set: setTimeout`, and every success toast threw.
  const real = { set: globalThis.setTimeout, clear: globalThis.clearTimeout };
  const calls = [];
  const strict = (name) =>
    function (...args) {
      if (this !== undefined && this !== globalThis)
        throw new TypeError('Illegal invocation');
      calls.push(name);
      return name === 'set' ? real.set(...args) : real.clear(...args);
    };
  globalThis.setTimeout = strict('set');
  globalThis.clearTimeout = strict('clear');
  try {
    const store = createToastStore();
    assert.doesNotThrow(() => store.success('1 mata kuliah ditambahkan.'));
    assert.doesNotThrow(() => store.dismiss(store.get()[0].id));
    assert.deepEqual(calls, ['set', 'clear']);
    assert.equal(store.get().length, 0);
  } finally {
    globalThis.setTimeout = real.set;
    globalThis.clearTimeout = real.clear;
  }
});

test('at most three toasts: the oldest success leaves first, errors are kept', () => {
  const store = createToastStore(clock().timers);
  store.error('E');
  for (const m of ['A', 'B', 'C']) store.success(m);
  assert.equal(store.get().length, MAX_TOASTS);
  assert.deepEqual(
    store.get().map((t) => t.message),
    ['E', 'B', 'C'],
  );
});

// With three errors showing, a new success must not remove itself at once, and a fourth error must not evict
// the oldest error. Errors stay until the member dismisses them; only older successes make room.
test('errors are never evicted: a new success still shows next to three errors, and a fourth error joins them', () => {
  const store = createToastStore(clock().timers);
  for (const m of ['E1', 'E2', 'E3']) store.error(m);
  store.success('S');
  assert.deepEqual(
    store.get().map((t) => t.message),
    ['E1', 'E2', 'E3', 'S'],
  );

  const errors = createToastStore(clock().timers);
  for (const m of ['E1', 'E2', 'E3', 'E4']) errors.error(m);
  assert.deepEqual(
    errors.get().map((t) => t.message),
    ['E1', 'E2', 'E3', 'E4'],
  );
});

test('a new toast makes room by removing the oldest older success, never itself', () => {
  const store = createToastStore(clock().timers);
  store.success('A');
  store.error('E1');
  store.error('E2');
  store.error('E3');
  assert.deepEqual(
    store.get().map((t) => t.message),
    ['E1', 'E2', 'E3'],
  );
  store.success('B');
  store.success('C');
  assert.deepEqual(
    store.get().map((t) => t.message),
    ['E1', 'E2', 'E3', 'C'],
  );
});

test('subscribers hear every change', () => {
  const store = createToastStore(clock().timers);
  const seen = [];
  const off = store.subscribe((items) => seen.push(items.length));
  const id = store.success('A');
  store.dismiss(id);
  off();
  store.success('B');
  assert.deepEqual(seen, [1, 0]);
});

test('the six pixel reactions are 10 × 10, named as the app names them', () => {
  assert.deepEqual(PIXEL_REACTION_KEYS, [
    'grin',
    'heart-eyes',
    'fire',
    'cry',
    'screaming',
    'party',
  ]);
  assert.deepEqual(Object.values(PIXEL_REACTION_LABELS), [
    'Senyum lebar',
    'Suka banget',
    'Keren',
    'Sedih',
    'Kaget',
    'Rayakan',
  ]);
  for (const k of PIXEL_REACTION_KEYS) {
    assert.equal(PIXEL_REACTIONS[k].length, 10, k);
    for (const row of PIXEL_REACTIONS[k])
      assert.match(row, /^[.#owrclb]{10}$/, k);
  }
});

test('pixel runs cover every non-empty pixel exactly once, with the rim as class k', () => {
  for (const k of PIXEL_REACTION_KEYS) {
    const filled = PIXEL_REACTIONS[k].join('').replace(/\./g, '').length;
    const runs = pixelRuns(k);
    assert.equal(
      runs.reduce((n, r) => n + r.width, 0),
      filled,
      k,
    );
    for (const r of runs) {
      const ch = PIXEL_REACTIONS[k][r.y][r.x];
      assert.equal(r.colour, ch === '#' ? 'k' : ch, k);
      assert.equal(
        PIXEL_REACTIONS[k][r.y].slice(r.x, r.x + r.width),
        ch.repeat(r.width),
      );
    }
  }
});

test('the halftone squares grow from nothing to cell − 1 toward the right, centred in their cells', () => {
  const sq = halftoneSquares(216, 8);
  assert.equal(Math.round(216 / 8), 27);
  assert.ok(sq.length < 27 && sq.length > 20);
  for (let i = 1; i < sq.length; i++) assert.ok(sq[i].size >= sq[i - 1].size);
  assert.equal(sq.at(-1).size, 7);
  assert.equal(sq.at(-1).x, 26 * 8 + 0.5);
  for (const s of sq) assert.equal(s.y, (8 - s.size) / 2);
});

test('theme: the stored preference is system, light or dark (default system), resolved against the system', () => {
  assert.equal(THEME_STORAGE_KEY, 'pips:theme');
  assert.equal(parsePreference(null), 'system');
  assert.equal(parsePreference('dark'), 'dark');
  assert.equal(parsePreference('blue'), 'system');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.deepEqual(THEME_COLORS, { light: '#FCFBF8', dark: '#0A0907' });
});
