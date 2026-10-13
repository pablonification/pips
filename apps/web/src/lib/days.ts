/**
 * Calendar days in WIB, as `YYYY-MM-DD` keys (the prototype's `dayKey`, `fromKey`, `addDays` and `monthCells` in
 * garis/ui.js and screens-core.js), whatever the device's time zone. A key names a day; `dayStart` is its first
 * instant (00.00 WIB). Shared by Beranda, Kalender and search (P1-A); the words for a day are in `./dates`.
 */
import { wib } from './dates';

/** A day in WIB: `2026-10-08`. */
export type DayKey = string;

/** A month: `month` 1–12, as the API's `GET /calendar/me` takes it. */
export interface Month {
  year: number;
  month: number;
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

const keyOfUtc = (t: Date) =>
  `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;

/** The WIB day an instant falls on. */
export function dayKeyOf(d: Date | string | number): DayKey {
  const w = wib(d);
  return `${w.year}-${pad(w.month + 1)}-${pad(w.day)}`;
}

/** The parts of a key: `month` 1–12. */
export function partsOf(key: DayKey): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

/** 00.00 WIB on that day, in milliseconds. */
export function dayStart(key: DayKey): number {
  const { year, month, day } = partsOf(key);
  return Date.UTC(year, month - 1, day) - WIB_OFFSET_MS;
}

/** The key `n` days later (earlier when negative). */
export function addDays(key: DayKey, n: number): DayKey {
  const { year, month, day } = partsOf(key);
  return keyOfUtc(new Date(Date.UTC(year, month - 1, day + n)));
}

/** 0 Sunday … 6 Saturday, as `Date.getDay`. */
export function weekdayOf(key: DayKey): number {
  const { year, month, day } = partsOf(key);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The month a day is in. */
export function monthOf(key: DayKey): Month {
  const { year, month } = partsOf(key);
  return { year, month };
}

/** The month `delta` months after `m`. */
export function shiftMonth(m: Month, delta: number): Month {
  const i = m.year * 12 + (m.month - 1) + delta;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}

export const sameMonth = (a: Month, b: Month) =>
  a.year === b.year && a.month === b.month;

/** The key of a day of a month, clamped to the month's length (31 Februari → 28 or 29). */
export function dayInMonth(m: Month, day: number): DayKey {
  const last = new Date(Date.UTC(m.year, m.month, 0)).getUTCDate();
  return `${m.year}-${pad(m.month)}-${pad(Math.min(Math.max(day, 1), last))}`;
}

/** `n` days from `start`, `start` first (Beranda's strip: eight days from today). */
export function daysFrom(start: DayKey, n: number): DayKey[] {
  return Array.from({ length: n }, (_, i) => addDays(start, i));
}

/** A month's grid, Monday first, in whole weeks: October 2026 starts on Monday 28 September (`monthCells`). */
export function monthCells(m: Month): DayKey[] {
  const first = `${m.year}-${pad(m.month)}-01`;
  const offset = (weekdayOf(first) + 6) % 7;
  const days = new Date(Date.UTC(m.year, m.month, 0)).getUTCDate();
  return daysFrom(addDays(first, -offset), Math.ceil((offset + days) / 7) * 7);
}

/** The months some days touch, in order, each once: what to ask `GET /calendar/me` for. */
export function monthsOf(keys: readonly DayKey[]): Month[] {
  const out: Month[] = [];
  for (const k of keys) {
    const m = monthOf(k);
    if (!out.some((x) => sameMonth(x, m))) out.push(m);
  }
  return out;
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((dayStart(b) - dayStart(a)) / DAY_MS);
}

/* P3-B: times typed in WIB (a native date and a time input) to and from the API's ISO strings. */

/** A typed time, `HH:MM` (24 hours). */
export type TimeKey = string;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The instant a WIB day and time name, as ISO: `"2026-10-13"` + `"13:00"` → `2026-10-13T06:00:00.000Z`. */
export function wibToIso(day: DayKey, time: TimeKey): string | null {
  const t = TIME_RE.exec(time);
  if (!DAY_RE.test(day) || !t) return null;
  const { year, month, day: d } = partsOf(day);
  const ms =
    Date.UTC(year, month - 1, d, Number(t[1]), Number(t[2])) - WIB_OFFSET_MS;
  // `2026-02-31` rolls over in Date.UTC: refuse a day that isn't on the calendar.
  return dayKeyOf(ms) === day ? new Date(ms).toISOString() : null;
}

/** The WIB day and time of an instant, as the date and time inputs take them. */
export function wibOf(d: Date | string | number): {
  day: DayKey;
  time: TimeKey;
} {
  const w = wib(d);
  return {
    day: `${w.year}-${pad(w.month + 1)}-${pad(w.day)}`,
    time: `${pad(w.hours)}:${pad(w.minutes)}`,
  };
}
