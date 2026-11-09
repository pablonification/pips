import { eventsInMonth, wibMonthRange } from '~/lib/calendar-month';
import { prefixTsQuery } from '~/lib/search';
import { and, asc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { Database } from '~/db/drizzle';
import { first, firstSure } from '~/db/helper';
import {
  calendarEvent,
  CalendarGroup,
  calendarGroup,
  courses,
} from '~/db/schema';
import {
  CalendarEvent,
  CalendarEventIdParamsSchema,
  GetCalendarEventParamsSchema,
  PersonalCalendarParamSchema,
  UpdateCalendarEventBodySchema,
} from '~/types/calendar.types';
import { JWTPayloadSchema } from '~/types/login.types';
import {
  getCourseById,
  getCurrentSemesterCodeAndYear,
  getUserCourse,
} from './course.repo';
import { getUserAcademic } from './user-profile.repo';

export async function getCalendarEvent(
  db: Database,
  q: z.infer<typeof GetCalendarEventParamsSchema>,
) {
  const { search, category, courseCode, year, major } = q;
  const isCoursesRequired = courseCode !== undefined || major !== undefined;
  // null: the text has no word, so nothing matches.
  const searchPhrase = search ? prefixTsQuery(search) : undefined;
  let calendarEvents = isCoursesRequired
    ? await getCalendarEventWithCoursesJoin(db, courseCode, major, searchPhrase)
    : await getCalendarEventOnly(db, searchPhrase);

  // courseCode and major filter are applied in the helper function
  // both helper functions return only list of CalendarEvents
  // see helper functions at the bottom of this code

  if (category) {
    calendarEvents = calendarEvents.filter((event) =>
      event.category.toLowerCase().includes(category.toLowerCase()),
    );
  }

  if (year) {
    calendarEvents = calendarEvents.filter(
      (event) => event.academicYear && event.academicYear === parseInt(year),
    );
  }

  return calendarEvents;
}

export async function getCalendarEventById(
  db: Database,
  { eventId }: z.infer<typeof CalendarEventIdParamsSchema>,
) {
  return await db.query.calendarEvent.findFirst({
    where: eq(calendarEvent.id, eventId),
    with: {
      calendarGroup: true,
    },
  });
}

export async function getCalendarGroupById(
  db: Database,
  calendarGroupId: string,
) {
  return await db.query.calendarGroup.findFirst({
    where: eq(calendarGroup.id, calendarGroupId),
  });
}

export function getCalendarGroupByCategory(
  db: Database,
  category: CalendarGroup['category'],
  code?: string,
) {
  return db.query.calendarGroup.findFirst({
    where: and(
      eq(calendarGroup.category, category),
      code ? eq(calendarGroup.code, code) : undefined,
    ),
  });
}

export async function getCalendarGroupByCourseId(
  db: Database,
  courseId: string,
) {
  const current = getCurrentSemesterCodeAndYear();
  const course = await getCourseById(db, courseId);
  if (!course) {
    return;
  }

  // must be if2021 or sti2021 based code or ifelective or stielective
  let code = course.major.toLowerCase();

  if (course.type === 'Mandatory' && course.semester !== null) {
    // 1-4
    const courseYear = Math.floor((course.semester - 1) / 2);
    const year = current.semesterYearTaken;
    code += (year - courseYear).toString();
  } else {
    code += 'elective';
  }

  return await getCalendarGroupByCategory(db, 'akademik', code);
}

export async function updateCalendarEvent(
  db: Database,
  data: z.infer<typeof UpdateCalendarEventBodySchema>,
  eventId: string,
) {
  const calendarEventId = await db
    .update(calendarEvent)
    .set(data)
    .where(eq(calendarEvent.id, eventId))
    .returning()
    .then(firstSure);
  return calendarEventId;
}

export async function deleteCalendarEvent(db: Database, eventId: string) {
  const calendarEventId = await db
    .delete(calendarEvent)
    .where(eq(calendarEvent.id, eventId))
    .returning()
    .then(first);
  return calendarEventId;
}

/** The full-text match for `search` (`prefixTsQuery`): none when undefined, nothing when null. */
function eventSearch(search: string | null | undefined) {
  if (search === undefined) return undefined;
  if (search === null) return sql`false`;
  return sql`(setweight(to_tsvector('indonesian', ${calendarEvent.title}), 'A') || setweight(to_tsvector('indonesian', ${calendarEvent.description}), 'B')) @@ to_tsquery('indonesian', ${search})`;
}

async function getCalendarEventOnly(db: Database, search?: string | null) {
  return await db
    .select()
    .from(calendarEvent)
    .where(eventSearch(search))
    .orderBy(asc(calendarEvent.start));
}
async function getCalendarEventWithCoursesJoin(
  db: Database,
  courseCode: string | undefined,
  major: 'IF' | 'STI' | 'OTHER' | undefined,
  search?: string | null,
) {
  let results = await db
    .select({
      calendarEvent,
      courseCode: courses.code,
      courseMajor: courses.major,
    })
    .from(calendarEvent)
    .where(eventSearch(search))
    .innerJoin(courses, eq(calendarEvent.courseId, courses.id))
    .orderBy(asc(calendarEvent.start));

  if (courseCode) {
    results = results.filter((r) => r.courseCode === courseCode);
  }

  if (major) {
    results = results.filter((r) => r.courseMajor === major);
  }

  const finalResults: Array<z.infer<typeof CalendarEvent>> = [];
  for (let i = 0; i < results.length; i++) {
    finalResults.push(results[i].calendarEvent);
  }
  return finalResults;
}

export async function createCalendarEvent(
  db: Database,
  data: typeof calendarEvent.$inferInsert,
) {
  const calendarEventId = await db
    .insert(calendarEvent)
    .values(data)
    .returning()
    .then(firstSure);
  return calendarEventId;
}

export async function getCalendarGroup(db: Database) {
  const calendarGroup = await db.query.calendarGroup.findMany();
  return calendarGroup;
}

export async function getPersonalCalendar(
  db: Database,
  user: z.infer<typeof JWTPayloadSchema>,
  query: z.infer<typeof PersonalCalendarParamSchema>,
) {
  const userAcademicContext = await getUserAcademic(db, user);
  const userCourseIds = (await getUserCourse(db, user.id, true)).map(
    (c) => c.courseId,
  );
  // Only the requested month (in WIB) is read; it used to read every Himpunan event ever and pick the month here.
  const { from, until } = wibMonthRange(query);
  const inMonth = and(
    gte(calendarEvent.start, from),
    lt(calendarEvent.start, until),
  );

  const academicEvents =
    userCourseIds.length > 0
      ? await db // Get academic events based on user context
          .select()
          .from(calendarEvent)
          .where(
            and(
              inArray(calendarEvent.courseId, userCourseIds),
              eq(
                calendarEvent.academicYear,
                userAcademicContext.semesterYearTaken,
              ),
              inMonth,
            ),
          )
      : [];

  // Himpunan events: those in a Himpunan calendar group.
  const himpunanEvents = await db
    .select({ event: calendarEvent })
    .from(calendarEvent)
    .innerJoin(
      calendarGroup,
      eq(calendarEvent.calendarGroupId, calendarGroup.id),
    )
    .where(and(eq(calendarGroup.category, 'himpunan'), inMonth))
    .then((rows) => rows.map((r) => r.event));

  return eventsInMonth([...academicEvents, ...himpunanEvents], query);
}

/** Events starting from `from` (included) until `until` (excluded): the day-before reminders' window. */
export async function getCalendarEventsStartingBetween(
  db: Database,
  from: Date,
  until: Date,
) {
  return await db
    .select()
    .from(calendarEvent)
    .where(and(gte(calendarEvent.start, from), lt(calendarEvent.start, until)))
    .orderBy(asc(calendarEvent.start));
}
