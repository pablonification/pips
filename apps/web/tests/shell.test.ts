import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { firstNameOf, initialsOf } from '../src/lib/shell/names';
import {
  modKeyLabel,
  opensPalette,
  PALETTE_LIMIT,
  paletteResults,
  type PaletteItem,
} from '../src/lib/shell/palette';
import {
  activeItem,
  deskCrumbs,
  DESTINATION_PATH,
  fillPath,
  isRootPage,
  parentOf,
  ROUTE_META,
  shellPath,
  titleOf,
  trailOf,
  type ShellPath,
} from '../src/lib/shell/routes';

/* The shell's rules (P0-C): the route table, back's parent, the lit navigation item, the desktop breadcrumbs,
   global search's results and shortcut, and the avatar's initials. */

const PATHS = Object.keys(ROUTE_META) as ShellPath[];

test('every route inside the app has an entry, and every entry is a route', () => {
  const tree = fs.readFileSync(
    path.resolve(import.meta.dirname, '../src/routeTree.gen.ts'),
    'utf8',
  );
  const to = /to:\n((?:\s+\| '[^']+'\n)+)/.exec(tree)![1];
  const routes = [...to.matchAll(/'([^']+)'/g)]
    .map((m) => m[1])
    .filter((p) => p !== '/login' && p !== '/dev/garis');
  assert.deepEqual([...routes].sort(), [...PATHS].sort());
});

test('every parent is a route of its own, and following parents always reaches a tab', () => {
  for (const p of PATHS) {
    const parent = parentOf(p, 'kalender');
    if (parent) assert.ok(parent in ROUTE_META, `${p} → ${parent}`);
    assert.ok(
      isRootPage(p) || parent,
      `${p} is neither a tab's page nor below one`,
    );
    // Lit item on phones: always one of the four tabs.
    assert.ok(
      ['beranda', 'pengumuman', 'kalender', 'layanan'].includes(
        activeItem(p, 'touch', 'kalender'),
      ),
      p,
    );
  }
});

test('titles: members’ service names and the prototype’s page names', () => {
  assert.equal(titleOf('/layanan/dingdong'), 'Ding Dong');
  assert.equal(titleOf('/layanan/curhat'), 'Curhat Yuk!');
  // The prototype's titleOf and the locked desk-pengurus-live screen ("Kelola › Live Counting"); the page's own
  // heading is the long service name.
  assert.equal(titleOf('/kelola/live'), 'Live Counting');
  assert.equal(titleOf('/kelola/live/$formId'), 'Live Counting');
  assert.equal(titleOf('/pengumuman/tulis'), 'Buat pengumuman');
  assert.equal(titleOf('/profil/matkul'), 'Mata kuliahku');
  assert.equal(titleOf('/profil/matkul/tambah'), 'Tambah mata kuliah');
  for (const p of PATHS) assert.ok(titleOf(p, { id: 'x' }).length > 0, p);
});

test('focused flows are the form, the composer and a Curhat room (SPEC story 19), and first run (P1-C)', () => {
  assert.deepEqual(PATHS.filter((p) => ROUTE_META[p].focused).sort(), [
    '/layanan/curhat/$roomId',
    '/layanan/form/$formId',
    // First run: a one-off checklist that ends on Beranda, with its own two ways out.
    '/mulai',
    '/pengumuman/tulis',
  ]);
});

test('the lit item: the tab a page is under; Kelola and Profil have their own on desktop', () => {
  assert.equal(activeItem('/', 'touch'), 'beranda');
  assert.equal(
    activeItem('/layanan/testi/$type/$semester', 'touch'),
    'layanan',
  );
  assert.equal(activeItem('/pengumuman/$id', 'desk'), 'pengumuman');
  // Kelola is in Layanan on phones and tablets, its own sidebar item on desktop (the locked prototype).
  assert.equal(activeItem('/kelola/live/$formId', 'touch'), 'layanan');
  assert.equal(activeItem('/kelola/live/$formId', 'desk'), 'kelola');
  // Profil keeps the tab you came from lit on phones (the prototype's stack); on desktop it is your name.
  assert.equal(
    activeItem('/profil/notifikasi', 'touch', 'kalender'),
    'kalender',
  );
  assert.equal(activeItem('/profil/notifikasi', 'desk', 'kalender'), 'profil');
});

test('back without history goes up: Profil to the tab you were last on, Kelola to Layanan', () => {
  assert.equal(parentOf('/layanan/dingdong'), '/layanan');
  assert.equal(parentOf('/profil', 'pengumuman'), '/pengumuman');
  assert.equal(parentOf('/profil'), '/');
  assert.equal(parentOf('/kelola'), '/layanan');
  assert.equal(parentOf('/layanan/curhat/$roomId'), '/layanan/curhat');
  assert.equal(parentOf('/kalender'), null);
  assert.equal(
    fillPath('/layanan/testi/$type/$semester', {
      type: 'teknik-informatika',
      semester: '3',
    }),
    '/layanan/testi/teknik-informatika/3',
  );
  assert.equal(fillPath('/layanan/form/$formId', {}), null);
  assert.equal(fillPath('/pengumuman/$id', { id: 'a b' }), '/pengumuman/a%20b');
});

test('the desktop breadcrumbs start at the sidebar item and end at the page', () => {
  const trail = (p: ShellPath, params = {}) =>
    trailOf(p, params).map((c) => c.href);
  assert.deepEqual(trail('/layanan/dingdong'), [
    '/layanan',
    '/layanan/dingdong',
  ]);
  assert.deepEqual(trail('/kelola/live/$formId', { formId: 'pixel' }), [
    '/kelola',
    '/kelola/live',
    '/kelola/live/pixel',
  ]);
  assert.deepEqual(trail('/profil/matkul/tambah'), [
    '/profil',
    '/profil/matkul',
    '/profil/matkul/tambah',
  ]);
  assert.deepEqual(
    trail('/layanan/testi/$type/$semester/$courseId', {
      type: 'teknik-informatika',
      semester: '3',
      courseId: 'IF2110',
    }),
    [
      '/layanan',
      '/layanan/testi',
      '/layanan/testi/teknik-informatika',
      '/layanan/testi/teknik-informatika/3',
      '/layanan/testi/teknik-informatika/3/IF2110',
    ],
  );
  // A sidebar item's own page shows no trail.
  for (const p of [
    '/',
    '/pengumuman',
    '/kalender',
    '/layanan',
    '/kelola',
    '/profil',
  ] as const)
    assert.equal(trailOf(p).length, 1, p);
});

test('a split page shows no breadcrumbs on desktop: the post beside the feed (the prototype’s openPost)', () => {
  // Review M3: "Pengumuman › Pengumuman" over the post.
  assert.deepEqual(deskCrumbs('/pengumuman/$id', { id: 'p1' }), []);
  assert.deepEqual(
    deskCrumbs('/layanan/dingdong').map((c) => c.href),
    ['/layanan', '/layanan/dingdong'],
  );
  assert.deepEqual(deskCrumbs('/layanan'), []);
});

test('a router match’s path maps to the table, trailing slash or not', () => {
  assert.equal(shellPath('/layanan/dingdong/'), '/layanan/dingdong');
  assert.equal(shellPath('/'), '/');
  assert.equal(shellPath('/pengumuman/$id/'), '/pengumuman/$id');
  assert.equal(shellPath('/login/'), null);
  assert.equal(shellPath('/dev/garis'), null);
  assert.deepEqual(Object.values(DESTINATION_PATH), [
    '/',
    '/pengumuman',
    '/kalender',
    '/layanan',
  ]);
});

const item = (
  id: string,
  label: string,
  extra: Partial<PaletteItem> = {},
): PaletteItem => ({
  id,
  group: 'Layanan',
  label,
  icon: 'folder',
  hint: '',
  run: () => {},
  ...extra,
});

test('search with nothing typed: the starting actions, then the pinned services under Pintasan', () => {
  const items = [
    item('a', 'Buat pengumuman', { group: 'Tindakan', start: true }),
    item('b', 'Ding Dong', { pinned: true }),
    item('c', 'Info Lomba'),
    item('d', 'Bayar Kas!', { pinned: true }),
  ];
  assert.deepEqual(
    paletteResults(items, '  ', 'Pintasan').map((g) => [
      g.heading,
      g.items.map((i) => i.id),
    ]),
    [
      ['Tindakan', ['a']],
      ['Pintasan', ['b', 'd']],
    ],
  );
});

test('search: label matches first, then the sources’ order, case ignored, at most 12, groups in first-seen order', () => {
  const items = [
    item('x', 'Curhat Yuk!', { hint: 'Ruang anonim', keywords: 'welfare kas' }),
    item('k', 'Bayar Kas!'),
    item('p', 'Kas bulan ini', { group: 'Pengumuman' }),
  ];
  assert.deepEqual(
    paletteResults(items, 'KAS', 'Pintasan').map((g) => [
      g.heading,
      g.items.map((i) => i.id),
    ]),
    [
      ['Layanan', ['k', 'x']],
      ['Pengumuman', ['p']],
    ],
  );
  const many = Array.from({ length: 30 }, (_, i) => item(`i${i}`, `Form ${i}`));
  const shown = paletteResults(many, 'form', 'Pintasan').flatMap(
    (g) => g.items,
  );
  assert.equal(shown.length, PALETTE_LIMIT);
  assert.equal(PALETTE_LIMIT, 12);
  assert.deepEqual(paletteResults(many, 'tidak ada', 'Pintasan'), []);
});

test('search opens with Ctrl K or ⌘K anywhere, and with / only when not typing', () => {
  const key = (k: string, mods: Partial<KeyboardEvent> = {}, tag = 'BODY') => ({
    key: k,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: {
      tagName: tag,
      isContentEditable: false,
    } as unknown as EventTarget,
    ...mods,
  });
  assert.ok(opensPalette(key('k', { ctrlKey: true })));
  assert.ok(opensPalette(key('K', { metaKey: true }, 'INPUT')));
  assert.ok(!opensPalette(key('k')));
  assert.ok(!opensPalette(key('k', { ctrlKey: true, altKey: true })));
  assert.ok(opensPalette(key('/')));
  assert.ok(!opensPalette(key('/', {}, 'INPUT')));
  assert.ok(!opensPalette(key('/', {}, 'TEXTAREA')));
  assert.ok(!opensPalette(key('/', { ctrlKey: true })));
  assert.equal(modKeyLabel('MacIntel'), '⌘K');
  assert.equal(modKeyLabel('Win32'), 'Ctrl K');
});

test('the avatar’s initials and the greeting’s first name', () => {
  assert.equal(initialsOf('Nadia Putri'), 'NP');
  assert.equal(initialsOf('Raka Pratama Wijaya'), 'RW');
  assert.equal(initialsOf('  raka  '), 'R');
  assert.equal(initialsOf(''), '');
  assert.equal(firstNameOf('Nadia Putri'), 'Nadia');
});
