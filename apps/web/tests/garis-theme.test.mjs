// The pre-paint theme script in index.html: it must agree with the app's theme rules (theme-core.mjs) for every
// stored preference and system setting, set the .dark class, color-scheme and theme-color before first paint, and
// survive blocked storage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { resolveTheme, THEME_COLORS, THEME_STORAGE_KEY } from '../src/lib/theme/theme-core.mjs';

const appDir = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
const script = /<script data-theme-prepaint>([\s\S]*?)<\/script>/.exec(html)?.[1];

function run({ stored, systemDark, storageThrows = false }) {
  const classes = new Set();
  const root = { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) }, style: {} };
  const meta = { content: '', setAttribute(k, v) { this[k] = v; } };
  const context = {
    localStorage: {
      getItem(k) {
        if (storageThrows) throw new Error('blocked');
        return k === THEME_STORAGE_KEY ? stored : null;
      },
    },
    matchMedia: (q) => ({ matches: q === '(prefers-color-scheme: dark)' && systemDark }),
    document: { documentElement: root, querySelector: (s) => (/theme-color/.test(s) ? meta : null) },
  };
  vm.runInNewContext(script, context);
  return { dark: classes.has('dark'), scheme: root.style.colorScheme, color: meta.content };
}

test('index.html has the pre-paint script in <head>, before any stylesheet or module', () => {
  assert.ok(script, 'no <script data-theme-prepaint>');
  const head = html.slice(0, html.indexOf('</head>'));
  assert.ok(head.includes('data-theme-prepaint'));
  assert.ok(html.indexOf('data-theme-prepaint') < html.indexOf('type="module"'));
  assert.match(html, /<meta name="theme-color" content="#FCFBF8"/);
  assert.match(html, /<meta name="color-scheme" content="light dark"/);
  assert.match(html, /<html lang="id"/);
});

test('the script resolves every case as the app does', () => {
  for (const stored of [null, 'system', 'light', 'dark', 'nonsense'])
    for (const systemDark of [false, true]) {
      const pref = stored === 'light' || stored === 'dark' ? stored : 'system';
      const want = resolveTheme(pref, systemDark);
      const got = run({ stored, systemDark });
      assert.deepEqual(got, { dark: want === 'dark', scheme: want, color: THEME_COLORS[want] }, `${stored}/${systemDark}`);
    }
});

test('blocked storage follows the system', () => {
  assert.deepEqual(run({ stored: 'light', systemDark: true, storageThrows: true }), { dark: true, scheme: 'dark', color: '#0A0907' });
});
