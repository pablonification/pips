// C1: one check for every style file in src, so a new .css file can't slip past the design-system rules (C1 brief,
// step 11). The per-file tests (garis-shell-css, pengumuman-css, …) keep their own rules on top.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const appDir = path.resolve(import.meta.dirname, '..');
const srcDir = path.join(appDir, 'src');

/** The token source: the only place raw colour values may be written. */
const TOKENS = 'src/styles/garis/tokens.css';
/** Font faces: their `src` and `unicode-range` aren't design rules; only monospace is checked there. */
const FONTS = 'src/styles/garis/fonts.css';
/**
 * Raw colours allowed by name. The dev-only gallery (never in production builds, verify-production-bundle.mjs)
 * ports four of the prototype's docs.css colours; C1 doesn't restyle it (listed for Dev 1).
 */
const RAW_COLOUR_ALLOWED = { 'src/dev/garis/gallery.css': 4 };

function cssFiles(dir = srcDir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? cssFiles(path.join(dir, e.name))
        : e.name.endsWith('.css')
          ? [
              path
                .relative(appDir, path.join(dir, e.name))
                .split(path.sep)
                .join('/'),
            ]
          : [],
    )
    .sort();
}

/** The file without comments, so a note that names a rule isn't taken for the rule. */
const css = (f) =>
  fs
    .readFileSync(path.join(appDir, f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');

/** The problems in one stylesheet's text. Exported through the tests below on samples too. */
function problems(file, text) {
  const out = [];
  const monospace =
    /font-family:[^;]*\b(monospace|mono)\b|\bui-monospace\b|--font-mono/gi;
  for (const m of text.matchAll(monospace)) out.push(`monospace: ${m[0]}`);
  if (file === FONTS) return out;
  if (file !== TOKENS) {
    const raw = [
      ...text.matchAll(
        /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|\blab\(/gi,
      ),
    ].map((m) => m[0]);
    if (raw.length !== (RAW_COLOUR_ALLOWED[file] ?? 0))
      out.push(`raw colours: ${raw.join(' ')}`);
  }
  for (const m of text.matchAll(/font-size:\s*([\d.]+)(px|rem)/g)) {
    const px = Number(m[1]) * (m[2] === 'rem' ? 16 : 1);
    if (px < 12) out.push(`text under 12 px: ${m[0]}`);
  }
  for (const m of text.matchAll(/text-transform:\s*(uppercase|capitalize)/g))
    out.push(`added capitals: ${m[0]}`);
  for (const m of text.matchAll(/transition(-property)?:\s*all\b/g))
    out.push(`transition all: ${m[0]}`);
  return out;
}

test('every stylesheet in src follows the rules: tokens only, text ≥ 12 px, no added capitals, no transition: all, no monospace', () => {
  const files = cssFiles();
  assert.ok(
    files.includes(TOKENS) &&
      files.includes(FONTS) &&
      files.includes('src/index.css'),
  );
  const bad = files.flatMap((f) =>
    problems(f, css(f)).map((p) => `${f}: ${p}`),
  );
  assert.deepEqual(bad, []);
  for (const f of Object.keys(RAW_COLOUR_ALLOWED))
    assert.ok(files.includes(f), `${f} is allowed raw colours but is gone`);
});

test('the check catches each kind of problem in a new file', () => {
  const f = 'src/features/new/new.css';
  assert.deepEqual(problems(f, '.a { color: #fff; }'), ['raw colours: #fff']);
  assert.deepEqual(
    problems(f, '.a { box-shadow: 0 0 0 1px rgb(0 0 0 / .1); }'),
    ['raw colours: rgb('],
  );
  assert.deepEqual(problems(f, '.a { font-size: 11px; }'), [
    'text under 12 px: font-size: 11px',
  ]);
  assert.deepEqual(problems(f, '.a { font-size: 0.7rem; }'), [
    'text under 12 px: font-size: 0.7rem',
  ]);
  assert.deepEqual(problems(f, '.a { text-transform: uppercase; }'), [
    'added capitals: text-transform: uppercase',
  ]);
  assert.deepEqual(problems(f, '.a { transition: all 1s; }'), [
    'transition all: transition: all',
  ]);
  assert.deepEqual(
    problems(f, '.a { font-family: ui-monospace, monospace; }'),
    ['monospace: font-family: ui-monospace, monospace'],
  );
  assert.deepEqual(
    problems(
      f,
      '.a { color: var(--text); font-size: 12px; transition: opacity 1s; }',
    ),
    [],
  );
  // The token file may hold raw values; the fonts file is checked for monospace only.
  assert.deepEqual(problems(TOKENS, ':root { --gold: #f8c249; }'), []);
  assert.deepEqual(problems(FONTS, '@font-face { font-size: 1px; }'), []);
  assert.equal(
    problems(FONTS, '@font-face { font-family: Geist Mono, monospace; }')
      .length > 0,
    true,
  );
});
