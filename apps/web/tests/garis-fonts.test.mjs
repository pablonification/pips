// Self-hosted fonts (SPEC "Typography"): budgets, format, @font-face, and no third-party font request.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const appDir = path.resolve(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(appDir, p));
const KiB = 1024;

test('Geist (variable, Latin) is a woff2 of at most 50 KiB', () => {
  const f = read('public/fonts/geist-latin-400-600.woff2');
  assert.equal(f.subarray(0, 4).toString('latin1'), 'wOF2');
  assert.ok(f.length <= 50 * KiB, `${(f.length / KiB).toFixed(1)} KiB`);
});

test('the one Archivo Expanded instance is a woff2 of at most 30 KiB', () => {
  const f = read('public/fonts/archivo-expanded-700-latin.woff2');
  assert.equal(f.subarray(0, 4).toString('latin1'), 'wOF2');
  assert.ok(f.length <= 30 * KiB, `${(f.length / KiB).toFixed(1)} KiB`);
});

test('fonts.css declares both faces from /fonts/ with font-display, plus metric-matched fallbacks', () => {
  const css = read('src/styles/garis/fonts.css').toString();
  const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
  const geist = faces.find((f) => /font-family: 'Geist';/.test(f));
  const archivo = faces.find((f) => /font-family: 'Archivo Expanded';/.test(f));
  assert.match(geist, /url\('\/fonts\/geist-latin-400-600\.woff2'\) format\('woff2'\)/);
  assert.match(geist, /font-weight: 400 600/);
  assert.match(geist, /font-display: swap/);
  assert.match(archivo, /url\('\/fonts\/archivo-expanded-700-latin\.woff2'\) format\('woff2'\)/);
  assert.match(archivo, /font-weight: 700/);
  assert.match(archivo, /font-display: swap/);
  for (const fb of ['Geist Fallback', 'Archivo Expanded Fallback']) {
    const face = faces.find((f) => f.includes(`'${fb}'`));
    assert.ok(face, fb);
    assert.match(face, /size-adjust: [\d.]+%/);
    assert.match(face, /ascent-override: [\d.]+%/);
  }
});

test('index.html preloads Geist, the one preloaded font, and requests no third-party fonts', () => {
  const html = read('index.html').toString();
  const preloads = [...html.matchAll(/<link[^>]*rel="preload"[^>]*>/g)].map((m) => m[0]);
  const fonts = preloads.filter((l) => /as="font"/.test(l));
  assert.equal(fonts.length, 1);
  assert.match(fonts[0], /href="\/fonts\/geist-latin-400-600\.woff2"/);
  assert.match(fonts[0], /type="font\/woff2"/);
  assert.match(fonts[0], /crossorigin/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test('no stylesheet in src loads a font from another origin, and no monospace face is shipped', () => {
  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
    );
  const css = walk(path.join(appDir, 'src')).filter((f) => f.endsWith('.css'));
  for (const f of css) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /fonts\.(googleapis|gstatic)\.com/, f);
  const files = fs.readdirSync(path.join(appDir, 'public/fonts'));
  assert.deepEqual(files.sort(), ['archivo-expanded-700-latin.woff2', 'geist-latin-400-600.woff2']);
});
