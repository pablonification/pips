// Testi Matkul's routes: a testimonial's author stays private, even when it's shown as "Anonim" (review m7).
import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import type { TestimoniDeps } from '../src/controllers/testimoni.controller';
import type { UserRolesEnum } from '../src/db/schema';
import { callRouter } from './support/router';
import { testUser } from './support/session';

let createTestimoniRouter: typeof import('../src/controllers/testimoni.controller').createTestimoniRouter;
before(async () => {
  usePlaceholderEnv();
  ({ createTestimoniRouter } =
    await import('../src/controllers/testimoni.controller'));
});

const raka = testUser('u-raka');

const row = {
  id: 'testi-1',
  userId: 'u-raka',
  courseId: 'course-IF2110',
  userName: null,
  impressions: null,
  challenges: null,
  advice: null,
  overview: 'Struktur data dasar.',
  assignments: null,
  lecturer_review: null,
  lecturer: null,
  createdAt: new Date('2026-10-08T06:30:00.000Z'),
};

function setup(roles: UserRolesEnum[]) {
  const deps: TestimoniDeps = {
    getUserRoles: async () => roles,
    createTestimoni: async (data, userId) =>
      ({ ...row, ...data, userId }) as never,
    getTestimoniByCourseId: async () => [row] as never,
  };
  return createTestimoniRouter(deps);
}

test("regression (review m7): GET /testimoni/course/{id} leaves out each author's userId", async () => {
  const res = await callRouter(
    setup([]),
    raka,
    'GET',
    '/testimoni/course/course-IF2110',
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].id, 'testi-1');
  assert.equal(res.body[0].overview, 'Struktur data dasar.');
  assert.ok(!('userId' in res.body[0]), JSON.stringify(res.body[0]));
});

test('POST /testimoni leaves out the userId too, and stays akademik only', async () => {
  const body = { courseId: 'course-IF2110', overview: 'Seru.' };
  const res = await callRouter(
    setup(['akademik']),
    raka,
    'POST',
    '/testimoni',
    body,
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.overview, 'Seru.');
  assert.ok(!('userId' in res.body), JSON.stringify(res.body));
  for (const roles of [[], ['admin']] as UserRolesEnum[][])
    assert.equal(
      (await callRouter(setup(roles), raka, 'POST', '/testimoni', body)).status,
      401,
    );
});
