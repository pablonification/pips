// P0-C: the shell's styles (src/styles/garis/shell.css) follow the design system's rules like the components do:
// colours only from tokens, layers only from the one z-index scale, the prototype's breakpoints and sizes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const css = fs.readFileSync(path.resolve(import.meta.dirname, '../src/styles/garis/shell.css'), 'utf8');
const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (sel) => {
  const at = body.indexOf(`${sel} {`);
  assert.notEqual(at, -1, `no ${sel} rule`);
  return body.slice(at, body.indexOf('}', at));
};

test('no raw colours: tokens only', () => {
  const raw = [...body.matchAll(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/gi)].map((m) => m[0]);
  assert.deepEqual(raw, []);
});

test('layers come from the scale: search is a modal over its scrim, the skip link above everything', () => {
  const raw = [...body.matchAll(/z-index:\s*([^;]+);/g)].map((m) => m[1].trim()).filter((v) => !/^var\(--z-[\w-]+\)$/.test(v) && !/^[0-3]$/.test(v));
  assert.deepEqual(raw, [], 'only the scale, or 0–3 inside the page (the sticky top bar, the agenda card)');
  assert.match(rule('.g-palette'), /z-index: var\(--z-modal\)/);
  assert.match(rule('.g-palette-scrim'), /z-index: var\(--z-scrim\)/);
  assert.match(rule('.g-skip'), /z-index: var\(--z-toast\)/);
});

test('the prototype’s sizes: a 248 px sidebar, an 88 px rail from 640 px, a 720 px column, 44 px search and avatar on gold', () => {
  assert.match(rule('.g-desk'), /grid-template-columns: 248px minmax\(0, 1fr\)/);
  assert.match(body, /@media \(min-width: 640px\) \{\s*\.g-shell \{\s*flex-direction: row;/);
  assert.match(body, /\.g-tabbar \{\s*order: -1;\s*flex: none;\s*width: 88px;/);
  assert.match(body, /max-width: 720px;/);
  assert.match(rule('.g-search-pill'), /min-height: 44px/);
  assert.match(rule('.g-top.gold .g-avatar'), /width: 44px;\s*height: 44px/);
  assert.match(rule('.g-top'), /position: sticky;\s*top: 0;/);
  // The active tab and sidebar item: the gold keycap.
  for (const sel of [".g-tab[aria-current='page'] .cap", ".g-side-item[aria-current='page']"])
    assert.match(rule(sel), /background: var\(--gold\);[\s\S]*inset 0 0 0 1\.5px var\(--ink\)/, sel);
});

test('no text-transform and no font under 12 px', () => {
  assert.doesNotMatch(body, /text-transform/);
  const sizes = [...body.matchAll(/font-size: (\d+)px/g)].map((m) => +m[1]);
  assert.ok(sizes.length > 5 && sizes.every((s) => s >= 12), sizes.join(','));
});
