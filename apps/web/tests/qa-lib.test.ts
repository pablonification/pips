// F2's helpers for the cross-cutting checks (e2e/qa/lib.ts): colours and contrast (the focus ring's 3:1), the copy
// check's text normaliser and line diff, the motion sampler's threshold, and the type and alt-text rules.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  badAlt,
  contrastRatio,
  firstFace,
  isMonospace,
  missingLines,
  moved,
  normaliseText,
  over,
  parseColor,
  textLines,
  type MotionSample,
} from '../e2e/qa/lib';

test('parseColor reads the forms Chromium computes, and nothing it can’t', () => {
  assert.deepEqual(parseColor('rgb(27, 21, 8)'), { r: 27, g: 21, b: 8, a: 1 });
  assert.deepEqual(parseColor('rgba(0, 0, 0, 0.5)'), {
    r: 0,
    g: 0,
    b: 0,
    a: 0.5,
  });
  assert.deepEqual(parseColor('rgb(255 255 255 / 10%)'), {
    r: 255,
    g: 255,
    b: 255,
    a: 0.1,
  });
  const c = parseColor('color(srgb 1 0.5 0 / 0.25)');
  assert.ok(c);
  assert.equal(Math.round(c.g), 128);
  assert.equal(c.a, 0.25);
  assert.deepEqual(parseColor('transparent'), { r: 0, g: 0, b: 0, a: 0 });
  assert.equal(parseColor('oklab(0.5 0.1 0.1)'), null);
  assert.equal(parseColor('currentcolor'), null);
});

test('contrastRatio matches WCAG’s known pairs', () => {
  const black = { r: 0, g: 0, b: 0, a: 1 };
  const white = { r: 255, g: 255, b: 255, a: 1 };
  assert.equal(contrastRatio(black, white).toFixed(1), '21.0');
  assert.equal(contrastRatio(white, white), 1);
  // #777 on white is the classic 4.48:1.
  const grey = { r: 0x77, g: 0x77, b: 0x77, a: 1 };
  assert.equal(contrastRatio(grey, white).toFixed(2), '4.48');
  // Garis focus: ink #1B1508 on the light page #FCFBF8, gold #F8C249 on the dark page #0A0907: both well over 3:1.
  const ink = parseColor('rgb(27, 21, 8)')!;
  const page = parseColor('rgb(252, 251, 248)')!;
  assert.ok(contrastRatio(ink, page) > 3);
  const gold = parseColor('rgb(248, 194, 73)')!;
  const night = parseColor('rgb(10, 9, 7)')!;
  assert.ok(contrastRatio(gold, night) > 3);
  // Gold on gold fails, as a ring drawn on the gold header would.
  assert.ok(contrastRatio(gold, gold) < 3);
});

test('over blends a see-through colour onto an opaque one', () => {
  const half = over(
    { r: 255, g: 255, b: 255, a: 0.5 },
    { r: 0, g: 0, b: 0, a: 1 },
  );
  assert.equal(Math.round(half.r), 128);
  assert.equal(half.a, 1);
});

test('normaliseText folds quotes, dashes, ellipses and every kind of space', () => {
  assert.equal(
    normaliseText('  Tidak ada hasil untuk “zz”… Coba lagi — ya  '),
    'Tidak ada hasil untuk "zz"... Coba lagi - ya',
  );
  assert.equal(normaliseText('Kamis,\n8 Okt'), 'Kamis, 8 Okt');
});

test('textLines and missingLines diff the visible text line by line, counting repeats', () => {
  const proto = textLines('Beranda\n\nPengumuman\nKalender\nKalender');
  const app = textLines('Beranda\nKalender\nLayanan');
  assert.deepEqual(missingLines(proto, app), ['Pengumuman', 'Kalender']);
  assert.deepEqual(missingLines(app, proto), ['Layanan']);
});

test('moved: a still element passes, a transform, a fade or a shift beyond half a pixel fails', () => {
  const still: MotionSample = {
    transform: 'none',
    opacity: 1,
    x: 10,
    y: 20,
    w: 100,
    h: 40,
  };
  assert.equal(moved([still, still, { ...still, x: 10.3 }]), null);
  assert.equal(moved([still]), null);
  assert.match(
    moved([still, { ...still, transform: 'matrix(1, 0, 0, 1, 0, 8)' }])!,
    /^transform/,
  );
  assert.match(moved([still, { ...still, opacity: 0.6 }])!, /^opacity/);
  assert.match(moved([still, { ...still, y: 24 }])!, /^box/);
  assert.match(moved([still, { ...still, h: 60 }])!, /^box/);
});

test('firstFace and isMonospace read a computed font-family', () => {
  assert.equal(
    firstFace(
      '"Archivo Expanded", "Archivo Expanded Fallback", Geist, sans-serif',
    ),
    'Archivo Expanded',
  );
  assert.equal(firstFace('Geist, sans-serif'), 'Geist');
  assert.equal(isMonospace('Geist, sans-serif'), false);
  assert.equal(isMonospace('ui-monospace, Menlo, monospace'), true);
  assert.equal(isMonospace('"Geist Mono", monospace'), true);
});

test('badAlt: a file name or a generic word says nothing', () => {
  assert.equal(badAlt('hmif.png'), true);
  assert.equal(badAlt('Gambar'), true);
  assert.equal(badAlt('avatar'), true);
  assert.equal(badAlt('Logo HMIF ITB'), false);
  assert.equal(badAlt('Foto Raka Pratama'), false);
});
