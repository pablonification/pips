import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import { callRouter } from './support/router';
import { testUser } from './support/session';

const FILES = 'https://files.example.test';

let createInfoRouter: typeof import('../src/controllers/info.controller').createInfoRouter;
before(async () => {
  usePlaceholderEnv({ R2_PUBLIC_URL: FILES });
  ({ createInfoRouter } = await import('../src/controllers/info.controller'));
});

const nadia = testUser('u-nadia'); // a member with no role
const raka = testUser('u-raka', { nim: '13524001' }); // pengurus: akademik and cnc
const admin = testUser('u-admin', { nim: '13524002' });
const ROLES: Record<string, string[]> = {
  [raka.id]: ['akademik', 'cnc'],
  [admin.id]: ['admin'],
};

function router() {
  const created: Array<Record<string, unknown>> = [];
  const deps = new Proxy(
    {},
    {
      get:
        (_t, name: string) =>
        async (...args: unknown[]) => {
          if (name === 'getUserRoles') return ROLES[args[0] as string] ?? [];
          if (name === 'getCategoriesByIds')
            return [{ id: 'c1', rolesAllowed: null }];
          if (name === 'createInfo') {
            created.push({ data: args[0], forGroups: args[5] });
            return { id: `i${created.length}`, ...(args[0] as object) };
          }
          return undefined;
        },
    },
  ) as any;
  return { created, router: createInfoRouter(deps) };
}

const post = (extra: Record<string, unknown> = {}) => ({
  title: 'Kuis 2 dimajukan',
  content: 'Kuis 2 IF2123 dimajukan ke Selasa.',
  forCategories: ['c1'],
  ...extra,
});

test("a client's lastNotifiedAt is ignored: the server decides when a post was last sent", async () => {
  const { created, router: r } = router();
  const res = await callRouter(
    r,
    raka,
    'POST',
    '/info',
    post({ lastNotifiedAt: '2020-01-01T00:00:00Z' }),
  );
  assert.equal(res.status, 201);
  assert.equal(created.length, 1);
  assert.equal('lastNotifiedAt' in (created[0].data as object), false);
});

test("a post aimed at groups the author isn't in is refused with 403, and nothing is created", async () => {
  const { created, router: r } = router();
  for (const [user, forGroups] of [
    [nadia, ['akademik']],
    [raka, ['ring1']],
    [raka, ['akademik', 'ring1']],
  ] as const) {
    const res = await callRouter(r, user, 'POST', '/info', post({ forGroups }));
    assert.equal(res.status, 403, `${user.id} ${forGroups.join()}`);
  }
  assert.equal(created.length, 0);
});

test('pengurus still post to their own groups, admin to any, and everyone without a group', async () => {
  const { created, router: r } = router();
  assert.equal(
    (
      await callRouter(
        r,
        raka,
        'POST',
        '/info',
        post({ forGroups: ['akademik', 'cnc'] }),
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await callRouter(
        r,
        admin,
        'POST',
        '/info',
        post({ forGroups: ['ring1'] }),
      )
    ).status,
    201,
  );
  assert.equal(
    (await callRouter(r, nadia, 'POST', '/info', post())).status,
    201,
  );
  assert.equal(
    (await callRouter(r, nadia, 'POST', '/info', post({ forGroups: [] })))
      .status,
    201,
  );
  assert.equal(created.length, 4);
});

test("a post's pictures are only the app's own uploads, at most 10", async () => {
  const { created, router: r } = router();
  for (const mediaUrls of [
    ['https://elsewhere.example.test/pic.jpg'],
    ['javascript:alert(1)'],
    ['http://files.example.test/pic.jpg'],
    ['https://files.example.test.elsewhere.example/pic.jpg'],
    ['https://files.example.test@elsewhere.example/pic.jpg'],
    ['https://files.example.test:8443/pic.jpg'],
    [FILES],
    [`${FILES}/a.jpg`, 'https://elsewhere.example.test/b.jpg'],
    Array.from({ length: 11 }, (_, i) => `${FILES}/p${i}.jpg`),
  ]) {
    const res = await callRouter(r, raka, 'POST', '/info', post({ mediaUrls }));
    assert.equal(res.status, 400, mediaUrls.join());
  }
  assert.equal(created.length, 0);
  for (const mediaUrls of [
    [`${FILES}/r176r3qcuqs3hg8o3dm93n35-kuis.jpg`],
    Array.from({ length: 10 }, (_, i) => `${FILES}/p${i}.jpg`),
  ]) {
    const res = await callRouter(r, raka, 'POST', '/info', post({ mediaUrls }));
    assert.equal(res.status, 201, mediaUrls.join());
  }
});

test('a post has one kind of audience: angkatan, courses or groups', async () => {
  const { created, router: r } = router();
  const angkatan = { forAngkatan: ['2025'] };
  const courses = { forCourses: [{ courseId: 'course-IF2123' }] };
  const groups = { forGroups: ['akademik'] };
  for (const audience of [
    { ...angkatan, ...groups },
    { ...angkatan, ...courses },
    { ...courses, ...groups },
    { ...angkatan, ...courses, ...groups },
  ]) {
    const res = await callRouter(r, raka, 'POST', '/info', post(audience));
    assert.equal(res.status, 400, Object.keys(audience).join());
  }
  assert.equal(created.length, 0);
  for (const audience of [
    angkatan,
    courses,
    groups,
    { ...angkatan, forGroups: [], forCourses: [] },
  ]) {
    const res = await callRouter(r, raka, 'POST', '/info', post(audience));
    assert.equal(res.status, 201, Object.keys(audience).join());
  }
});
