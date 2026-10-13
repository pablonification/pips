// C1: `fidelity:compare` (e2e/scripts/compare-runs.mjs) finds every way two fidelity runs can differ.
import assert from 'node:assert/strict';
import test from 'node:test';
import { compareRuns } from '../e2e/scripts/compare-runs.mjs';
import { blank } from '../e2e/scripts/lib/image.mjs';

const W = 100;
const H = 100;
const screen = (name, status = 'close', app = `app/${name}.png`) => ({
  name,
  status,
  app: status === 'not built yet' ? undefined : app,
});
const run = (...screens) => ({ screens });

/** Images by run and file; `dots` changed pixels drawn in red at the top left of the final capture. */
function loader(images) {
  return (runName, file) => images[runName]?.[file] ?? null;
}
const withDots = (img, dots) => {
  const out = { ...img, data: Uint8Array.from(img.data) };
  for (let i = 0; i < dots; i++) {
    out.data[i * 4] = 255;
    out.data[i * 4 + 1] = 0;
    out.data[i * 4 + 2] = 0;
  }
  return out;
};

test('identical captures with the same status are unchanged', () => {
  const img = blank(W, H);
  const rows = compareRuns(
    run(screen('a'), screen('b', 'different')),
    run(screen('a'), screen('b', 'different')),
    loader({
      baseline: { 'app/a.png': img, 'app/b.png': img },
      final: { 'app/a.png': img, 'app/b.png': img },
    }),
  );
  assert.deepEqual(
    rows.map((r) => [r.name, r.status]),
    [
      ['a', 'unchanged'],
      ['b', 'unchanged'],
    ],
  );
});

test('a capture with more changed pixels than the threshold is changed; one under it is not', () => {
  const img = blank(W, H);
  const load = (dots) =>
    loader({
      baseline: { 'app/a.png': img },
      final: { 'app/a.png': withDots(img, dots) },
    });
  // 10,000 pixels at 0.0001 (compare-before's threshold): 1 pixel is the limit.
  assert.equal(
    compareRuns(run(screen('a')), run(screen('a')), load(1))[0].status,
    'unchanged',
  );
  const changed = compareRuns(run(screen('a')), run(screen('a')), load(30))[0];
  assert.equal(changed.status, 'changed');
  assert.equal(changed.changedPixels, 30);
});

test('a status change, a size change and a missing screen or capture all count', () => {
  const img = blank(W, H);
  const rows = compareRuns(
    run(screen('status'), screen('size'), screen('gone'), screen('nofile')),
    run(
      screen('status', 'different'),
      screen('size'),
      screen('nofile'),
      screen('new'),
    ),
    loader({
      baseline: {
        'app/status.png': img,
        'app/size.png': img,
        'app/nofile.png': img,
      },
      final: { 'app/status.png': img, 'app/size.png': blank(W, H + 1) },
    }),
  );
  assert.deepEqual(
    rows.map((r) => [r.name, r.status, r.note]),
    [
      ['gone', 'missing', 'not in the final run'],
      ['new', 'missing', 'not in the baseline run'],
      ['nofile', 'missing', 'no final capture'],
      ['size', 'changed', 'size 100×100 → 100×101'],
      ['status', 'changed', 'close → different'],
    ],
  );
});

test('a screen neither run built is unchanged', () => {
  const rows = compareRuns(
    run(screen('x', 'not built yet')),
    run(screen('x', 'not built yet')),
    loader({}),
  );
  assert.equal(rows[0].status, 'unchanged');
});
