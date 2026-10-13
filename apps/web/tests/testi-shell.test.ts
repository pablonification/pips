import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  activeItem,
  deskCrumbs,
  parentOf,
  titleOf,
} from '../src/lib/shell/routes';

/* Testi Matkul inside the shell (P2-B): titles from the URL as the prototype's `testiTitle`, and Mata Kuliah Umum's
   list right below Testi Matkul (it has no semester step), so back and the breadcrumbs never pass a page that only
   redirects. */

const IF3 = { type: 'teknik-informatika', semester: '3' };
const MKU = { type: 'mata-kuliah-umum', semester: 'other' };
const LIST = '/layanan/testi/$type/$semester' as const;
const COURSE = '/layanan/testi/$type/$semester/$courseId' as const;

test('titles: programme, list, and Testi Matkul for anything unknown', () => {
  assert.equal(titleOf('/layanan/testi'), 'Testi Matkul');
  assert.equal(
    titleOf('/layanan/testi/$type', { type: 'teknik-informatika' }),
    'Teknik Informatika',
  );
  assert.equal(titleOf('/layanan/testi/$type', { type: 'x' }), 'Testi Matkul');
  assert.equal(titleOf(LIST, IF3), 'IF · Semester 3');
  assert.equal(
    titleOf(LIST, {
      type: 'sistem-dan-teknologi-informasi',
      semester: 'other',
    }),
    'STI · Pilihan',
  );
  assert.equal(titleOf(LIST, MKU), 'Mata Kuliah Umum');
  assert.equal(titleOf(LIST, { type: 'x', semester: '3' }), 'Testi Matkul');
});

test('a list sits below its programme; Mata Kuliah Umum’s below Testi Matkul', () => {
  assert.equal(parentOf(LIST, 'beranda', IF3), '/layanan/testi/$type');
  assert.equal(parentOf(LIST, 'beranda', MKU), '/layanan/testi');
  assert.equal(parentOf(COURSE, 'beranda', MKU), LIST);
});

test('breadcrumbs follow the same parents, from Layanan', () => {
  const trail = (params: Record<string, string>) =>
    deskCrumbs(COURSE, { ...params, courseId: 'c1' }).map((c) => c.href);
  assert.deepEqual(trail(IF3), [
    '/layanan',
    '/layanan/testi',
    '/layanan/testi/teknik-informatika',
    '/layanan/testi/teknik-informatika/3',
    '/layanan/testi/teknik-informatika/3/c1',
  ]);
  assert.deepEqual(trail(MKU), [
    '/layanan',
    '/layanan/testi',
    '/layanan/testi/mata-kuliah-umum/other',
    '/layanan/testi/mata-kuliah-umum/other/c1',
  ]);
});

test('Layanan stays lit on every level', () => {
  for (const p of [
    '/layanan/testi',
    '/layanan/testi/$type',
    LIST,
    COURSE,
  ] as const) {
    assert.equal(activeItem(p, 'touch'), 'layanan', p);
    assert.equal(activeItem(p, 'desk'), 'layanan', p);
  }
});
