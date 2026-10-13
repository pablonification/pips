// C1: the before set's states run against the redesigned app, and a state the app no longer has is listed as
// removed by compare-before, not as changed or missing.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { STATES } from '../e2e/capture/states';
import { captureStatus } from '../e2e/scripts/lib/compare.mjs';

test('the install tutorial is removed, keeps its path and still captures what a phone browser opens', () => {
  const install = STATES.find((s) => s.id === 'install-prompt');
  assert.ok(install);
  assert.equal(install.path, '/');
  assert.equal(install.installed, false);
  assert.match(install.removed ?? '', /install gate/);
});

test('every state opens a new path, never an old one (they redirect)', () => {
  const old =
    /^\/(home|timeline|settings|calendar|add-announcement|socket)(\/|$|\?)/;
  assert.deepEqual(
    STATES.filter((s) => old.test(s.path)).map((s) => `${s.id}: ${s.path}`),
    [],
  );
  assert.equal(new Set(STATES.map((s) => s.id)).size, STATES.length);
});

test('compare-before: removed wins over the pixels; otherwise missing, changed or unchanged', () => {
  const threshold = 0.0001;
  assert.equal(
    captureStatus({ captured: true, removed: 'gone', ratio: 0.5, threshold }),
    'removed',
  );
  assert.equal(
    captureStatus({
      captured: true,
      removed: 'gone',
      sizeDiffers: true,
      threshold,
    }),
    'removed',
  );
  assert.equal(captureStatus({ captured: false, threshold }), 'missing');
  assert.equal(
    captureStatus({ captured: true, ratio: 0.001, threshold }),
    'changed',
  );
  assert.equal(
    captureStatus({ captured: true, sizeDiffers: true, threshold }),
    'changed',
  );
  assert.equal(
    captureStatus({ captured: true, ratio: 0.00001, threshold }),
    'unchanged',
  );
});
