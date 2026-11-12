// Info Lomba's writes (P3-B): cnc only, checked on the server, and a free competition can be edited (C5).
import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import type { CompetitionsDeps } from '../src/controllers/competitions.controller';
import type { UserRolesEnum } from '../src/db/schema';
import { callRouter } from './support/router';
import { testUser } from './support/session';

let createCompetitionsRouter: typeof import('../src/controllers/competitions.controller').createCompetitionsRouter;
const FILES = 'https://files.example.test';

before(async () => {
  usePlaceholderEnv({ R2_PUBLIC_URL: FILES });
  ({ createCompetitionsRouter } =
    await import('../src/controllers/competitions.controller'));
});

const member = testUser('u-cnc');

const competition = {
  id: 'lomba-1',
  name: 'Gemastik XIX',
  organizer: 'Kemendikbudristek',
  registrationStart: new Date('2026-09-01T00:00:00.000Z'),
  registrationDeadline: new Date('2026-10-14T16:59:00.000Z'),
  price: '150000',
  registrationUrl: 'https://gemastik.kemdikbud.go.id',
  sourceUrl: 'https://gemastik.kemdikbud.go.id/info',
  categories: ['Competitive Programming'],
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};

function setup(roles: UserRolesEnum[]) {
  const writes: Array<{ op: string; data?: unknown }> = [];
  const deps: CompetitionsDeps = {
    getUserRoles: async () => roles,
    createCompetition: async (data) => {
      writes.push({ op: 'create', data });
      return { ...competition, ...data } as never;
    },
    updateCompetition: async (id, data) => {
      // As Drizzle's set({}) does in competitions.repo.ts.
      if (Object.keys(data).length === 0) throw new Error('No values to set');
      writes.push({ op: 'update', data });
      return { ...competition, ...data, id } as never;
    },
    getCompetitionById: async (id) =>
      (id === competition.id ? competition : undefined) as never,
    getCompetitionsList: async () => [],
    deleteCompetition: async (id) => {
      writes.push({ op: 'delete' });
      return (id === competition.id ? competition : undefined) as never;
    },
  };
  return { router: createCompetitionsRouter(deps), writes };
}

const body = {
  name: 'Hology 8',
  organizer: 'Universitas Brawijaya',
  categories: ['UI/UX'],
  registrationStart: '2026-10-08T00:00:00.000Z',
  registrationDeadline: '2026-10-20T16:59:00.000Z',
  price: null,
  registrationUrl: 'https://hology.ub.ac.id',
  sourceUrl: 'https://hology.ub.ac.id/info',
};

for (const price of [null, '0']) {
  test(`regression (C5): PUT /competitions/{id} saves a free competition (price ${JSON.stringify(price)})`, async () => {
    const { router, writes } = setup(['cnc']);
    const res = await callRouter(
      router,
      member,
      'PUT',
      '/competitions/lomba-1',
      {
        price,
      },
    );
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(writes, [{ op: 'update', data: { price } }]);
  });
}

test('PUT /competitions/{id}: the other rules stay (name and organiser at least 3 characters)', async () => {
  const { router, writes } = setup(['cnc']);
  const res = await callRouter(router, member, 'PUT', '/competitions/lomba-1', {
    name: 'AB',
  });
  assert.equal(res.status, 400);
  assert.deepEqual(writes, []);
});

test('regression (M1): PUT /competitions/{id} with an empty body answers 400, not 500, and writes nothing', async () => {
  const { router, writes } = setup(['cnc']);
  const res = await callRouter(
    router,
    member,
    'PUT',
    '/competitions/lomba-1',
    {},
  );
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.deepEqual(writes, []);
});

test('PUT /competitions/{id}: only the poster, replaced or removed, reaches the update', async () => {
  for (const mediaUrls of [[`${FILES}/abc-hology.png`], []]) {
    const { router, writes } = setup(['cnc']);
    const res = await callRouter(
      router,
      member,
      'PUT',
      '/competitions/lomba-1',
      { mediaUrls },
    );
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(writes, [{ op: 'update', data: { mediaUrls } }]);
  }
});

test('POST /competitions: a poster comes as its uploaded address', async () => {
  const { router, writes } = setup(['cnc']);
  const mediaUrls = [`${FILES}/abc-hology.png`];
  const res = await callRouter(router, member, 'POST', '/competitions', {
    ...body,
    mediaUrls,
  });
  assert.equal(res.status, 201);
  assert.deepEqual(
    (writes[0].data as { mediaUrls: string[] }).mediaUrls,
    mediaUrls,
  );
});

test('POST /competitions: cnc adds one, with a free price', async () => {
  const { router, writes } = setup(['cnc']);
  const res = await callRouter(router, member, 'POST', '/competitions', body);
  assert.equal(res.status, 201);
  assert.equal(writes[0].op, 'create');
});

test('the role is checked on the server: without cnc every write answers 401 and changes nothing', async () => {
  for (const roles of [
    [],
    ['akademik', 'admin'],
    ['ring1'],
  ] as UserRolesEnum[][]) {
    const { router, writes } = setup(roles);
    assert.equal(
      (await callRouter(router, member, 'POST', '/competitions', body)).status,
      401,
    );
    assert.equal(
      (
        await callRouter(router, member, 'PUT', '/competitions/lomba-1', {
          name: 'Gemastik XX',
        })
      ).status,
      401,
    );
    assert.equal(
      (await callRouter(router, member, 'DELETE', '/competitions/lomba-1'))
        .status,
      401,
    );
    assert.deepEqual(writes, []);
  }
});

test('DELETE /competitions/{id}: cnc removes it; an unknown one is 404', async () => {
  const { router } = setup(['cnc']);
  assert.equal(
    (await callRouter(router, member, 'DELETE', '/competitions/lomba-1'))
      .status,
    200,
  );
  assert.equal(
    (await callRouter(router, member, 'DELETE', '/competitions/nope')).status,
    404,
  );
});

const NOT_IN_THE_STORE = [
  ['https://elsewhere.example.test/poster.jpg'],
  ['javascript:alert(1)'],
  ['http://files.example.test/poster.jpg'],
  ['https://files.example.test.elsewhere.example/poster.jpg'],
  ['https://files.example.test@elsewhere.example/poster.jpg'],
  ['https://files.example.test:8443/poster.jpg'],
  [FILES],
  [`${FILES}/a.jpg`, 'https://elsewhere.example.test/b.jpg'],
];

test("POST /competitions: a competition's pictures are only the app's own uploads", async () => {
  const { router, writes } = setup(['cnc']);
  for (const mediaUrls of NOT_IN_THE_STORE) {
    const res = await callRouter(router, member, 'POST', '/competitions', {
      ...body,
      mediaUrls,
    });
    assert.equal(res.status, 400, mediaUrls.join());
  }
  assert.deepEqual(writes, []);
});

test("PUT /competitions/{id}: a new picture must be the app's own upload; an edit that leaves the pictures alone is not refused", async () => {
  const { router, writes } = setup(['cnc']);
  for (const mediaUrls of NOT_IN_THE_STORE) {
    const res = await callRouter(
      router,
      member,
      'PUT',
      '/competitions/lomba-1',
      { name: 'Hology 9', mediaUrls },
    );
    assert.equal(res.status, 400, mediaUrls.join());
  }
  assert.deepEqual(writes, []);
  const res = await callRouter(router, member, 'PUT', '/competitions/lomba-1', {
    name: 'Hology 9',
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(writes, [{ op: 'update', data: { name: 'Hology 9' } }]);
});
