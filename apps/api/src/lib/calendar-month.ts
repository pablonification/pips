import { wibMonthYear } from './wib';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Events that start in `month` (1–12) of `year` in WIB, earliest first. The month is read in WIB, not the server's
 * time zone: the API image runs in UTC, where an event from 00.00 to 06.59 WIB on the 1st is still in the
 * previous month.
 */
export function eventsInMonth<T extends { start: Date }>(
  events: T[],
  { month, year }: { month: number; year: number },
): T[] {
  return events
    .filter((c) => {
      const wib = wibMonthYear(c.start);
      return wib.month === month && wib.year === year;
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * The instants `month` (1–12) of `year` covers in WIB: from the 1st at 00.00 WIB (included) to the next month's 1st
 * (excluded). Lets the database pick a month's events, with the same result as `eventsInMonth`.
 */
export function wibMonthRange({
  month,
  year,
}: {
  month: number;
  year: number;
}) {
  const startOf = (y: number, m: number) => {
    const d = new Date(0);
    d.setUTCFullYear(y, m - 1, 1); // also right for years under 100, unlike Date.UTC
    return new Date(d.getTime() - WIB_OFFSET_MS);
  };
  return { from: startOf(year, month), until: startOf(year, month + 1) };
}
