// The review's routes (e2e/review/routes.ts) cover the shell's route registry (src/lib/shell/routes.ts) and /login:
// a new route fails here until the sweep and the catalogue know it. The type below fails the type check too.
import assert from 'node:assert/strict';
import test from 'node:test';
import { FORWARDING, LEFT_OUT, ROUTES } from '../e2e/review/routes';
import { ROUTE_META, type ShellPath } from '../src/lib/shell/routes';

type Swept =
  | Exclude<ShellPath, (typeof LEFT_OUT)[number] | keyof typeof FORWARDING>
  | '/login';
// Compile-time: every swept path has an entry, and nothing else does.
const _every: Record<Swept, unknown> = ROUTES;
const _only: Record<keyof typeof ROUTES, unknown> = {} as Record<
  Swept,
  unknown
>;
void _every;
void _only;

test('every registry route is swept, forwarded or left out, and /login is swept', () => {
  const registry = Object.keys(ROUTE_META).sort();
  const known = [
    ...Object.keys(ROUTES).filter((p) => p !== '/login'),
    ...Object.keys(FORWARDING),
    ...LEFT_OUT,
  ].sort();
  assert.deepEqual(known, registry);
  assert.ok('/login' in ROUTES);
});

test('every URL fills its params with a value and is a path', () => {
  for (const [p, r] of Object.entries(ROUTES)) {
    assert.ok(r.url.startsWith('/'), p);
    assert.ok(!r.url.includes('$'), `${p}: ${r.url}`);
    assert.ok(r.as.length > 0, p);
  }
});
