import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  curhatUnreadTotal,
  openFormsCount,
  serviceBadge,
} from '../src/features/layanan/rules';
import { servicesByGroup } from '../src/lib/services';

/* Layanan (P1-C brief, "Rules to unit-test"): group order, Kelola per role, expired entries, badge counts. */

const now = new Date('2026-10-08T09:00:00+07:00');
const nadia = { roles: [] as string[] };
const raka = { roles: ['akademik', 'admin'] };

test('groups in order; Kelola only with a capability, last', () => {
  assert.deepEqual(
    servicesByGroup(nadia, now).map((g) => g.group),
    ['Kuliah', 'Teman dan himpunan', 'Kesempatan', 'Administrasi'],
  );
  const groups = servicesByGroup(raka, now);
  assert.equal(groups.at(-1)?.group, 'Kelola');
  assert.deepEqual(
    groups.at(-1)?.services.map((s) => s.label),
    [
      'Live Counting & Rekap Form',
      'Data SPARTA Magang',
      'Tambah acara Akademik',
    ],
  );
});

test('rows in the prototype’s order, with the members’ names', () => {
  const rows = servicesByGroup(nadia, now).flatMap((g) =>
    g.services.map((s) => s.label),
  );
  assert.deepEqual(rows, [
    'Ding Dong',
    'Testi Matkul',
    'NIM Finder',
    'Curhat Yuk!',
    'Form',
    'Info Lomba',
    'Beasiswa',
    'LowonginAja!',
    'Bayar Kas!',
    'Surat & Proposal',
  ]);
});

test('Kelola per role', () => {
  const kelola = (roles: string[]) =>
    servicesByGroup({ roles }, now)
      .find((g) => g.group === 'Kelola')
      ?.services.map((s) => s.id) ?? [];
  assert.deepEqual(kelola(['admin']), ['live', 'sparta-data']);
  assert.deepEqual(kelola(['peoplemanage']), ['sparta-data']);
  assert.deepEqual(kelola(['akademik']), ['acara']);
  assert.deepEqual(kelola(['cnc']), []);
});

test('an entry past validUntil is hidden, and shown before it', () => {
  const ids = (at: Date) =>
    servicesByGroup(nadia, at).flatMap((g) => g.services.map((s) => s.id));
  assert.ok(ids(new Date('2026-08-23T23:58:00+07:00')).includes('sparta'));
  assert.ok(!ids(new Date('2026-08-23T23:59:00+07:00')).includes('sparta'));
  assert.ok(!ids(now).includes('sparta'));
});

test('badges: Curhat’s unread summed, Form’s open count, none at 0 or while unknown', () => {
  assert.equal(
    curhatUnreadTotal([
      { unreadCount: 2 },
      { unreadCount: 1 },
      { unreadCount: 0 },
    ]),
    3,
  );
  assert.equal(curhatUnreadTotal(undefined), 0);
  assert.equal(
    openFormsCount([
      { status: 'open' },
      { status: 'already_responded' },
      { status: 'not_opened' },
      { status: 'open' },
    ]),
    2,
  );
  assert.deepEqual(serviceBadge('curhat', { unread: 1 }), {
    kind: 'count',
    value: 1,
  });
  assert.deepEqual(serviceBadge('form', { openForms: 1 }), {
    kind: 'tag',
    value: 1,
  });
  assert.equal(serviceBadge('curhat', { unread: 0 }), null);
  assert.equal(serviceBadge('form', {}), null);
  assert.equal(serviceBadge('dingdong', { unread: 3, openForms: 2 }), null);
});
