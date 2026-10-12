// The e2e harness's screen list and record folders (e2e/fidelity/names.mjs, e2e/scripts/lib/paths.mjs).
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  PENGURUS_ROUTES,
  ROUTES,
  SIZES,
  screenNames,
} from '../e2e/fidelity/names.mjs';

test('the locked prototype has 216 screens: 36 routes × 3 layouts × 2 themes', () => {
  assert.equal(ROUTES.length, 25);
  assert.equal(PENGURUS_ROUTES.length, 11);
  const names = screenNames().map((s) => s.name);
  assert.equal(names.length, 216);
  assert.equal(new Set(names).size, 216);
  for (const n of names)
    assert.match(
      n,
      /^(phone|tablet|desk)-(anggota|pengurus)-[a-z-]+-(light|dark)$/,
    );
  assert.ok(names.includes('phone-anggota-beranda-light'));
  assert.ok(names.includes('desk-pengurus-pop-menu-own-dark'));
});

test('capture sizes match the locked screens’ pixel sizes', () => {
  // Locked PNGs: phone 780 × 1600, tablet 834 × 1068, desk 1440 × 956.
  const px = (s) => [
    s.width * s.deviceScaleFactor,
    s.height * s.deviceScaleFactor,
  ];
  assert.deepEqual(px(SIZES.phone), [780, 1600]);
  assert.deepEqual(px(SIZES.tablet), [834, 1068]);
  assert.deepEqual(px(SIZES.desk), [1440, 956]);
});

test('records go to PIPS_OPS_DIR/redesign when it is set', async () => {
  const previous = process.env.PIPS_OPS_DIR;
  try {
    process.env.PIPS_OPS_DIR = '/tmp/pips-ops-test';
    const { recordDir, redesignDir } = await import(
      `../e2e/scripts/lib/paths.mjs?case=${Date.now()}`
    );
    assert.equal(redesignDir(), path.join('/tmp/pips-ops-test', 'redesign'));
    assert.equal(
      recordDir('before-set'),
      path.join('/tmp/pips-ops-test', 'redesign', 'before-set'),
    );
  } finally {
    if (previous === undefined) delete process.env.PIPS_OPS_DIR;
    else process.env.PIPS_OPS_DIR = previous;
  }
});

test('report folder timestamps sort and contain no colons', async () => {
  const { stamp } = await import('../e2e/scripts/lib/paths.mjs');
  assert.equal(
    stamp(new Date('2026-10-12T14:03:09.123Z')),
    '2026-10-12T14-03-09',
  );
});
