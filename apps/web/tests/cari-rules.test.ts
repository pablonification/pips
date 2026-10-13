// P1-A: global search's sources (brief rule 13): the 21-day window, the 3-character threshold, rows' words, and the
// sources together through P0-C's ranking (label matches first, index order, at most 12, groups in order).
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { CalendarEvent } from '../src/api/generated';
import {
  asksApi,
  eventHint,
  personHint,
  postLabel,
  upcomingEvents,
} from '../src/features/cari/rules';
import { paletteResults, type PaletteItem } from '../src/lib/shell/palette';

process.env.TZ = 'UTC';

const wib = (s: string) => new Date(`${s}:00+07:00`).toISOString();
const NOW = Date.parse(wib('2026-10-08T13:35'));
const ev = (id: string, start: string): CalendarEvent => ({
  id,
  calendarGroupId: 'g',
  courseId: null,
  title: id,
  description: '',
  category: 'himpunan',
  academicYear: 2026,
  academicSemesterCode: 'Ganjil',
  start: wib(start),
  end: wib(start),
  googleCalendarUrl: '',
  googleCalendarId: '',
});

test('Kalender lists upcoming events within 21 days, by start', () => {
  const list = upcomingEvents(
    [
      ev('past', '2026-10-08T10:00'),
      ev('later-today', '2026-10-08T19:00'),
      ev('day21', '2026-10-29T23:00'),
      ev('day22', '2026-10-30T08:00'),
      ev('tomorrow', '2026-10-09T08:00'),
    ],
    NOW,
  );
  assert.deepEqual(
    list.map((e) => e.id),
    ['later-today', 'tomorrow', 'day21'],
  );
});

test('rows read as the prototype’s: event hints, post labels, people', () => {
  assert.equal(eventHint(ev('k', '2026-10-13T13:00')), 'Sel 13 Okt 13.00');
  assert.equal(postLabel({ title: 'Jadwal UTS', content: 'x' }), 'Jadwal UTS');
  const long = 'a'.repeat(70);
  assert.equal(postLabel({ title: '', content: long }), `${'a'.repeat(64)}…`);
  assert.equal(personHint({ nim: '13525045', major: 'IF' }), '13525045 · IF');
});

test('the API is asked from 3 characters, trimmed', () => {
  assert.equal(asksApi('if'), false);
  assert.equal(asksApi('  ra '), false);
  assert.equal(asksApi('nad'), true);
});

const item = (
  id: string,
  group: string,
  label: string,
  extra: Partial<PaletteItem> = {},
): PaletteItem => ({
  id,
  group,
  label,
  icon: 'cari',
  hint: '',
  run: () => {},
  ...extra,
});

test('with the sources together: Tindakan and Pintasan to start, then IF3170 as Raka finds its events and course', () => {
  const items: PaletteItem[] = [
    item('t:buat', 'Tindakan', 'Buat pengumuman', {
      start: true,
      hint: 'Pengumuman',
    }),
    item('t:matkul', 'Tindakan', 'Tambah mata kuliah', {
      start: true,
      hint: 'Mata kuliahku',
    }),
    item('t:tema', 'Tindakan', 'Ganti ke tampilan gelap', { hint: 'Tampilan' }),
    item('l:dingdong', 'Layanan', 'Ding Dong', { pinned: true }),
    item('l:kas', 'Layanan', 'Bayar Kas!', { pinned: true }),
    item('l:lomba', 'Layanan', 'Info Lomba'),
    item('k:kuis2', 'Kalender', 'Kuis 2 · IF3170', {
      hint: 'Sel 13 Okt 13.00',
    }),
    item('k:uts', 'Kalender', 'UTS · IF3170', { hint: 'Rab 21 Okt 13.00' }),
    item('m:IF3170', 'Mata kuliah', 'IF3170 Inteligensi Buatan', {
      hint: 'Ding Dong',
    }),
  ];
  const start = paletteResults(items, '', 'Pintasan');
  assert.deepEqual(
    start.map((g) => [g.heading, g.items.map((i) => i.label)]),
    [
      ['Tindakan', ['Buat pengumuman', 'Tambah mata kuliah']],
      ['Pintasan', ['Ding Dong', 'Bayar Kas!']],
    ],
  );
  const found = paletteResults(items, 'IF3170', 'Pintasan');
  assert.deepEqual(
    found.map((g) => [g.heading, g.items.map((i) => i.label)]),
    [
      ['Kalender', ['Kuis 2 · IF3170', 'UTS · IF3170']],
      ['Mata kuliah', ['IF3170 Inteligensi Buatan']],
    ],
  );
  // "gelap" finds the theme action; "ding" finds the service by label before the course by its hint.
  assert.deepEqual(
    paletteResults(items, 'gelap', 'Pintasan')[0].items[0].id,
    't:tema',
  );
  assert.deepEqual(
    paletteResults(items, 'ding', 'Pintasan').flatMap((g) =>
      g.items.map((i) => i.id),
    ),
    ['l:dingdong', 'm:IF3170'],
  );
});

test('at most 12 results, from every source', () => {
  const many = Array.from({ length: 20 }, (_, i) =>
    item(`p${i}`, i < 10 ? 'Pengumuman' : 'Orang', `Rapat ${i}`),
  );
  const groups = paletteResults(many, 'rapat', 'Pintasan');
  assert.equal(groups.flatMap((g) => g.items).length, 12);
  assert.deepEqual(
    groups.map((g) => g.heading),
    ['Pengumuman', 'Orang'],
  );
});
