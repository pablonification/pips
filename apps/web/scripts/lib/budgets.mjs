// Performance budgets read from a production build (SPEC "Performance architecture and budgets", story 154).
// Pure functions over the build's manifests, so tests/budgets.test.mjs can check them on a small fake build.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const KIB = 1024;
export const BUDGETS = {
  /** First-party JS loaded before a route's first render, gzip. Stretch goal 120 KiB. */
  routeInitialJsGzip: 150 * KIB,
  /** Everything the service worker precaches, uncompressed. */
  precache: 1.5 * KIB * KIB,
};

/** Every chunk `key` pulls in before it runs: itself and its static imports, transitively (not dynamic ones). */
export function staticClosure(manifest, keys) {
  const seen = new Set();
  const visit = (key) => {
    if (seen.has(key) || !manifest[key]) return;
    seen.add(key);
    for (const dep of manifest[key].imports ?? []) visit(dep);
  };
  keys.forEach(visit);
  return seen;
}

/** Route files in the manifest: `src/routes/…` modules, without the router plugin's `?tsr-split=…` suffix. */
export function routeFiles(manifest) {
  const files = new Set();
  for (const key of Object.keys(manifest)) {
    const file = key.replace(/\?.*$/, '');
    if (
      file.startsWith('src/routes/') &&
      !file.split('/').some((p) => p.startsWith('-')) &&
      file !== 'src/routes/__root.tsx'
    ) {
      files.add(file);
    }
  }
  return [...files].sort();
}

/** The layout route files above `file`: `src/routes/_app.tsx`, `src/routes/_app/_left-navbar.tsx`, … */
export function ancestorFiles(file, known) {
  const parts = file.replace(/^src\/routes\//, '').split('/');
  const ancestors = [];
  for (let i = 1; i < parts.length; i++) {
    const dir = parts.slice(0, i).join('/');
    for (const ext of ['.tsx', '.ts']) {
      const candidate = `src/routes/${dir}${ext}`;
      if (known.has(candidate)) ancestors.push(candidate);
    }
  }
  return ancestors;
}

/** The URL a route file serves, for the report: `_app/_left-navbar/pengumuman/$id/index.tsx` → `/pengumuman/$id`. */
export function routePath(file) {
  const parts = file
    .replace(/^src\/routes\//, '')
    .replace(/\.(tsx|ts)$/, '')
    .replace(/\.lazy$/, '')
    .split('/')
    .filter((p) => !p.startsWith('_') && p !== 'index')
    .map((p) => p.replace(/_$/, ''));
  return `/${parts.join('/')}`;
}

/**
 * For each route: the chunks loaded before its first render (the entry, the route's own split chunks and its
 * layouts', with their static imports) and their gzip size.
 */
export function routeInitialJs(manifest, gzipSizeOf) {
  const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
  const files = routeFiles(manifest);
  const known = new Set(files);
  const keysFor = (file) =>
    Object.keys(manifest).filter((k) => k === file || k.startsWith(`${file}?`));
  // Layouts (`_app.tsx` next to `_app/`) are counted with the pages under them, not on their own.
  const isLayout = (file) =>
    files.some((f) => f.startsWith(`${file.replace(/\.(tsx|ts)$/, '')}/`));
  return files
    .filter((file) => !isLayout(file))
    .map((file) => {
      const keys = [
        entryKey,
        ...[file, ...ancestorFiles(file, known)].flatMap(keysFor),
      ];
      const chunks = [
        ...new Set(
          [...staticClosure(manifest, keys)].map((k) => manifest[k].file),
        ),
      ]
        .filter((f) => f.endsWith('.js'))
        .sort();
      const gzip = chunks.reduce((sum, f) => sum + gzipSizeOf(f), 0);
      return { route: routePath(file), file, chunks, gzip };
    });
}

/** The URLs the service worker precaches, read from the manifest Workbox injected into `sw.js`. */
export function precacheUrls(swSource) {
  const urls = new Set();
  for (const m of swSource.matchAll(/["']?url["']?\s*:\s*"([^"]+)"/g))
    urls.add(m[1]);
  return [...urls].sort();
}

/** Measures a real build in `dist`. */
export function measureBuild(dist) {
  const read = (f) => fs.readFileSync(path.join(dist, f));
  const manifest = JSON.parse(read('.vite/manifest.json'));
  const gzipCache = new Map();
  const gzipSizeOf = (f) => {
    if (!gzipCache.has(f))
      gzipCache.set(f, zlib.gzipSync(read(f), { level: 9 }).length);
    return gzipCache.get(f);
  };
  const routes = routeInitialJs(manifest, gzipSizeOf);
  let chunkModules = {};
  try {
    chunkModules = JSON.parse(read('.vite/chunk-modules.json'));
  } catch {
    // Older builds have no module list.
  }
  for (const r of routes) {
    r.packages = [
      ...new Set(
        r.chunks
          .flatMap((c) => chunkModules[c] ?? [])
          .filter((m) => m.startsWith('npm:'))
          .map((m) => m.slice(4)),
      ),
    ].sort();
  }
  const urls = precacheUrls(read('sw.js').toString());
  const precache = urls.map((url) => ({
    url,
    bytes: fs.statSync(path.join(dist, url.replace(/^\//, ''))).size,
  }));
  return {
    routes,
    precache,
    precacheBytes: precache.reduce((s, p) => s + p.bytes, 0),
  };
}

/** Lines that break a budget; empty when everything fits. */
export function overBudget(result, budgets = BUDGETS) {
  const problems = result.routes
    .filter((r) => r.gzip > budgets.routeInitialJsGzip)
    .map(
      (r) =>
        `${r.route}: ${(r.gzip / KIB).toFixed(1)} KiB gzip before first render (budget ${budgets.routeInitialJsGzip / KIB} KiB)`,
    );
  if (result.precacheBytes > budgets.precache) {
    problems.push(
      `precache: ${(result.precacheBytes / KIB).toFixed(1)} KiB (budget ${budgets.precache / KIB} KiB)`,
    );
  }
  return problems;
}
