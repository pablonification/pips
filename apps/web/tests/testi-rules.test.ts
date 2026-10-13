import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Course, Testimoni } from '../src/api/generated';
import {
  authorOf,
  clampIndex,
  codeLine,
  countLine,
  courseParams,
  inList,
  linkSegments,
  listCourses,
  listOfSlug,
  majorOfSlug,
  matchCourse,
  searchCourses,
  sections,
  testiTitle,
} from '../src/features/testi/rules';

/* Testi Matkul (P2-B brief, "Tests"): matching (the code bug), the course-list mapping, sections, authors, titles,
   the pager clamp. */

const course = (
  code: string,
  name: string,
  over: Partial<Course> = {},
): Course => ({
  id: `course-${code}`,
  curriculumYear: 2024,
  major: 'IF',
  type: 'Mandatory',
  semester: 3,
  semesterCode: 'Ganjil',
  code,
  name,
  credits: 3,
  dingdongUrl: null,
  isActive: true,
  ...over,
});

const if2110 = course('IF2110', 'Algoritma dan Pemrograman II');
const if2130 = course('IF2130', 'Sistem Operasi');
const if2210 = course('IF2210', 'Pemrograman Berorientasi Objek', {
  semester: 4,
  semesterCode: 'Genap',
});
// An elective the seed gives a semester number: Pilihan must still list it, and Semester 7 mustn't.
const if4010 = course('IF4010', 'Pemrograman Unit Pemrosesan Grafis', {
  type: 'Elective',
  semester: 7,
});
const ii2110 = course('II2110', 'Matematika Diskret', { major: 'STI' });
const dp3011 = course('DP3011', 'Berpikir Desain', {
  major: 'OTHER',
  type: 'Elective',
  semester: null,
});
// One of the seed's mandatory OTHER courses: reachable only through search, as today.
const ku1101 = course('KU1101', 'Pengantar Rekayasa dan Desain', {
  major: 'OTHER',
  semester: 1,
});
const catalogue = [if2130, ii2110, if4010, dp3011, if2110, ku1101, if2210];

test('regression: a course is found by its code in any case, and by its name', () => {
  for (const q of ['if2110', 'IF2110', 'If2110', 'algoritma', '  IF2110 ', 'if2110 algo'])
    assert.equal(matchCourse(if2110, q), true, q);
  assert.equal(matchCourse(if2110, 'if2130'), false);
  // Today's rule: the query lowercased, the code compared as stored (upper case). It never matched a code.
  const today = (c: Course, q: string) =>
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    c.code.includes(q.toLowerCase());
  assert.equal(today(if2110, 'IF2110'), false, 'the bug this replaces');
});

test('the start search spans the catalogue, by code; nothing typed is no search', () => {
  assert.equal(searchCourses(catalogue, ''), null);
  assert.equal(searchCourses(catalogue, '   '), null);
  assert.deepEqual(
    searchCourses(catalogue, 'if2110')?.map((c) => c.code),
    ['IF2110'],
  );
  assert.deepEqual(
    searchCourses(catalogue, 'pemrograman')?.map((c) => c.code),
    ['IF2110', 'IF2210', 'IF4010'],
  );
  assert.deepEqual(searchCourses(catalogue, 'zzz'), []);
});

test('course lists: a semester is its mandatory courses; Pilihan and Mata Kuliah Umum are electives, any semester', () => {
  assert.deepEqual(
    listCourses(catalogue, 'IF', 3).map((c) => c.code),
    ['IF2110', 'IF2130'],
  );
  assert.deepEqual(listCourses(catalogue, 'IF', 4).map((c) => c.code), ['IF2210']);
  assert.deepEqual(listCourses(catalogue, 'IF', 7), []);
  assert.deepEqual(
    listCourses(catalogue, 'IF', 'pilihan').map((c) => c.code),
    ['IF4010'],
  );
  assert.deepEqual(
    listCourses(catalogue, 'OTHER', 'pilihan').map((c) => c.code),
    ['DP3011'],
  );
  assert.equal(inList(ii2110, 'IF', 3), false, 'other programmes stay out');
  // The list's own search filters from the first character, by code too.
  assert.deepEqual(listCourses(catalogue, 'IF', 3, 'i').map((c) => c.code), ['IF2110', 'IF2130']);
  assert.deepEqual(listCourses(catalogue, 'IF', 3, 'if2130').map((c) => c.code), ['IF2130']);
});

test('URL slugs: today’s programme and list values; anything else is unknown', () => {
  assert.equal(majorOfSlug('teknik-informatika'), 'IF');
  assert.equal(majorOfSlug('sistem-dan-teknologi-informasi'), 'STI');
  assert.equal(majorOfSlug('mata-kuliah-umum'), 'OTHER');
  assert.equal(majorOfSlug('IF'), null);
  assert.equal(listOfSlug('3'), 3);
  assert.equal(listOfSlug('other'), 'pilihan');
  assert.equal(listOfSlug('9'), null);
  assert.equal(listOfSlug('3a'), null);
  assert.deepEqual(courseParams(if2110), {
    type: 'teknik-informatika',
    semester: '3',
    courseId: 'course-IF2110',
  });
  assert.deepEqual(courseParams(if4010).semester, 'other');
  assert.deepEqual(courseParams(dp3011).type, 'mata-kuliah-umum');
});

test('titles (testiTitle)', () => {
  assert.equal(testiTitle({}), null);
  assert.equal(testiTitle({ major: 'IF' }), 'Teknik Informatika');
  assert.equal(testiTitle({ major: 'STI' }), 'Sistem dan Teknologi Informasi');
  assert.equal(testiTitle({ major: 'IF', list: 3 }), 'IF · Semester 3');
  assert.equal(testiTitle({ major: 'STI', list: 'pilihan' }), 'STI · Pilihan');
  assert.equal(testiTitle({ major: 'OTHER', list: 'pilihan' }), 'Mata Kuliah Umum');
  assert.equal(testiTitle({ major: 'IF', list: 3, code: 'IF2110' }), 'IF2110');
});

test('row and header lines', () => {
  assert.equal(countLine(3), '3 testimoni');
  assert.equal(countLine(0), 'Belum ada testimoni');
  assert.equal(codeLine(if2110), 'IF2110 · 3 SKS');
  assert.equal(codeLine({ code: 'IF2110', credits: null }), 'IF2110');
});

const t = (over: Partial<Testimoni>): Testimoni => ({
  id: 't',
  userId: null,
  courseId: 'c',
  userName: null,
  impressions: null,
  challenges: null,
  advice: null,
  overview: null,
  assignments: null,
  lecturer_review: null,
  lecturer: null,
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});

test('sections per programme; empty ones left out; the other programme’s after; the lecturer last', () => {
  const titles = (major: Course['major'], x: Testimoni) =>
    sections(major, x).map((s) => s.title);
  assert.deepEqual(
    titles('IF', t({ overview: 'a', assignments: 'b', lecturer_review: 'c' })),
    ['Overview', 'Tugas', 'Review Dosen'],
  );
  assert.deepEqual(
    titles('STI', t({ impressions: 'a', challenges: 'b', advice: 'c' })),
    ['Kesan', 'Tantangan', 'Saran'],
  );
  assert.deepEqual(titles('OTHER', t({ overview: 'a', advice: ' ' })), ['Overview']);
  assert.deepEqual(
    titles('STI', t({ impressions: 'a', overview: 'b', lecturer: 'Dr. Rina' })),
    ['Kesan', 'Overview', 'Dosen'],
  );
  assert.deepEqual(titles('IF', t({ advice: 'x' })), ['Saran']);
  // Line breaks stay.
  assert.equal(sections('IF', t({ overview: 'a\nb' }))[0].text, 'a\nb');
});

test('authors: null, empty and "Anonim" are Anonim with "?"; others show initials of the first two words', () => {
  for (const n of [null, undefined, '', '  ', 'Anonim', 'anonim'])
    assert.deepEqual(authorOf(n), { name: 'Anonim', initials: '?' }, String(n));
  assert.deepEqual(authorOf('Fikri, IF 2023'), { name: 'Fikri, IF 2023', initials: 'FI' });
  assert.deepEqual(authorOf('nabila'), { name: 'nabila', initials: 'N' });
});

test('the pager clamps a 1-based page from the URL into range', () => {
  assert.equal(clampIndex(undefined, 3), 0);
  assert.equal(clampIndex(1, 3), 0);
  assert.equal(clampIndex(2, 3), 1);
  assert.equal(clampIndex(3, 3), 2);
  assert.equal(clampIndex(9, 3), 2);
  assert.equal(clampIndex(0, 3), 0);
  assert.equal(clampIndex(-4, 3), 0);
  assert.equal(clampIndex(2.7, 3), 1);
  assert.equal(clampIndex(5, 0), 0);
});

test('links in a testimonial are found as today’s app finds them, punctuation kept outside', () => {
  assert.deepEqual(linkSegments('tanpa tautan'), [{ text: 'tanpa tautan' }]);
  assert.deepEqual(linkSegments('Lihat https://example.org/a, lalu\nbaca.'), [
    { text: 'Lihat ' },
    { text: 'https://example.org/a', href: 'https://example.org/a' },
    { text: ', lalu\nbaca.' },
  ]);
  assert.deepEqual(linkSegments('(www.example.org)')[1], {
    text: 'www.example.org',
    href: 'https://www.example.org',
  });
});
