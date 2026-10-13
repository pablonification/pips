// P3-B: the add-event dialog's rules (brief rules 2–5, 8) and the WIB times, under a device zone that isn't WIB.
process.env.TZ = 'America/New_York';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  ApiError,
  type CalendarEvent,
  type Course,
} from '../src/api/generated';
import { kelolaTulis } from '../src/copy/kelola-tulis';
import {
  addedToast,
  afterAdd,
  courseOptions,
  createBody,
  draftOf,
  firstError,
  inMyCalendar,
  monthsTouched,
  newDraft,
  updateBody,
  validateEvent,
} from '../src/features/kelola-acara/rules';
import {
  writeFailure,
  writeFailureMessage,
} from '../src/features/kelola-tulis/rules';
import { wibOf, wibToIso } from '../src/lib/days';

const course = (code: string, major: Course['major'] = 'IF'): Course => ({
  id: `course-${code}`,
  curriculumYear: 2024,
  major,
  type: 'Mandatory',
  semester: 5,
  semesterCode: 'Ganjil',
  code,
  name: `Mata kuliah ${code}`,
  credits: 3,
  dingdongUrl: null,
  isActive: true,
});

test('the zone is not WIB, so every rule below proves itself in WIB', () => {
  assert.notEqual(new Date('2026-10-13T06:00:00Z').getHours(), 13);
});

test('WIB: what is typed becomes ISO, and comes back the same, whatever the device zone', () => {
  assert.equal(wibToIso('2026-10-13', '13:00'), '2026-10-13T06:00:00.000Z');
  assert.equal(wibToIso('2026-10-13', '00:30'), '2026-10-12T17:30:00.000Z');
  assert.equal(wibToIso('2026-12-31', '23:59'), '2026-12-31T16:59:00.000Z');
  assert.deepEqual(wibOf('2026-10-13T06:00:00.000Z'), {
    day: '2026-10-13',
    time: '13:00',
  });
  assert.deepEqual(wibOf('2026-10-12T17:30:00.000Z'), {
    day: '2026-10-13',
    time: '00:30',
  });
  for (const [day, time] of [
    ['2026-10-13', '07:05'],
    ['2027-01-01', '00:00'],
    ['2026-03-08', '02:30'], // New York's own clock change that night
  ])
    assert.deepEqual(wibOf(wibToIso(day, time)!), { day, time });
  // Nothing that isn't a day and a time.
  assert.equal(wibToIso('', '13:00'), null);
  assert.equal(wibToIso('2026-10-13', ''), null);
  assert.equal(wibToIso('2026-02-31', '13:00'), null);
  assert.equal(wibToIso('2026-10-13', '24:00'), null);
});

test('course options: no Mata Kuliah Umum; your courses first, then the rest, each by code; the first chosen', () => {
  const catalogue = [
    course('IF2110'),
    course('KU1011', 'OTHER'),
    course('IF3170'),
    course('II2110', 'STI'),
    course('IF3110'),
  ];
  const mine = new Set(['course-IF3170', 'course-IF3110']);
  assert.deepEqual(
    courseOptions(catalogue, mine).map((c) => c.code),
    ['IF3110', 'IF3170', 'IF2110', 'II2110'],
  );
  assert.deepEqual(
    courseOptions(catalogue, new Set()).map((c) => c.code),
    ['IF2110', 'IF3110', 'IF3170', 'II2110'],
  );
  // The catalogue it came from is left as it was.
  assert.equal(catalogue[0].code, 'IF2110');
});

test('a new draft: the chosen day, 13.00 to 15.00', () => {
  assert.deepEqual(newDraft('akademik', '2026-10-08', 'course-IF3170'), {
    category: 'akademik',
    courseId: 'course-IF3170',
    title: '',
    date: '2026-10-08',
    start: '13:00',
    end: '15:00',
    description: '',
  });
});

test('validation: a title, a date and both times; an end before the start; equal is a deadline', () => {
  const ok = {
    ...newDraft('akademik', '2026-10-13', 'course-IF3170'),
    title: 'Kuis 2',
  };
  assert.deepEqual(validateEvent(ok), {});
  assert.deepEqual(validateEvent({ ...ok, title: '   ' }), {
    title: 'Tulis judul acara, misalnya Kuis 2.',
  });
  assert.deepEqual(validateEvent({ ...ok, date: '' }), {
    date: 'Isi tanggal dan jam acara.',
  });
  assert.deepEqual(validateEvent({ ...ok, start: '' }), {
    start: 'Isi tanggal dan jam acara.',
  });
  assert.deepEqual(validateEvent({ ...ok, end: '' }), {
    end: 'Isi tanggal dan jam acara.',
  });
  assert.deepEqual(validateEvent({ ...ok, start: '15:00', end: '13:00' }), {
    end: 'Jam selesai tidak boleh sebelum jam mulai.',
  });
  // A deadline: Selesai equal to Mulai shows "Batas" in Kalender.
  assert.deepEqual(validateEvent({ ...ok, start: '23:59', end: '23:59' }), {});
  // Several at once: focus goes to the first, top to bottom.
  const all = validateEvent({ ...ok, title: '', start: '15:00', end: '13:00' });
  assert.deepEqual(Object.keys(all).sort(), ['end', 'title']);
  assert.equal(firstError(all), 'title');
  assert.equal(firstError({ end: 'x' }), 'end');
});

test('the request body: Akademik with its course, trimmed, times as ISO (the brief’s exact body)', () => {
  const d = {
    ...newDraft('akademik', '2026-10-13', 'course-IF3170'),
    title: '  Kuis 2 ',
    description: '   ',
  };
  assert.deepEqual(createBody(d), {
    category: 'akademik',
    courseId: 'course-IF3170',
    title: 'Kuis 2',
    description: '',
    start: '2026-10-13T06:00:00.000Z',
    end: '2026-10-13T08:00:00.000Z',
  });
  const h = {
    ...newDraft('himpunan', '2026-10-15', 'course-IF3170'),
    title: 'Rapat Anggota HMIF',
    start: '19:00',
    end: '21:00',
  };
  const body = createBody(h);
  assert.equal(body.category, 'himpunan');
  assert.equal('courseId' in body, false);
  assert.equal(body.start, '2026-10-15T12:00:00.000Z');
});

test('changing an event: filled in WIB; only title, description, start and end are sent', () => {
  const e: CalendarEvent = {
    id: 'b1',
    calendarGroupId: 'group-IF3170',
    courseId: 'course-IF3170',
    title: 'Kuis 1',
    description: 'Pencarian dan heuristik.',
    category: 'akademik',
    academicYear: 2026,
    academicSemesterCode: 'Ganjil',
    start: '2026-10-08T03:00:00.000Z',
    end: '2026-10-08T04:00:00.000Z',
    googleCalendarUrl: 'https://calendar.google.com/x',
    googleCalendarId: 'x',
  };
  const d = draftOf(e);
  assert.deepEqual(d, {
    category: 'akademik',
    courseId: 'course-IF3170',
    title: 'Kuis 1',
    date: '2026-10-08',
    start: '10:00',
    end: '11:00',
    description: 'Pencarian dan heuristik.',
  });
  assert.deepEqual(updateBody({ ...d, date: '2026-11-02' }), {
    title: 'Kuis 1',
    description: 'Pencarian dan heuristik.',
    start: '2026-11-02T03:00:00.000Z',
    end: '2026-11-02T04:00:00.000Z',
  });
  assert.equal(draftOf({ ...e, category: 'himpunan' }).category, 'himpunan');
  // The months to refresh: the old date's and the new one's, once each.
  assert.deepEqual(monthsTouched(e.start, '2026-11-02T03:00:00.000Z'), [
    { year: 2026, month: 10 },
    { year: 2026, month: 11 },
  ]);
  assert.deepEqual(monthsTouched(e.start, e.end), [{ year: 2026, month: 10 }]);
  // 00.30 WIB on 1 November is still 31 October in New York and in UTC.
  assert.deepEqual(monthsTouched('2026-10-31T17:30:00.000Z'), [
    { year: 2026, month: 11 },
  ]);
});

test('after adding: the event’s day; on desktop the event only when it’s in your calendar (S.deskEv)', () => {
  const mine = new Set(['course-IF3170']);
  const kuis2 = {
    id: 'new',
    start: '2026-10-13T06:00:00.000Z',
    category: 'akademik',
    courseId: 'course-IF3170',
  };
  assert.deepEqual(afterAdd(kuis2, mine, true), {
    hari: '2026-10-13',
    acara: 'new',
  });
  assert.deepEqual(afterAdd(kuis2, mine, false), {
    hari: '2026-10-13',
    acara: undefined,
  });
  const other = { ...kuis2, courseId: 'course-IF2110' };
  assert.deepEqual(afterAdd(other, mine, true), {
    hari: '2026-10-13',
    acara: undefined,
  });
  const himpunan = { ...kuis2, category: 'himpunan', courseId: null };
  assert.equal(inMyCalendar(himpunan, new Set()), true);
  assert.equal(afterAdd(himpunan, new Set(), true).acara, 'new');
  // Late in the WIB evening is still that WIB day.
  assert.equal(
    afterAdd({ ...kuis2, start: '2026-10-13T16:59:00.000Z' }, mine, true).hari,
    '2026-10-13',
  );
});

test('the toasts: the course’s members, or everyone for Himpunan', () => {
  const d = newDraft('akademik', '2026-10-13', 'course-IF3170');
  assert.equal(
    addedToast(d, course('IF3170')),
    'Acara ditambahkan ke kalender anggota IF3170 dan Google Calendar-nya.',
  );
  assert.equal(
    addedToast({ ...d, category: 'himpunan' }, undefined),
    'Acara ditambahkan ke kalender semua anggota dan Google Calendar-nya.',
  );
});

const apiError = (status: number) =>
  new ApiError(
    { method: 'POST', url: '/api/calendar/event' },
    {
      url: '/api/calendar/event',
      ok: false,
      status,
      statusText: '',
      body: { error: 'You are not authorized to create academic events' },
    },
    'Forbidden',
  );

test('writes never sign out: 401 and 403 are "no access"; anything else is "not saved"; no API text', () => {
  assert.equal(writeFailure(apiError(401)), 'tanpaAkses');
  assert.equal(writeFailure(apiError(403)), 'tanpaAkses');
  for (const e of [
    apiError(400),
    apiError(404),
    apiError(503),
    new TypeError('Failed to fetch'),
  ])
    assert.equal(writeFailure(e), 'gagal');
  assert.equal(writeFailureMessage(apiError(403)), kelolaTulis.tanpaAkses);
  assert.equal(writeFailureMessage(apiError(503)), kelolaTulis.gagal);
  for (const text of Object.values(kelolaTulis)) {
    assert.doesNotMatch(text, /authorized|Unauthorized|!/);
  }
});
