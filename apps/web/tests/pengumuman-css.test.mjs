// P1-B: Pengumuman's styles (src/features/pengumuman/pengumuman.css) follow the design system's rules: colours only
// from tokens, the type scale and nothing under 12 px, no capitals or monospace added, layers inside the page only,
// prose no wider than 65 characters, and the picker in two rows of three on the narrowest phones.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const css = fs.readFileSync(
  path.resolve(
    import.meta.dirname,
    '../src/features/pengumuman/pengumuman.css',
  ),
  'utf8',
);
const body = css.replace(/\/\*[\s\S]*?\*\//g, '');

test('no raw colours: tokens only', () => {
  const raw = [...body.matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\(/gi)].map(
    (m) => m[0],
  );
  assert.deepEqual(raw, []);
});

test('the type scale, nothing under 12 px, no added capitals, no monospace', () => {
  const scale = new Set([12, 13, 14, 15, 16, 17, 20, 24, 32]);
  const sizes = [...body.matchAll(/font-size:\s*(\d+)px/g)].map((m) => +m[1]);
  assert.ok(sizes.length > 10, 'sizes found');
  assert.deepEqual(
    sizes.filter((s) => !scale.has(s)),
    [],
  );
  assert.doesNotMatch(body, /text-transform/);
  assert.doesNotMatch(body, /monospace|ui-monospace|font-family/);
});

test('layers stay inside the page (0–3); overlays use the shared scale', () => {
  const raw = [...body.matchAll(/z-index:\s*([^;]+);/g)]
    .map((m) => m[1].trim())
    .filter((v) => !/^[0-3]$/.test(v) && !/^var\(--z-[\w-]+\)$/.test(v));
  assert.deepEqual(raw, []);
});

test('prose is at most 65 characters a line', () => {
  const widths = [...body.matchAll(/max-width:\s*(\d+)ch/g)].map((m) => +m[1]);
  assert.ok(widths.length > 0);
  assert.ok(
    widths.every((w) => w <= 65),
    widths.join(','),
  );
});

test('the picker is two rows of three below 340 px (the prototype’s `@container phone` rule)', () => {
  assert.match(
    body,
    /@(?:media|container)[^{]*\(max-width:\s*340px\)\s*\{[\s\S]*?\.g-picker\s*\{[^}]*grid-template-columns:\s*repeat\(3,/,
  );
});
