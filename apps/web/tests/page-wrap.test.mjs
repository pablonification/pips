// P2-C review minor 6: the wrapper around today's screens (routes/_app/_left-navbar.tsx) clips sideways with
// `overflow-x: clip`, so it isn't a second scrolling box that sticky bars stick to, and falls back to `hidden` where
// `clip` isn't supported (Safari before 16), so those browsers keep the sideways clipping they had.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (file) =>
  fs.readFileSync(path.resolve(import.meta.dirname, '..', file), 'utf8');
const css = read('src/styles/garis/shell.css').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

test('the page wrapper clips with clip, and with hidden where clip is unsupported', () => {
  const wrapper = read('src/routes/_app/_left-navbar.tsx');
  assert.match(wrapper, /className="g-page-wrap\b/);
  assert.doesNotMatch(wrapper, /overflow-x-(hidden|clip|auto|scroll)/);
  assert.match(css, /\.g-page-wrap\s*\{\s*overflow-x:\s*clip;\s*\}/);
  assert.match(
    css,
    /@supports not \(overflow-x: clip\)\s*\{\s*\.g-page-wrap\s*\{\s*overflow-x:\s*hidden;\s*\}\s*\}/,
  );
});
