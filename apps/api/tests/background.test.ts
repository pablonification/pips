import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import { runInBackground } from '../src/lib/background';
import type { InfoDeps } from '../src/controllers/info.controller';
import { callRouter } from './support/router';
import { testUser } from './support/session';

const root = path.resolve(import.meta.dirname, '..');

test('a failed background job is logged under its name, and never rejects anywhere', async () => {
  const logged: Array<[string, unknown]> = [];
  const boom = new Error('connection terminated');
  runInBackground('Last sign-in update', Promise.reject(boom), (m, e) =>
    logged.push([m, e]),
  );
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(logged, [['Last sign-in update failed:', boom]]);
});

/** Runs a script in a fresh Node and returns how it ended. */
function runNode(script: string) {
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', script],
    { cwd: root, encoding: 'utf8', timeout: 30_000 },
  );
}

test('with the logger installed, a stray rejection is logged and the process lives on', () => {
  const lib = path.join(root, 'src/lib/background.ts');
  const run = runNode(`
    const lib = await import(${JSON.stringify(lib)});
    (lib.installUnhandledRejectionLogger ?? lib.default.installUnhandledRejectionLogger)();
    Promise.reject(new Error('stray'));
    setTimeout(() => { console.log('still serving'); }, 50);
  `);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /still serving/);
  assert.match(run.stderr, /Unhandled rejection: Error: stray/);
});

test('without it, Node 22 ends the process (why the logger exists)', () => {
  const run = runNode(`
    Promise.reject(new Error('stray'));
    setTimeout(() => { console.log('still serving'); }, 50);
  `);
  assert.notEqual(run.status, 0);
  assert.doesNotMatch(run.stdout, /still serving/);
});

// The push fan-out after creating a post must not be started with `void`: a failure in it would be unhandled.
test('POST /info answers 201 when the push fan-out fails, and the failure is logged', async () => {
  usePlaceholderEnv();
  const { createInfoRouter } =
    await import('../src/controllers/info.controller');
  const author = testUser('u-author');
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  const errors: unknown[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    const router = createInfoRouter({
      getUserRoles: async () => ['akademik'],
      getCategoriesByIds: async () => [{ id: 'c1', name: 'Akademik' }],
      createInfo: async () => ({ id: 'p1', title: 'Hai', content: 'Isi' }),
      notifyNewInfo: async () => {
        throw new Error('database went away');
      },
    } as unknown as InfoDeps);
    const res = await callRouter(router, author, 'POST', '/info', {
      title: 'Hai',
      content: 'Isi',
      forCategories: ['c1'],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    await new Promise((r) => setTimeout(r, 20));
  } finally {
    process.off('unhandledRejection', onUnhandled);
    console.error = originalError;
  }
  assert.deepEqual(unhandled, []);
  assert.match(String((errors[0] as unknown[])[0]), /New post push failed:/);
});
