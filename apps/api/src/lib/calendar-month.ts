import { wibMonthYear } from './wib';

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
