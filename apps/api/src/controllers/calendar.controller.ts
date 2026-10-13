import { GaxiosError } from 'gaxios';
import { calendar, type calendar_v3 } from 'googleapis/build/src/apis/calendar';
import postgres from 'postgres';
import { calendarEvent, CalendarGroup } from '~/db/schema';
import {
  ENDS_BEFORE_START,
  endsBeforeStart,
  googleEventGone,
} from '~/lib/calendar-event';
import { googleAuth } from '~/lib/googleapi';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  getCalendarEventById,
  getCalendarGroup,
  getCalendarGroupByCategory,
  getCalendarGroupByCourseId,
  getPersonalCalendar,
  updateCalendarEvent,
} from '~/repositories/calendar.repo';
import { getCurrentSemesterCodeAndYear } from '~/repositories/course.repo';
import { getUserRoles } from '~/repositories/user-role.repo';
import {
  deleteCalendarEventRoute,
  getCalendarEventByIdRoute,
  getCalendarEventRoute,
  getCalendarGroupRoute,
  getPersonalCalendarRoute,
  postCalendarEventRoute,
  updateCalendarEventRoute,
} from '~/routes/calendar.route';
import { withDb, type WithoutDb } from './deps';
import { createAuthRouter } from './router-factory';

/** The Google Calendar calls the routes make. Each throws Google's `GaxiosError` when Google refuses. */
export interface GoogleCalendarApi {
  insert: (
    calendarId: string,
    event: calendar_v3.Schema$Event,
  ) => Promise<calendar_v3.Schema$Event>;
  get: (
    calendarId: string,
    eventId: string,
  ) => Promise<calendar_v3.Schema$Event>;
  update: (
    calendarId: string,
    eventId: string,
    event: calendar_v3.Schema$Event,
  ) => Promise<void>;
  remove: (calendarId: string, eventId: string) => Promise<void>;
  /** Resolves when the service account can reach the calendar (`calendars.get`). */
  getCalendar: (calendarId: string) => Promise<void>;
}

/** What the calendar routes need from storage and Google, passed in so the route tests run without either. */
export interface CalendarDeps {
  getUserRoles: WithoutDb<typeof getUserRoles>;
  getCalendarGroupByCourseId: WithoutDb<typeof getCalendarGroupByCourseId>;
  getCalendarGroupByCategory: WithoutDb<typeof getCalendarGroupByCategory>;
  createCalendarEvent: WithoutDb<typeof createCalendarEvent>;
  getCalendarEvent: WithoutDb<typeof getCalendarEvent>;
  getCalendarEventById: WithoutDb<typeof getCalendarEventById>;
  updateCalendarEvent: WithoutDb<typeof updateCalendarEvent>;
  deleteCalendarEvent: WithoutDb<typeof deleteCalendarEvent>;
  getCalendarGroup: WithoutDb<typeof getCalendarGroup>;
  getPersonalCalendar: WithoutDb<typeof getPersonalCalendar>;
  google: GoogleCalendarApi;
}

const googleCalendar: GoogleCalendarApi = {
  insert: async (calendarId, requestBody) =>
    (
      await calendar('v3').events.insert({
        auth: googleAuth,
        calendarId,
        requestBody,
      })
    ).data,
  get: async (calendarId, eventId) =>
    (await calendar('v3').events.get({ auth: googleAuth, calendarId, eventId }))
      .data,
  update: async (calendarId, eventId, requestBody) => {
    await calendar('v3').events.update({
      auth: googleAuth,
      calendarId,
      eventId,
      requestBody,
    });
  },
  remove: async (calendarId, eventId) => {
    await calendar('v3').events.delete({
      auth: googleAuth,
      calendarId,
      eventId,
    });
  },
  getCalendar: async (calendarId) => {
    await calendar('v3').calendars.get({ auth: googleAuth, calendarId });
  },
};

const databaseDeps: CalendarDeps = {
  getUserRoles: withDb(getUserRoles),
  getCalendarGroupByCourseId: withDb(getCalendarGroupByCourseId),
  getCalendarGroupByCategory: withDb(getCalendarGroupByCategory),
  createCalendarEvent: withDb(createCalendarEvent),
  getCalendarEvent: withDb(getCalendarEvent),
  getCalendarEventById: withDb(getCalendarEventById),
  updateCalendarEvent: withDb(updateCalendarEvent),
  deleteCalendarEvent: withDb(deleteCalendarEvent),
  getCalendarGroup: withDb(getCalendarGroup),
  getPersonalCalendar: withDb(getPersonalCalendar),
  google: googleCalendar,
};

export function createCalendarRouter(deps: CalendarDeps = databaseDeps) {
  const calendarRouter = createAuthRouter();

  calendarRouter.openapi(postCalendarEventRoute, async (c) => {
    const roles = await deps.getUserRoles(c.var.user.id);
    const { title, description, start, end, category, courseId } =
      c.req.valid('json');

    let calendarGroup: CalendarGroup | undefined;

    if (category === 'akademik') {
      if (!roles.includes('akademik')) {
        return c.json(
          { error: 'You are not authorized to create academic events' },
          403,
        );
      }
      if (!courseId) {
        return c.json({ error: 'Course ID is required' }, 400);
      }
      calendarGroup = await deps.getCalendarGroupByCourseId(courseId);
    } else {
      if (!roles.includes('ring1')) {
        return c.json(
          { error: 'You are not authorized to create events' },
          403,
        );
      }
      calendarGroup = await deps.getCalendarGroupByCategory(category);
    }

    if (endsBeforeStart(start, end)) {
      return c.json({ error: ENDS_BEFORE_START }, 400);
    }

    // 1. Check if calendar group exists
    if (!calendarGroup?.googleCalendarUrl) {
      return c.json({ error: 'Calendar group not found' }, 404);
    }

    // 2. Create event in GCal
    const event: calendar_v3.Schema$Event = {
      summary: title,
      description,
      start: {
        dateTime: start?.toISOString(),
        timeZone: 'Asia/Jakarta',
      },
      end: {
        dateTime: end?.toISOString(),
        timeZone: 'Asia/Jakarta',
      },
    };
    let eventGCal: calendar_v3.Schema$Event;
    try {
      eventGCal = await deps.google.insert(
        calendarGroup.googleCalendarUrl,
        event,
      );
    } catch (error) {
      if (error instanceof GaxiosError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }

    if (!eventGCal.htmlLink || !eventGCal.id) {
      return c.json({ error: 'Failed to create event' }, 400);
    }

    // 3. Insert event to DB
    const nowAcademicContext = getCurrentSemesterCodeAndYear();
    const insertData: typeof calendarEvent.$inferInsert = {
      calendarGroupId: calendarGroup.id,
      courseId,
      title,
      description: description ?? '',
      category: category ?? '',
      academicYear: courseId ? nowAcademicContext.semesterYearTaken : null,
      academicSemesterCode: courseId
        ? nowAcademicContext.semesterCodeTaken
        : null,
      start,
      end,
      googleCalendarUrl: eventGCal.htmlLink,
      googleCalendarId: eventGCal.id,
    };
    const createdEvent = await deps.createCalendarEvent(insertData);
    return c.json(createdEvent, 201);
  });

  calendarRouter.openapi(getCalendarEventRoute, async (c) => {
    const { search, category, courseCode, year, major } = c.req.valid('query');

    try {
      const data = await deps.getCalendarEvent({
        search,
        category,
        courseCode,
        year,
        major,
      });

      return c.json(data, 200);
    } catch (error) {
      if (error instanceof postgres.PostgresError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  });

  calendarRouter.openapi(getCalendarEventByIdRoute, async (c) => {
    const { eventId } = c.req.valid('param');

    try {
      const data = await deps.getCalendarEventById({ eventId });

      if (!data) return c.json("error: 'Event not found'", 404);
      return c.json(data, 200);
    } catch (error) {
      if (error instanceof postgres.PostgresError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  });

  calendarRouter.openapi(updateCalendarEventRoute, async (c) => {
    const { eventId } = c.req.valid('param');
    const { title, description, start, end } = c.req.valid('json');

    // 1. Fetch data from DB, if exists
    const eventDB = await deps.getCalendarEventById({ eventId });
    if (!eventDB) {
      return c.json({ error: 'Event not found' }, 404);
    }

    const roles = await deps.getUserRoles(c.var.user.id);
    if (eventDB.category === 'akademik') {
      if (!roles.includes('akademik')) {
        return c.json(
          { error: 'You are not authorized to update academic events' },
          403,
        );
      }
    } else {
      if (!roles.includes('ring1')) {
        return c.json(
          { error: 'You are not authorized to update events' },
          403,
        );
      }
    }

    // Only one end may be sent: check it against the other end as stored.
    if (endsBeforeStart(start ?? eventDB.start, end ?? eventDB.end)) {
      return c.json({ error: ENDS_BEFORE_START }, 400);
    }

    if (eventDB.calendarGroup.googleCalendarUrl === null) {
      // Buat type check aja kalo calendar group url exists
      return c.json(
        { error: "Event doesn't belong to any group, contact back-end!" },
        404,
      );
    }

    // 2. If exists, ambil id sama groupId dan get event from GCal
    let fetchedData: calendar_v3.Schema$Event;
    try {
      fetchedData = await deps.google.get(
        eventDB.calendarGroup.googleCalendarUrl,
        eventDB.googleCalendarId,
      );
    } catch (error) {
      if (error instanceof GaxiosError && error.message === 'Not Found') {
        return c.json({ error: error.message }, 404);
      }
      throw error;
    }

    // 3. Update ke GCal dulu make data baru (logic samain kyk kemarin)
    const event: calendar_v3.Schema$Event = {
      summary: title ?? fetchedData.summary,
      description: description ?? fetchedData.description,
      start: {
        dateTime: start?.toISOString() ?? fetchedData.start?.dateTime,
        timeZone: 'Asia/Jakarta',
      },
      end: {
        dateTime: end?.toISOString() ?? fetchedData.end?.dateTime,
        timeZone: 'Asia/Jakarta',
      },
    };

    // console.log(event);
    try {
      await deps.google.update(
        eventDB.calendarGroup.googleCalendarUrl,
        eventDB.googleCalendarId,
        event,
      );
    } catch (error) {
      // console.log(error);
      if (error instanceof GaxiosError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }

    // 4. Update ke DB
    const updatedEvent = await deps.updateCalendarEvent(
      c.req.valid('json'),
      eventId,
    );
    return c.json(updatedEvent, 200);
  });

  calendarRouter.openapi(deleteCalendarEventRoute, async (c) => {
    try {
      const { eventId } = c.req.valid('param');

      const eventDB = await deps.getCalendarEventById({ eventId });
      if (!eventDB?.calendarGroup.googleCalendarUrl) {
        return c.json({ error: 'Event not found' }, 404);
      }

      const roles = await deps.getUserRoles(c.var.user.id);
      if (eventDB.category === 'akademik') {
        if (!roles.includes('akademik')) {
          return c.json(
            { error: 'You are not authorized to delete academic events' },
            403,
          );
        }
      } else {
        if (!roles.includes('ring1')) {
          return c.json(
            { error: 'You are not authorized to delete events' },
            403,
          );
        }
      }

      const calendarId = eventDB.calendarGroup.googleCalendarUrl;
      try {
        await deps.google.remove(calendarId, eventDB.googleCalendarId);
      } catch (error) {
        // Already removed in Google Calendar: remove the row too, or the event could never be deleted (C6).
        const gone = await googleEventGone(error, () =>
          deps.google.getCalendar(calendarId),
        );
        if (!gone) throw error;
      }
      const event = await deps.deleteCalendarEvent(eventId);
      if (!event) {
        return c.json({ error: 'Event not found' }, 404);
      }
      return c.body(null, 204);
    } catch (error) {
      if (error instanceof GaxiosError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  });

  calendarRouter.openapi(getCalendarGroupRoute, async (c) => {
    const calendarGroups = await deps.getCalendarGroup();
    return c.json(calendarGroups, 200);
  });

  calendarRouter.openapi(getPersonalCalendarRoute, async (c) => {
    const events = await deps.getPersonalCalendar(
      c.var.user,
      c.req.valid('query'),
    );
    return c.json(events, 200);
  });

  return calendarRouter;
}

export const calendarRouter = createCalendarRouter();
