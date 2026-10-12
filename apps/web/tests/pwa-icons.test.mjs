// P0-C: the installed app's look. The manifest colours come from the tokens, the page is called PIPS!, and every
// icon is the official logo, whole, on HMIF's ink (scripts/icons/build-icons.py), never a redrawn mark.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PNG } from 'pngjs';

const appDir = path.resolve(import.meta.dirname, '..');
const read = (f) => fs.readFileSync(path.join(appDir, f), 'utf8');
const png = (f) => PNG.sync.read(fs.readFileSync(path.join(appDir, 'public', f)));
const INK = [0x1b, 0x15, 0x08];

test('the manifest: the light app background as theme colour, ink behind the splash, the icons it names exist', () => {
  const vite = read('vite.config.ts');
  assert.match(vite, /theme_color: '#FCFBF8'/);
  assert.match(vite, /background_color: '#1B1508'/);
  assert.match(read('src/styles/garis/tokens.css'), /--bg-app: #fcfbf8;/);
  assert.match(read('src/styles/garis/tokens.css'), /--ink: #1b1508;/);
  for (const [, src] of vite.matchAll(/src: '\/(android-chrome[^']+)'/g)) assert.ok(fs.existsSync(path.join(appDir, 'public', src)), src);
  // Fonts are precached; no Google Fonts are cached at run time (P0-A self-hosts them).
  assert.match(vite, /globPatterns: \[[^\]]*woff2/);
  assert.doesNotMatch(read('src/sw.ts'), /registerRoute\([^)]*fonts\.(googleapis|gstatic)/);
});

test('the page is called PIPS!, and no redrawn logo is linked', () => {
  const html = read('index.html');
  assert.match(html, /<title>PIPS!<\/title>/);
  assert.doesNotMatch(html, /HMIF App|safari-pinned-tab|mask-icon/);
  assert.ok(!fs.existsSync(path.join(appDir, 'public/safari-pinned-tab.svg')));
  assert.match(read('src/sw.ts'), /icon: '\/push-icon-192x192\.png',\s+badge: '\/push-badge-96x96\.png'/);
});

test('every icon is square, ink at the edges, with the logo whole in the middle', () => {
  const files = {
    'android-chrome-192x192.png': 192,
    'android-chrome-384x384.png': 384,
    'android-chrome-512x512.png': 512,
    'android-chrome-maskable-192x192.png': 192,
    'android-chrome-maskable-512x512.png': 512,
    'apple-touch-icon.png': 180,
    'mstile-150x150.png': 270,
    'push-icon-192x192.png': 192,
    'push-badge-96x96.png': 96,
    'favicon-32x32.png': 32,
    'favicon-16x16.png': 16,
  };
  for (const [f, size] of Object.entries(files)) {
    const img = png(f);
    assert.equal(img.width, size, f);
    assert.equal(img.height, size, f);
    const at = (x, y) => [...img.data.slice((y * size + x) * 4, (y * size + x) * 4 + 3)];
    for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) assert.deepEqual(at(x, y), INK, `${f} corner`);
    if (size < 96) continue;
    // The logo keeps its 800 × 533 shape: the non-ink box around the centre is 3:2.
    let [x0, y0, x1, y1] = [size, size, 0, 0];
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const p = at(x, y);
        if (Math.abs(p[0] - INK[0]) + Math.abs(p[1] - INK[1]) + Math.abs(p[2] - INK[2]) > 24) {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
      }
    const ratio = (x1 - x0 + 1) / (y1 - y0 + 1);
    assert.ok(Math.abs(ratio - 800 / 533) < 0.06, `${f} logo ratio ${ratio}`);
    assert.ok(Math.abs((x0 + x1) / 2 - (size - 1) / 2) <= 1.5, `${f} centred`);
    // The maskable icons keep the whole logo inside the 80 % safe circle.
    if (f.includes('maskable')) {
      const r = Math.hypot(x1 - x0 + 1, y1 - y0 + 1) / 2;
      assert.ok(r <= 0.4 * size, `${f}: corners ${r} px from the centre`);
    }
  }
});
