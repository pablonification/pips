import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  angkatanLabel,
  categoryRows,
  CATALOGUE_LIMIT,
  catalogueResults,
  groupsFact,
  picksBody,
  programName,
  semesterLabel,
  setPick,
  togglePick,
  totalSks,
} from '../src/features/profil/rules';
import { installWay } from '../src/features/profil/install-store';

/* Profil's rules (P1-C brief, "Rules to unit-test"). */

const cats = [
  { id: 'akademik', name: 'Akademik', requiredPush: false },
  { id: 'himpunan', name: 'Himpunan', requiredPush: true },
  { id: 'lomba', name: 'Lomba', requiredPush: false },
];

test('categories: the API’s order, required ones locked on and explained, the Akademik note', () => {
  const rows = categoryRows(cats, ['lomba', 'himpunan']);
  assert.deepEqual(
    rows.map((r) => [r.id, r.on, r.required, r.note]),
    [
      ['akademik', true, false, 'akademik'],
      // Muted on the server or not, a required category stays on.
      ['himpunan', true, true, 'wajib'],
      ['lomba', false, false, null],
    ],
  );
});

test('a required Akademik says why it is locked, not what it includes', () => {
  const [row] = categoryRows(
    [{ id: 'a', name: 'Akademik', requiredPush: true }],
    [],
  );
  assert.equal(row.note, 'wajib');
});

/* ---- The member card and Informasi akun ---- */

test('programme names as the prototype’s PROG', () => {
  assert.equal(programName('IF'), 'Teknik Informatika');
  assert.equal(programName('STI'), 'Sistem dan Teknologi Informasi');
});

test('angkatan: shortAng, plus the name only when it is a real one', () => {
  const list = [
    { year: 2025, name: 'PIXEL' },
    { year: 2024, name: '2024' },
    { year: 2023, name: '  ' },
    { year: 2022, name: null },
  ];
  assert.equal(angkatanLabel('IF', 2025, list), 'IF’25 · PIXEL');
  assert.equal(angkatanLabel('STI', 2024, list), 'STI’24');
  assert.equal(angkatanLabel('IF', 2023, list), 'IF’23');
  assert.equal(angkatanLabel('IF', 2022, list), 'IF’22');
  // Not loaded yet, or not on the list.
  assert.equal(angkatanLabel('IF', 2025, undefined), 'IF’25');
  assert.equal(angkatanLabel('IF', 2021, list), 'IF’21');
});

test('semester label: the academic year runs to the next year', () => {
  assert.equal(
    semesterLabel({ semesterCode: 'Ganjil', semesterYear: 2026 }),
    'Ganjil 2026/2027',
  );
  assert.equal(
    semesterLabel({ semesterCode: 'Genap', semesterYear: 2025 }),
    'Genap 2025/2026',
  );
});

test('Grup: only with roles; group names, each once', () => {
  const groups = [
    { role: 'akademik', group: 'Akademik' },
    { role: 'admin', group: 'Admin PIPS!' },
  ];
  assert.equal(groupsFact([], groups), null);
  assert.equal(
    groupsFact(['akademik', 'admin'], groups),
    'Akademik, Admin PIPS!',
  );
  // A role the list doesn't name shows its key rather than nothing.
  assert.equal(groupsFact(['ring1'], groups), 'ring1');
  assert.equal(groupsFact(['akademik', 'akademik'], groups), 'Akademik');
});

/* ---- Mata kuliahku and Tambah mata kuliah ---- */

test('total SKS: a course without credits counts 0', () => {
  assert.equal(
    totalSks([
      { course: { credits: 3 } },
      { course: { credits: 4 } },
      { course: { credits: null } },
      { course: null },
    ]),
    7,
  );
  assert.equal(totalSks([]), 0);
});

const course = (
  id: string,
  code: string,
  name: string,
  major: string,
  semester: number | null,
) => ({ id, code, name, major, semester });

const catalogue = [
  course('c1', 'IF2211', 'Strategi Algoritma', 'IF', 4),
  course('c2', 'IF2110', 'Algoritma dan Struktur Data', 'IF', 3),
  course('c3', 'II2111', 'Algoritma Lanjut', 'STI', 3),
  course('c4', 'IF2180', 'Sistem Basis Data', 'IF', 3),
  course('c5', 'KU1102', 'Pengenalan Komputasi', 'OTHER', 1),
];
const nadia = { major: 'IF', semester: 3 };

test('catalogue: this semester’s courses are left out', () => {
  const ids = catalogueResults(catalogue, ['c4'], '', nadia).map((c) => c.id);
  assert.ok(!ids.includes('c4'));
  assert.equal(ids.length, 4);
});

test('catalogue: code or name, any case', () => {
  assert.deepEqual(
    catalogueResults(catalogue, [], 'if2211', nadia).map((c) => c.code),
    ['IF2211'],
  );
  assert.deepEqual(
    catalogueResults(catalogue, [], 'STRATEGI', nadia).map((c) => c.code),
    ['IF2211'],
  );
  assert.deepEqual(
    catalogueResults(catalogue, [], '  basis ', nadia).map((c) => c.code),
    ['IF2180'],
  );
  assert.deepEqual(catalogueResults(catalogue, [], 'zzz', nadia), []);
});

test('catalogue: your major first, then your semester, then by code', () => {
  assert.deepEqual(
    catalogueResults(catalogue, [], 'algoritma', nadia).map((c) => c.code),
    // IF semester 3, IF semester 4, then STI.
    ['IF2110', 'IF2211', 'II2111'],
  );
  assert.deepEqual(
    catalogueResults(catalogue, [], '', nadia).map((c) => c.code),
    ['IF2110', 'IF2180', 'IF2211', 'II2111', 'KU1102'],
  );
});

test('catalogue: at most 10', () => {
  const many = Array.from({ length: 25 }, (_, i) =>
    course(`m${i}`, `IF3${String(i).padStart(3, '0')}`, 'Pilihan', 'IF', 5),
  );
  const out = catalogueResults(many, [], '', nadia);
  assert.equal(CATALOGUE_LIMIT, 10);
  assert.equal(out.length, 10);
  assert.equal(out[0].code, 'IF3000');
});

test('picks: choosing, re-choosing clears, the count, the request body', () => {
  let picks = togglePick({}, 'c1', 2);
  assert.deepEqual(picks, { c1: 2 });
  picks = togglePick(picks, 'c1', 3);
  assert.deepEqual(picks, { c1: 3 });
  picks = togglePick(picks, 'c2', 1);
  assert.equal(Object.keys(picks).length, 2);
  // Re-choosing the chosen class clears it.
  picks = togglePick(picks, 'c1', 3);
  assert.deepEqual(picks, { c2: 1 });
  assert.deepEqual(picksBody(setPick(picks, 'c5', 2)), [
    { courseId: 'c2', class: 1 },
    { courseId: 'c5', class: 2 },
  ]);
  assert.deepEqual(setPick(picks, 'c2', null), {});
});

test('picks survive a new search: they are kept by course, not by result', () => {
  const picks = togglePick({}, 'c1', 2);
  const shown = catalogueResults(catalogue, [], 'basis', nadia);
  assert.ok(!shown.some((c) => c.id === 'c1'));
  assert.deepEqual(picksBody(picks), [{ courseId: 'c1', class: 2 }]);
});

/* ---- Pasang PIPS! ---- */

test('Pasang PIPS!: installed, LINE, iPhone, Android prompt, Android menu, others', () => {
  const base = {
    ios: false,
    iosVersion: null,
    android: false,
    line: false,
    androidChrome: false,
    standalone: false,
  };
  assert.equal(
    installWay({ ...base, standalone: true, ios: true }, false),
    'terpasang',
  );
  assert.equal(installWay({ ...base, line: true, ios: true }, false), 'line');
  assert.equal(
    installWay({ ...base, line: true, android: true }, true),
    'line',
  );
  assert.equal(
    installWay({ ...base, ios: true, iosVersion: 17.5 }, false),
    'iphone',
  );
  assert.equal(
    installWay({ ...base, android: true, androidChrome: true }, true),
    'prompt',
  );
  assert.equal(
    installWay({ ...base, android: true, androidChrome: true }, false),
    'android',
  );
  assert.equal(installWay(base, false), 'lainnya');
  assert.equal(installWay(base, true), 'prompt');
});
