import { CronJob } from 'cron';
import { db } from '~/db/drizzle';
import { CalendarEvent, PushSubscription } from '~/db/schema';
import { trackBackground } from '~/lib/background';
import { guardedTask } from '~/lib/guarded-task';
import { PushData, sendNotificationToAll } from '~/lib/push-manager';
import { wibClock } from '~/lib/wib';
import { getCalendarEventsStartingBetween } from '~/repositories/calendar.repo';
import { getCourseUsersByIds } from '~/repositories/course.repo';
import {
  getAllPushSubscriptions,
  removeFailedPushSubscriptions,
  toPushSubscriptionsHash,
} from '~/repositories/push.repo';
import { getUnsubsByCategoryName } from '~/repositories/user-unsubscribe.repo';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/**
 * How far back a run catches up after runs that didn't happen (the database was down, or a run was still going). A
 * reminder caught up within this is late but still before its event.
 */
export const REMINDER_CATCH_UP_MS = 6 * 60 * MINUTE_MS;

export interface ReminderCourse {
  id: string;
  code: string;
  name: string;
  userCourses: Array<{ userId: string }>;
}

export interface Reminder {
  subscriptions: PushSubscription[];
  data: PushData;
}

/**
 * The day-before (H-1) reminders for `events`, in the app's words: an event of a course goes to the students taking
 * it this semester who haven't muted Akademik, any other event to everyone with notifications on. A student with no
 * device subscribed is skipped, not an error that would stop the rest of the minute's reminders.
 */
export function buildReminders(input: {
  events: CalendarEvent[];
  courses: ReminderCourse[];
  subscriptions: PushSubscription[];
  academicUnsubs: ReadonlySet<string>;
}): Reminder[] {
  const byUser = toPushSubscriptionsHash(input.subscriptions);
  const courses = new Map(input.courses.map((c) => [c.id, c]));
  const reminders: Reminder[] = [];

  for (const event of input.events) {
    const at = wibClock(event.start);
    const body = event.description.trim();
    if (event.courseId === null) {
      reminders.push({
        subscriptions: input.subscriptions,
        data: {
          title: `Besok ada ${event.title}, ${at}`,
          options: body ? { body } : {},
        },
      });
      continue;
    }
    const course = courses.get(event.courseId);
    if (!course) continue;
    const students = new Set(
      course.userCourses
        .map((uc) => uc.userId)
        .filter((userId) => !input.academicUnsubs.has(userId)),
    );
    const subscriptions = [...students].flatMap((id) => byUser[id] ?? []);
    if (subscriptions.length === 0) continue;
    reminders.push({
      subscriptions,
      data: {
        title: `Besok kamu ada ${event.title}, ${at}`,
        options: {
          body: [`${course.code} ${course.name}`, body]
            .filter(Boolean)
            .join('\n'),
        },
      },
    });
  }
  return reminders;
}

export interface ReminderDeps {
  now: () => number;
  /** Events starting from `from` (included) until `until` (excluded). */
  readEvents: (from: Date, until: Date) => Promise<CalendarEvent[]>;
  readCourses: (courseIds: string[]) => Promise<ReminderCourse[]>;
  readSubscriptions: () => Promise<PushSubscription[]>;
  readAcademicUnsubs: () => Promise<Set<string>>;
  send: (
    subscriptions: PushSubscription[],
    data: PushData,
  ) => Promise<Awaited<ReturnType<typeof sendNotificationToAll>>>;
  prune: (
    results: Awaited<ReturnType<typeof sendNotificationToAll>>,
  ) => Promise<void>;
}

/**
 * One run of the reminder job (every minute): every event starting 24 hours after a minute not yet covered gets its
 * reminder, once. The first run after start covers its own minute only; after that a run picks up any minute that a
 * failed, slow or skipped run left (up to `REMINDER_CATCH_UP_MS`). A run that fails before sending leaves its minutes
 * for the next one; a run that starts while another is still going does nothing. What was covered is kept in
 * memory, so minutes during a restart are missed; remembering them would need a column.
 */
export function createReminderRun(deps: ReminderDeps) {
  let coveredUntil: number | undefined;
  let running = false;

  return async () => {
    if (running) return;
    running = true;
    try {
      const minuteStart = Math.floor(deps.now() / MINUTE_MS) * MINUTE_MS;
      const until = minuteStart + MINUTE_MS + DAY_MS;
      // The first run after start owes its own minute, even if it fails.
      coveredUntil ??= until - MINUTE_MS;
      const from = Math.max(coveredUntil, until - REMINDER_CATCH_UP_MS);
      if (from >= until) return;

      const events = await deps.readEvents(new Date(from), new Date(until));
      if (events.length === 0) {
        coveredUntil = until;
        return;
      }
      const courseIds = [
        ...new Set(
          events.flatMap((e) => (e.courseId === null ? [] : [e.courseId])),
        ),
      ];
      const [courses, subscriptions, academicUnsubs] = await Promise.all([
        deps.readCourses(courseIds),
        deps.readSubscriptions(),
        deps.readAcademicUnsubs(),
      ]);
      // Covered from here on: whatever happens while sending, these minutes are never sent twice.
      coveredUntil = until;

      const reminders = buildReminders({
        events,
        courses,
        subscriptions,
        academicUnsubs,
      });
      for (const reminder of reminders) {
        const results = await deps.send(reminder.subscriptions, reminder.data);
        await deps.prune(results).catch((error: unknown) => {
          console.error('Pruning push subscriptions failed:', error);
        });
      }
    } finally {
      running = false;
    }
  };
}

export const runReminders = createReminderRun({
  now: () => Date.now(),
  readEvents: async (from, until) =>
    await getCalendarEventsStartingBetween(db, from, until),
  readCourses: async (ids) => await getCourseUsersByIds(db, ids),
  readSubscriptions: async () => await getAllPushSubscriptions(db),
  readAcademicUnsubs: async () => await getUnsubsByCategoryName(db, 'Akademik'),
  send: async (subscriptions, data) =>
    await sendNotificationToAll(subscriptions, data),
  prune: async (results) => {
    await removeFailedPushSubscriptions(db, results);
  },
});

/** Every minute: push the events starting in 24 hours (H-1). A run that fails is logged; it never stops the API. */
const remindersTick = guardedTask('Calendar cron', runReminders);
export const calendarCron = new CronJob(
  '* * * * *',
  // Tracked so a shutdown lets a run that is sending finish.
  async () => {
    await trackBackground(remindersTick());
  },
);
