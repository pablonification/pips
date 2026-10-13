// The design-system lint rules (eslint-rules/garis.mjs), run through the app's real ESLint config, so the test also
// covers where they apply (GARIS_FILES in eslint.config.js): all of src since C1, the generated API client aside.
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { ESLint } from 'eslint';

const appDir = path.resolve(import.meta.dirname, '..');
const eslint = new ESLint({ cwd: appDir });
const NEW = 'src/components/garis/__lint-sample.tsx';
// A file outside the folders the rules covered before C1 (today's route folders, components, hooks, lib).
const OUTSIDE = 'src/routes/_app/__lint-sample.tsx';

async function rules(code, file = NEW) {
  const [res] = await eslint.lintText(code, { filePath: path.join(appDir, file) });
  return res.messages.filter((m) => m.ruleId?.startsWith('garis/') || m.ruleId === 'no-restricted-imports').map((m) => m.ruleId);
}
const wrap = (jsx) => `export function Sample() {\n  return ${jsx};\n}\n`;

test('raw colours are rejected in new code: hex, rgb(), hsl(), color-mix() and arbitrary colour classes', async () => {
  for (const bad of [
    wrap(`<div style={{ color: '#1B1508' }} />`),
    wrap(`<div style={{ background: 'rgb(27 21 8 / 0.5)' }} />`),
    wrap(`<div className="bg-[#F8C249]" />`),
    wrap(`<div className="text-[hsl(var(--x))]" />`),
    wrap(`<div className="hover:bg-[var(--bg-muted)]" />`),
  ])
    assert.deepEqual(await rules(bad), ['garis/no-raw-colour'], bad);
});

test('old palette and Tailwind palette colour classes are rejected; Garis token classes pass', async () => {
  for (const cls of ['bg-white', 'text-black', 'bg-green-300', 'border-gray-200', 'text-red-500/50', 'hover:bg-yellow-50', 'bg-background', 'text-muted-foreground', 'ring-ring'])
    assert.deepEqual(await rules(wrap(`<div className="${cls}" />`)), ['garis/no-raw-colour'], cls);
  assert.deepEqual(
    await rules(wrap(`<div className="bg-surface text-fg-2 border-line ring-focus hover:bg-hover text-accent bg-accent-subtle text-center text-balance outline-focus" />`)),
    [],
  );
});

test('arbitrary and non-Garis text sizes are rejected; the type styles pass', async () => {
  for (const cls of ['text-[13px]', 'text-[1.2rem]', 'md:text-sm', 'text-xl', 'text-heading-md', 'text-body-sm'])
    assert.deepEqual(await rules(wrap(`<p className="${cls}" />`)), ['garis/no-arbitrary-text-size'], cls);
  assert.deepEqual(await rules(wrap(`<p className="t-display t-sm t-cap num text-fg-3" />`)), []);
});

// Review m6: a fixed size in a style object slipped past the text-size rule.
test('a fixed font size in a style object is rejected; a component’s own size prop is its types’ business', async () => {
  for (const bad of [wrap(`<p style={{ fontSize: 11 }} />`), wrap(`<p style={{ fontSize: '0.7rem' }} />`), wrap('<p style={{ fontSize: `${11}px` }} />')])
    assert.deepEqual(await rules(bad), ['garis/no-arbitrary-text-size'], bad);
  assert.deepEqual(await rules(`export function W({ size }: { size: 15 | 20 }) {\n  return <b style={{ fontSize: size }} />;\n}\n`), []);
});

// Review m6: nothing stopped capitals added by CSS. Sentence case everywhere; the app adds no capitals of its own.
test('capitals added by styling are rejected: uppercase, capitalize, text-transform', async () => {
  for (const bad of [
    wrap(`<span className="uppercase" />`),
    wrap(`<span className="md:capitalize t-cap" />`),
    wrap(`<span style={{ textTransform: 'uppercase' }} />`),
    'export const css = `.x { text-transform: uppercase; }`;\n',
  ])
    assert.deepEqual(await rules(bad), ['garis/no-added-capitals'], bad);
  assert.deepEqual(await rules(wrap(`<span className="normal-case t-cap" style={{ textTransform: 'none' }} />`)), []);
});

test('transition-all is rejected', async () => {
  assert.deepEqual(await rules(wrap(`<div className="transition-all" />`)), ['garis/no-transition-all']);
  assert.deepEqual(await rules(wrap(`<div style={{ transition: 'all 100ms' }} />`)), ['garis/no-transition-all']);
  assert.deepEqual(await rules(wrap(`<div className="transition-colors" />`)), []);
});

test('<img> is rejected except in HmifLogo and Media', async () => {
  assert.deepEqual(await rules(wrap(`<img src="/img/icon.svg" alt="" />`)), ['garis/no-img-icon']);
  assert.deepEqual(await rules(wrap(`<img src="/logo/hmif.png" alt="" />`), 'src/components/garis/HmifLogo.tsx'), []);
});

test('icon libraries and the animation library are rejected', async () => {
  assert.deepEqual(await rules(`import { Home } from 'lucide-react';\nexport const X = Home;\n`), ['garis/no-icon-library']);
  assert.deepEqual(await rules(`import { FaHome } from 'react-icons/fa';\nexport const X = FaHome;\n`), ['garis/no-icon-library']);
  assert.deepEqual(await rules(`import { motion } from 'framer-motion';\nexport const X = motion;\n`), ['no-restricted-imports']);
});

test('monospace is rejected', async () => {
  assert.deepEqual(await rules(wrap(`<code className="font-mono" />`)), ['garis/no-monospace']);
  assert.deepEqual(await rules(wrap(`<p style={{ fontFamily: 'Geist Mono, monospace' }} />`)), ['garis/no-monospace']);
});

test('since C1 the rules cover all of src, files outside the old new-code folders included', async () => {
  const bad = wrap(`<div className="bg-white text-[13px] transition-all font-mono uppercase" />`);
  for (const f of [OUTSIDE, 'src/components/__x.tsx', 'src/hooks/__x.tsx', 'src/lib/__x.tsx', 'src/routes/__x.tsx', 'src/components/icons/__x.tsx', 'src/dev/garis/__x.tsx']) {
    const found = await rules(bad, f);
    for (const rule of ['garis/no-raw-colour', 'garis/no-arbitrary-text-size', 'garis/no-transition-all', 'garis/no-monospace', 'garis/no-added-capitals'])
      assert.ok(found.includes(rule), `${f}: ${rule}`);
  }
  assert.deepEqual(await rules(`import { Home } from 'lucide-react';\nexport const X = Home;\n`, OUTSIDE), ['garis/no-icon-library']);
  // The generated API client is the one exception.
  assert.deepEqual(await rules(bad, 'src/api/generated/__x.tsx'), []);
});

test('all of src passes the rules, with no unused variables left', async () => {
  const results = await eslint.lintFiles(['src']);
  const errors = results.flatMap((r) => r.messages.filter((m) => m.severity === 2 || m.ruleId === '@typescript-eslint/no-unused-vars').map((m) => `${r.filePath}:${m.line} ${m.ruleId}`));
  assert.deepEqual(errors, []);
});
