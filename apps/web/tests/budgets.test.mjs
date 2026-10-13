import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  BUDGETS,
  KIB,
  ancestorFiles,
  overBudget,
  precacheUrls,
  routeInitialJs,
  routePath,
} from '../scripts/lib/budgets.mjs';

// A small fake build: the entry imports react; the pengumuman page (split by the router plugin) imports the feed
// and lazily the composer; its layout `_app` imports the navbar.
const manifest = {
  'index.html': {
    file: 'assets/index.js',
    isEntry: true,
    imports: ['_react.js'],
    dynamicImports: [
      'src/routes/_app.tsx?tsr-split=component',
      'src/routes/_app/pengumuman/index.tsx?tsr-split=component',
    ],
  },
  '_react.js': { file: 'assets/react.js' },
  'src/routes/_app.tsx?tsr-split=component': {
    file: 'assets/_app.js',
    imports: ['_navbar.js'],
  },
  '_navbar.js': { file: 'assets/navbar.js', imports: ['_react.js'] },
  'src/routes/_app/pengumuman/index.tsx?tsr-split=component': {
    file: 'assets/pengumuman.js',
    imports: ['_feed.js'],
    dynamicImports: ['_composer.js'],
  },
  '_feed.js': { file: 'assets/feed.js' },
  '_composer.js': { file: 'assets/composer.js', imports: ['_camera.js'] },
  '_camera.js': { file: 'assets/camera.js' },
  'src/routes/login/index.tsx?tsr-split=component': { file: 'assets/login.js' },
};
const sizes = {
  'assets/index.js': 50,
  'assets/react.js': 40,
  'assets/_app.js': 5,
  'assets/navbar.js': 10,
  'assets/pengumuman.js': 20,
  'assets/feed.js': 30,
  'assets/composer.js': 100,
  'assets/camera.js': 200,
  'assets/login.js': 7,
};
const kib = (f) => sizes[f] * KIB;

test('a route counts the entry, its layouts and its own chunk with static imports, not lazy ones', () => {
  const routes = routeInitialJs(manifest, kib);
  assert.deepEqual(
    routes.map((r) => r.route),
    ['/pengumuman', '/login'],
  );
  const feed = routes.find((r) => r.route === '/pengumuman');
  assert.deepEqual(feed.chunks, [
    'assets/_app.js',
    'assets/feed.js',
    'assets/index.js',
    'assets/navbar.js',
    'assets/pengumuman.js',
    'assets/react.js',
  ]);
  assert.equal(feed.gzip, (50 + 40 + 5 + 10 + 20 + 30) * KIB);
  const login = routes.find((r) => r.route === '/login');
  assert.equal(login.gzip, (50 + 40 + 7) * KIB, 'no layout above /login');
});

test('layouts and URLs are read from file paths', () => {
  const known = new Set([
    'src/routes/_app.tsx',
    'src/routes/_app/_left-navbar.tsx',
    'src/routes/_app/_left-navbar/profil.tsx',
  ]);
  assert.deepEqual(
    ancestorFiles(
      'src/routes/_app/_left-navbar/profil/_settings-item/matkul/index.tsx',
      known,
    ),
    [
      'src/routes/_app.tsx',
      'src/routes/_app/_left-navbar.tsx',
      'src/routes/_app/_left-navbar/profil.tsx',
    ],
  );
  assert.equal(
    routePath('src/routes/_app/_left-navbar/pengumuman/$id/index.tsx'),
    '/pengumuman/$id',
  );
  assert.equal(routePath('src/routes/_app/_left-navbar/index.tsx'), '/');
  assert.equal(
    routePath(
      'src/routes/_app/_left-navbar/layanan/testi_/$type/$semester/$courseId/index.tsx',
    ),
    '/layanan/testi/$type/$semester/$courseId',
  );
  assert.equal(
    routePath(
      'src/routes/_app/_left-navbar/profil/_settings-item/matkul/tambah/index.tsx',
    ),
    '/profil/matkul/tambah',
  );
});

test('the precache list is read from the manifest Workbox injected into sw.js', () => {
  const sw =
    'precacheAndRoute([{url:"assets/index.js",revision:null},{"revision":"abc","url":"index.html"},{url:"logo/hmif.png",revision:"1"}])';
  assert.deepEqual(precacheUrls(sw), [
    'assets/index.js',
    'index.html',
    'logo/hmif.png',
  ]);
});

test('over-budget routes and precache are reported', () => {
  const result = {
    routes: [
      { route: '/', gzip: BUDGETS.routeInitialJsGzip },
      { route: '/pengumuman', gzip: BUDGETS.routeInitialJsGzip + 1 },
    ],
    precacheBytes: BUDGETS.precache + 1,
  };
  const problems = overBudget(result);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /^\/pengumuman: /);
  assert.match(problems[1], /^precache: /);
  assert.deepEqual(
    overBudget({ routes: [{ route: '/', gzip: 1 }], precacheBytes: 1 }),
    [],
  );
});

test('fonts: exactly two files, Geist ≤ 50 KiB and Archivo Expanded ≤ 30 KiB (C1)', () => {
  const ok = [
    { file: 'fonts/archivo-expanded-700-latin.woff2', bytes: 30 * KIB },
    { file: 'fonts/geist-latin-400-600.woff2', bytes: 50 * KIB },
  ];
  const base = { routes: [], precacheBytes: 0 };
  assert.deepEqual(overBudget({ ...base, fonts: ok }), []);
  const problems = (fonts) => overBudget({ ...base, fonts });
  assert.match(
    problems([ok[0], { ...ok[1], bytes: 50 * KIB + 1 }]).join(),
    /geist-latin-400-600\.woff2 50\.0 KiB \(budget 50 KiB\)/,
  );
  assert.match(
    problems([{ ...ok[0], bytes: 30 * KIB + 1 }, ok[1]]).join(),
    /archivo.* \(budget 30 KiB\)/,
  );
  assert.match(
    problems([...ok, { file: 'assets/inter.woff2', bytes: 1 }]).join(),
    /fonts: 3 files/,
  );
  assert.match(problems([ok[1]]).join(), /0 archivo files/);
});

test('budgets are strict by default since C1; BUDGETS_STRICT=0 is warn mode', async () => {
  const fs = await import('node:fs');
  const script = fs.readFileSync(
    new URL('../scripts/budgets.mjs', import.meta.url),
    'utf8',
  );
  assert.match(script, /process\.env\.BUDGETS_STRICT !== '0'/);
});
