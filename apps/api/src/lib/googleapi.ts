import { existsSync } from 'node:fs';
import { auth } from 'googleapis/build/src/apis/calendar';
import { env } from '~/configs/env.config';

export const googleAuth = new auth.GoogleAuth({
  keyFile: env.GOOGLE_CALENDAR_SECRET_PATH,
  scopes: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ],
});

/** What to log at start when Kalender's Google key file is missing; null when it is there. */
export function calendarKeyWarning(keyFile: string) {
  if (existsSync(keyFile)) return null;
  return `GOOGLE_CALENDAR_SECRET_PATH names no file (${keyFile}): Kalender changes will fail until it exists.`;
}
