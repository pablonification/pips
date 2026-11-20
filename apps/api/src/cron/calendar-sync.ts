import { existsSync } from 'node:fs';
import { CronJob } from 'cron';
import { calendar, type calendar_v3 } from 'googleapis/build/src/apis/calendar';
import { env } from '~/configs/env.config';
import { db } from '~/db/drizzle';
import type { CalendarEvent, CalendarGroup } from '~/db/schema';
import { trackBackground } from '~/lib/background';
import {
  planSync,
  syncWindow,
  toSyncedEvent,
  type SyncPlan,
} from '~/lib/calendar-sync';
import { googleAuth } from '~/lib/googleapi';
import { guardedTask } from '~/lib/guarded-task';
import { logger } from '~/logger';
import {
  applySyncPlan,
  getSyncedCalendarGroups,
  getSyncedEventsBetween,
} from '~/repositories/calendar.repo';

/** Google answers at most 2500 events a page; a year of one calendar fits in a few pages. */
const PAGE_SIZE = 2500;
const MAX_PAGES = 10;

export interface CalendarSyncDeps {
  now: () => number;
  /** Whether the service account's key file is there; without it nothing is asked of Google. */
  hasKey: () => boolean;
  readGroups: () => Promise<CalendarGroup[]>;
  /** Every event of `calendarId` overlapping `from`–`until`, recurring ones expanded. Throws when Google refuses. */
  listGoogle: (
    calendarId: string,
    from: Date,
    until: Date,
  ) => Promise<calendar_v3.Schema$Event[]>;
  readStored: (
    groupId: string,
    from: Date,
    until: Date,
  ) => Promise<CalendarEvent[]>;
  apply: (group: CalendarGroup, plan: SyncPlan) => Promise<void>;
  log: (entry: Record<string, unknown>) => void;
}

/**
 * One run: for each synced calendar, read Google's events around now and make Kalender's copy match. A calendar
 * Google refuses (not shared with the service account, gone) is logged once until it changes, and the others still
 * sync; its rows stay as they were rather than vanishing because Google didn't answer. A run that starts while
 * another is going does nothing.
 */
export function createCalendarSync(deps: CalendarSyncDeps) {
  let running = false;
  let keyWarned = false;
  const lastProblem = new Map<string, string>();

  return async () => {
    if (running) return;
    running = true;
    try {
      if (!deps.hasKey()) {
        if (!keyWarned)
          deps.log({
            type: 'calendar-sync',
            message: 'No Google key file: synced calendars are not read',
          });
        keyWarned = true;
        return;
      }
      keyWarned = false;
      const { from, until } = syncWindow(deps.now());
      for (const group of await deps.readGroups()) {
        const calendarId = group.googleCalendarUrl;
        if (!calendarId) continue;
        let google: calendar_v3.Schema$Event[];
        try {
          google = await deps.listGoogle(calendarId, from, until);
        } catch (error) {
          const status =
            (error as { response?: { status?: number } }).response?.status ??
            'error';
          const problem = String(status);
          if (lastProblem.get(group.id) !== problem) {
            deps.log({
              type: 'calendar-sync',
              message:
                status === 404 || status === 403
                  ? 'Google refused the calendar: share it with the service account ("See all event details")'
                  : 'Reading the calendar from Google failed',
              calendar: group.code,
              status,
            });
            lastProblem.set(group.id, problem);
          }
          continue;
        }
        if (lastProblem.delete(group.id))
          deps.log({
            type: 'calendar-sync',
            message: 'Calendar readable again',
            calendar: group.code,
          });
        const events = google.flatMap((e) => {
          const synced = toSyncedEvent(e, group.name);
          return synced ? [synced] : [];
        });
        const stored = await deps.readStored(group.id, from, until);
        await deps.apply(group, planSync(events, stored));
      }
    } finally {
      running = false;
    }
  };
}

async function listGoogle(calendarId: string, from: Date, until: Date) {
  const events: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data } = await calendar('v3').events.list({
      auth: googleAuth,
      calendarId,
      timeMin: from.toISOString(),
      timeMax: until.toISOString(),
      singleEvents: true,
      showDeleted: false,
      maxResults: PAGE_SIZE,
      pageToken,
    });
    events.push(...(data.items ?? []));
    pageToken = data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }
  return events;
}

export const runCalendarSync = createCalendarSync({
  now: () => Date.now(),
  hasKey: () => existsSync(env.GOOGLE_CALENDAR_SECRET_PATH),
  readGroups: async () => await getSyncedCalendarGroups(db),
  listGoogle,
  readStored: async (groupId, from, until) =>
    await getSyncedEventsBetween(db, groupId, from, until),
  apply: async (group, plan) => {
    await applySyncPlan(db, group, plan);
  },
  log: (entry) => {
    logger.warn(entry);
  },
});

/** Every 10 minutes, and once at start: PRISMA's changes reach Kalender within ten minutes. */
const syncTick = guardedTask('Calendar sync', runCalendarSync);
export const calendarSyncCron = new CronJob('*/10 * * * *', async () => {
  await trackBackground(syncTick());
});
