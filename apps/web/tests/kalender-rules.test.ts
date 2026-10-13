// P1-A: the calendar's day keys and Kalender's rules (brief rules 1–3, 8–12), in WIB whatever the device's zone.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { CalendarEvent, Course, UserCourse } from '../src/api/generated';
import { dLong, dShort, hm } from '../src/lib/dates';
import {
  addDays,
  dayInMonth,
  dayKeyOf,
  dayStart,
  daysBetween,
  monthCells,
  monthsOf,
  shiftMonth,
} from '../src/lib/days';
import {
  capFirst,
  chosenStripDay,
  courseLine,
  coursesById,
  dateLine,
  deskCellName,
  deskDefaultEvent,
  evLabel,
  eventsOn,
  gridMonths,
  isEnded,
  isPoint,
  mergeEvents,
  monthChangeDay,
  monthDayName,
  moveFocus,
  reminderLine,
  stripDayName,
  stripDays,
  stripMonths,
  testiParams,
  timeLine,
  whenDay,
} from '../src/features/kalender/rules';

// The device's zone must not matter: every rule works in WIB. Run these as if the device were in California.
process.env.TZ = 'America/Los_Angeles';

/** An instant given as WIB wall time. */
const wib = (s: string) => new Date(`${s}:00+07:00`).toISOString();
const NOW = Date.parse(wib('2026-10-08T13:35'));

const ev = (
  id: string,
  category: 'akademik' | 'himpunan',
  title: string,
  start: string,
  end: string = start,
  courseId: string | null = null,
): CalendarEvent => ({
  id,
  calendarGroupId: courseId ? `group-${courseId}` : 'group-himpunan',
  courseId,
  title,
  description: '',
  category,
  academicYear: 2026,
  academicSemesterCode: 'Ganjil',
  start: wib(start),
  end: wib(end),
  googleCalendarUrl: `https://calendar.google.com/calendar/event?eid=${id}`,
  googleCalendarId: id,
});

const course = (
  code: string,
  name: string,
  extra: Partial<Course> = {},
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
  ...extra,
});

// Nadia's week, as the prototype's data.js has it.
const sharing = ev(
  'h1',
  'himpunan',
  'Sharing Session: Magang di Startup',
  '2026-10-08T19:00',
  '2026-10-08T21:00',
);
const kuis2 = ev(
  'a2',
  'akademik',
  'Kuis 2',
  '2026-10-08T15:00',
  '2026-10-08T16:40',
  'course-IF2123',
);
const kuis1 = ev(
  'a1',
  'akademik',
  'Kuis 1',
  '2026-10-07T09:00',
  '2026-10-07T10:00',
  'course-IF2120',
);
const tubes = ev(
  'a3',
  'akademik',
  'Deadline Tugas Besar 1',
  '2026-10-09T23:59',
  '2026-10-09T23:59',
  'course-IF2110',
);
const baksos = ev(
  'h2',
  'himpunan',
  'Bakti Sosial HMIF',
  '2026-10-10T08:00',
  '2026-10-10T12:00',
);
const EVENTS = [sharing, kuis2, kuis1, tubes, baksos];

/* ================= Day keys ================= */

test('a day is the WIB day, whatever the device zone', () => {
  assert.equal(dayKeyOf(wib('2026-10-01T00:30')), '2026-10-01');
  assert.equal(dayKeyOf(wib('2026-09-30T23:59')), '2026-09-30');
  assert.equal(dayKeyOf(NOW), '2026-10-08');
  assert.equal(
    new Date(dayStart('2026-10-08')).toISOString(),
    '2026-10-07T17:00:00.000Z',
  );
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(daysBetween('2026-10-08', '2026-10-29'), 21);
});

test('the month grid starts on Monday: October 2026 starts on 28 September, five whole weeks', () => {
  const cells = monthCells({ year: 2026, month: 10 });
  assert.equal(cells[0], '2026-09-28');
  assert.equal(cells.length, 35);
  assert.equal(cells.at(-1), '2026-11-01');
  // February 2021 fills exactly four weeks; March 2026 needs six rows (it starts on a Sunday).
  assert.equal(monthCells({ year: 2021, month: 2 }).length, 28);
  assert.equal(monthCells({ year: 2026, month: 3 }).length, 42);
  assert.deepEqual(gridMonths({ year: 2026, month: 10 }), [
    { year: 2026, month: 9 },
    { year: 2026, month: 10 },
    { year: 2026, month: 11 },
  ]);
});

test('months shift across years and days clamp to a shorter month', () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), {
    year: 2025,
    month: 12,
  });
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), {
    year: 2027,
    month: 1,
  });
  assert.equal(dayInMonth({ year: 2026, month: 2 }, 31), '2026-02-28');
  assert.equal(dayInMonth({ year: 2028, month: 2 }, 31), '2028-02-29');
});

test('date words: "15.00", "Kamis, 8 Oktober", "Sen 12 Okt"', () => {
  assert.equal(hm(kuis2.start), '15.00');
  assert.equal(dLong(NOW), 'Kamis, 8 Oktober');
  assert.equal(dShort(wib('2026-10-12T13:00')), 'Sen 12 Okt');
  assert.equal(dateLine(kuis2), 'Kamis, 8 Oktober 2026');
});

/* ================= The strip (rule 8) ================= */

test('the strip is eight days from today, and one month unless the days cross its end', () => {
  assert.deepEqual(stripDays(NOW), [
    '2026-10-08',
    '2026-10-09',
    '2026-10-10',
    '2026-10-11',
    '2026-10-12',
    '2026-10-13',
    '2026-10-14',
    '2026-10-15',
  ]);
  assert.deepEqual(stripMonths(NOW), [{ year: 2026, month: 10 }]);
  const late = Date.parse(wib('2026-10-28T09:00'));
  assert.equal(stripDays(late).at(-1), '2026-11-04');
  assert.deepEqual(stripMonths(late), [
    { year: 2026, month: 10 },
    { year: 2026, month: 11 },
  ]);
  // New Year: December and January.
  assert.deepEqual(monthsOf(stripDays(Date.parse(wib('2026-12-30T08:00')))), [
    { year: 2026, month: 12 },
    { year: 2027, month: 1 },
  ]);
});

test('the chosen strip day: the URL’s when it is on the strip, else today', () => {
  const days = stripDays(NOW);
  assert.equal(chosenStripDay(days, undefined), '2026-10-08');
  assert.equal(chosenStripDay(days, '2026-10-10'), '2026-10-10');
  assert.equal(chosenStripDay(days, '2026-10-20'), '2026-10-08');
});

/* ================= Events (rules 1–3) ================= */

test('a day’s events are those starting on it in WIB, by start (rule 1)', () => {
  assert.deepEqual(
    eventsOn(EVENTS, '2026-10-08').map((e) => e.id),
    ['a2', 'h1'],
  );
  assert.deepEqual(eventsOn(EVENTS, '2026-10-11'), []);
  // 00.30 WIB on the 1st is the 1st, though it is still the 30th in UTC and on this device.
  const early = ev(
    'x',
    'himpunan',
    'Pagi',
    '2026-10-01T00:30',
    '2026-10-01T02:00',
  );
  assert.deepEqual(
    eventsOn([early], '2026-10-01').map((e) => e.id),
    ['x'],
  );
  assert.deepEqual(eventsOn([early], '2026-09-30'), []);
});

test('events from several months merge once each, by start', () => {
  assert.deepEqual(
    mergeEvents([[kuis2, sharing], [sharing, kuis1], undefined]).map(
      (e) => e.id,
    ),
    ['a1', 'a2', 'h1'],
  );
});

test('deadlines are point events; ended events end before now (rules 2, 3)', () => {
  assert.equal(isPoint(tubes), true);
  assert.equal(isPoint(kuis2), false);
  assert.equal(isEnded(kuis1, NOW), true);
  assert.equal(isEnded(kuis2, NOW), false);
  assert.equal(timeLine(tubes), 'Paling lambat 23.59 WIB');
  assert.equal(timeLine(kuis2), '15.00–16.40 WIB');
});

test('course lines, labels and Testi Matkul’s page', () => {
  const taken: UserCourse[] = [
    {
      userId: 'u',
      courseId: 'course-IF2123',
      class: 1,
      semesterCodeTaken: 'Ganjil',
      semesterYearTaken: 2026,
      course: course('IF2123', 'Aljabar Linier dan Geometri'),
    },
    {
      userId: 'u',
      courseId: 'course-IF9',
      class: 1,
      semesterCodeTaken: 'Ganjil',
      semesterYearTaken: 2026,
    },
  ];
  const map = coursesById(taken);
  assert.equal(map.size, 1);
  const c = map.get('course-IF2123');
  assert.equal(courseLine(kuis2, c), 'IF2123 Aljabar Linier dan Geometri');
  assert.equal(courseLine(sharing, undefined), 'Acara Himpunan');
  assert.equal(courseLine(tubes, undefined), '');
  assert.equal(evLabel(kuis2, c), 'Kuis 2 · IF2123');
  assert.equal(
    evLabel(sharing, undefined),
    'Sharing Session: Magang di Startup',
  );
  assert.deepEqual(testiParams(course('IF2123', 'x')), {
    type: 'teknik-informatika',
    semester: '3',
    courseId: 'course-IF2123',
  });
  assert.deepEqual(
    testiParams(course('II2120', 'x', { major: 'STI', semester: 3 })).type,
    'sistem-dan-teknologi-informasi',
  );
  assert.deepEqual(
    testiParams(course('IF4020', 'x', { type: 'Elective', semester: 7 }))
      .semester,
    'other',
  );
  assert.deepEqual(
    testiParams(course('DP3011', 'x', { major: 'OTHER', semester: null })),
    {
      type: 'mata-kuliah-umum',
      semester: 'other',
      courseId: 'course-DP3011',
    },
  );
});

/* ================= Pengingat H-1 (rule 11) ================= */

test('the reminder line: off, already sent, or when it will be sent', () => {
  assert.equal(
    reminderLine(tubes, NOW, false),
    'Notifikasi belum menyala di perangkat ini',
  );
  // Kuis 2 at 15.00 today: its reminder went yesterday at 15.00.
  assert.equal(
    reminderLine(kuis2, NOW, true),
    'Sudah dikirim Rab 7 Okt, 15.00',
  );
  const praktikum = ev(
    'a4',
    'akademik',
    'Praktikum 2',
    '2026-10-12T13:00',
    '2026-10-12T15:00',
  );
  assert.equal(reminderLine(praktikum, NOW, true), 'Dikirim Min 11 Okt, 13.00');
  assert.equal(
    reminderLine(sharing, NOW, true),
    'Sudah dikirim Rab 7 Okt, 19.00',
  );
});

/* ================= Words and names (rule 9) ================= */

test('whenDay and its raised first letter', () => {
  assert.equal(whenDay(tubes.start, NOW), 'besok');
  assert.equal(capFirst(whenDay(tubes.start, NOW)), 'Besok');
  assert.equal(whenDay(kuis2.start, NOW), 'hari ini');
  assert.equal(whenDay(kuis1.start, NOW), 'kemarin');
  assert.equal(whenDay(wib('2026-10-12T13:00'), NOW), 'Sen 12 Okt');
});

test('accessible names: strip days, month days and desktop cells', () => {
  assert.equal(
    stripDayName('2026-10-08', 0, 2),
    'Kamis, 8 Oktober, hari ini, 2 acara',
  );
  assert.equal(
    stripDayName('2026-10-09', 1, 1),
    'Jumat, 9 Oktober, besok, 1 acara',
  );
  assert.equal(
    stripDayName('2026-10-11', 3, 0),
    'Minggu, 11 Oktober, tidak ada acara',
  );
  // P1-A round 2: a day whose month hasn't arrived (or failed) has no count, not a wrong "tidak ada acara".
  assert.equal(stripDayName('2026-11-02', 5, null), 'Senin, 2 November');
  assert.equal(
    monthDayName('2026-10-08', '2026-10-08', 2),
    'Kamis, 8 Oktober, hari ini, 2 acara',
  );
  assert.equal(
    monthDayName('2026-10-19', '2026-10-08', 1),
    'Senin, 19 Oktober, 1 acara',
  );
  assert.equal(
    deskCellName('2026-10-08', '2026-10-08', [
      'Kuis 2 · IF2123',
      'Sharing Session: Magang di Startup',
    ]),
    'Kamis, 8 Oktober, hari ini, 2 acara: Kuis 2 · IF2123, Sharing Session: Magang di Startup',
  );
  assert.equal(
    deskCellName('2026-10-11', '2026-10-08', []),
    'Minggu, 11 Oktober, tidak ada acara',
  );
});

/* ================= The month: keyboard and selection (rule 10) ================= */

test('keyboard moves: arrows, Home and End to the week’s ends, Page Up and Down across months and years', () => {
  assert.equal(moveFocus('2026-10-08', 'ArrowRight'), '2026-10-09');
  assert.equal(moveFocus('2026-10-01', 'ArrowLeft'), '2026-09-30');
  assert.equal(moveFocus('2026-10-08', 'ArrowDown'), '2026-10-15');
  assert.equal(moveFocus('2026-10-08', 'ArrowUp'), '2026-10-01');
  assert.equal(moveFocus('2026-10-08', 'Home'), '2026-10-05'); // Monday
  assert.equal(moveFocus('2026-10-08', 'End'), '2026-10-11'); // Sunday
  assert.equal(moveFocus('2026-10-11', 'Home'), '2026-10-05'); // a Sunday's week starts the Monday before
  assert.equal(moveFocus('2026-10-05', 'End'), '2026-10-11');
  assert.equal(moveFocus('2026-10-08', 'PageUp'), '2026-09-08');
  assert.equal(moveFocus('2026-01-15', 'PageUp'), '2025-12-15');
  assert.equal(moveFocus('2026-12-31', 'PageDown'), '2027-01-31');
  assert.equal(moveFocus('2026-01-31', 'PageDown'), '2026-02-28');
  assert.equal(moveFocus('2026-10-08', 'Enter'), null);
});

test('changing the month chooses today in today’s month, otherwise the 1st', () => {
  assert.equal(monthChangeDay({ year: 2026, month: 11 }, NOW), '2026-11-01');
  assert.equal(monthChangeDay({ year: 2026, month: 10 }, NOW), '2026-10-08');
  assert.equal(monthChangeDay({ year: 2025, month: 10 }, NOW), '2025-10-01');
});

test('desktop’s default event: today the first not ended; a chosen day its first; another day none', () => {
  // Nadia at 13.35: Kuis 2 is next. Raka: his 10.00 quiz has ended, so the Sharing Session.
  assert.equal(deskDefaultEvent(EVENTS, '2026-10-08', NOW, 'auto'), 'a2');
  const rakaKuis = ev(
    'b1',
    'akademik',
    'Kuis 1',
    '2026-10-08T10:00',
    '2026-10-08T11:00',
    'course-IF3170',
  );
  assert.equal(
    deskDefaultEvent([rakaKuis, sharing], '2026-10-08', NOW, 'auto'),
    'h1',
  );
  assert.equal(
    deskDefaultEvent([rakaKuis, sharing], '2026-10-08', NOW, 'first'),
    'b1',
  );
  assert.equal(deskDefaultEvent(EVENTS, '2026-10-09', NOW, 'first'), 'a3');
  assert.equal(deskDefaultEvent(EVENTS, '2026-10-09', NOW, 'auto'), null);
  assert.equal(deskDefaultEvent(EVENTS, '2026-10-11', NOW, 'first'), null);
});
