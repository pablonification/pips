/** WIB is UTC+7 all year (no daylight saving). */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Today's month (1–12) and year in WIB, read at call time, whatever time zone the server runs in. */
export function currentWibMonthYear(now: number = Date.now()) {
  const wib = new Date(now + WIB_OFFSET_MS);
  return { month: wib.getUTCMonth() + 1, year: wib.getUTCFullYear() };
}

/** The month (1–12) and year an instant falls in, in WIB, whatever time zone the server runs in. */
export function wibMonthYear(date: Date | string | number) {
  return currentWibMonthYear(new Date(date).getTime());
}
