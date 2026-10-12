// The fidelity tool's non-route screens (e2e/fidelity/names.mjs): every locked PNG that isn't a route screen is
// either an app task's (EXTRA_SCREENS, 35) or the prototype's own (PROTOTYPE_ONLY, 11), never both, with the
// project and viewport garis-check.mjs took it at.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { EXTRA_SCREENS, PROTOTYPE_ONLY, screenNames } from '../e2e/fidelity/names.mjs';
import { lockedScreensDir } from '../e2e/scripts/lib/paths.mjs';

const appDir = path.resolve(import.meta.dirname, '..');

test('35 app-owned and 11 prototype-only non-route screens, all distinct', () => {
  const names = EXTRA_SCREENS.map((e) => e.name);
  assert.equal(names.length, 35);
  assert.equal(PROTOTYPE_ONLY.length, 11);
  assert.equal(new Set([...names, ...PROTOTYPE_ONLY]).size, 46);
  const routes = new Set(screenNames().map((s) => s.name));
  for (const n of names) assert.ok(!routes.has(n), n);
});

test('each extra has a project, a theme from its name and the viewport it was taken at', () => {
  for (const e of EXTRA_SCREENS) {
    assert.ok(['phone', 'tablet', 'desk'].includes(e.layout), e.name);
    assert.equal(e.theme, e.name.endsWith('-dark') ? 'dark' : 'light', e.name);
    assert.ok(['app', 'page', 'element'].includes(e.capture), e.name);
    const { width, height } = e.viewport;
    if (e.layout === 'phone') assert.ok(width <= 390 && [800, 844].includes(height), e.name);
    if (e.layout === 'tablet') assert.ok(width >= 640 && width < 1024, e.name);
    if (e.layout === 'desk') assert.ok(width >= 1024, e.name);
  }
  const kit = EXTRA_SCREENS.find((e) => e.name === 'system-kit');
  assert.deepEqual(kit, { name: 'system-kit', layout: 'desk', theme: 'light', viewport: { width: 1440, height: 1000 }, capture: 'element', note: kit.note });
});

test('the locked screens, where present, are exactly the route screens plus these 46', (t) => {
  const dir = lockedScreensDir();
  // The locked screens live in the workspace repo, not in pips: CI has only the lists above.
  if (!dir) return t.diagnostic('locked screens not on this machine; lists checked above');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4));
  const known = new Set([...screenNames().map((s) => s.name), ...EXTRA_SCREENS.map((e) => e.name), ...PROTOTYPE_ONLY]);
  assert.deepEqual(files.filter((f) => !known.has(f)), []);
  assert.deepEqual([...known].filter((k) => !files.includes(k)), []);
});

test('extras.ts maps the design-system captures to the gallery, each with an element target', () => {
  const src = fs.readFileSync(path.join(appDir, 'e2e/fidelity/extras.ts'), 'utf8');
  for (const name of ['system-cards', 'system-kit']) {
    const at = src.indexOf(`'${name}': {`);
    assert.notEqual(at, -1, name);
    const entry = src.slice(at, src.indexOf('},\n', at));
    assert.match(entry, /path: '\/dev\/garis'/);
    assert.match(entry, /target:/);
  }
});

test('page captures carry the prototype bar, which the report crops off the locked screen before comparing', async () => {
  const { PROTO_BAR } = await import('../e2e/fidelity/names.mjs');
  const { cropTop } = await import('../e2e/scripts/lib/image.mjs');
  for (const e of EXTRA_SCREENS) assert.equal(e.protoBar, e.capture === 'page' ? PROTO_BAR : undefined, e.name);
  assert.equal(PROTO_BAR, 44);
  // A 2 × 3 image: the top row goes, the rest stays as it was.
  const img = { width: 2, height: 3, data: Uint8Array.from({ length: 24 }, (_, i) => i) };
  const out = cropTop(img, 1);
  assert.equal(out.height, 2);
  assert.deepEqual([...out.data], [...img.data.slice(8)]);
  assert.equal(cropTop(img, 9).height, 0);
});

test('extras.ts maps the shell’s page captures to Beranda (P0-C), never the prototype’s own bar', () => {
  const src = fs.readFileSync(path.join(appDir, 'e2e/fidelity/extras.ts'), 'utf8');
  for (const name of EXTRA_SCREENS.filter((e) => e.name.startsWith('page-') || /^(narrow320|desk1024)-beranda$/.test(e.name)).map((e) => e.name))
    assert.match(src, new RegExp(`'${name}': beranda,`), name);
  for (const name of PROTOTYPE_ONLY) assert.doesNotMatch(src, new RegExp(`'${name}'`), name);
});
