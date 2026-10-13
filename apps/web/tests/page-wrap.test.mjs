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

// Found in P3-C round 2: the two rules were nested inside `.g-legacy .min-h-screen:not(.fixed)` (CSS nesting), so
// they matched only a wrapper inside a legacy full-window screen, never the real one, and the text checks above
// still passed. They must sit at the top level of the file.
test('the page wrapper rules are not nested in another rule', () => {
  const depthAt = (index) => {
    let depth = 0;
    for (let i = 0; i < index; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    return depth;
  };
  const clip = css.search(/\.g-page-wrap\s*\{\s*overflow-x:\s*clip;/);
  const fallback = css.indexOf('@supports not (overflow-x: clip)');
  assert.ok(clip >= 0 && fallback >= 0);
  assert.equal(depthAt(clip), 0, '.g-page-wrap { overflow-x: clip }');
  assert.equal(depthAt(fallback), 0, '@supports not (overflow-x: clip)');
});
