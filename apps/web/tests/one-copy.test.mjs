// A small hook or helper lives in one file; screens import it. A newcomer copies what they find, so a second
// definition would grow into a third.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const src = path.resolve(import.meta.dirname, '../src');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'generated' ? [] : files(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}
const definedIn = (re) =>
  files(src)
    .filter((f) => re.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(src, f));

test('useOnline is defined once, in hooks/useOnline.ts', () => {
  assert.deepEqual(definedIn(/(function|const)\s+useOnline\b/), [
    'hooks/useOnline.ts',
  ]);
});

test('useDelayed is defined once, in hooks/useDelayed.ts', () => {
  assert.deepEqual(definedIn(/(function|const)\s+useDelayed\b/), [
    'hooks/useDelayed.ts',
  ]);
});
