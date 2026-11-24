import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  BERANDA_TILES,
  SERVICE_GROUPS,
  SERVICES,
  isServiceActive,
  searchableServices,
  searchServices,
  servicesByGroup,
  type Service,
  visibleServices,
} from '../src/lib/services';
import { ICONS_BY_KEY } from '../src/components/icons/by-key';
import { ICONS, type IconKey } from '../src/components/icons/registry';

const all = SERVICES as readonly Service[];
const NOW = new Date('2026-10-08T13:35:00+07:00'); // a fixed "now"
const nadia = { roles: [] as string[] };
const raka = { roles: ['welfarenakademik', 'akademik', 'de', 'admin'] };

test('ids are unique', () => {
  assert.equal(new Set(all.map((s) => s.id)).size, all.length);
});

test("members' names, exactly as they know them", () => {
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
  ]) {
    assert.ok(labels.includes(name), name);
  }
});

test('Layanan for Nadia, group by group and in order', () => {
  assert.deepEqual(
    servicesByGroup(nadia, NOW).map((g) => [
      g.group,
      g.services.map((s) => s.id),
    ]),
    [
      ['Kuliah', ['dingdong', 'testi']],
      ['Teman dan himpunan', ['nim', 'curhat', 'form']],
      ['Kesempatan', ['lomba', 'beasiswa', 'lowongan']],
      ['Administrasi', ['kas', 'surat', 'tautan']],
    ],
  );
});

test("Raka's Kelola group holds his tools only", () => {
  const kelola = servicesByGroup(raka, NOW).find((g) => g.group === 'Kelola');
  assert.deepEqual(
    kelola?.services.map((s) => s.id),
    ['form-builder', 'live', 'acara', 'kelola-tautan'],
  );
  assert.deepEqual(
    visibleServices({ roles: ['peoplemanage'] }, NOW)
      .filter((s) => s.group === 'Kelola')
      .map((s) => s.id),
    ['form-builder'],
  );
  assert.deepEqual(
    visibleServices({ roles: ['ring1'] }, NOW)
      .filter((s) => s.group === 'Kelola')
      .map((s) => s.id),
    ['form-builder'],
    'ring1 adds Himpunan events from Kalender; the Kelola row is for Akademik events; any pengurus builds forms',
  );
});

test('groups use the expected names in the expected order', () => {
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

test('external services are HTTPS links to s.hmif.dev', () => {
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

test('every entry has an owner, an icon key and lower-case synonyms; a description only when it adds something', () => {
  for (const s of all) {
    if (s.description !== undefined) {
      assert.ok(s.description.trim().length > 0, s.id);
      assert.ok(
        !s.description.toLowerCase().includes(s.label.toLowerCase()),
        `${s.id}: the description repeats the name`,
      );
    }
    assert.ok(s.owner.length > 0, s.id);
    assert.ok(s.icon.length > 0, s.id);
    for (const w of s.synonyms)
      assert.equal(w, w.toLowerCase(), `${s.id}: ${w}`);
  }
});

test("the icons shown by key are the registry's own, and every service's is among them", () => {
  for (const [key, icon] of Object.entries(ICONS_BY_KEY))
    assert.equal(icon, ICONS[key as IconKey], key);
  for (const s of all) assert.ok(s.icon in ICONS_BY_KEY, s.id);
});

test('a service can end: hidden from its deadline, shown before it', () => {
  const ending: Service = {
    ...all[0],
    id: 'x',
    validUntil: '2026-08-23T23:59:00+07:00',
  };
  assert.equal(
    isServiceActive(ending, new Date('2026-08-23T23:58:59+07:00')),
    true,
  );
  assert.equal(
    isServiceActive(ending, new Date('2026-08-23T23:59:00+07:00')),
    false,
  );
  assert.equal(
    isServiceActive(ending, new Date('2026-08-24T00:00:00+07:00')),
    false,
  );
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

test("Beranda's tiles: seven services in the Home order", () => {
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

// Welfare must not see "Curhat Yuk!" twice in global search, both leading to the inbox.
test('Welfare finds Curhat Yuk! once in global search, as the inbox; Layanan and members keep the member row', () => {
  const welfare = { roles: ['curhatadmin'] };
  assert.deepEqual(
    searchServices('curhat', welfare, NOW).map((s) => s.id),
    ['curhat-inbox'],
  );
  assert.ok(!searchableServices(welfare, NOW).some((s) => s.id === 'curhat'));
  // Layanan still lists the member row for Welfare.
  assert.ok(visibleServices(welfare, NOW).some((s) => s.id === 'curhat'));
  for (const user of [nadia, raka])
    assert.deepEqual(
      searchServices('curhat', user, NOW).map((s) => s.id),
      ['curhat'],
    );
  assert.deepEqual(
    searchableServices(raka, NOW).map((s) => s.id),
    visibleServices(raka, NOW).map((s) => s.id),
  );
});

test('two entries with the same name each say which one they are', () => {
  for (const s of all) {
    const twins = all.filter((o) => o.label === s.label);
    if (twins.length > 1) assert.ok(s.description, s.id);
  }
});
