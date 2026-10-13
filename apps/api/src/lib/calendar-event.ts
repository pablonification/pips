import { GaxiosError } from 'gaxios';

/**
 * An event may end when it starts (a deadline, shown as "Batas"), never before (C6). Checked on the server, since
 * the API answers anyone, not only the app's form.
 */
export function endsBeforeStart(start: Date, end: Date): boolean {
  return end.getTime() < start.getTime();
}

export const ENDS_BEFORE_START = 'An event cannot end before it starts';

/** Google's HTTP status for a refused call, or undefined for anything that isn't Google's error. */
export function googleStatus(error: unknown): number | undefined {
  if (!(error instanceof GaxiosError)) return undefined;
  return error.status ?? error.response?.status;
}

/**
 * Whether deleting an event in PIPS! may remove its row after Google refused to delete it (C6). 410 (Gone): Google
 * deleted it already. 404 means either that or a calendar the service account can't reach, so the calendar is
 * checked first: reachable, the event is gone; not reachable, the row stays (review m6). Any other failure keeps the
 * row, so the two calendars stay the same.
 */
export async function googleEventGone(
  error: unknown,
  calendarReachable: () => Promise<void>,
): Promise<boolean> {
  const status = googleStatus(error);
  if (status === 410) return true;
  if (status !== 404) return false;
  try {
    await calendarReachable();
    return true;
  } catch {
    return false;
  }
}
