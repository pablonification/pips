// C1: checks that keep the app clean once today's screens are gone (C1 brief, step 15). Each fails on a file that
// comes back: an import of a removed package, a dependency or public file nothing uses, a module nothing reaches,
// a link to an old path, a prototype stand-in string or a Google Fonts request.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import {
  entries,
  sourceFiles,
  unreachable,
} from '../scripts/lib/reachable.mjs';

const appDir = path.resolve(import.meta.dirname, '..');
const read = (f) => fs.readFileSync(path.join(appDir, f), 'utf8');
const pkg = JSON.parse(read('package.json'));

/** Tracked and new files under `dir` (git's view, so build output and caches never count). */
function files(dir) {
  return execFileSync('git', ['ls-files', '-co', '--exclude-standard', dir], {
    cwd: appDir,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((f) => f && fs.existsSync(path.join(appDir, f)));
}

/** Packages C1 removed. None may come back through an import. */
const REMOVED_PACKAGES = [
  'lucide-react',
  'framer-motion',
  'react-hot-toast',
  'embla-carousel-react',
  'react-webcam',
  'bungkus',
  'recharts',
  'vaul',
  '@hookform/resolvers',
  'react-hook-form',
  'class-variance-authority',
  'tw-animate-css',
  '@tailwindcss/typography',
  '@tanstack/router-devtools',
  'dayjs',
];

/** Folders and files C1 deleted. Nothing may import them again. */
const REMOVED_PATHS = [
  'src/assets/',
  'src/components/ui/',
  'src/components/navbar/',
  'src/components/schedule/',
  'src/components/custom-form/',
  'src/components/admin/',
  'src/components/info/',
  'src/components/user/',
  'src/utils/',
  'src/styles/tailwind3-palette.css',
  'src/lib/device.ts',
  'src/lib/roles.ts',
  'src/lib/sparta.ts',
  'src/lib/websocket.ts',
  'src/hooks/useWindowSize.ts',
  'src/hooks/useSpartaLock.ts',
  'tailwind.config.js',
];

const CODE = /\.(ts|tsx|mts|mjs|js|cjs)$/;

/** Every import specifier in a file: TypeScript's scanner for code, `@import`/`@plugin` for CSS. */
function specifiers(file, text) {
  if (file.endsWith('.css'))
    return [...text.matchAll(/@(?:import|plugin)\s+['"]([^'"]+)['"]/g)].map(
      (m) => m[1],
    );
  return ts
    .preProcessFile(text, true, true)
    .importedFiles.map((i) => i.fileName);
}

/** The npm package a specifier names, or null for relative paths, aliases and virtual modules. */
function packageOf(spec) {
  if (/^(\.|~\/|\/|node:|virtual:|#)/.test(spec)) return null;
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

const codeFiles = [
  ...files('src'),
  ...files('e2e'),
  ...files('tests'),
  ...files('scripts'),
  ...files('eslint-rules'),
  'eslint.config.js',
  'vite.config.ts',
].filter((f) => CODE.test(f) || f.endsWith('.css'));

const imports = codeFiles.flatMap((f) =>
  specifiers(f, read(f)).map((spec) => ({ file: f, spec })),
);

test('nothing in src, e2e, tests or scripts imports a removed package or a deleted path', () => {
  const bad = imports
    .filter(({ file, spec }) => {
      if (REMOVED_PACKAGES.includes(packageOf(spec))) return true;
      const target = spec.startsWith('~/')
        ? `src/${spec.slice(2)}`
        : spec.startsWith('.')
          ? path.posix.join(path.posix.dirname(file), spec)
          : null;
      return (
        target &&
        REMOVED_PATHS.some(
          (p) => target === p.replace(/\.[a-z]+$/, '') || target.startsWith(p),
        )
      );
    })
    .map(({ file, spec }) => `${file}: ${spec}`);
  assert.deepEqual(bad, []);
  for (const p of REMOVED_PATHS)
    assert.equal(fs.existsSync(path.join(appDir, p)), false, p);
  for (const p of REMOVED_PACKAGES) {
    assert.equal(pkg.dependencies[p], undefined, p);
    assert.equal(pkg.devDependencies[p], undefined, p);
  }
});

/** Packages used without an import in the code, each with its reason (C1 brief, step 9). */
const INDIRECT = {
  'workbox-window':
    'virtual:pwa-register (vite-plugin-pwa) in src/main.tsx and src/lib/sw-register.ts loads it',
  'eslint-config-prettier':
    'eslint-plugin-prettier/recommended (eslint.config.js) extends it',
  prettier:
    'eslint-plugin-prettier runs it; also `prettier` on the command line',
  'prettier-plugin-tailwindcss': '.prettierrc `plugins`',
  'openapi-typescript-codegen':
    'the `api` and `api-staging` scripts (its `openapi` command)',
  typescript: '`tsc` in the build and typecheck scripts',
  tsx: '`tsx --test` in the test script',
  '@types/node': 'tsconfig.json `types`',
  '@types/react': 'React types',
  '@types/react-dom': 'React DOM types',
  '@types/pngjs': 'pngjs types for e2e/scripts/lib/image.mjs',
  geist: 'scripts/fonts subsets Geist from its files',
  '@fontsource-variable/archivo':
    'scripts/fonts subsets Archivo Expanded from its files',
};

test('every dependency is imported, or used by a config or script for a reason listed here', () => {
  const used = new Set(
    imports.map(({ spec }) => packageOf(spec)).filter(Boolean),
  );
  const unused = [
    ...Object.keys(pkg.dependencies),
    ...Object.keys(pkg.devDependencies),
  ].filter((p) => !used.has(p) && !INDIRECT[p]);
  assert.deepEqual(unused, []);
  for (const p of Object.keys(INDIRECT))
    assert.ok(
      pkg.dependencies[p] || pkg.devDependencies[p],
      `${p} is listed as indirect but isn't a dependency`,
    );
});

/**
 * Public files no code names, kept on purpose: browsers ask for favicon.ico by convention, and the old app icons
 * wait for HMIF to sign off the new icon and splash (C1 brief, open question 4).
 */
const PUBLIC_ALLOWED = {
  'public/favicon.ico': 'browsers request it by convention',
  'public/browserconfig.xml':
    'Windows asks for it by convention (it names mstile-150x150.png)',
  'public/android-chrome-384x384.png':
    'an app icon size browsers may request (P0-B kept it)',
  'public/icon.png': 'old app icon, kept until HMIF signs off the new one',
  'public/icon-foreground.png':
    'old app icon, kept until HMIF signs off the new one',
  'public/icon-background.png':
    'old app icon, kept until HMIF signs off the new one',
  'public/logo-nobg.png': 'old app icon, kept until HMIF signs off the new one',
  'public/logo-nobg-96x96.png':
    'old app icon, kept until HMIF signs off the new one',
  'public/logo-nobg-256x256.png':
    'old app icon, kept until HMIF signs off the new one',
  'public/splash.png': 'old splash, kept until HMIF signs off the new one',
};

test('every public file is referenced by the app, the manifest, the service worker or browserconfig.xml', () => {
  const referrers = [
    ...files('src').filter((f) => CODE.test(f) || f.endsWith('.css')),
    'index.html',
    'vite.config.ts',
    'public/browserconfig.xml',
  ]
    .map(read)
    .join('\n');
  const orphans = files('public')
    .filter((f) => !f.startsWith('public/prototypes/'))
    .filter(
      (f) =>
        !referrers.includes(f.slice('public'.length)) && !PUBLIC_ALLOWED[f],
    );
  assert.deepEqual(orphans, []);
  for (const f of Object.keys(PUBLIC_ALLOWED))
    assert.ok(fs.existsSync(path.join(appDir, f)), `${f} is allowed but gone`);
});

/** Modules only the unit tests use: the copy glossary is the glossary check's own list (P0-B, story 155). */
const TEST_ONLY = ['src/copy/glossary.ts'];

test('every module in src is reachable from main.tsx, sw.ts or a route file', () => {
  const all = sourceFiles();
  assert.ok(entries(all).includes('src/main.tsx'));
  assert.ok(entries(all).includes('src/sw.ts'));
  const dead = unreachable(all)
    .map((d) => d.file)
    .filter((f) => !TEST_ONLY.includes(f));
  assert.deepEqual(dead, []);
  for (const f of TEST_ONLY) assert.ok(fs.existsSync(path.join(appDir, f)), f);
});

/** Every string, template and JSX text in a TypeScript file, comments left out. */
function strings(file) {
  const source = ts.createSourceFile(
    file,
    read(file),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const out = [];
  const visit = (node) => {
    if (
      ts.isStringLiteralLike(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    )
      out.push({
        text: node.text,
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      });
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

const appCode = files('src').filter(
  (f) =>
    /\.(ts|tsx)$/.test(f) &&
    !f.startsWith('src/api/generated/') &&
    f !== 'src/routeTree.gen.ts',
);
/** Today's first path segments; only P0-B's redirect table may name them. */
const OLD_PATH =
  /^\/(home|timeline|settings|calendar|add-announcement|socket)(\/|$|\?|#)/;

test('no link, navigation or redirect to an old path outside the redirect table', () => {
  const bad = appCode
    .filter((f) => f !== 'src/lib/legacy-redirects.ts')
    .flatMap((f) =>
      strings(f)
        .filter((s) => OLD_PATH.test(s.text))
        .map((s) => `${f}:${s.line} ${s.text}`),
    );
  assert.deepEqual(bad, []);
});

/** The prototype's own stand-ins (its app.js and screens-*.js), never shipped. */
const STAND_INS = [
  'Contoh:',
  '(contoh)',
  'Simulasi pengisi baru',
  'Atur prototipe',
  'Mulai ulang',
  'Prototipe PIPS!',
];

test('no prototype stand-in string, and no Google Fonts request', () => {
  const bad = appCode.flatMap((f) =>
    strings(f)
      .filter((s) => STAND_INS.some((x) => s.text.includes(x)))
      .map((s) => `${f}:${s.line} ${s.text}`),
  );
  assert.deepEqual(bad, []);
  for (const f of [
    'index.html',
    ...files('src').filter((f) => /\.(ts|tsx|css|html)$/.test(f)),
  ])
    assert.doesNotMatch(read(f), /fonts\.(googleapis|gstatic)\.com/, f);
});

test('no console.log in src; console.error and console.warn report real failures', () => {
  const bad = appCode.filter((f) =>
    /\bconsole\.log\(/.test(
      read(f).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, ''),
    ),
  );
  assert.deepEqual(bad, []);
});
