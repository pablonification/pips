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

/*
 * Review m4: the checks above would pass a recoloured, redrawn or filtered logo of the same shape. This one scales
 * the official public/logo/hmif.png as scripts/icons/build-icons.py does (Pillow's LANCZOS, premultiplied alpha, the
 * share of the side, centred on ink) and compares it with the icon pixel by pixel. Only rounding differs.
 */
const SHARES = {
  'android-chrome-192x192.png': 0.7,
  'android-chrome-384x384.png': 0.7,
  'android-chrome-512x512.png': 0.7,
  'android-chrome-maskable-192x192.png': 0.56,
  'android-chrome-maskable-512x512.png': 0.56,
  'apple-touch-icon.png': 0.7,
  'mstile-150x150.png': 0.7,
  'push-icon-192x192.png': 0.7,
  'push-badge-96x96.png': 0.86,
};

const sinc = (x) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
const lanczos = (x) => (Math.abs(x) < 3 ? sinc(x) * sinc(x / 3) : 0);

/** Pillow's resampling weights (libImaging/Resample.c, precompute_coeffs) for `from` → `to` pixels. */
function weights(from, to) {
  const scale = from / to;
  const filterscale = Math.max(scale, 1);
  const support = 3 * filterscale;
  return Array.from({ length: to }, (_, i) => {
    const center = (i + 0.5) * scale;
    const min = Math.max(Math.trunc(center - support + 0.5), 0);
    const max = Math.min(Math.trunc(center + support + 0.5), from);
    const k = [];
    for (let x = min; x < max; x++) k.push(lanczos((x - center + 0.5) / filterscale));
    const sum = k.reduce((a, b) => a + b, 0);
    return { min, k: k.map((w) => w / sum) };
  });
}

/** The logo resized to width × height (premultiplied, as Pillow does for RGBA), over ink: RGB floats. */
function logoOnInk(logo, width, height) {
  const pre = new Float64Array(logo.width * logo.height * 4);
  for (let i = 0; i < logo.width * logo.height; i++) {
    const a = logo.data[i * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) pre[i * 4 + c] = logo.data[i * 4 + c] * a;
    pre[i * 4 + 3] = logo.data[i * 4 + 3];
  }
  const wx = weights(logo.width, width);
  const wy = weights(logo.height, height);
  const rows = new Float64Array(width * logo.height * 4);
  for (let y = 0; y < logo.height; y++)
    for (let x = 0; x < width; x++)
      for (let c = 0; c < 4; c++) {
        let v = 0;
        wx[x].k.forEach((w, j) => (v += w * pre[(y * logo.width + wx[x].min + j) * 4 + c]));
        rows[(y * width + x) * 4 + c] = v;
      }
  const out = new Float64Array(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const px = [0, 0, 0, 0];
      for (let c = 0; c < 4; c++) wy[y].k.forEach((w, j) => (px[c] += w * rows[((wy[y].min + j) * width + x) * 4 + c]));
      const a = Math.min(1, Math.max(0, px[3] / 255));
      for (let c = 0; c < 3; c++) out[(y * width + x) * 3 + c] = Math.min(255, Math.max(0, px[c])) + (1 - a) * INK[c];
    }
  return out;
}

/** Mean absolute difference (0–255) between the icon's centre and the official logo placed as the script does. */
function logoDifference(icon, logo, share) {
  const size = icon.width;
  const width = Math.max(1, Math.round(size * share));
  const height = Math.max(1, Math.round((width * logo.height) / logo.width));
  const left = Math.floor((size - width) / 2);
  const top = Math.floor((size - height) / 2);
  const want = logoOnInk(logo, width, height);
  let sum = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      for (let c = 0; c < 3; c++)
        sum += Math.abs(icon.data[((top + y) * size + left + x) * 4 + c] - want[(y * width + x) * 3 + c]);
  return sum / (width * height * 3);
}

test('every icon shows the official logo itself, unaltered: the same pixels as public/logo/hmif.png scaled', () => {
  const logo = png('logo/hmif.png');
  for (const [f, share] of Object.entries(SHARES)) {
    const diff = logoDifference(png(f), logo, share);
    assert.ok(diff < 1.5, `${f}: differs from the official logo by ${diff.toFixed(2)} on average`);
  }
});

test('the comparison catches a recoloured or redrawn logo', () => {
  const logo = png('logo/hmif.png');
  const icon = png('android-chrome-512x512.png');
  const recoloured = { ...icon, data: Buffer.from(icon.data) };
  // Gold turned to green: swap red and green wherever the logo is.
  for (let i = 0; i < recoloured.data.length; i += 4) {
    const [r, g] = [recoloured.data[i], recoloured.data[i + 1]];
    recoloured.data[i] = g;
    recoloured.data[i + 1] = r;
  }
  assert.ok(logoDifference(recoloured, logo, 0.7) >= 1.5);
  const mirrored = { ...icon, data: Buffer.from(icon.data) };
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++)
      for (let c = 0; c < 4; c++) mirrored.data[(y * 512 + x) * 4 + c] = icon.data[(y * 512 + 511 - x) * 4 + c];
  assert.ok(logoDifference(mirrored, logo, 0.7) >= 1.5);
});
