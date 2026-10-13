// The import graph of `src`: which modules the app can reach from its entries (C1, step 1). Read with the
// TypeScript compiler's own import scanner, so static imports, re-exports, `import()` and CSS `@import` all count.
//   node scripts/lib/reachable.mjs            # prints every module nothing reaches, with what imports it
// tests/c1-clean.test.mjs keeps it as a check: every module in `src` is reachable.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const webDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const srcDir = path.join(webDir, 'src');

const EXTENSIONS = [
  '',
  '.ts',
  '.tsx',
  '.mts',
  '.mjs',
  '.js',
  '.d.ts',
  '.d.mts',
];

/** Every file under `src`, relative to `apps/web` (`src/…`). */
export function sourceFiles(dir = srcDir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? sourceFiles(path.join(dir, e.name))
        : [path.relative(webDir, path.join(dir, e.name))],
    )
    .sort();
}

/** The app's entries: the page's script, the service worker, and every route file the router plugin reads. */
export function entries(files = sourceFiles()) {
  return files.filter(
    (f) =>
      f === 'src/main.tsx' ||
      f === 'src/sw.ts' ||
      f === 'src/vite-env.d.ts' ||
      (f.startsWith('src/routes/') &&
        /\.(ts|tsx)$/.test(f) &&
        !f
          .replace(/^src\/routes\//, '')
          .split('/')
          .some((p) => p.startsWith('-'))),
  );
}

/** The specifiers a file imports: TypeScript's scanner for code, `@import`/`url()` for CSS. */
export function importsOf(file, text) {
  if (file.endsWith('.css')) {
    return [
      ...text.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g),
      ...text.matchAll(/url\(\s*['"]?(\.{1,2}\/[^'")]+)['"]?\s*\)/g),
    ].map((m) => m[1]);
  }
  return ts
    .preProcessFile(text, true, true)
    .importedFiles.map((i) => i.fileName);
}

/** Resolves a specifier to a file in `src` (relative or `~/`), or null for packages and virtual modules. */
export function resolve(
  from,
  spec,
  exists = (f) => fs.existsSync(path.join(webDir, f)),
) {
  let base;
  const clean = spec.replace(/\?.*$/, '');
  if (clean.startsWith('~/')) base = path.join('src', clean.slice(2));
  else if (clean.startsWith('.')) base = path.join(path.dirname(from), clean);
  else return null;
  base = base.split(path.sep).join('/');
  const tries = [
    ...EXTENSIONS.map((e) => base + e),
    ...EXTENSIONS.slice(1).map((e) => `${base}/index${e}`),
    // `./x.mjs` written for a `.d.mts` next to it, and `.js` written for `.ts`.
    base.replace(/\.mjs$/, '.d.mts'),
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.js$/, '.tsx'),
  ];
  for (const t of tries) {
    if (t !== base || path.extname(t)) {
      if (exists(t) && !fs.statSync(path.join(webDir, t)).isDirectory())
        return t;
    }
  }
  return null;
}

/** The graph: for each file, the files in `src` it imports. */
export function graph(files = sourceFiles()) {
  const edges = new Map();
  for (const f of files) {
    if (!/\.(ts|tsx|mts|mjs|css)$/.test(f)) {
      edges.set(f, []);
      continue;
    }
    const text = fs.readFileSync(path.join(webDir, f), 'utf8');
    edges.set(
      f,
      importsOf(f, text)
        .map((s) => resolve(f, s))
        .filter(Boolean),
    );
  }
  return edges;
}

/** Files nothing reaches from the entries, each with the files that import it. */
export function unreachable(files = sourceFiles()) {
  const edges = graph(files);
  const seen = new Set();
  const stack = [...entries(files)];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const d of edges.get(f) ?? []) stack.push(d);
    // A `.mjs` module's types sit next to it.
    if (f.endsWith('.mjs')) stack.push(f.replace(/\.mjs$/, '.d.mts'));
  }
  const importers = new Map();
  for (const [f, deps] of edges)
    for (const d of deps) importers.set(d, [...(importers.get(d) ?? []), f]);
  return files
    .filter((f) => !seen.has(f) && edges.has(f))
    .map((f) => ({ file: f, importedBy: importers.get(f) ?? [] }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dead = unreachable();
  for (const d of dead)
    console.log(
      `${d.file}${d.importedBy.length ? `  <- ${d.importedBy.join(', ')}` : ''}`,
    );
  console.log(`${dead.length} unreachable of ${sourceFiles().length}`);
}
