// P3-A: Kelola's rules (src/features/kelola/rules.ts), run under a time zone that isn't WIB, so every time on screen
// is shown to be WIB whatever the device's zone.
process.env.TZ = 'America/Los_Angeles';

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildDb } from '../e2e/fixtures/api';
import type { InternshipSubmission } from '../src/api/generated';
import {
  divisionsOf,
  filterSubmissions,
  formCaption,
  formIsOpen,
  formsEntry,
  hasFilters,
  kelolaAccess,
  kelolaServices,
  liveTotal,
  orDash,
  pageCount,
  plaqueLine,
  priorityName,
  questionBars,
  rowTime,
  spartaStats,
} from '../src/features/kelola/rules';
import { shortWhen } from '../src/lib/form/format';
import { parentOf, trailOf } from '../src/lib/shell/routes';

const raka = buildDb('pengurus').me;
const nadia = buildDb('anggota').me;
const people = { roles: ['peoplemanage'] };
const ring1 = { roles: ['ring1'] };
const akademik = { roles: ['akademik'] };
const NOW = Date.parse('2026-10-08T06:35:00.000Z'); // Kamis 8 Okt 2026, 13.35 WIB

test('the timezone of this run is not WIB', () => {
  assert.notEqual(new Date(NOW).getHours(), 13);
});

test('kelolaServices: Raka gets the three rows in the registry order', () => {
  assert.deepEqual(
    kelolaServices(raka).map((s) => [s.label, s.icon, s.destination]),
    [
      ['Live Counting & Rekap Form', 'grafik', '/kelola/live'],
      ['Data SPARTA Magang', 'kelola', '/kelola/sparta'],
      ['Tambah acara Akademik', 'kalender', '/kelola/acara'],
    ],
  );
  assert.deepEqual(
    kelolaServices(people).map((s) => s.label),
    ['Data SPARTA Magang'],
  );
  assert.deepEqual(kelolaServices(nadia), []);
});

test('kelolaAccess: Raka everywhere; peoplemanage only SPARTA; Nadia nowhere', () => {
  for (const page of ['hub', 'live', 'sparta'] as const)
    assert.deepEqual(kelolaAccess(raka, page), { allowed: true });
  assert.deepEqual(kelolaAccess(people, 'hub'), { allowed: true });
  assert.deepEqual(kelolaAccess(people, 'sparta'), { allowed: true });
  assert.deepEqual(kelolaAccess(people, 'live'), {
    allowed: false,
    to: '/kelola',
  });
  for (const page of ['hub', 'live', 'sparta'] as const)
    assert.deepEqual(kelolaAccess(nadia, page), {
      allowed: false,
      to: '/layanan',
    });
  assert.deepEqual(kelolaAccess(null, 'hub'), {
    allowed: false,
    to: '/layanan',
  });
});

// Deviation since P0-B round 2 (services.ts): Tambah acara Akademik is akademik's only, since the server lets only
// akademik add an Akademik event; the brief's ring1 row would lead to a 403. So ring1 alone has no Kelola tool.
test('kelolaAccess: akademik alone has Tambah acara Akademik only; ring1 alone has none', () => {
  assert.deepEqual(
    kelolaServices(akademik).map((s) => s.label),
    ['Tambah acara Akademik'],
  );
  assert.deepEqual(kelolaAccess(akademik, 'hub'), { allowed: true });
  assert.deepEqual(kelolaAccess(akademik, 'live'), {
    allowed: false,
    to: '/kelola',
  });
  assert.deepEqual(kelolaAccess(akademik, 'sparta'), {
    allowed: false,
    to: '/kelola',
  });
  assert.deepEqual(kelolaServices(ring1), []);
  assert.deepEqual(kelolaAccess(ring1, 'hub'), {
    allowed: false,
    to: '/layanan',
  });
});

test('formsEntry: one forwards, two list, none is empty', () => {
  assert.deepEqual(formsEntry([{ id: 'pixel' }]), {
    kind: 'forward',
    formId: 'pixel',
  });
  assert.deepEqual(formsEntry([{ id: 'a' }, { id: 'b' }]), { kind: 'list' });
  assert.deepEqual(formsEntry([]), { kind: 'empty' });
});

test('formCaption: Dibuka, or Ditutup once past closesAt, in WIB', () => {
  const form = {
    opensAt: '2026-09-12T06:00:00.000Z',
    closesAt: '2026-10-01T16:59:00.000Z',
  };
  assert.equal(
    formCaption({ ...form, closesAt: null }, shortWhen, NOW),
    'Dibuka Sab 12 Sep, 13.00',
  );
  assert.equal(formCaption(form, shortWhen, NOW), 'Ditutup Kam 1 Okt, 23.59');
  assert.equal(
    formCaption(
      { ...form, closesAt: '2026-10-31T16:59:00.000Z' },
      shortWhen,
      NOW,
    ),
    'Dibuka Sab 12 Sep, 13.00',
  );
});

test('back parents: no form page goes back to /kelola/live, which can forward to it', () => {
  assert.equal(parentOf('/kelola'), '/layanan');
  assert.equal(parentOf('/kelola/live'), '/kelola');
  assert.equal(parentOf('/kelola/live/$formId'), '/kelola');
  assert.equal(parentOf('/kelola/live/$formId/rekap'), '/kelola/live/$formId');
  assert.equal(parentOf('/kelola/sparta'), '/kelola');
  assert.equal(parentOf('/kelola/sparta/$submissionId'), '/kelola/sparta');
  for (const p of [
    '/kelola/live/$formId',
    '/kelola/live/$formId/rekap',
  ] as const)
    assert.ok(
      !trailOf(p, { formId: 'pixel' }).some((c) => c.path === '/kelola/live'),
      p,
    );
});

test('formIsOpen: active, opened, not closed', () => {
  const form = {
    opensAt: '2026-09-12T06:00:00.000Z',
    closesAt: null as string | null,
    isActive: true,
  };
  assert.equal(formIsOpen(form, NOW), true);
  assert.equal(formIsOpen({ ...form, isActive: false }, NOW), false);
  assert.equal(
    formIsOpen({ ...form, opensAt: '2026-10-10T06:00:00.000Z' }, NOW),
    false,
  );
  assert.equal(
    formIsOpen({ ...form, closesAt: '2026-10-08T06:35:00.000Z' }, NOW),
    false,
  );
  assert.equal(
    formIsOpen({ ...form, closesAt: '2026-10-08T06:36:00.000Z' }, NOW),
    true,
  );
});

test('liveTotal: the larger wins; a stale fetch never lowers it', () => {
  assert.equal(liveTotal(undefined, undefined), undefined);
  assert.equal(liveTotal(142, undefined), 142);
  assert.equal(liveTotal(undefined, 143), 143);
  assert.equal(liveTotal(142, 143), 143);
  assert.equal(liveTotal(144, 143), 144);
});

test('plaqueLine: today, another day, none; WIB under another zone', () => {
  assert.equal(
    plaqueLine('2026-10-08T06:31:00.000Z', NOW),
    'orang sudah mengisi · terakhir 13.31 WIB',
  );
  assert.equal(
    plaqueLine('2026-10-07T06:31:00.000Z', NOW),
    'orang sudah mengisi · terakhir Rab 7 Okt, 13.31 WIB',
  );
  // 23.10 WIB the night before is another day in WIB, though the same day in Los Angeles.
  assert.equal(
    plaqueLine('2026-10-07T16:10:00.000Z', NOW),
    'orang sudah mengisi · terakhir Rab 7 Okt, 23.10 WIB',
  );
  assert.equal(plaqueLine(null, NOW), 'orang sudah mengisi');
});

test('rowTime: hm today, dShort another day, in WIB', () => {
  assert.equal(rowTime('2026-10-08T05:41:00.000Z', NOW), '12.41');
  assert.equal(rowTime('2026-10-06T05:41:00.000Z', NOW), 'Sel 6 Okt');
  assert.equal(rowTime('2026-10-07T17:05:00.000Z', NOW), '00.05');
});

test('questionBars: count / max; max 0 gives empty tracks; rating 1–5 with zeros', () => {
  assert.deepEqual(
    questionBars({
      type: 'radio',
      options: [
        { value: 'IF', count: 96 },
        { value: 'STI', count: 48 },
      ],
    }),
    [
      { label: 'IF', count: 96, ratio: 1 },
      { label: 'STI', count: 48, ratio: 0.5 },
    ],
  );
  const empty = questionBars({
    type: 'checkbox',
    options: [
      { value: 'A', count: 0 },
      { value: 'B', count: 0 },
    ],
  });
  assert.deepEqual(
    empty.map((b) => b.ratio),
    [0, 0],
  );
  assert.ok(empty.every((b) => Number.isFinite(b.ratio)));
  assert.deepEqual(
    questionBars({
      type: 'rating',
      options: [
        { value: '4', count: 6 },
        { value: '2', count: 3 },
        { value: '5', count: 2 },
      ],
    }).map((b) => [b.label, b.count, b.ratio]),
    [
      ['1', 0, 0],
      ['2', 3, 0.5],
      ['3', 0, 0],
      ['4', 6, 1],
      ['5', 2, 2 / 6],
    ],
  );
  assert.deepEqual(questionBars({ type: 'rating', options: [] }).length, 5);
});

test('pageCount: 20 a page, at least one', () => {
  assert.equal(pageCount(0), 1);
  assert.equal(pageCount(20), 1);
  assert.equal(pageCount(21), 2);
  assert.equal(pageCount(142), 8);
});

// ---------- SPARTA ----------

const db = buildDb('pengurus');
const divisions = divisionsOf(db.internshipDepartments);
const byId = new Map(divisions.map((d) => [d.id, d]));
const [bima, tasya, nadiaDraft] = db.internshipSubmissions;
const sub = (
  id: string,
  over: Partial<InternshipSubmission>,
  choices: string[],
): InternshipSubmission => ({
  ...bima,
  id,
  ...over,
  choices: choices.map((divisionId, i) => ({
    id: `${id}-${i}`,
    submissionId: id,
    divisionId,
    priorityOrder: i + 1,
    answers: [],
  })),
});
const subs = [
  sub('a', { fullName: 'Ayu Lestari', nim: '13525001', isLocked: true }, [
    'div-cnc',
    'div-akademik',
  ]),
  sub('b', { fullName: 'Bayu Saputra', nim: '18225002', isLocked: false }, [
    'div-akademik',
    'div-cnc',
    'div-welfare',
  ]),
  sub('c', { fullName: 'Citra Ayu', nim: '13525003', isLocked: true }, [
    'div-welfare',
  ]),
];
const ids = (list: InternshipSubmission[]) => list.map((s) => s.id);

test('divisionsOf: every division with its department, in order', () => {
  assert.deepEqual(
    divisions.map((d) => `${d.departmentName}/${d.name}`),
    [
      'Welfare and Academics/Akademik',
      'Welfare and Academics/Welfare',
      'Competition and Community/Competition and Community',
      'Career Development/Career Development',
    ],
  );
});

test('filter: division alone matches any choice of it', () => {
  assert.deepEqual(ids(filterSubmissions(subs, { divisi: 'div-cnc' })), [
    'a',
    'b',
  ]);
});

test('filter: priority alone needs a choice at that priority', () => {
  assert.deepEqual(ids(filterSubmissions(subs, { pilihan: 2 })), ['a', 'b']);
  assert.deepEqual(ids(filterSubmissions(subs, { pilihan: 3 })), ['b']);
  assert.deepEqual(ids(filterSubmissions(subs, { pilihan: 4 })), []);
});

test('filter: priority and division need that division at that priority', () => {
  assert.deepEqual(
    ids(filterSubmissions(subs, { pilihan: 1, divisi: 'div-cnc' })),
    ['a'],
  );
  assert.deepEqual(
    ids(filterSubmissions(subs, { pilihan: 2, divisi: 'div-cnc' })),
    ['b'],
  );
});

test('filter: status and search (name or NIM, any case) apply on top', () => {
  assert.deepEqual(ids(filterSubmissions(subs, { status: 'terkunci' })), [
    'a',
    'c',
  ]);
  assert.deepEqual(ids(filterSubmissions(subs, { status: 'draf' })), ['b']);
  assert.deepEqual(ids(filterSubmissions(subs, { q: 'AYU' })), ['a', 'b', 'c']);
  assert.deepEqual(ids(filterSubmissions(subs, { q: ' citra ' })), ['c']);
  assert.deepEqual(ids(filterSubmissions(subs, { q: '182250' })), ['b']);
  assert.deepEqual(
    ids(
      filterSubmissions(subs, {
        q: 'ayu',
        status: 'terkunci',
        divisi: 'div-welfare',
      }),
    ),
    ['c'],
  );
  assert.equal(hasFilters({}), false);
  assert.equal(hasFilters({ q: '  ' }), false);
  assert.equal(hasFilters({ status: 'draf' }), true);
});

test('statistics: first choice or all, per department or per division, highest first', () => {
  assert.deepEqual(
    spartaStats(subs, divisions, 'divisi', 'pertama').map((r) => [
      r.label,
      r.count,
    ]),
    [
      ['Competition and Community · Competition and Community', 1],
      ['Welfare and Academics · Akademik', 1],
      ['Welfare and Academics · Welfare', 1],
    ],
  );
  assert.deepEqual(
    spartaStats(subs, divisions, 'departemen', 'semua').map((r) => [
      r.label,
      r.count,
    ]),
    [
      ['Welfare and Academics', 4],
      ['Competition and Community', 2],
    ],
  );
  assert.deepEqual(
    spartaStats(subs, divisions, 'departemen', 'pertama').map((r) => [
      r.label,
      r.count,
    ]),
    [
      ['Welfare and Academics', 2],
      ['Competition and Community', 1],
    ],
  );
  // A division that no longer exists is left out, as today.
  assert.deepEqual(
    spartaStats([sub('x', {}, ['gone'])], divisions, 'divisi', 'semua'),
    [],
  );
  assert.deepEqual(spartaStats([], divisions, 'divisi', 'semua'), []);
});

test('"–" for empty fields and missing priorities (a partial draft)', () => {
  assert.equal(orDash(''), '–');
  assert.equal(orDash('  '), '–');
  assert.equal(orDash(null), '–');
  assert.equal(orDash('IF K2'), 'IF K2');
  assert.equal(nadiaDraft.choices?.length, 3);
  assert.equal(priorityName(nadiaDraft, 1, byId), 'Akademik');
  assert.equal(priorityName(nadiaDraft, 4, byId), '–');
  assert.equal(priorityName(tasya, 4, byId), 'Career Development');
  assert.equal(priorityName(sub('y', {}, ['gone']), 1, byId), '–');
});
