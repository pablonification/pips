// F1's flow catalogue (e2e/review/flows.ts) and its flows (e2e/review/flows/*.flow.ts): unique ids, every field,
// only known layouts, themes, personas, owners and areas, stories between 1 and 157, locked screens that exist, and
// a recording declared for every variant of every flow.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { FINDINGS } from '../e2e/review/findings';
import {
  AREAS,
  FLOWS,
  LAYOUTS,
  OWNERS,
  PERSONAS,
  THEMES,
  recordingName,
  recordingsPerTheme,
  variantLayouts,
} from '../e2e/review/flows';

const flowsDir = path.resolve(import.meta.dirname, '..', 'e2e', 'review', 'flows');
const sources = readdirSync(flowsDir)
  .filter((f) => f.endsWith('.flow.ts'))
  .map((f) => readFileSync(path.join(flowsDir, f), 'utf8'))
  .join('\n');

test('49 flows from the brief’s tables, plus old-links, each id once', () => {
  const ids = FLOWS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 50);
  assert.deepEqual(FLOWS.filter((f) => f.addedFrom).map((f) => f.id), ['old-links']);
});

test('every field present; only known layouts, themes, personas, owners and areas; stories 1 to 157', () => {
  const areas = AREAS.map((a) => a.id) as string[];
  for (const f of FLOWS) {
    for (const k of ['title', 'check', 'startsAt'] as const) assert.ok(f[k]?.length, `${f.id}.${k}`);
    assert.ok(areas.includes(f.area), `${f.id}: area`);
    assert.ok(f.variants.length > 0, `${f.id}: variants`);
    assert.ok(f.layouts.length > 0 && f.layouts.every((l) => LAYOUTS.includes(l)), `${f.id}: layouts`);
    assert.ok(f.themes.length > 0 && f.themes.every((t) => THEMES.includes(t)), `${f.id}: themes`);
    assert.ok(f.owners.length > 0 && f.owners.every((o) => OWNERS.includes(o)), `${f.id}: owners`);
    assert.ok(f.stories.length > 0 && f.stories.every((s) => Number.isInteger(s) && s >= 1 && s <= 157), `${f.id}: stories`);
    assert.ok(f.startsAt.startsWith('/'), `${f.id}: startsAt`);
    for (const v of f.variants) {
      assert.ok(PERSONAS.includes(v.persona), `${f.id}:${v.key} persona`);
      assert.match(v.key, /^[a-z0-9-]+$/);
      assert.ok(variantLayouts(f, v).length > 0, `${f.id}:${v.key} has a layout`);
    }
    if (f.darkSet) assert.ok(f.themes.includes('dark'), `${f.id}: in the dark set, so dark`);
  }
  assert.ok(OWNERS.includes('P3-C'));
});

test('the dark set is the brief’s twelve flows', () => {
  assert.deepEqual(
    FLOWS.filter((f) => f.darkSet).map((f) => f.id).sort(),
    [
      'beranda',
      'beranda-pengurus',
      'curhat-room',
      'form-pixel',
      'kalender',
      'layanan',
      'live-counting',
      'navigation',
      'pengumuman-react-comment',
      'pengumuman-unread',
      'profil',
      'signin-shared-link',
    ],
  );
});

test('the locked screens a flow passes through exist', async () => {
  // names.mjs has no types of its own: read it as plain data.
  const namesFile: string = '../e2e/fidelity/names.mjs';
  const { EXTRA_SCREENS, PENGURUS_ROUTES, ROUTES } = (await import(namesFile)) as {
    EXTRA_SCREENS: { name: string }[];
    PENGURUS_ROUTES: string[];
    ROUTES: string[];
  };
  const routes = new Set([...ROUTES.map((r) => `anggota-${r}`), ...PENGURUS_ROUTES.map((r) => `pengurus-${r}`)]);
  const extras = new Set(EXTRA_SCREENS.map((e) => e.name.replace(/-(light|dark)$/, '')));
  for (const f of FLOWS)
    for (const s of f.locked) assert.ok(routes.has(s) || extras.has(s) || extras.has(`${s}`), `${f.id}: ${s}`);
});

test('every variant of every flow is recorded by a flow() in flows/*.flow.ts, and nothing else is', () => {
  const declared = [...sources.matchAll(/flow\(\s*'([a-z0-9-]+)',\s*'([a-z0-9-]+)'/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.equal(new Set(declared).size, declared.length, 'no variant declared twice');
  const expected = FLOWS.flatMap((f) => f.variants.map((v) => `${f.id}:${v.key}`));
  assert.deepEqual([...declared].sort(), [...expected].sort());
});

test('a flow marked failing names a finding that exists, and the finding names it back', () => {
  for (const m of sources.matchAll(/failsWith\('(F1-\d+)'\)/g)) {
    const f = FINDINGS.find((x) => x.id === m[1]);
    assert.ok(f, m[1]);
  }
  const ids = FINDINGS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const f of FINDINGS) for (const id of f.flows) assert.ok(FLOWS.some((x) => x.id === id), `${f.id}: ${id}`);
});

test('recording names: layout and theme, plus the variant when a flow has two or more', () => {
  const one = FLOWS.find((f) => f.id === 'beranda')!;
  const two = FLOWS.find((f) => f.id === 'layanan')!;
  assert.equal(recordingName(one, 'phone', 'light', 'nadia'), 'phone-light');
  assert.equal(recordingName(two, 'desktop', 'dark', 'raka'), 'desktop-dark-raka');
  assert.equal(recordingsPerTheme(FLOWS.find((f) => f.id === 'install')!), 4);
});
