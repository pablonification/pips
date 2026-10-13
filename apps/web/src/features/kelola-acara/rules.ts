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
  addDays,
  dayKeyOf,
  daysBetween,
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
  /** The end's day, in days after the start's: 0 for the form's own events, more for one across midnight or days. */
  endDays: number;
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
    endDays: 0,
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
    // The form shows one date; an event the API stored across midnight or days keeps its end's day (review m2).
    end: en.time,
    endDays: Math.max(0, daysBetween(s.day, en.day)),
    description: e.description,
  };
}

/** The draft's start and end as ISO, the end `endDays` after the start's date (null when not a real date or time). */
function instants(d: EventDraft) {
  return {
    start: wibToIso(d.date, d.start),
    end: d.date ? wibToIso(addDays(d.date, d.endDays), d.end) : null,
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
    const { start, end } = instants(d);
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
    start: instants(d).start!,
    end: instants(d).end!,
  };
}

/**
 * `PUT /calendar/event/{id}`: only what the API can change (the course and category stay). The start and end go only
 * when the date or a time changed, so an event the form can't show whole (across days) isn't cut to one (review m2).
 */
export function updateBody(d: EventDraft, e: CalendarEvent) {
  const was = draftOf(e);
  const moved =
    d.date !== was.date || d.start !== was.start || d.end !== was.end;
  return {
    title: d.title.trim(),
    description: d.description.trim(),
    ...(moved ? { start: instants(d).start!, end: instants(d).end! } : {}),
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
