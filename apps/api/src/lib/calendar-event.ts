import { GaxiosError } from 'gaxios';

/**
 * An event may end when it starts (a deadline, shown as "Batas"), never before (C6). Checked on the server, since
 * the API answers anyone, not only the app's form.
 */
export function endsBeforeStart(start: Date, end: Date): boolean {
  return end.getTime() < start.getTime();
}

export const ENDS_BEFORE_START = 'An event cannot end before it starts';

/**
 * Google Calendar no longer has the event (404 Not Found, 410 Gone: deleted there already). Deleting it in PIPS!
 * then only needs the row removed; any other failure keeps the row, so the two calendars stay the same.
 */
export function googleEventGone(error: unknown): boolean {
  if (!(error instanceof GaxiosError)) return false;
  const status = error.status ?? error.response?.status;
  return status === 404 || status === 410;
}
