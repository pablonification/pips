// The Garis icons in src/components/icons/ are the prototype's drawings (tests/fixtures/garis-icons.json, taken from
// the locked garis/ui.js by scripts/garis/gen-icons.mjs): one file per icon, every path, the glyph fills, and the
// frame (24 grid, currentColor, square caps, mitred corners, 1.5 px rendered stroke at 16, 20 and 24 px).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const appDir = path.resolve(import.meta.dirname, '..');
const dir = path.join(appDir, 'src/components/icons');
const { IC, IC_FILL, ICON_LABELS } = JSON.parse(fs.readFileSync(path.join(appDir, 'tests/fixtures/garis-icons.json'), 'utf8'));
const pascal = (k) => k.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
const attrs = (svg) => [...svg.matchAll(/<(\w+)([^>]*)\/>/g)].map((m) => `${m[1]} ${m[2].replace(/class=/g, 'className=').trim()}`);

test('54 icons and 11 two-tone service glyphs, as SPEC "Icons" counts them', () => {
  assert.equal(Object.keys(IC).length, 54);
  assert.equal(Object.keys(IC_FILL).length, 11);
});

for (const [key, drawing] of Object.entries(IC)) {
  test(`${key}: drawn exactly as in the prototype`, () => {
    const src = fs.readFileSync(path.join(dir, `${key}.tsx`), 'utf8').replace(/\s+/g, ' ');
    assert.match(src, new RegExp(`export function Icon${pascal(key)}\\(`));
    for (const el of attrs(drawing)) assert.ok(src.includes(`<${el} />`), `${key} lacks <${el} />`);
    if (IC_FILL[key]) {
      assert.match(src, new RegExp(`export function Glyph${pascal(key)}\\(`));
      for (const el of attrs(IC_FILL[key])) assert.ok(src.includes(`<${el} />`), `${key} glyph lacks <${el} />`);
    }
  });
}

test('the registry lists every icon with the prototype’s label', () => {
  const reg = fs.readFileSync(path.join(dir, 'registry.ts'), 'utf8');
  for (const [k, label] of Object.entries(ICON_LABELS)) assert.ok(reg.includes(`: '${label}',`), k);
});

test('the frame: 24 grid, currentColor, square caps, mitred corners, three sizes at a 1.5 px rendered stroke', () => {
  const src = fs.readFileSync(path.join(dir, 'icon.tsx'), 'utf8');
  for (const s of ['viewBox="0 0 24 24"', 'stroke="currentColor"', 'strokeLinecap="square"', 'strokeLinejoin="miter"', 'fill="none"', 'focusable="false"'])
    assert.ok(src.includes(s), s);
  // iconBox() as written in icon.tsx: sizes round up to 16, 20 or 24; the stroke is 1.5 × 24 / size.
  const iconBox = (size) => {
    const s = size <= 16 ? 16 : size <= 20 ? 20 : 24;
    return { s, stroke: +((1.5 * 24) / s).toFixed(2) };
  };
  assert.ok(src.includes('size <= 16 ? 16 : size <= 20 ? 20 : 24'));
  assert.deepEqual([16, 18, 20, 24, 40].map((n) => iconBox(n).s), [16, 20, 20, 24, 24]);
  for (const n of [16, 20, 24]) {
    const { s, stroke } = iconBox(n);
    assert.equal(Math.round(stroke * (s / 24) * 100) / 100, 1.5);
  }
});

test('inside buttons and the active tab the stroke renders 2 px (components.css)', () => {
  const css = fs.readFileSync(path.join(appDir, 'src/styles/garis/components.css'), 'utf8');
  for (const [s, w] of [[16, 3], [20, 2.4], [24, 2]]) {
    assert.match(css, new RegExp(`\\.g-ic\\.s${s} \\{\\s*stroke-width: ${w};`));
    assert.equal((w * s) / 24, 2);
  }
});

test('no icon is an image, and no icon file imports anything but its frame', () => {
  for (const f of fs.readdirSync(dir).filter((f) => Object.hasOwn(IC, f.replace('.tsx', '')))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(src, /<img|<image/);
    const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(imports, ['./icon'], f);
  }
});
