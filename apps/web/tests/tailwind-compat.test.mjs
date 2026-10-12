// The Tailwind 4 upgrade must not change how today's screens look. These check the compatibility rules in
// src/index.css and src/styles/tailwind3-palette.css against Tailwind's own compiler, one per change it caught.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

const appDir = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
// @tailwindcss/node is what @tailwindcss/vite compiles with.
const { compile } = require(
  createRequire(require.resolve('@tailwindcss/vite')).resolve(
    '@tailwindcss/node',
  ),
);

async function css(candidates) {
  const entry = path.join(appDir, 'src/index.css');
  const compiler = await compile(fs.readFileSync(entry, 'utf8'), {
    base: path.dirname(entry),
    onDependency: () => {},
  });
  return compiler.build(candidates);
}

function rule(output, selector) {
  const at = output.indexOf(`${selector} {`);
  assert.notEqual(at, -1, `no rule for ${selector}`);
  return output.slice(at, output.indexOf('}', at) + 1);
}

function sourceClasses(pattern) {
  const found = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.tsx?$/.test(entry.name))
        for (const m of fs.readFileSync(file, 'utf8').matchAll(pattern))
          found.add(m[0]);
    }
  };
  walk(path.join(appDir, 'src'));
  return [...found];
}

test("the config's own colour shades win over Tailwind 3's default palette", async () => {
  const output = await css([
    'text-green-300',
    'bg-green-50',
    'bg-yellow-300',
    'bg-red-500',
    'bg-gray-200',
  ]);
  assert.match(rule(output, '.text-green-300'), /#305138/);
  assert.match(rule(output, '.bg-green-50'), /#eaeeeb/);
  assert.match(rule(output, '.bg-yellow-300'), /#e2c66f/);
  assert.match(rule(output, '.bg-red-500'), /#A70000/i);
  // A shade the config doesn't set keeps Tailwind 3's value, not version 4's OKLCH one.
  assert.match(output, /--color-gray-200: #e5e7eb;/);
});

test("the calendar's category colours are generated though no file spells them out", async () => {
  const output = await css([]);
  for (const color of ['teal', 'yellow', 'red', 'blue'])
    for (const cls of [
      `bg-${color}-200`,
      `text-${color}-500`,
      `border-${color}-500`,
    ])
      assert.ok(output.includes(`.${cls} {`), `${cls} is missing`);
});

test('every space-x and space-y the app uses spaces like Tailwind 3', async () => {
  const used = sourceClasses(/\bspace-[xy]-[0-9.]+\b/g);
  assert.ok(used.length > 0);
  const output = await css(used);
  for (const cls of used) {
    const escaped = cls.replace('.', '\\.');
    const v3 = rule(output, `.${escaped} > :not([hidden]) ~ :not([hidden])`);
    assert.match(
      v3,
      cls.startsWith('space-x') ? /margin-left:/ : /margin-top:/,
      cls,
    );
    assert.ok(
      output.includes(`.${escaped} > :not(:last-child)`),
      `${cls} has no reset`,
    );
  }
});

test("font sizes keep Tailwind 3's fixed line heights", async () => {
  const output = await css(['text-sm', 'text-xs']);
  assert.match(output, /--text-sm--line-height: 1\.25rem/);
  assert.match(output, /--text-xs--line-height: 1rem/);
});

test("table cells keep the browser's 1px padding, as under Tailwind 3", async () => {
  assert.match(await css([]), /td,\s*th\s*\{\s*padding: 1px;/);
});
