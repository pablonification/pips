// Fails if a production build in dist/ has anything that must never ship (run after `pnpm build`; CI does):
// - development-only code: the test login, the Garis gallery (/dev/garis) or the shell's test page (/dev/shell).
//   Staging-mode builds include them on purpose, so don't run this on them;
// - a `prototypes/` folder, any source map (`.map`) or a script or style pointing at one;
// - build metadata the server would hand out: a dot folder (`.vite/`) or `chunk-modules.json` (the budget check
//   reads them from dist-meta/, beside the build);
// - a comment in index.html naming a work item;
// - a build tool in package.json's runtime dependencies;
// - a precache (`self.__WB_MANIFEST` in sw.js) beyond the app shell and route chunks: no prototypes, no source maps,
//   no images but the official logo and the manifest's icons, and at most 1.5 MiB;
// - a service worker without the app-shell navigation fallback, the bounded same-origin image cache, push,
//   notification clicks or the share target, or with a catch-all asset cache.
//   node scripts/verify-production-bundle.mjs [dist]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUDGETS, KIB, precacheUrls } from './lib/budgets.mjs';

const FORBIDDEN_TEXT = [
  '/api/auth/login/dev',
  // A sentence only the gallery has (src/dev/garis/).
  'Sistem desain Garis · PIPS!',
  // A sentence only the shell's test page has (src/dev/shell/).
  'Halaman uji shell',
];

// Task and finding ids such as P0-A, F2-007, T3, C1: none may appear in index.html.
const WORK_ITEM = /\b(?:[PF]\d-[A-Z\d]+|[TC]\d|PROD-PASS)\b/;

// Packages that only run while building; in `dependencies` they would look like part of the app.
const BUILD_TOOL =
  /^(?:vite|typescript|eslint.*|@vitejs\/.+|@types\/.+|.*vite-plugin.*|@tailwindcss\/vite)$/;

/** The build tools `pkg` (a package.json) lists as runtime dependencies. */
export function buildToolsInDependencies(pkg) {
  return Object.keys(pkg.dependencies ?? {})
    .filter((name) => BUILD_TOOL.test(name))
    .sort()
    .map((name) => `package.json: ${name} is a build tool in dependencies`);
}

/** Every file in `dir`, relative to it with `/` separators. */
function files(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

/** The icons the web manifest names, which the precache may hold for the installed app. */
function manifestIcons(dir) {
  const file = join(dir, 'manifest.webmanifest');
  if (!existsSync(file)) return [];
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  return (manifest.icons ?? []).map((i) => i.src.replace(/^\//, ''));
}

/** The problems in a build folder; empty when it may ship. */
export function verify(dir) {
  const problems = [];
  const all = files(dir);
  for (const f of all.filter((f) => /\.(js|html)$/.test(f))) {
    const text = readFileSync(join(dir, f), 'utf8');
    for (const t of FORBIDDEN_TEXT)
      if (text.includes(t)) problems.push(`${f}: development-only code (${t})`);
  }
  if (all.some((f) => f.startsWith('prototypes/')))
    problems.push('prototypes/: the review prototypes are in the build');
  for (const f of all.filter((f) => f.endsWith('.map')))
    problems.push(`${f}: a source map is in the build`);
  for (const f of all.filter(
    (f) =>
      f.split('/').some((p) => p.startsWith('.')) ||
      /(^|\/)chunk-modules\.json$/.test(f),
  ))
    problems.push(`${f}: build metadata is in the build`);
  for (const f of all.filter((f) => /\.(js|css)$/.test(f)))
    if (/[#@] sourceMappingURL=/.test(readFileSync(join(dir, f), 'utf8')))
      problems.push(`${f}: points at a source map`);
  if (all.includes('index.html')) {
    const html = readFileSync(join(dir, 'index.html'), 'utf8');
    for (const [, comment] of html.matchAll(/<!--([\s\S]*?)-->/g)) {
      const label = WORK_ITEM.exec(comment);
      if (label)
        problems.push(`index.html: a comment names a work item (${label[0]})`);
    }
  }

  if (!all.includes('sw.js')) {
    problems.push('sw.js: no service worker');
    return problems;
  }
  const sw = readFileSync(join(dir, 'sw.js'), 'utf8');
  const urls = precacheUrls(sw);
  if (!urls.includes('index.html'))
    problems.push('precache: no index.html (the app shell)');
  const images = new Set(['logo/hmif.png', ...manifestIcons(dir)]);
  let bytes = 0;
  for (const url of urls) {
    const f = url.replace(/^\//, '');
    if (f.startsWith('prototypes/'))
      problems.push(`precache: ${f} (review prototypes)`);
    if (f.endsWith('.map')) problems.push(`precache: ${f} (a source map)`);
    if (/\.(png|jpe?g|gif|webp|avif|svg|ico)$/.test(f) && !images.has(f))
      problems.push(`precache: ${f} (an image outside the shell)`);
    if (existsSync(join(dir, f))) bytes += statSync(join(dir, f)).size;
    else problems.push(`precache: ${f} is not in the build`);
  }
  if (bytes > BUDGETS.precache)
    problems.push(
      `precache: ${(bytes / KIB).toFixed(1)} KiB (budget ${BUDGETS.precache / KIB} KiB)`,
    );

  const needs = [
    ['the app-shell navigation fallback', /[`'"]\/index\.html[`'"]/],
    ['the bounded image cache', /maxEntries:\s*\d+/],
    ['push', /addEventListener\([`'"]push[`'"]/],
    ['notification clicks', /addEventListener\([`'"]notificationclick[`'"]/],
    ['the share target', /\/share-file-handler/],
  ];
  for (const [what, re] of needs)
    if (!re.test(sw)) problems.push(`sw.js: missing ${what}`);
  // An earlier worker cached every script, style and image as `assets-cache`; the current one only deletes that cache.
  const catchAll = [...sw.matchAll(/assets-cache/g)].filter(
    (m) => !/icons-cache/.test(sw.slice(m.index, m.index + 80)),
  );
  if (catchAll.length)
    problems.push('sw.js: a catch-all asset cache (assets-cache)');
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? 'dist';
  const pkg = resolve(dirname(resolve(dir)), 'package.json');
  const problems = [
    ...verify(dir),
    ...(existsSync(pkg)
      ? buildToolsInDependencies(JSON.parse(readFileSync(pkg, 'utf8')))
      : []),
  ];
  if (problems.length) {
    console.error(
      `The production build in ${dir} has what must not ship:\n${problems.join('\n')}`,
    );
    process.exit(1);
  }
  console.log(
    `ok: ${dir} has no development-only code, prototypes, source maps or build metadata; the precache and service worker are as SPEC says`,
  );
}
