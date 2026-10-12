// The Garis tokens and styles as Tailwind compiles them (with @tailwindcss/node, as the build does).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

const appDir = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const { compile } = require(createRequire(require.resolve('@tailwindcss/vite')).resolve('@tailwindcss/node'));

async function css(candidates) {
  const entry = path.join(appDir, 'src/index.css');
  const compiler = await compile(fs.readFileSync(entry, 'utf8'), { base: path.dirname(entry), onDependency: () => {} });
  return compiler.build(candidates);
}
const escape = (c) => `.${c.replace(/[:/[\]().%]/g, (m) => `\\${m}`)}`;
function rule(output, cls) {
  const at = output.indexOf(`${escape(cls)} {`);
  return at === -1 ? null : output.slice(at, output.indexOf('}', at) + 1);
}

test('token utilities read the theme’s custom properties, so the theme swaps at run time', async () => {
  const out = await css(['bg-surface', 'bg-muted', 'bg-accent', 'text-fg', 'text-fg-2', 'text-accent', 'border-line', 'ring-focus', 'outline-focus', 'rounded-card', 'shadow-raised']);
  assert.match(rule(out, 'bg-surface'), /background-color: var\(--bg-surface\)/);
  assert.match(rule(out, 'bg-muted'), /background-color: var\(--bg-muted\)/);
  assert.match(rule(out, 'bg-accent'), /background-color: var\(--bg-accent\)/);
  assert.match(rule(out, 'text-fg'), /color: var\(--text\)/);
  assert.match(rule(out, 'text-fg-2'), /color: var\(--text-2\)/);
  assert.match(rule(out, 'text-accent'), /color: var\(--text-accent\)/);
  assert.match(rule(out, 'border-line'), /border-color: var\(--border\)/);
  assert.match(rule(out, 'ring-focus'), /var\(--focus\)/);
  assert.match(rule(out, 'outline-focus'), /outline-color: var\(--focus\)/);
  assert.match(rule(out, 'rounded-card'), /border-radius: 12px/);
  assert.match(rule(out, 'shadow-raised'), /var\(--shadow-raised\)/);
  // `@theme reference` emits no variables, so --shadow-raised never refers to itself.
  assert.doesNotMatch(out, /--shadow-raised:\s*var\(--shadow-raised\)/);
});

test('backgrounds, text and lines are separate scales: a text token is not a background', async () => {
  const out = await css(['bg-fg-2', 'text-surface', 'border-fg']);
  assert.equal(rule(out, 'bg-fg-2'), null);
  assert.equal(rule(out, 'text-surface'), null);
  assert.equal(rule(out, 'border-fg'), null);
});

test('today’s screens keep their colours: the old shadcn classes no longer share the Garis names', async () => {
  const out = await css(['border-border', 'bg-sc-accent', 'bg-sc-muted']);
  assert.match(rule(out, 'border-border'), /hsl\(var\(--sc-border\)\)/);
  assert.match(rule(out, 'bg-sc-accent'), /hsl\(var\(--accent\)\)/);
  assert.match(rule(out, 'bg-sc-muted'), /hsl\(var\(--muted\)\)/);
  // The Garis --border is a colour; the old value lives on as --sc-border.
  const index = fs.readFileSync(path.join(appDir, 'src/index.css'), 'utf8');
  assert.doesNotMatch(index, /^\s*--border:/m);
});

test('the type styles compile exactly as garis.css sets them', async () => {
  const out = await css(['t-display-l', 't-display', 't-title', 't-heading', 't-body-l', 't-body', 't-sub', 't-sm', 't-label', 't-cap', 't-micro', 't-figure', 't-figure-xl', 'disp', 'num']);
  const want = { 't-display-l': '32px', 't-display': '24px', 't-title': '20px', 't-heading': '17px', 't-body-l': '16px', 't-body': '15px', 't-sub': '15px', 't-sm': '14px', 't-label': '14px', 't-cap': '13px', 't-micro': '12px', 't-figure': '32px', 't-figure-xl': '56px' };
  for (const [cls, size] of Object.entries(want)) assert.match(rule(out, cls), new RegExp(`font-size: ${size}`), cls);
  for (const cls of ['t-display-l', 't-display', 'disp']) assert.match(rule(out, cls), /font-family: var\(--font-display\)/);
  assert.match(rule(out, 'num'), /tabular-nums/);
  // Nothing under 12 px anywhere in the design system's CSS.
  const all = ['type.css', 'components.css'].map((f) => fs.readFileSync(path.join(appDir, 'src/styles/garis', f), 'utf8')).join('\n');
  const sizes = [...all.matchAll(/font-size: (\d+)px/g)].map((m) => +m[1]);
  assert.ok(sizes.length > 10 && sizes.every((s) => s >= 12), sizes.join(','));
  assert.doesNotMatch(all, /font-family:[^;]*(?:monospace|Mono)/);
});

// Regression: Tag's "outline" tone also matched Tailwind's `outline` utility, drawing a dark outline round the
// "Kelas 02" tag in the gallery. The components put these modifier classes next to their g-* class; none may be a
// Tailwind utility.
test('no component modifier class is also a Tailwind utility', async () => {
  const components = fs.readFileSync(path.join(appDir, 'src/styles/garis/components.css'), 'utf8');
  const modifiers = new Set([...components.matchAll(/\.g-[\w-]+((?:\.[\w-]+)+)/g)].flatMap((m) => m[1].split('.').filter(Boolean)));
  for (const part of ['s16', 's20', 's24', 'f', 'gf', 'pp', 'k', 'o', 'w', 'r', 'c', 'l', 'b', 'n', 'box', 'handle', 'rule', 'hint', 'dis-ic', 'msg', 't-ic', 'act', 'sq', 'bars', 'glyph', 'radio'])
    modifiers.add(part);
  // Each modifier alone must add nothing to what Tailwind generates without it.
  const base = await css([]);
  const clashes = [];
  for (const m of modifiers) if ((await css([m])) !== base) clashes.push(m);
  assert.deepEqual(clashes, []);
  // The test sees a clash when there is one.
  assert.notEqual(await css(['outline']), base);
  assert.ok(modifiers.has('outlined') && !modifiers.has('outline'));
});

test('reduced motion removes all motion; nothing uses transition: all', () => {
  const comp = fs.readFileSync(path.join(appDir, 'src/styles/garis/components.css'), 'utf8');
  assert.doesNotMatch(comp, /transition:\s*all|transition-property:\s*all/);
  assert.match(comp, /prefers-reduced-motion: reduce/);
});
