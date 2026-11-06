import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { runInBackground } from '../src/lib/background';
import { createShutdown, isShuttingDown } from '../src/lib/shutdown';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeSteps(order: string[], serverMs = 30) {
  return {
    stopJobs: () => order.push('jobs stopped'),
    closeServer: async () => {
      order.push('stop accepting');
      await tick(serverMs);
      order.push('requests finished');
    },
    closeSockets: async () => {
      order.push('sockets closed');
    },
    closeDatabase: async () => {
      order.push('database closed');
    },
    exit: (code: number) => order.push(`exit ${code}`),
    log: () => {},
  };
}

test('SIGTERM: stop jobs and new connections, let requests and push fan-outs finish, then close and exit 0', async () => {
  const order: string[] = [];
  let pushed = false;
  runInBackground(
    'Push',
    tick(80).then(() => {
      pushed = true;
      order.push('push finished');
    }),
  );
  const shutdown = createShutdown(fakeSteps(order), 2000);
  assert.equal(isShuttingDown(), false);
  const done = shutdown('SIGTERM');
  assert.equal(isShuttingDown(), true, '/health answers 503 from now on');
  await Promise.all([done, shutdown('SIGTERM')]); // a second signal doesn't start it twice
  assert.ok(pushed);
  assert.deepEqual(order, [
    'jobs stopped',
    'stop accepting',
    'sockets closed',
    'requests finished',
    'push finished',
    'database closed',
    'exit 0',
  ]);
});

test('work still going at the deadline is cut off with exit 1', async () => {
  const order: string[] = [];
  runInBackground('Stalled push', new Promise(() => {}));
  const started = Date.now();
  await createShutdown(fakeSteps(order), 1200)('SIGTERM');
  await tick(300);
  assert.ok(Date.now() - started < 2000);
  // The background wait gives up a second before the deadline, so the pool still closes and the exit is clean.
  assert.deepEqual(order.slice(-2), ['database closed', 'exit 0']);

  const hung: string[] = [];
  const steps = fakeSteps(hung);
  steps.closeServer = async () => await new Promise(() => {});
  void createShutdown(steps, 200)('SIGTERM');
  await tick(400);
  assert.deepEqual(hung.slice(-1), ['exit 1']);
});
