/**
 * P3-B: the add-event dialog's rules (garis/screens-core.js `addEventForm`, app.js's `addev` submit branch), and
 * changing an event (a proposal). Pure, so `tests/kelola-acara-rules.test.ts` runs them under another time zone:
 * what is typed is WIB, what is sent is ISO, and what is shown back is WIB.
 */
import type { CalendarEvent, Course } from '~/api/generated';
import { fill } from '~/copy/fill';
import { kelolaAcara as t } from '~/copy/kelola-acara';
import type { EventCategory } from '~/lib/capabilities';
import {
  dayKeyOf,
  monthOf,
  wibOf,
  wibToIso,
  type DayKey,
  type Month,
  type TimeKey,
} from '~/lib/days';

export interface EventDraft {
  category: EventCategory;
  /** The chosen course (Akademik events only). */
  courseId: string;
  title: string;
  date: DayKey;
  start: TimeKey;
  end: TimeKey;
  description: string;
}

export type EventField = 'title' | 'date' | 'start' | 'end';
export type EventErrors = Partial<Record<EventField, string>>;

/** The order errors are checked and focused in: top to bottom. */
export const EVENT_FIELDS: readonly EventField[] = [
  'title',
  'date',
  'start',
  'end',
];

/**
 * The courses an Akademik event can be for: the catalogue without `OTHER` (Mata Kuliah Umum has no calendar),
 * your courses this semester first, each group by code. The first is chosen.
 */
export function courseOptions(
  catalogue: readonly Course[],
  mine: ReadonlySet<string>,
): Course[] {
  return catalogue
    .filter((c) => c.major !== 'OTHER')
    .sort(
      (a, b) =>
        Number(mine.has(b.id)) - Number(mine.has(a.id)) ||
        a.code.localeCompare(b.code),
    );
}

/** A fresh draft: the chosen day (today when none), 13.00 to 15.00, as the prototype's. */
export function newDraft(
  category: EventCategory,
  day: DayKey,
  courseId = '',
): EventDraft {
  return {
    category,
    courseId,
    title: '',
    date: day,
    start: '13:00',
    end: '15:00',
    description: '',
  };
}

/** A draft from an event, in WIB, for Ubah acara. */
export function draftOf(e: CalendarEvent): EventDraft {
  const s = wibOf(e.start);
  const en = wibOf(e.end);
  return {
    category: e.category === 'akademik' ? 'akademik' : 'himpunan',
    courseId: e.courseId ?? '',
    title: e.title,
    date: s.day,
    start: s.time,
    // An event across midnight keeps its end time; the form has one date (the API's events are within a day).
    end: en.time,
    description: e.description,
  };
}

/**
 * The submit branch's checks: a title (it stays until the next submit, as the prototype's), a date and both times,
 * and an end not before the start. An end equal to the start is a deadline ("Batas" in Kalender), so it's allowed.
 */
export function validateEvent(d: EventDraft): EventErrors {
  const errors: EventErrors = {};
  if (!d.title.trim()) errors.title = t.galat.judul;
  const missing = (['date', 'start', 'end'] as const).find((k) => !d[k]);
  if (missing) errors[missing] = t.galat.waktu;
  else {
    const start = wibToIso(d.date, d.start);
    const end = wibToIso(d.date, d.end);
    if (!start)
      errors[wibToIso(d.date, '00:00') ? 'start' : 'date'] = t.galat.waktu;
    else if (!end) errors.end = t.galat.waktu;
    else if (Date.parse(end) < Date.parse(start)) errors.end = t.galat.selesai;
  }
  return errors;
}

export const firstError = (errors: EventErrors): EventField | undefined =>
  EVENT_FIELDS.find((k) => errors[k]);

/** `POST /calendar/event`: Akademik with its course; Himpunan without one. */
export function createBody(d: EventDraft) {
  return {
    category: d.category,
    ...(d.category === 'akademik' ? { courseId: d.courseId } : {}),
    title: d.title.trim(),
    description: d.description.trim(),
    start: wibToIso(d.date, d.start)!,
    end: wibToIso(d.date, d.end)!,
  };
}

/** `PUT /calendar/event/{id}`: only what the API can change (the course and category stay). */
export function updateBody(d: EventDraft) {
  return {
    title: d.title.trim(),
    description: d.description.trim(),
    start: wibToIso(d.date, d.start)!,
    end: wibToIso(d.date, d.end)!,
  };
}

/** Whether an event is in your own calendar: every Himpunan event, and Akademik ones of your courses. */
export function inMyCalendar(
  e: Pick<CalendarEvent, 'category' | 'courseId'>,
  mine: ReadonlySet<string>,
): boolean {
  return e.category !== 'akademik' || (!!e.courseId && mine.has(e.courseId));
}

/**
 * Where Kalender goes after adding (the submit branch, `S.deskEv`): the event's day; on desktop the new event is
 * chosen in the side column when it's in your calendar, otherwise nothing is.
 */
export function afterAdd(
  e: Pick<CalendarEvent, 'id' | 'start' | 'category' | 'courseId'>,
  mine: ReadonlySet<string>,
  desk: boolean,
): { hari: DayKey; acara: string | undefined } {
  return {
    hari: dayKeyOf(e.start),
    acara: desk && inMyCalendar(e, mine) ? e.id : undefined,
  };
}

/** The months a change touches: the old date's and the new date's (once when the same). */
export function monthsTouched(...instants: string[]): Month[] {
  const seen = new Map<string, Month>();
  for (const i of instants) {
    const m = monthOf(dayKeyOf(i));
    seen.set(`${m.year}-${m.month}`, m);
  }
  return [...seen.values()];
}

/** The success toast after adding: the course's members, or everyone for a Himpunan event. */
export function addedToast(d: EventDraft, course: Course | undefined): string {
  return d.category === 'akademik'
    ? fill(t.ditambahkanAkademik, { kode: course?.code ?? '' })
    : t.ditambahkanHimpunan;
}
