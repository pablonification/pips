import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { runWhenSettled, type SettleTimers } from '../src/lib/sw-register';

/*
 * When the service worker registers (P1-A round 2, the request budget): after a quiet second with nothing fetching
 * and an idle moment, or 10 s after load.
 */

function harness(fetching: number) {
  let n = fetching;
  const listeners = new Set<() => void>();
  let pending: { at: number; cb: () => void; id: number }[] = [];
  const idles: (() => void)[] = [];
  let now = 0;
  let nextId = 1;
  const timers: SettleTimers = {
    setTimeout: (cb, ms) => {
      const id = nextId++;
      pending.push({ at: now + ms, cb, id });
      return id;
    },
    clearTimeout: (id) => {
      pending = pending.filter((t) => t.id !== id);
    },
    idle: (cb) => idles.push(cb),
  };
  return {
    timers,
    source: {
      isFetching: () => n,
      subscribe: (l: () => void) => {
        listeners.add(l);
        return () => void listeners.delete(l);
      },
    },
    listeners,
    /** A query changes: `v` queries fetching now. */
    setFetching(v: number) {
      n = v;
      listeners.forEach((l) => l());
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = pending
          .filter((t) => t.at <= end)
          .sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        now = next.at;
        pending = pending.filter((t) => t !== next);
        next.cb();
      }
      now = end;
    },
    runIdle() {
      idles.splice(0).forEach((cb) => cb());
    },
  };
}

test('waits for a quiet second with nothing fetching, then an idle moment', () => {
  const h = harness(0);
  let runs = 0;
  runWhenSettled(h.source, () => runs++, h.timers);
  h.advance(500);
  // The route's data starts loading before the quiet second ends.
  h.setFetching(2);
  h.advance(1_500);
  h.runIdle();
  assert.equal(runs, 0, 'not while queries are fetching');
  h.setFetching(0);
  h.advance(999);
  h.runIdle();
  assert.equal(runs, 0, 'not before a quiet second');
  h.advance(1);
  assert.equal(runs, 0, 'not before the browser is idle');
  h.runIdle();
  assert.equal(runs, 1);
  assert.equal(h.listeners.size, 0, 'stops listening');
  h.setFetching(0);
  h.advance(20_000);
  h.runIdle();
  assert.equal(runs, 1, 'only once');
});

test('a gap between the route’s code and its data doesn’t count as settled', () => {
  const h = harness(1);
  let runs = 0;
  runWhenSettled(h.source, () => runs++, h.timers);
  h.setFetching(0); // the calendar arrived
  h.advance(300); // the component's code loads
  h.setFetching(5); // the sections start their requests
  h.advance(2_000);
  h.runIdle();
  assert.equal(runs, 0);
  h.setFetching(0);
  h.advance(1_000);
  h.runIdle();
  assert.equal(runs, 1);
});

test('a query that starts before the idle callback starts the quiet second again', () => {
  const h = harness(0);
  let runs = 0;
  runWhenSettled(h.source, () => runs++, h.timers);
  h.advance(1_000);
  h.setFetching(1);
  h.runIdle();
  assert.equal(runs, 0);
  h.setFetching(0);
  h.advance(1_000);
  h.runIdle();
  assert.equal(runs, 1);
});

test('nothing to load (signed out): registers after a quiet second', () => {
  const h = harness(0);
  let runs = 0;
  runWhenSettled(h.source, () => runs++, h.timers);
  h.advance(1_000);
  h.runIdle();
  assert.equal(runs, 1);
});

test('a page that never settles still registers 10 s after load', () => {
  const h = harness(1);
  let runs = 0;
  runWhenSettled(h.source, () => runs++, h.timers);
  h.advance(9_999);
  assert.equal(runs, 0);
  h.advance(1);
  assert.equal(runs, 1);
  h.setFetching(0);
  h.advance(2_000);
  h.runIdle();
  assert.equal(runs, 1);
});
