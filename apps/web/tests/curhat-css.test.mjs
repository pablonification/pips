// P2-C: Curhat's styles (src/features/curhat/curhat.css) follow the design system's rules: colours only from tokens,
// the type scale and nothing under 12 px, no capitals or monospace added, layers inside the page only, and the
// prototype's values for the bubbles, the room square and the composer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const css = fs.readFileSync(
  path.resolve(import.meta.dirname, '../src/features/curhat/curhat.css'),
  'utf8',
);
const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (selector) => {
  const at = body.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} is styled`);
  return body.slice(at, body.indexOf('}', at));
};

test('no raw colours: tokens only', () => {
  const raw = [...body.matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\(/gi)].map(
    (m) => m[0],
  );
  assert.deepEqual(raw, []);
});

test('the type scale, nothing under 12 px, no added capitals, no monospace', () => {
  const scale = new Set([12, 13, 14, 15, 16, 17, 20, 24, 32]);
  const sizes = [...body.matchAll(/font-size:\s*(\d+)px/g)].map((m) => +m[1]);
  assert.ok(sizes.length >= 5, 'sizes found');
  assert.deepEqual(
    sizes.filter((s) => !scale.has(s)),
    [],
  );
  assert.doesNotMatch(body, /text-transform/);
  assert.doesNotMatch(body, /monospace|font-family/);
});

test('layers stay inside the page (0–3)', () => {
  const raw = [...body.matchAll(/z-index:\s*([^;]+);/g)]
    .map((m) => m[1].trim())
    .filter((v) => !/^[0-3]$/.test(v));
  assert.deepEqual(raw, []);
});

test('the prototype’s values: gold bubbles framed in ink, the 40 px room square, the 44 px composer growing to 5 lines', () => {
  assert.match(rule('.g-bubble.me'), /background: var\(--gold\)/);
  assert.match(rule('.g-bubble.me'), /inset 0 0 0 1\.5px var\(--ink\)/);
  assert.match(rule('.g-bubble.them'), /background: var\(--bg-surface\)/);
  assert.match(rule('.g-bubble'), /max-width: 82%/);
  assert.match(rule('.g-room-av'), /width: 40px/);
  assert.match(rule('.g-bubble .quote'), /background: var\(--quote-tint\)/);
  assert.match(rule('.g-composer textarea.g-field'), /min-height: 44px/);
  assert.match(rule('.g-composer textarea.g-field'), /max-height: 140px/);
  assert.match(rule('.g-chat-bar'), /position: sticky/);
});
