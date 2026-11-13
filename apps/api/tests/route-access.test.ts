// Who may call each route: every route the API serves has a row in src/lib/route-access.ts, and each row is checked
// with requests, so a forgotten or changed role check fails here.
import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import type { RouteAccess } from '../src/lib/route-access';
import { rolesEnums } from '../src/db/roles-group';
import { sessionCookie, testUser } from './support/session';

const ORIGIN = 'http://localhost:5173';
const UNLIMITED = 1_000_000;

type App = {
  request: (path: string, init?: RequestInit) => Response | Promise<Response>;
};
type Routes = Record<string, RouteAccess>;

let ROUTE_ACCESS: Routes;
let app: App & { routes: Array<{ method: string; path: string }> };
let fakeApp: App & { routes: Array<{ method: string; path: string }> };

/** The member's roles, written in their id, so one fake reader serves every controller. */
const memberWith = (roles: readonly string[]) =>
  testUser(`roles:${roles.join(',')}`, { nim: '13525901' });
const readRoles = async (userId: string) =>
  userId.slice('roles:'.length).split(',').filter(Boolean) as never[];

/** A controller's deps with the fake role reader; any storage call throws, so a handler that runs answers 500. */
const fakeDeps = <T>() =>
  new Proxy(
    {},
    {
      get: (_target, name) =>
        name === 'getUserRoles'
          ? readRoles
          : () => {
              throw new Error(`no fake for ${String(name)}`);
            },
    },
  ) as T;

/** Inputs that pass validation, for routes whose handler checks the role after validating the request. */
const VALID_INPUT: Record<string, unknown> = {
  'PUT /api/curhat/chatroom/{chatroomId}/pin': { isPinned: true },
};

before(async () => {
  // Staging with test login and the bypass key, so the routes only they add are served too.
  usePlaceholderEnv({
    // A socket that doesn't exist fails at once; the placeholder's closed port can take seconds per query.
    DATABASE_URL:
      'postgres://placeholder:placeholder@localhost/placeholder?host=/nonexistent-pips-socket',
    APP_ENV: 'staging',
    LOGIN_BYPASS_KEY: 'k'.repeat(40),
    ENABLE_TEST_LOGIN: 'true',
    DEV_LOGIN_EMAIL: '13525901@std.stei.itb.ac.id',
    DEV_LOGIN_PASSWORD_HASH: '00:00',
  });
  ({ ROUTE_ACCESS } = await import('../src/lib/route-access'));
  const { createApp } = await import('../src/app');
  app = createApp({
    checkDatabase: async () => undefined,
    rateLimits: {
      signIn: UNLIMITED,
      writes: UNLIMITED,
      previews: UNLIMITED,
      nimSearches: UNLIMITED,
    },
  });

  // Every controller that takes its storage (and the member's roles) as deps.
  const routers = [
    (
      await import('../src/controllers/calendar.controller')
    ).createCalendarRouter(fakeDeps()),
    (await import('../src/controllers/comment.controller')).createCommentRouter(
      fakeDeps(),
    ),
    (
      await import('../src/controllers/competitions.controller')
    ).createCompetitionsRouter(fakeDeps()),
    (await import('../src/controllers/course.controller')).createCourseRouter(
      fakeDeps(),
    ),
    (await import('../src/controllers/curhat.controller')).createCurhatRouter(
      fakeDeps(),
    ),
    (await import('../src/controllers/form.controller')).createFormRouter(
      fakeDeps(),
    ),
    (await import('../src/controllers/info.controller')).createInfoRouter(
      fakeDeps(),
    ),
    (
      await import('../src/controllers/internship.controller')
    ).createInternshipRouter(fakeDeps()),
    (
      await import('../src/controllers/programme-window.controller')
    ).createProgrammeWindowRouter(fakeDeps()),
    (await import('../src/controllers/push.controller')).createPushRouter(
      fakeDeps(),
    ),
    (
      await import('../src/controllers/testimoni.controller')
    ).createTestimoniRouter(fakeDeps()),
    (
      await import('../src/controllers/user-finder.controller')
    ).createUserFinderRouter(fakeDeps()),
  ];
  const fake = new OpenAPIHono();
  for (const router of routers) fake.route('/api', router);
  fake.onError((err, c) =>
    err instanceof HTTPException
      ? err.getResponse()
      : c.json({ error: 'the handler ran' }, 500),
  );
  fakeApp = fake;
});

/** `METHOD /path` of every handler `served` registers, as the OpenAPI document writes paths. */
function routesOf(served: { routes: Array<{ method: string; path: string }> }) {
  return new Set(
    served.routes
      .filter((r) => r.method !== 'ALL' && !r.path.includes('*'))
      .map((r) => `${r.method} ${r.path.replace(/:(\w+)/g, '{$1}')}`),
  );
}

async function send(
  to: App,
  route: string,
  user: ReturnType<typeof testUser> | null,
  body?: unknown,
) {
  const [method, path] = route.split(' ');
  const headers: Record<string, string> = { Origin: ORIGIN };
  if (user) headers.Cookie = await sessionCookie(user);
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await to.request(path.replace(/\{\w+\}/g, 'sample-1'), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return {
    status: res.status,
    body: json,
    noSession: res.status === 401 && res.headers.has('www-authenticate'),
  };
}

const roleRows = () =>
  Object.entries(ROUTE_ACCESS).filter(
    (row): row is [string, Extract<RouteAccess, { who: readonly string[] }>] =>
      Array.isArray(row[1].who),
  );

test('every route the API serves has a row in ROUTE_ACCESS', () => {
  const missing = [...routesOf(app)].filter((r) => !(r in ROUTE_ACCESS));
  assert.deepEqual(
    missing,
    [],
    `Add a row for each of these to ROUTE_ACCESS in apps/api/src/lib/route-access.ts, saying who may call it ` +
      `('anyone', 'member', or the roles, with a note for what the handler decides): ${missing.join(', ')}`,
  );
});

test('every row in ROUTE_ACCESS is a route the API serves', () => {
  const served = routesOf(app);
  const stale = Object.keys(ROUTE_ACCESS).filter((r) => !served.has(r));
  assert.deepEqual(stale, [], `Remove or fix these rows: ${stale.join(', ')}`);
});

test('every role in ROUTE_ACCESS is a real role', () => {
  for (const [route, access] of roleRows()) {
    assert.ok(access.who.length > 0, `${route} lists no role`);
    for (const role of access.who)
      assert.ok(
        (rolesEnums as readonly string[]).includes(role),
        `${route}: ${role}`,
      );
  }
});

test('signed out: every route but the signed-out ones answers 401 from the session check', async () => {
  const wrong: string[] = [];
  for (const [route, access] of Object.entries(ROUTE_ACCESS)) {
    if (access.who === 'anyone') continue;
    const res = await send(app, route, null);
    if (!res.noSession) wrong.push(`${route} → ${res.status}`);
  }
  assert.deepEqual(wrong, []);
});

test('signed out: the signed-out routes answer without asking for a session', async () => {
  const wrong: string[] = [];
  for (const [route, access] of Object.entries(ROUTE_ACCESS)) {
    if (access.who !== 'anyone') continue;
    const res = await send(app, route, null);
    if (res.noSession || res.status === 404)
      wrong.push(`${route} → ${res.status}`);
  }
  assert.deepEqual(wrong, []);
});

test('every role-only route can be called in this test (its controller takes fake deps)', () => {
  const testable = routesOf(fakeApp);
  const missing = roleRows()
    .map(([route]) => route)
    .filter((route) => !testable.has(route));
  assert.deepEqual(
    missing,
    [],
    'Give these routes’ controllers a getUserRoles dep and mount them in this test',
  );
});

test('a member holding every role but the listed ones gets 401 on each role-only route', async () => {
  const wrong: string[] = [];
  for (const [route, access] of roleRows()) {
    const others = rolesEnums.filter((r) => !access.who.includes(r));
    const res = await send(
      fakeApp,
      route,
      memberWith(others),
      VALID_INPUT[route],
    );
    if (res.status !== 401 || res.body?.error !== 'Unauthorized')
      wrong.push(`${route} → ${res.status} ${JSON.stringify(res.body)}`);
  }
  assert.deepEqual(wrong, []);
});

test('a member holding any one of the listed roles gets past the check', async () => {
  const wrong: string[] = [];
  for (const [route, access] of roleRows()) {
    for (const role of access.who) {
      const res = await send(
        fakeApp,
        route,
        memberWith([role]),
        VALID_INPUT[route],
      );
      if (res.status === 401) wrong.push(`${route} as ${role} → 401`);
    }
  }
  assert.deepEqual(wrong, []);
});

test('routes open to every member have no role check in front of them', async (t) => {
  const testable = routesOf(fakeApp);
  const wrong: string[] = [];
  let checked = 0;
  for (const [route, access] of Object.entries(ROUTE_ACCESS)) {
    if (access.who !== 'member' || !testable.has(route)) continue;
    checked++;
    const res = await send(fakeApp, route, memberWith([]), VALID_INPUT[route]);
    if (res.status === 401 && res.body?.error === 'Unauthorized')
      wrong.push(route);
  }
  t.diagnostic(
    `${checked + roleRows().length} of ${Object.keys(ROUTE_ACCESS).length} rows checked with a member's request`,
  );
  assert.deepEqual(wrong, []);
});
