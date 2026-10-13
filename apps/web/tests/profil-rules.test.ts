import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { categoryRows } from '../src/features/profil/rules';

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
