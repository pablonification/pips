// P1-A: Beranda's and Kalender's styles (src/features/beranda/beranda.css, src/features/kalender/kalender.css) follow
// the design system: colours only from tokens, the type scale and nothing under 12 px, no capitals or monospace
// added, layers inside the page, no `transition: all`, the bars' draw-in never under reduced motion, and the
// prototype's narrow-phone and tablet rules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (rel) =>
  fs
    .readFileSync(path.resolve(import.meta.dirname, '..', rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
// Review m10: a header named a test file that doesn't exist. Every `tests/…` a header names must be there.
test('the styles’ headers name test files that exist', () => {
  for (const rel of [
    'src/features/beranda/beranda.css',
    'src/features/kalender/kalender.css',
  ]) {
    const raw = fs.readFileSync(
      path.resolve(import.meta.dirname, '..', rel),
      'utf8',
    );
    const named = [...raw.matchAll(/\btests\/[\w.-]+/g)].map((m) => m[0]);
    assert.ok(named.length > 0, `${rel} names its test`);
    for (const t of named)
      assert.ok(
        fs.existsSync(path.resolve(import.meta.dirname, '..', t)),
        `${rel} names ${t}`,
      );
  }
});

const FILES = {
  beranda: read('src/features/beranda/beranda.css'),
  kalender: read('src/features/kalender/kalender.css'),
};

for (const [name, body] of Object.entries(FILES)) {
  test(`${name}: no raw colours, tokens only`, () => {
    const raw = [
      ...body.matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\(|color-mix\(/gi),
    ].map((m) => m[0]);
    assert.deepEqual(raw, []);
  });

  test(`${name}: the type scale, nothing under 12 px, no added capitals, no monospace`, () => {
    const scale = new Set([12, 13, 14, 15, 16, 17, 20, 24, 32]);
    const sizes = [...body.matchAll(/font-size:\s*(\d+)px/g)].map((m) => +m[1]);
    assert.ok(sizes.length > 3, 'sizes found');
    assert.deepEqual(
      sizes.filter((s) => !scale.has(s)),
      [],
    );
    assert.doesNotMatch(body, /text-transform/);
    assert.doesNotMatch(body, /monospace|font-family/);
  });

  test(`${name}: layers stay inside the page (0–3), no transition: all`, () => {
    const raw = [...body.matchAll(/z-index:\s*([^;]+);/g)]
      .map((m) => m[1].trim())
      .filter((v) => !/^[0-3]$/.test(v));
    assert.deepEqual(raw, []);
    assert.doesNotMatch(body, /transition(?:-property)?:\s*all\b/);
  });

  test(`${name}: every class is the g- prefixed port`, () => {
    const roots = [...body.matchAll(/(?:^|[\s,{(])\.([a-z][\w-]*)/gm)].map(
      (m) => m[1],
    );
    const parts = new Set([
      'time',
      'wd',
      'dn',
      'key',
      'out',
      'today',
      'akademik',
      'himpunan',
      'point',
      'past',
      'h',
      'd',
      'tm',
      'ttl',
      'draw',
      'two',
      'grow',
      'brief',
      'prev',
      'ext',
      'block',
      'urgent',
    ]);
    assert.deepEqual(
      roots.filter((c) => !c.startsWith('g-') && !parts.has(c)),
      [],
    );
  });
}

test('the bars draw in 520 ms, 55 ms apart, and never under reduced motion', () => {
  const b = FILES.beranda;
  assert.match(
    b,
    /animation:\s*g-draw 520ms cubic-bezier\(0\.16, 1, 0\.3, 1\) both/,
  );
  assert.match(b, /animation-delay:\s*calc\(var\(--i\) \* 55ms \+ 120ms\)/);
  assert.match(
    b,
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.g-agenda\.draw \.g-ag-day \.g-mbars i\s*\{\s*animation:\s*none;/,
  );
});

test('tablets: the tiles in one row of eight; the narrowest phones: seven 44 px days and the follow-up button below', () => {
  assert.match(
    FILES.beranda,
    /@media \(min-width: 640px\)\s*\{\s*\.g-tiles\s*\{\s*grid-template-columns:\s*repeat\(8,/,
  );
  assert.match(
    FILES.kalender,
    /@media \(max-width: 340px\)\s*\{\s*\.g-month\s*\{\s*margin-inline:\s*-12px;/,
  );
  assert.match(
    FILES.beranda,
    /@media \(max-width: 340px\)[\s\S]*\.g-att > \.g-btn\s*\{\s*margin-left:\s*50px;/,
  );
});

// Review m8, Dev 1's decision: the Live Counting mark blinks four times like the prototype's `.live i`
// (garis.css: `animation: blink 1s step-end 4`), and reduced motion stops it with every other animation.
test('beranda: the Live Counting mark blinks four times, as the prototype', () => {
  const rule = FILES.beranda.match(/\.g-live i \{([^}]*)\}/);
  assert.ok(rule, '.g-live i exists');
  assert.match(rule[1], /animation:\s*g-blink 1s step-end 4;/);
  const base = read('src/styles/garis/base.css');
  assert.match(
    base,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important/,
  );
});
