import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { openFormsCount, serviceBadge } from '../src/features/layanan/rules';
import { totalUnread } from '../src/lib/curhat-unread';
import { servicesByGroup } from '../src/lib/services';

/* Layanan: group order, Kelola per role, expired entries, badge counts. */

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
    ['Form', 'Live Counting & Rekap Form', 'Tambah acara Akademik'],
  );
});

test('rows in their order, with the members’ names', () => {
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
  assert.deepEqual(kelola(['admin']), ['form-builder', 'live']);
  assert.deepEqual(kelola(['peoplemanage']), ['form-builder']);
  assert.deepEqual(kelola(['akademik']), ['form-builder', 'acara']);
  // Any role builds forms.
  assert.deepEqual(kelola(['cnc']), ['form-builder']);
  assert.deepEqual(kelola([]), []);
});

test('badges: Curhat’s unread summed, Form’s open count, none at 0 or while unknown', () => {
  assert.equal(
    totalUnread([{ unreadCount: 2 }, { unreadCount: 1 }, { unreadCount: 0 }]),
    3,
  );
  assert.equal(totalUnread(undefined), 0);
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
