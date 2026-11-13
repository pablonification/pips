import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  CAPABILITY_ROLES,
  can,
  canCreateEvent,
  canDeleteContent,
  canManageEvent,
  canPostInCategory,
  eventCategoriesFor,
  type Capability,
} from '../src/lib/capabilities';
import { ROUTE_ACCESS } from '../../api/src/lib/route-access';

const api = (file: string) =>
  fs.readFileSync(
    path.resolve(import.meta.dirname, '../../api/src', file),
    'utf8',
  );
const list = (source: string) =>
  [...source.matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1]).sort();
const constant = (source: string, name: string) =>
  list(new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`).exec(source)![1]);
/** The roles the API's route table (apps/api/src/lib/route-access.ts) gives `routes`; they must agree. */
const routeRoles = (...routes: string[]) => {
  const sets = routes.map((route) => {
    const who = ROUTE_ACCESS[route]?.who;
    assert.ok(Array.isArray(who), `${route} is for named roles in the API`);
    return [...who].sort().join(',');
  });
  assert.equal(new Set(sets).size, 1, `${routes.join(', ')} use one role set`);
  return sets[0].split(',');
};

// The map mirrors the server: each row is read from the API's route table (its tests check the table with requests)
// or from its own source, so a change there fails here.
const SERVER: Record<Capability, () => string[]> = {
  createCompetition: () => routeRoles('POST /api/competitions'),
  manageCompetition: () =>
    routeRoles(
      'POST /api/competitions',
      'PUT /api/competitions/{id}',
      'DELETE /api/competitions/{competitionId}',
    ),
  createTestimonial: () => routeRoles('POST /api/testimoni'),
  broadcastPush: () => routeRoles('POST /api/push/broadcast'),
  liveCounting: () =>
    routeRoles(
      'GET /api/form/admin/list',
      'GET /api/form/{formId}/responses',
      'GET /api/form/{formId}/responses/count',
      'GET /api/form/{formId}/analytics',
    ),
  spartaData: () =>
    routeRoles(
      'GET /api/internship/submissions',
      'GET /api/internship/submissions/{id}',
      'POST /api/internship/departments',
      'PUT /api/internship/departments/{id}',
      'DELETE /api/internship/departments/{id}',
      'POST /api/internship/divisions',
      'PUT /api/internship/divisions/{id}',
      'DELETE /api/internship/divisions/{id}',
    ),
  moderateContent: () =>
    constant(api('lib/authorization.ts'), 'CONTENT_MODERATOR_ROLES'),
  editCourseCatalog: () =>
    routeRoles(
      'POST /api/course',
      'PUT /api/course/{courseId}',
      'DELETE /api/course/{courseId}',
    ),
  createAkademikEvent: () => {
    const src = api('controllers/calendar.controller.ts');
    assert.match(
      src,
      /category === 'akademik'[\s\S]{0,200}roles\.includes\('akademik'\)/,
    );
    return ['akademik'];
  },
  createHimpunanEvent: () => {
    const src = api('controllers/calendar.controller.ts');
    assert.match(src, /roles\.includes\('ring1'\)/);
    return ['ring1'];
  },
  respondCurhat: () => {
    // The role is one constant, used by the Welfare list, pins and the room access rule.
    const role = /CURHAT_ADMIN_ROLE\s*=\s*'([a-z0-9]+)'/.exec(
      api('lib/curhat.ts'),
    )![1];
    assert.match(
      api('controllers/curhat.controller.ts'),
      /roles\.includes\(CURHAT_ADMIN_ROLE\)/,
    );
    assert.match(api('lib/curhat.ts'), /roles\.includes\(CURHAT_ADMIN_ROLE\)/);
    assert.deepEqual(routeRoles('PUT /api/curhat/chatroom/{chatroomId}/pin'), [
      role,
    ]);
    return [role];
  },
};

for (const capability of Object.keys(CAPABILITY_ROLES) as Capability[]) {
  test(`${capability} mirrors the server's roles`, () => {
    assert.deepEqual(
      [...CAPABILITY_ROLES[capability]].sort(),
      SERVER[capability]().sort(),
    );
  });
}

test('every capability is checked against the server', () => {
  assert.deepEqual(
    Object.keys(SERVER).sort(),
    Object.keys(CAPABILITY_ROLES).sort(),
  );
});

// The two sample personas: a plain member and a pengurus.
const nadia = { id: 'nadia', roles: [] as string[] };
const raka = {
  id: 'raka',
  roles: ['welfarenakademik', 'akademik', 'de', 'admin'],
};

test('a member with no roles can do none of the pengurus actions', () => {
  for (const capability of Object.keys(CAPABILITY_ROLES) as Capability[]) {
    assert.equal(can(nadia, capability), false, capability);
  }
  assert.equal(can(null, 'liveCounting'), false);
  assert.equal(can(undefined, 'liveCounting'), false);
  assert.equal(can({ roles: null }, 'liveCounting'), false);
});

test('Raka (akademik, admin) gets exactly the tools his roles allow', () => {
  const granted = (Object.keys(CAPABILITY_ROLES) as Capability[])
    .filter((c) => can(raka, c))
    .sort();
  assert.deepEqual(granted, [
    'createAkademikEvent',
    'createTestimonial',
    'editCourseCatalog',
    'liveCounting',
    'moderateContent',
    'spartaData',
  ]);
  assert.equal(canCreateEvent(raka), true);
  assert.equal(canCreateEvent({ roles: ['ring1'] }), true);
  assert.equal(canCreateEvent({ roles: ['cnc'] }), false);
  assert.equal(can({ roles: ['peoplemanage'] }, 'spartaData'), true);
  assert.equal(can({ roles: ['peoplemanage'] }, 'liveCounting'), false);
});

test('posting: open categories for everyone, restricted ones by role, an empty list for nobody', () => {
  assert.equal(canPostInCategory(nadia, { rolesAllowed: null }), true);
  assert.equal(canPostInCategory(nadia, {}), true);
  assert.equal(canPostInCategory(nadia, { rolesAllowed: ['akademik'] }), false);
  assert.equal(canPostInCategory(raka, { rolesAllowed: ['akademik'] }), true);
  // The server lists a category only when rolesAllowed IS NULL or one of the member's roles is in it,
  // and an empty JSON array has no roles, so [] means nobody can post there.
  assert.equal(canPostInCategory(nadia, { rolesAllowed: [] }), false);
  assert.equal(canPostInCategory(raka, { rolesAllowed: [] }), false);
  const repo = api('repositories/category.repo.ts');
  const listing = repo.slice(repo.indexOf('getInfoCategoryList'));
  assert.match(
    listing,
    /isNull\(categories\.rolesAllowed\)/,
    'only null is open',
  );
  assert.match(
    listing,
    /json_array_elements_text\(\$\{categories\.rolesAllowed\}\)/,
    'otherwise a role must be in the list',
  );
});

test('deleting: the author, or a moderator (admin)', () => {
  assert.equal(canDeleteContent(nadia, 'nadia'), true);
  assert.equal(canDeleteContent(nadia, 'raka'), false);
  assert.equal(canDeleteContent(raka, 'nadia'), true);
  assert.equal(
    canDeleteContent({ id: 'x', roles: ['akademik'] }, 'nadia'),
    false,
  );
  assert.equal(canDeleteContent(null, 'nadia'), false);
});

// Events by category. The server checks adding, changing and deleting the same way (calendar.controller.ts).
test('events: Akademik for akademik, Himpunan for ring1, Akademik first; changing follows the category', () => {
  assert.deepEqual(eventCategoriesFor(raka), ['akademik']);
  assert.deepEqual(eventCategoriesFor({ roles: ['ring1'] }), ['himpunan']);
  assert.deepEqual(eventCategoriesFor({ roles: ['ring1', 'akademik'] }), [
    'akademik',
    'himpunan',
  ]);
  assert.deepEqual(eventCategoriesFor(nadia), []);
  assert.deepEqual(eventCategoriesFor({ roles: ['admin', 'cnc'] }), []);
  assert.equal(canManageEvent(raka, 'akademik'), true);
  assert.equal(canManageEvent(raka, 'himpunan'), false);
  assert.equal(canManageEvent({ roles: ['ring1'] }, 'himpunan'), true);
  assert.equal(canManageEvent({ roles: ['ring1'] }, 'akademik'), false);
  assert.equal(canManageEvent(nadia, 'akademik'), false);
  // The server checks update and delete with the same rule as add: Akademik needs akademik, anything else ring1.
  const src = api('controllers/calendar.controller.ts');
  assert.equal(
    [...src.matchAll(/category === 'akademik'/g)].length,
    3,
    'add, update and delete each check the category',
  );
  assert.equal([...src.matchAll(/roles\.includes\('ring1'\)/g)].length, 3);
});

test('competitions: cnc adds, changes and deletes; nobody else', () => {
  assert.equal(can({ roles: ['cnc'] }, 'manageCompetition'), true);
  assert.equal(can(raka, 'manageCompetition'), false);
  assert.equal(can(raka, 'createCompetition'), false);
});

test('testimonials: akademik adds them; admin alone and members don’t (the API allows akademik only)', () => {
  assert.equal(can({ roles: ['akademik'] }, 'createTestimonial'), true);
  assert.equal(can(raka, 'createTestimonial'), true);
  assert.equal(can({ roles: ['admin'] }, 'createTestimonial'), false);
  assert.equal(can({ roles: [] }, 'createTestimonial'), false);
});
