import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  BERANDA_TILES,
  SERVICE_GROUPS,
  SERVICES,
  isServiceActive,
  searchServices,
  servicesByGroup,
  type Service,
  visibleServices,
} from '../src/lib/services';

const all = SERVICES as readonly Service[];
const NOW = new Date('2026-10-08T13:35:00+07:00'); // the prototype's "now"
const nadia = { roles: [] as string[] };
const raka = { roles: ['welfarenakademik', 'akademik', 'de', 'admin'] };

test('ids are unique', () => {
  assert.equal(new Set(all.map((s) => s.id)).size, all.length);
});

test("members' names, exactly as they know them (FEATURES.md)", () => {
  const labels = all.map((s) => s.label);
  for (const name of [
    'Ding Dong',
    'Testi Matkul',
    'NIM Finder',
    'Info Lomba',
    'Curhat Yuk!',
    'LowonginAja!',
    'Bayar Kas!',
    'Beasiswa',
    'Surat & Proposal',
    'Form',
    'Live Counting & Rekap Form',
    'Data SPARTA Magang',
  ]) {
    assert.ok(labels.includes(name), name);
  }
});

test("the prototype's Layanan for Nadia, group by group and in order (garis/data.js SERVICES)", () => {
  assert.deepEqual(
    servicesByGroup(nadia, NOW).map((g) => [
      g.group,
      g.services.map((s) => s.id),
    ]),
    [
      ['Kuliah', ['dingdong', 'testi']],
      ['Teman dan himpunan', ['nim', 'curhat', 'form']],
      ['Kesempatan', ['lomba', 'beasiswa', 'lowongan']],
      ['Administrasi', ['kas', 'surat']],
    ],
  );
});

test("Raka's Kelola group holds his tools only (garis/screens-more.js kelolaItems)", () => {
  const kelola = servicesByGroup(raka, NOW).find((g) => g.group === 'Kelola');
  assert.deepEqual(
    kelola?.services.map((s) => s.id),
    ['live', 'sparta-data', 'acara'],
  );
  assert.deepEqual(
    visibleServices({ roles: ['peoplemanage'] }, NOW)
      .filter((s) => s.group === 'Kelola')
      .map((s) => s.id),
    ['sparta-data'],
  );
  assert.deepEqual(
    visibleServices({ roles: ['ring1'] }, NOW)
      .filter((s) => s.group === 'Kelola')
      .map((s) => s.id),
    [],
    'ring1 adds Himpunan events from Kalender; the Kelola row is for Akademik events',
  );
});

test('groups use SPEC names in SPEC order', () => {
  assert.deepEqual(SERVICE_GROUPS, [
    'Kuliah',
    'Teman dan himpunan',
    'Kesempatan',
    'Administrasi',
    'Kelola',
  ]);
  for (const s of all) assert.ok(SERVICE_GROUPS.includes(s.group), s.id);
  for (const s of all.filter((s) => s.group === 'Kelola'))
    assert.ok(s.capability, `${s.id} needs a capability`);
});

test('external services are HTTPS links to s.hmif.dev, as today (FEATURES.md §12)', () => {
  const external = all.filter((s) => s.kind === 'external');
  assert.deepEqual(external.map((s) => s.id).sort(), [
    'beasiswa',
    'kas',
    'lowongan',
    'surat',
  ]);
  for (const s of external)
    assert.match(s.destination, /^https:\/\/s\.hmif\.dev\/\S+$/);
});

test('internal destinations are routes in the route tree', () => {
  const tree = fs.readFileSync(
    path.resolve(import.meta.dirname, '../src/routeTree.gen.ts'),
    'utf8',
  );
  const block = /export interface FileRoutesByTo \{([\s\S]*?)\n\}/.exec(
    tree,
  )![1];
  const paths = new Set([...block.matchAll(/'([^']+)':/g)].map((m) => m[1]));
  for (const s of all.filter((s) => s.kind === 'internal')) {
    assert.ok(paths.has(s.destination), `${s.id}: ${s.destination}`);
  }
});

test('every entry has a description, an owner, an icon key and lower-case synonyms', () => {
  for (const s of all) {
    assert.ok(s.description.length > 0, s.id);
    assert.ok(s.owner.length > 0, s.id);
    assert.ok(s.icon.length > 0, s.id);
    for (const w of s.synonyms)
      assert.equal(w, w.toLowerCase(), `${s.id}: ${w}`);
  }
});

test('Magang SPARTA is hidden after its deadline (23 Agustus 2026, 23.59 WIB), as the prototype hides it', () => {
  const sparta = all.find((s) => s.id === 'sparta')!;
  assert.equal(
    isServiceActive(sparta, new Date('2026-08-23T23:59:00+07:00')),
    true,
  );
  assert.equal(
    isServiceActive(sparta, new Date('2026-08-24T00:00:00+07:00')),
    false,
  );
  assert.ok(
    visibleServices(nadia, new Date('2026-08-20T12:00:00+07:00')).some(
      (s) => s.id === 'sparta',
    ),
  );
  assert.ok(!visibleServices(nadia, NOW).some((s) => s.id === 'sparta'));
});

test('a service can start later', () => {
  const later: Service = {
    ...all[0],
    id: 'x',
    validFrom: '2026-11-01T00:00:00+07:00',
  };
  assert.equal(isServiceActive(later, NOW), false);
  assert.equal(
    isServiceActive(later, new Date('2026-11-01T00:00:00+07:00')),
    true,
  );
});

test("Beranda's tiles: seven services in today's Home order (garis/data.js TILES)", () => {
  assert.deepEqual(BERANDA_TILES, [
    'dingdong',
    'nim',
    'testi',
    'lomba',
    'curhat',
    'beasiswa',
    'kas',
  ]);
});

test('search matches names, descriptions and synonyms, ignoring case', () => {
  assert.deepEqual(
    searchServices('materi', nadia, NOW).map((s) => s.id),
    ['dingdong'],
  );
  assert.deepEqual(
    searchServices('DING DONG', nadia, NOW).map((s) => s.id),
    ['dingdong'],
  );
  assert.deepEqual(
    searchServices('kas iuran', nadia, NOW).map((s) => s.id),
    ['kas'],
  );
  assert.deepEqual(searchServices('  ', nadia, NOW), []);
  assert.deepEqual(
    searchServices('rekap', nadia, NOW),
    [],
    'members never find Kelola tools',
  );
  assert.deepEqual(
    searchServices('rekap', raka, NOW).map((s) => s.id),
    ['live'],
  );
});
