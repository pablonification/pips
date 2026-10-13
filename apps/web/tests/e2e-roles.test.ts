// The harness's `roles` option (P3-A): a list adds roles to the persona, `{ only }` replaces them, and everything
// the db derives from roles follows.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { applyRoles, buildDb } from '../e2e/fixtures/api';

test('applyRoles: none keeps, a list adds without duplicates, only replaces', () => {
  assert.deepEqual(applyRoles(['akademik', 'admin'], null), [
    'akademik',
    'admin',
  ]);
  assert.deepEqual(applyRoles(['akademik'], ['peoplemanage', 'akademik']), [
    'akademik',
    'peoplemanage',
  ]);
  assert.deepEqual(
    applyRoles(['akademik', 'admin'], { only: ['peoplemanage'] }),
    ['peoplemanage'],
  );
  assert.deepEqual(applyRoles(['admin'], { only: [] }), []);
});

test('buildDb without the option is unchanged', () => {
  assert.deepEqual(buildDb('pengurus'), buildDb('pengurus', null));
  assert.deepEqual(buildDb('anggota').me?.roles, []);
});

test('a peoplemanage-only member: me, groups and the admin form list follow', () => {
  const db = buildDb('pengurus', { only: ['peoplemanage'] });
  assert.deepEqual(db.me?.roles, ['peoplemanage']);
  assert.deepEqual(
    db.groups.map((g) => g.role),
    ['peoplemanage'],
  );
  assert.deepEqual(db.adminForms, []);
  // Raka's own categories (Akademik, Himpunan) are no longer his to post in.
  assert.ok(!db.postableCategories.some((c) => c.name === 'Akademik'));
});

test('roles added to Nadia make her an admin for the admin form list', () => {
  const db = buildDb('anggota', ['admin']);
  assert.deepEqual(db.me?.roles, ['admin']);
  assert.equal(db.adminForms.length, 1);
  assert.deepEqual(
    db.groups.map((g) => g.role),
    ['admin'],
  );
});

test('the signed-out visitor ignores the option', () => {
  assert.equal(buildDb(null, ['admin']).me, null);
});
