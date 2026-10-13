/**
 * Kalender's rules (P1-A brief, rules 1–3, 8–12): which events a day has, deadlines and ended events, the course
 * line, the event detail's lines, the reminder, accessible names, the keyboard model of the month grid and which day
 * and event are chosen. Pure, so `tests/kalender-rules.test.ts` checks them; every day is a WIB day.
 * The prototype's versions: `eventsOn`, `isPoint`, `isPastEv`, `evLabel` (garis/state.js), `agendaRow`, `evInfo`,
 * `phoneMonth`, `scrKalender` (garis/screens-core.js), `cal-day`, `cal-month`, `cal-today` (garis/app.js).
 */
import type { CalendarEvent, Course, UserCourse } from '~/api/generated';
import { fill } from '~/copy/fill';
import { kalender as t } from '~/copy/kalender';
import { dLong, dShort, dayDiff, hm, wib } from '~/lib/dates';
import {
  addDays,
  dayInMonth,
  dayKeyOf,
  daysFrom,
  monthCells,
  monthOf,
  monthsOf,
  partsOf,
  sameMonth,
  shiftMonth,
  weekdayOf,
  type DayKey,
  type Month,
} from '~/lib/days';

export type CalEvent = CalendarEvent;

const ms = (iso: string) => Date.parse(iso);

/* ================= Events (rules 1–3) ================= */

/** A deadline is a point in time: it starts and ends at once (rule 2). */
export const isPoint = (e: CalEvent) => ms(e.start) === ms(e.end);

/** Ended: its end is before now (rule 3). A deadline ends at its time. */
export const isEnded = (e: CalEvent, now: number) => ms(e.end) < now;

export const isHimpunan = (e: CalEvent) => e.category === 'himpunan';

/** The WIB day an event starts on: the day it belongs to (rule 1). */
export const startDay = (e: CalEvent): DayKey => dayKeyOf(e.start);

/** By start, then title, so equal starts keep one order everywhere. */
export const byStart = (a: CalEvent, b: CalEvent) =>
  ms(a.start) - ms(b.start) || a.title.localeCompare(b.title);

/** A day's events: those that start on it, by start (rule 1). The API already filters who sees what. */
export function eventsOn(events: readonly CalEvent[], day: DayKey): CalEvent[] {
  return events.filter((e) => startDay(e) === day).sort(byStart);
}

/** Events from several months, each once, by start. */
export function mergeEvents(
  lists: ReadonlyArray<readonly CalEvent[] | undefined>,
): CalEvent[] {
  const seen = new Map<string, CalEvent>();
  for (const list of lists) for (const e of list ?? []) seen.set(e.id, e);
  return [...seen.values()].sort(byStart);
}

/* ================= Courses ================= */

/** This semester's courses by id: an Akademik event's `courseId` names one of them. */
export function coursesById(
  taken: readonly UserCourse[] | undefined,
): Map<string, Course> {
  const out = new Map<string, Course>();
  for (const uc of taken ?? []) if (uc.course) out.set(uc.courseId, uc.course);
  return out;
}

export const courseOf = (e: CalEvent, courses: ReadonlyMap<string, Course>) =>
  e.courseId ? courses.get(e.courseId) : undefined;

/** A row's second line (`agendaRow`): "IF2123 Aljabar Linier dan Geometri", or "Acara Himpunan". */
export function courseLine(e: CalEvent, course: Course | undefined): string {
  if (course) return `${course.code} ${course.name}`;
  return isHimpunan(e) ? t.acaraHimpunan : '';
}

/** An event named with its course code (`evLabel`): "Kuis 2 · IF2123". */
export function evLabel(e: CalEvent, course: Course | undefined): string {
  return course ? `${e.title} · ${course.code}` : e.title;
}

/* ================= The event detail (`evInfo`) ================= */

/** "15.00–16.40 WIB", or "Paling lambat 23.59 WIB" for a deadline. */
export function timeLine(e: CalEvent): string {
  const when = isPoint(e)
    ? fill(t.detail.palingLambat, { jam: hm(e.start) })
    : `${hm(e.start)}–${hm(e.end)}`;
  return fill(t.detail.wib, { waktu: when });
}

/** "Kamis, 8 Oktober 2026". */
export const dateLine = (e: CalEvent) =>
  `${dLong(e.start)} ${wib(e.start).year}`;

/** Pengingat H-1 (rule 11): sent 24 hours before the start, only to a device with notifications on. */
export function reminderLine(
  e: CalEvent,
  now: number,
  pushOn: boolean,
): string {
  if (!pushOn) return t.detail.notifikasiMati;
  const at = ms(e.start) - 24 * 60 * 60 * 1000;
  return fill(at < now ? t.detail.sudahDikirim : t.detail.dikirim, {
    hari: dShort(at),
    jam: hm(at),
  });
}

/** Testi Matkul's page for a course: today's URL (`/layanan/testi/$type/$semester/$courseId`, P0-B). */
export function testiParams(course: Course) {
  const type =
    course.major === 'IF'
      ? 'teknik-informatika'
      : course.major === 'STI'
        ? 'sistem-dan-teknologi-informasi'
        : 'mata-kuliah-umum';
  const semester =
    course.type === 'Elective' || course.semester === null
      ? 'other'
      : String(course.semester);
  return { type, semester, courseId: course.id };
}

/* ================= Words for days ================= */

/** "hari ini", "besok", "kemarin", else "Sen 12 Okt" (`whenDay`). */
export function whenDay(d: string | number, now: number): string {
  const dd = dayDiff(d, now);
  if (dd === 0) return t.kapan.hariIni;
  if (dd === 1) return t.kapan.besok;
  if (dd === -1) return t.kapan.kemarin;
  return dShort(d);
}

/** The first letter raised, where a line starts with a lower-case word ("Besok, 23.59"). */
export const capFirst = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

const count = (n: number) =>
  n ? fill(t.nama.jumlahAcara, { jumlah: n }) : t.nama.tidakAdaAcara;

/** A day's name on Beranda's strip (rule 9): "Kamis, 8 Oktober, hari ini, 2 acara". */
export function stripDayName(
  day: DayKey,
  index: number,
  events: number,
): string {
  const date = dLong(dayStartOf(day));
  const named =
    index === 0
      ? fill(t.nama.hariIni, { hari: date })
      : index === 1
        ? fill(t.nama.besok, { hari: date })
        : date;
  return `${named}, ${count(events)}`;
}

/** A day's name in the phone month: "Kamis, 8 Oktober, hari ini, 2 acara". */
export function monthDayName(
  day: DayKey,
  today: DayKey,
  events: number,
): string {
  const date = dLong(dayStartOf(day));
  const named = day === today ? fill(t.nama.hariIni, { hari: date }) : date;
  return `${named}, ${count(events)}`;
}

/** A desktop cell also lists its events: "…, 2 acara: Kuis 2 · IF2123, Sharing Session: Magang di Startup". */
export function deskCellName(
  day: DayKey,
  today: DayKey,
  labels: readonly string[],
): string {
  const date = dLong(dayStartOf(day));
  const named = day === today ? fill(t.nama.hariIni, { hari: date }) : date;
  const list = labels.length
    ? fill(t.nama.daftarAcara, {
        jumlah: labels.length,
        daftar: labels.join(', '),
      })
    : t.nama.tidakAdaAcara;
  return `${named}, ${list}`;
}

const dayStartOf = (day: DayKey) => {
  const { year, month, day: d } = partsOf(day);
  // Noon WIB: safely inside the day whatever rounding a formatter does.
  return Date.UTC(year, month - 1, d, 5);
};

/* ================= Beranda's strip (rule 8) ================= */

/** Eight days from today. */
export const stripDays = (now: number): DayKey[] => daysFrom(dayKeyOf(now), 8);

/** The months the strip needs: one, or two when the eight days cross a month's end. */
export const stripMonths = (now: number): Month[] => monthsOf(stripDays(now));

/** The chosen day: the URL's when it is on the strip, else today. */
export function chosenStripDay(
  days: readonly DayKey[],
  fromUrl: string | undefined,
): DayKey {
  return fromUrl && days.includes(fromUrl) ? fromUrl : days[0];
}

/* ================= Kalender's month (rules 10, keyboard) ================= */

/** The months a month's grid shows (its outside days too), so their bars are there. */
export const gridMonths = (view: Month): Month[] => monthsOf(monthCells(view));

/** The month buttons choose today in today's month, otherwise the 1st (`cal-month`). */
export function monthChangeDay(view: Month, now: number): DayKey {
  const today = dayKeyOf(now);
  return sameMonth(view, monthOf(today)) ? today : dayInMonth(view, 1);
}

export type GridKey =
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown';

/**
 * Where focus goes in the month grid (SPEC "Kalender: Keyboard"): arrows a day or a week, Home and End the week's
 * Monday and Sunday, Page Up and Page Down the same date a month earlier or later (the last day of a shorter month).
 * Null for any other key.
 */
export function moveFocus(day: DayKey, key: string): DayKey | null {
  switch (key) {
    case 'ArrowLeft':
      return addDays(day, -1);
    case 'ArrowRight':
      return addDays(day, 1);
    case 'ArrowUp':
      return addDays(day, -7);
    case 'ArrowDown':
      return addDays(day, 7);
    case 'Home':
      return addDays(day, -((weekdayOf(day) + 6) % 7));
    case 'End':
      return addDays(day, 6 - ((weekdayOf(day) + 6) % 7));
    case 'PageUp':
    case 'PageDown': {
      const m = shiftMonth(monthOf(day), key === 'PageUp' ? -1 : 1);
      return dayInMonth(m, partsOf(day).day);
    }
    default:
      return null;
  }
}

/**
 * Desktop's chosen event when the URL names none (rule 10, the prototype's `deskEv`): choosing a day chooses its first
 * event; otherwise, on today, the first event not yet ended (Kuis 2 for Nadia at 13.35, the Sharing Session for Raka);
 * on any other day none (changing the month clears it).
 */
export type DeskPick = 'first' | 'auto';

export function deskDefaultEvent(
  events: readonly CalEvent[],
  day: DayKey,
  now: number,
  pick: DeskPick,
): string | null {
  const list = eventsOn(events, day);
  if (pick === 'first' && list.length) return list[0].id;
  if (day === dayKeyOf(now))
    return list.find((e) => !isEnded(e, now))?.id ?? null;
  return null;
}
