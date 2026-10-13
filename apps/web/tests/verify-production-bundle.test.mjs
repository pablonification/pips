// C1: scripts/verify-production-bundle.mjs on small fixture builds: one clean, and one for each thing that must
// never ship.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verify } from '../scripts/verify-production-bundle.mjs';

/** A minimal production build: the shell, one route chunk, the logo, a manifest icon and a service worker. */
const CLEAN_SW = [
  'var IMAGES=`images-v1`,RETIRED=[`assets-cache`,`icons-cache`,`google-fonts-cache`];',
  'precacheAndRoute([{"revision":"1","url":"index.html"},{"revision":null,"url":"assets/index-a.js"},',
  '{"revision":"2","url":"logo/hmif.png"},{"revision":"3","url":"android-chrome-192x192.png"}]);',
  'registerRoute(new NavigationRoute(createHandlerBoundToURL(`/index.html`),{denylist:[]}));',
  'registerRoute(e=>e,new CacheFirst({cacheName:IMAGES,plugins:[new ExpirationPlugin({maxEntries:80})]}));',
  'self.addEventListener(`push`,e=>e);self.addEventListener(`notificationclick`,e=>e);',
  'registerRoute(({url})=>url.pathname===`/share-file-handler`,h,`POST`);',
].join('');

function build(changes = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pips-bundle-'));
  const files = {
    'index.html': '<!doctype html><div id="root"></div>',
    'assets/index-a.js': 'console.info("app")',
    'logo/hmif.png': 'png',
    'android-chrome-192x192.png': 'png',
    'manifest.webmanifest': JSON.stringify({
      icons: [{ src: '/android-chrome-192x192.png' }],
    }),
    'sw.js': CLEAN_SW,
    ...changes,
  };
  for (const [f, text] of Object.entries(files)) {
    if (text === null) continue;
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), text);
  }
  return dir;
}

test('a clean build passes', () => {
  assert.deepEqual(verify(build()), []);
});

test('development-only code fails: the test login, the gallery, the shell test page', () => {
  for (const text of [
    'fetch("/api/auth/login/dev")',
    'h1("Sistem desain Garis · PIPS!")',
    'p("Halaman uji shell")',
  ]) {
    const problems = verify(build({ 'assets/dev.js': text }));
    assert.equal(problems.length, 1, text);
    assert.match(problems[0], /development-only code/);
  }
});

test('the review prototypes and source maps fail', () => {
  assert.match(
    verify(build({ 'prototypes/hmif-garis-prototype.html': '<html>' })).join(),
    /prototypes\/: the review prototypes/,
  );
  assert.match(
    verify(build({ 'assets/index-a.js.map': '{}' })).join(),
    /index-a\.js\.map: a source map/,
  );
});

test('the precache fails with prototypes, maps, other images, or over 1.5 MiB', () => {
  const sw = (entry) =>
    CLEAN_SW.replace(
      '{"revision":"1","url":"index.html"}',
      `{"revision":"1","url":"index.html"},${entry}`,
    );
  assert.match(
    verify(
      build({
        'sw.js': sw('{"revision":"9","url":"img/home/calendar-bg.png"}'),
        'img/home/calendar-bg.png': 'png',
      }),
    ).join(),
    /calendar-bg\.png \(an image outside the shell\)/,
  );
  assert.match(
    verify(
      build({
        'sw.js': sw('{"revision":"9","url":"prototypes/garis/app.js"}'),
      }),
    ).join(),
    /prototypes\/garis\/app\.js \(review prototypes\)/,
  );
  assert.match(
    verify(
      build({ 'sw.js': sw('{"revision":"9","url":"assets/x.js.map"}') }),
    ).join(),
    /x\.js\.map \(a source map\)/,
  );
  assert.match(
    verify(
      build({
        'sw.js': sw('{"revision":"9","url":"assets/big.js"}'),
        'assets/big.js': 'x'.repeat(1.5 * 1024 * 1024),
      }),
    ).join(),
    /precache: .* KiB \(budget 1536 KiB\)/,
  );
});

test('the service worker fails without its fallback, image bound, push, clicks or share target, or with a catch-all cache', () => {
  const without = (from, to = '') =>
    verify(build({ 'sw.js': CLEAN_SW.replace(from, to) })).join();
  assert.match(
    without('`/index.html`', '`/x`'),
    /missing the app-shell navigation fallback/,
  );
  assert.match(without('maxEntries:80'), /missing the bounded image cache/);
  assert.match(without('addEventListener(`push`'), /missing push/);
  assert.match(
    without('addEventListener(`notificationclick`'),
    /missing notification clicks/,
  );
  assert.match(without('/share-file-handler'), /missing the share target/);
  assert.match(
    verify(
      build({
        'sw.js': `${CLEAN_SW}registerRoute(e=>e,new CacheFirst({cacheName:\`assets-cache\`}));`,
      }),
    ).join(),
    /a catch-all asset cache/,
  );
  assert.match(verify(build({ 'sw.js': null })).join(), /no service worker/);
});
