// Adding, changing and deleting calendar events (P3-B): who may, and the times and Google Calendar rules (C6).
import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { GaxiosError } from 'gaxios';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import type { CalendarDeps } from '../src/controllers/calendar.controller';
import type { CalendarGroup, UserRolesEnum } from '../src/db/schema';
import { callRouter } from './support/router';
import { testUser } from './support/session';

let createCalendarRouter: typeof import('../src/controllers/calendar.controller').createCalendarRouter;
let GOOGLE_CALENDAR_FAILED: string;
before(async () => {
  usePlaceholderEnv();
  ({ createCalendarRouter, GOOGLE_CALENDAR_FAILED } =
    await import('../src/controllers/calendar.controller'));
});

const raka = testUser('u-raka', { nim: '13524045', angkatan: 2024 });

const group = (category: 'akademik' | 'himpunan'): CalendarGroup => ({
  id: `g-${category}`,
  name: category,
  category,
  code: category === 'akademik' ? 'if2024' : null,
  googleCalendarUrl: `${category}@group.calendar.google.com`,
});

type StoredEvent = Awaited<ReturnType<CalendarDeps['getCalendarEventById']>>;
const stored = (
  over: Partial<NonNullable<StoredEvent>> = {},
): NonNullable<StoredEvent> => ({
  id: 'ev-1',
  calendarGroupId: 'g-akademik',
  courseId: 'course-IF3170',
  title: 'Kuis 1',
  description: '',
  category: 'akademik',
  academicYear: 2026,
  academicSemesterCode: 'Ganjil',
  start: new Date('2026-10-06T06:00:00.000Z'),
  end: new Date('2026-10-06T08:00:00.000Z'),
  googleCalendarUrl: 'https://calendar.google.com/event?eid=1',
  googleCalendarId: 'gcal-1',
  calendarGroup: group('akademik'),
  ...over,
});

const googleError = (status: number) =>
  new GaxiosError(`Google says ${status}`, {}, {
    status,
    statusText: '',
    headers: {},
    config: {},
    data: {},
    request: { responseURL: '' },
  } as never);

function setup(
  roles: UserRolesEnum[],
  opts: {
    event?: StoredEvent;
    googleDelete?: () => Promise<void>;
    calendarReachable?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const deleted: string[] = [];
  const deps: CalendarDeps = {
    getUserRoles: async () => roles,
    // The repository returns a Drizzle query (awaitable); a promise stands in for it.
    getCalendarGroupByCourseId: (async () =>
      group(
        'akademik',
      )) as unknown as CalendarDeps['getCalendarGroupByCourseId'],
    getCalendarGroupByCategory: (async (category: 'akademik' | 'himpunan') =>
      group(category)) as unknown as CalendarDeps['getCalendarGroupByCategory'],
    createCalendarEvent: async (data) =>
      ({
        id: 'ev-new',
        courseId: null,
        academicYear: null,
        academicSemesterCode: null,
        ...data,
      }) as never,
    getCalendarEvent: async () => [],
    getCalendarEventById: async () =>
      opts.event === undefined ? stored() : opts.event,
    updateCalendarEvent: async (data, eventId) =>
      ({ ...stored(), ...data, id: eventId }) as never,
    deleteCalendarEvent: async (eventId) => {
      deleted.push(eventId);
      return stored({ id: eventId });
    },
    getCalendarGroup: async () => [],
    getPersonalCalendar: async () => [],
    google: {
      insert: async (_calendarId, event) => {
        calls.push(`insert ${event.summary}`);
        return { id: 'gcal-new', htmlLink: 'https://calendar.google.com/new' };
      },
      get: async () => {
        calls.push('get');
        return {
          summary: 'Kuis 1',
          start: { dateTime: '2026-10-06T06:00:00.000Z' },
          end: { dateTime: '2026-10-06T08:00:00.000Z' },
        };
      },
      update: async () => {
        calls.push('update');
      },
      getCalendar: async () => {
        calls.push('calendar');
        if (opts.calendarReachable === false) throw googleError(404);
      },
      remove:
        opts.googleDelete ??
        (async () => {
          calls.push('remove');
        }),
    },
  };
  return { router: createCalendarRouter(deps), deps, calls, deleted };
}

const kuis2 = {
  category: 'akademik',
  courseId: 'course-IF3170',
  title: 'Kuis 2',
  description: '',
  start: '2026-10-13T06:00:00.000Z',
  end: '2026-10-13T08:00:00.000Z',
};

test('POST /calendar/event: akademik adds a course event to Google Calendar, then the database', async () => {
  const { router, calls } = setup(['akademik']);
  const res = await callRouter(router, raka, 'POST', '/calendar/event', kuis2);
  assert.equal(res.status, 201);
  assert.equal(res.body.title, 'Kuis 2');
  assert.equal(res.body.googleCalendarId, 'gcal-new');
  assert.deepEqual(calls, ['insert Kuis 2']);
});

test('POST /calendar/event: when the database refuses the event, it is removed from Google Calendar again', async () => {
  const { router, deps, calls } = setup(['akademik']);
  const removed: string[] = [];
  deps.createCalendarEvent = async () => {
    throw new Error('database unreachable');
  };
  deps.google.remove = async (calendarId, eventId) => {
    removed.push(`${calendarId} ${eventId}`);
  };
  const res = await callRouter(router, raka, 'POST', '/calendar/event', kuis2);
  assert.equal(res.status, 500);
  assert.deepEqual(calls, ['insert Kuis 2']);
  assert.deepEqual(removed, ['akademik@group.calendar.google.com gcal-new']);
});

test('POST /calendar/event: when removing it again fails too, the answer is still the database error', async () => {
  const { router, deps } = setup(['akademik']);
  let tried = 0;
  deps.createCalendarEvent = async () => {
    throw new Error('database unreachable');
  };
  deps.google.remove = async () => {
    tried++;
    throw googleError(503);
  };
  const res = await callRouter(router, raka, 'POST', '/calendar/event', kuis2);
  assert.equal(res.status, 500);
  assert.equal(tried, 1);
});

test('POST /calendar/event: the role is checked by category on the server', async () => {
  const notAkademik = setup(['ring1', 'admin']);
  assert.equal(
    (
      await callRouter(
        notAkademik.router,
        raka,
        'POST',
        '/calendar/event',
        kuis2,
      )
    ).status,
    403,
  );
  assert.deepEqual(notAkademik.calls, []);
  const himpunan = { ...kuis2, category: 'himpunan', courseId: undefined };
  const notRing1 = setup(['akademik', 'admin']);
  assert.equal(
    (
      await callRouter(
        notRing1.router,
        raka,
        'POST',
        '/calendar/event',
        himpunan,
      )
    ).status,
    403,
  );
  const ring1 = setup(['ring1']);
  assert.equal(
    (await callRouter(ring1.router, raka, 'POST', '/calendar/event', himpunan))
      .status,
    201,
  );
});

test('regression (C6): an event that ends before it starts is refused before Google is asked', async () => {
  const { router, calls } = setup(['akademik']);
  const res = await callRouter(router, raka, 'POST', '/calendar/event', {
    ...kuis2,
    end: '2026-10-13T05:59:00.000Z',
  });
  assert.equal(res.status, 400);
  assert.deepEqual(calls, []);
});

test('an event that ends when it starts is a deadline, and is allowed', async () => {
  const { router } = setup(['akademik']);
  const res = await callRouter(router, raka, 'POST', '/calendar/event', {
    ...kuis2,
    end: kuis2.start,
  });
  assert.equal(res.status, 201);
});

test('PUT /calendar/event/{id}: akademik changes an Akademik event', async () => {
  const { router, calls } = setup(['akademik']);
  const res = await callRouter(router, raka, 'PUT', '/calendar/event/ev-1', {
    title: 'Kuis 1 (ganti ruang)',
    description: 'Di 7602',
    start: '2026-10-07T06:00:00.000Z',
    end: '2026-10-07T08:00:00.000Z',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.title, 'Kuis 1 (ganti ruang)');
  assert.deepEqual(calls, ['get', 'update']);
});

test('PUT /calendar/event/{id}: a Himpunan event needs ring1, whatever else you hold', async () => {
  const { router, calls } = setup(['akademik', 'admin'], {
    event: stored({
      category: 'himpunan',
      courseId: null,
      calendarGroup: group('himpunan'),
    }),
  });
  const res = await callRouter(router, raka, 'PUT', '/calendar/event/ev-1', {
    title: 'Sharing Session',
  });
  assert.equal(res.status, 403);
  assert.deepEqual(calls, []);
});

test('regression (C6): a change that makes the event end before it starts is refused', async () => {
  // Only the end is sent: it is checked against the start already stored (06.00 UTC).
  const { router, calls } = setup(['akademik']);
  const res = await callRouter(router, raka, 'PUT', '/calendar/event/ev-1', {
    end: '2026-10-06T05:00:00.000Z',
  });
  assert.equal(res.status, 400);
  assert.deepEqual(calls, []);
  // And only the start, against the stored end (08.00 UTC).
  const late = await callRouter(router, raka, 'PUT', '/calendar/event/ev-1', {
    start: '2026-10-06T09:00:00.000Z',
  });
  assert.equal(late.status, 400);
});

test('DELETE /calendar/event/{id}: removed from Google Calendar, then the database', async () => {
  const { router, calls, deleted } = setup(['akademik']);
  const res = await callRouter(router, raka, 'DELETE', '/calendar/event/ev-1');
  assert.equal(res.status, 204);
  assert.deepEqual(calls, ['remove']);
  assert.deepEqual(deleted, ['ev-1']);
});

test('DELETE /calendar/event/{id}: without the role, 403 and nothing removed', async () => {
  const { router, calls, deleted } = setup(['ring1']);
  const res = await callRouter(router, raka, 'DELETE', '/calendar/event/ev-1');
  assert.equal(res.status, 403);
  assert.deepEqual(calls, []);
  assert.deepEqual(deleted, []);
});

test('DELETE /calendar/event/{id}: an unknown event is 404', async () => {
  const { router } = setup(['akademik'], { event: null as never });
  const res = await callRouter(router, raka, 'DELETE', '/calendar/event/nope');
  assert.equal(res.status, 404);
});

test('regression (C6): when Google already removed the event (410 Gone), the row is deleted too', async () => {
  const { router, calls, deleted } = setup(['akademik'], {
    googleDelete: async () => {
      throw googleError(410);
    },
  });
  const res = await callRouter(router, raka, 'DELETE', '/calendar/event/ev-1');
  assert.equal(res.status, 204);
  assert.deepEqual(calls, []);
  assert.deepEqual(deleted, ['ev-1']);
});

test('DELETE /calendar/event/{id}: Google answers 404 and the calendar is reachable, so the event is gone and the row is deleted', async () => {
  const { router, calls, deleted } = setup(['akademik'], {
    googleDelete: async () => {
      throw googleError(404);
    },
  });
  const res = await callRouter(router, raka, 'DELETE', '/calendar/event/ev-1');
  assert.equal(res.status, 204);
  assert.deepEqual(calls, ['calendar']);
  assert.deepEqual(deleted, ['ev-1']);
});

test('regression (review m6): Google answers 404 and the calendar is not reachable, so the row stays and the delete fails', async () => {
  const { router, calls, deleted } = setup(['akademik'], {
    googleDelete: async () => {
      throw googleError(404);
    },
    calendarReachable: false,
  });
  const res = await callRouter(router, raka, 'DELETE', '/calendar/event/ev-1');
  assert.equal(res.status, 400);
  assert.deepEqual(calls, ['calendar']);
  assert.deepEqual(deleted, []);
});

test('DELETE /calendar/event/{id}: any other Google failure keeps the row, so the two calendars stay the same', async () => {
  const { router, deleted } = setup(['akademik'], {
    googleDelete: async () => {
      throw googleError(500);
    },
  });
  const res = await callRouter(router, raka, 'DELETE', '/calendar/event/ev-1');
  assert.equal(res.status, 400);
  assert.deepEqual(deleted, []);
});

test("regression (review): Google's own error message never reaches the client, on any calendar write", async () => {
  const failing = async () => {
    throw googleError(403);
  };
  const cases = [
    { method: 'POST', path: '/calendar/event', body: kuis2, google: { insert: failing } },
    { method: 'PUT', path: '/calendar/event/ev-1', body: { title: 'Kuis 3' }, google: { update: failing } },
    { method: 'DELETE', path: '/calendar/event/ev-1', body: undefined, google: { remove: failing } },
  ] as const;
  for (const { method, path, body, google } of cases) {
    const { router, deps } = setup(['akademik']);
    Object.assign(deps.google, google);
    const res = await callRouter(router, raka, method, path, body);
    assert.equal(res.status, 400, `${method} ${path}`);
    assert.doesNotMatch(JSON.stringify(res.body), /Google says/, `${method} ${path}`);
    assert.deepEqual(res.body, { error: GOOGLE_CALENDAR_FAILED });
  }
});

test("regression (review): an event Google can't find answers a fixed 404, not Google's message", async () => {
  const { router, deps } = setup(['akademik']);
  deps.google.get = async () => {
    throw new GaxiosError('Not Found', {}, {
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config: {},
      data: {},
      request: { responseURL: '' },
    } as never);
  };
  const res = await callRouter(router, raka, 'PUT', '/calendar/event/ev-1', { title: 'Kuis 3' });
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: 'Event not found' });
});
