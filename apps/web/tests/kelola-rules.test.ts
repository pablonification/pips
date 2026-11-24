// Kelola's rules (src/features/kelola/rules.ts), run under a time zone that isn't WIB, so every time on screen
// is shown to be WIB whatever the device's zone.
process.env.TZ = 'America/Los_Angeles';

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildDb } from '../e2e/fixtures/api';
import {
  formCaption,
  formIsOpen,
  formsEntry,
  kelolaAccess,
  kelolaServices,
  gateRedirect,
  liveTotal,
  pageCount,
  plaqueLine,
  questionBars,
  rowTime,
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

test('kelolaServices: Raka gets the three rows in the registry order, Form first', () => {
  assert.deepEqual(
    kelolaServices(raka).map((s) => [s.label, s.icon, s.destination]),
    [
      ['Form', 'form', '/kelola/form'],
      ['Live Counting & Rekap Form', 'grafik', '/kelola/live'],
      ['Tambah acara Akademik', 'kalender', '/kelola/acara'],
    ],
  );
  assert.deepEqual(
    kelolaServices(people).map((s) => s.label),
    ['Form'],
  );
  assert.deepEqual(kelolaServices(nadia), []);
});

test('kelolaAccess: Raka everywhere; peoplemanage only the hub; Nadia nowhere', () => {
  for (const page of ['hub', 'live'] as const)
    assert.deepEqual(kelolaAccess(raka, page), { allowed: true });
  assert.deepEqual(kelolaAccess(people, 'hub'), { allowed: true });
  assert.deepEqual(kelolaAccess(people, 'live'), {
    allowed: false,
    to: '/kelola',
  });
  for (const page of ['hub', 'live'] as const)
    assert.deepEqual(kelolaAccess(nadia, page), {
      allowed: false,
      to: '/layanan',
    });
  assert.deepEqual(kelolaAccess(null, 'hub'), {
    allowed: false,
    to: '/layanan',
  });
});

// The member saved on the device may lack a role just given: nobody is sent away before the session check has
// answered in this visit.
test('gateRedirect: sends away only after the session check answered', () => {
  const denied = kelolaAccess(nadia, 'live');
  assert.equal(gateRedirect(denied, false), null);
  assert.equal(gateRedirect(denied, true), '/layanan');
  assert.equal(gateRedirect(kelolaAccess(people, 'live'), true), '/kelola');
  assert.equal(gateRedirect(kelolaAccess(raka, 'live'), false), null);
  assert.equal(gateRedirect(kelolaAccess(raka, 'live'), true), null);
});

// Tambah acara Akademik is akademik's only, since the server lets only akademik add an Akademik event; a ring1 row
// would lead to a 403. So ring1 alone has no Kelola tool.
test('kelolaAccess: akademik alone has Form and Tambah acara Akademik; ring1 alone has Form only', () => {
  assert.deepEqual(
    kelolaServices(akademik).map((s) => s.label),
    ['Form', 'Tambah acara Akademik'],
  );
  assert.deepEqual(kelolaAccess(akademik, 'hub'), { allowed: true });
  assert.deepEqual(kelolaAccess(akademik, 'live'), {
    allowed: false,
    to: '/kelola',
  });
  // Any pengurus builds forms, so every role has Kelola.
  assert.deepEqual(
    kelolaServices(ring1).map((s) => s.label),
    ['Form'],
  );
  assert.deepEqual(kelolaAccess(ring1, 'hub'), { allowed: true });
  assert.deepEqual(kelolaAccess(ring1, 'form'), { allowed: true });
  assert.deepEqual(kelolaAccess(akademik, 'form'), { allowed: true });
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
  assert.equal(parentOf('/kelola'), '/profil');
  assert.equal(parentOf('/kelola/live'), '/kelola');
  assert.equal(parentOf('/kelola/live/$formId'), '/kelola');
  assert.equal(parentOf('/kelola/live/$formId/rekap'), '/kelola/live/$formId');
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
