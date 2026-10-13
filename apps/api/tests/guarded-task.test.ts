import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { guardedTask } from '../src/lib/guarded-task';

// Regression (CI's image check, 2026-10-13): the calendar cron's first run with no database rejected, nothing
// caught it, and the API exited. A failed run must be logged and must never reject.
test('a failed run is logged with its error and never rejects', async () => {
  const logged: Array<[string, unknown]> = [];
  const refused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), {
    code: 'ECONNREFUSED',
  });
  const tick = guardedTask(
    'Calendar cron',
    () => Promise.reject(refused),
    (message, error) => logged.push([message, error]),
  );
  await assert.doesNotReject(tick());
  assert.deepEqual(logged, [['Calendar cron failed:', refused]]);
});

test('a run that throws before its first await is caught too', async () => {
  const logged: unknown[] = [];
  const tick = guardedTask(
    'Calendar cron',
    async () => {
      throw new TypeError('boom');
    },
    (_message, error) => logged.push(error),
  );
  await assert.doesNotReject(tick());
  assert.equal(logged.length, 1);
});

test('a run that succeeds logs nothing, and every run goes ahead', async () => {
  let runs = 0;
  const logged: unknown[] = [];
  const tick = guardedTask(
    'Calendar cron',
    async () => {
      runs += 1;
      if (runs === 1) throw new Error('down');
    },
    (_message, error) => logged.push(error),
  );
  await tick();
  await tick();
  assert.equal(runs, 2);
  assert.equal(logged.length, 1);
});
