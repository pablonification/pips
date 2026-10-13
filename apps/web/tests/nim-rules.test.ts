import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { NimFinderResult } from '../src/api/generated';
import { nimQuery, nimStatus, rankMembers } from '../src/features/nim/rules';

/* NIM Finder (P2-B brief, "Tests"): ranking, the 3-character rule on the trimmed query, the status wording. */

const m = (fullName: string, nim: string): NimFinderResult => ({
  fullName,
  nim,
  major: nim.startsWith('182') ? 'STI' : 'IF',
  picture: null,
});

test('exact NIM, then NIM prefixes, then other NIM matches, then names; A–Z within each, from a Z–A input', () => {
  const zToA = [
    m('Zahra Putri', '13525135'),
    m('Yoga 135', '13125999'),
    m('Wulan', '13512345'),
    m('Dewi', '13113599'),
    m('Bima', '13510000'),
    m('Ahmad 135', '18222000'),
    m('Citra', '135'),
    m('Andi', '13599999'),
  ];
  assert.deepEqual(
    rankMembers(zToA, '135').map((x) => x.fullName),
    [
      'Citra', // the exact NIM
      'Andi', // NIMs starting with it, A–Z
      'Bima',
      'Wulan',
      'Zahra Putri',
      'Dewi', // other NIM matches
      'Ahmad 135', // name matches, A–Z
      'Yoga 135',
    ],
  );
  // The input is left as it was.
  assert.equal(zToA[0].fullName, 'Zahra Putri');
});

test('names A–Z when nothing matches a NIM', () => {
  assert.deepEqual(
    rankMembers(
      [m('Rakai Prasetyo', '13525001'), m('Raka Pratama', '18224045')],
      'rak',
    ).map((x) => x.fullName),
    ['Raka Pratama', 'Rakai Prasetyo'],
  );
});

test('the 3-character rule is on the trimmed query', () => {
  assert.equal(nimQuery(undefined), null);
  assert.equal(nimQuery('ra'), null);
  assert.equal(nimQuery('  ra '), null);
  assert.equal(nimQuery(' rak '), 'rak');
  assert.equal(nimQuery('135'), '135');
});

test('status wording, as nimResults words it', () => {
  assert.equal(
    nimStatus({ kind: 'short' }),
    'Ketik minimal 3 huruf nama atau angka NIM.',
  );
  assert.equal(
    nimStatus({ kind: 'done', count: 2, typed: 'rak' }),
    '2 hasil. Pilih untuk menyalin NIM.',
  );
  assert.equal(
    nimStatus({ kind: 'done', count: 0, typed: 'Zzz ' }),
    'Tidak ada anggota dengan nama atau NIM “Zzz ”.',
  );
  assert.equal(nimStatus({ kind: 'loading' }), 'Mencari…');
});

test('at the API’s cap of 30 the count reads "30+ hasil", so it isn’t taken for the total', () => {
  // Dev 1's decision (P2-B round 2): P0-D returns at most 30 members (apps/api/src/lib/nim-finder.ts).
  assert.equal(
    nimStatus({ kind: 'done', count: 30, typed: '135' }),
    '30+ hasil. Pilih untuk menyalin NIM.',
  );
  assert.equal(
    nimStatus({ kind: 'done', count: 29, typed: '135' }),
    '29 hasil. Pilih untuk menyalin NIM.',
  );
});
