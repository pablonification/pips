// The e2e harness's image comparison (e2e/scripts/lib/image.mjs), used by compare-before and fidelity.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  blank,
  fit,
  pixelDiff,
  readPng,
  resize,
  sideBySide,
  ssim,
  writePng,
} from '../e2e/scripts/lib/image.mjs';

/** A white image with a black square at (x, y). */
function square(width, height, x, y, size) {
  const img = blank(width, height);
  for (let yy = y; yy < y + size; yy++)
    for (let xx = x; xx < x + size; xx++)
      img.data.set([0, 0, 0, 255], (yy * width + xx) * 4);
  return img;
}

test('identical images: no changed pixels and SSIM 1', () => {
  const a = square(64, 64, 10, 10, 20);
  const d = pixelDiff(a, square(64, 64, 10, 10, 20));
  assert.equal(d.changed, 0);
  assert.equal(d.ratio, 0);
  assert.ok(Math.abs(ssim(a, a, 64) - 1) < 1e-9);
});

test('a moved square changes pixels in proportion and lowers SSIM', () => {
  const a = square(100, 100, 10, 10, 20);
  const b = square(100, 100, 50, 50, 20);
  const d = pixelDiff(a, b);
  assert.equal(d.changed, 800); // 400 pixels lost + 400 gained
  assert.equal(d.ratio, 0.08);
  assert.ok(ssim(a, b, 100) < 0.95);
});

test('a blank screen is far from a busy one', () => {
  const busy = blank(120, 120);
  for (let i = 0; i < busy.data.length; i += 4)
    busy.data.set((i / 4) % 7 < 3 ? [0, 0, 0, 255] : [255, 255, 255, 255], i);
  assert.ok(ssim(busy, blank(120, 120), 120) < 0.5);
});

test('pixelDiff refuses images of different sizes', () => {
  assert.throws(() => pixelDiff(blank(10, 10), blank(10, 11)), /size differs/);
});

test('resize averages areas and keeps a uniform colour', () => {
  const half = resize(blank(40, 20, [10, 20, 30]), 20, 10);
  assert.equal(half.width, 20);
  assert.equal(half.height, 10);
  assert.deepEqual([...half.data.subarray(0, 4)], [10, 20, 30, 255]);
  const grey = resize(square(2, 2, 0, 0, 1), 1, 1); // one black pixel of four
  assert.equal(grey.data[0], Math.round((255 * 3) / 4));
});

test('fit pads and crops from the top left', () => {
  const small = square(4, 4, 0, 0, 4);
  const padded = fit(small, 6, 6);
  assert.deepEqual([...padded.data.subarray(0, 4)], [0, 0, 0, 255]);
  assert.deepEqual(
    [...padded.data.subarray((5 * 6 + 5) * 4, (5 * 6 + 5) * 4 + 4)],
    [255, 255, 255, 255],
  );
  assert.equal(fit(padded, 2, 2).data.length, 2 * 2 * 4);
});

test('sideBySide lays images out at one height with gaps', () => {
  const out = sideBySide([blank(10, 20), blank(20, 10)], 20, 4);
  // 10 wide at height 20, 40 wide at height 20, three gaps of 4
  assert.equal(out.width, 10 + 40 + 12);
  assert.equal(out.height, 20 + 8);
});

test('PNG round trip', () => {
  const file = path.join(
    mkdtempSync(path.join(tmpdir(), 'pips-e2e-')),
    'a.png',
  );
  const img = square(8, 8, 2, 2, 3);
  writePng(file, img);
  const back = readPng(file);
  assert.equal(back.width, 8);
  assert.equal(pixelDiff(img, back).changed, 0);
});
