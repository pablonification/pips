import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import {
  escapeLike,
  NIM_FINDER_LIMIT,
  toNimFinderResult,
} from '../src/lib/nim-finder';
import type { UserFinderDeps } from '../src/controllers/user-finder.controller';
import { callRouter } from './support/router';
import { testUser } from './support/session';

let nimFinderQuery: typeof import('../src/repositories/user-finder.repo').nimFinderQuery;
let db: typeof import('../src/db/drizzle').db;
let createUserFinderRouter: typeof import('../src/controllers/user-finder.controller').createUserFinderRouter;
before(async () => {
  usePlaceholderEnv();
  ({ nimFinderQuery } = await import('../src/repositories/user-finder.repo'));
  ({ db } = await import('../src/db/drizzle'));
  ({ createUserFinderRouter } =
    await import('../src/controllers/user-finder.controller'));
});

test('% _ and \\ are taken literally', () => {
  assert.equal(escapeLike('%%%'), '\\%\\%\\%');
  assert.equal(escapeLike('a_b'), 'a\\_b');
  assert.equal(escapeLike('a\\b'), 'a\\\\b');
  assert.equal(escapeLike('Raka 135'), 'Raka 135');
});

// Regression (C8): "%%%" was put into the pattern as is ("%%%%%"), so it listed every member.
test('the query matches the text literally, selects only the four public columns and is capped', () => {
  const query = nimFinderQuery(db, { search: '%%%' }).toSQL();
  const sql = query.sql;
  assert.match(
    sql,
    /^select "full_name", "nim", "jurusan", "picture" from "users" where/,
  );
  for (const hidden of [
    'email',
    'id',
    'jenis_kelamin',
    'status_keanggotaan',
    'asal_kampus',
    'angkatan',
    'last_login_at',
    'created_at',
  ])
    assert.doesNotMatch(
      sql.split(' from ')[0],
      new RegExp(`"${hidden}"`),
      hidden,
    );
  assert.ok(query.params.includes('%\\%\\%\\%%'), JSON.stringify(query.params));
  assert.ok(!query.params.includes('%%%%%'));
  assert.match(sql, / limit \$\d+$/);
  assert.equal(query.params.at(-1), NIM_FINDER_LIMIT);
  assert.equal(NIM_FINDER_LIMIT, 30);
});

test('closest NIM matches come first: exact, then prefix, then other NIM matches, then names A–Z', () => {
  const query = nimFinderQuery(db, { search: '13525' }).toSQL();
  assert.match(
    query.sql,
    /order by case when "users"\."nim" = \$\d+ then 0 when "users"\."nim" like \$\d+ then 1 when "users"\."nim" like \$\d+ then 2 else 3 end, "users"\."full_name" asc/,
  );
  assert.deepEqual(query.params.slice(2, 5), ['13525', '13525%', '%13525%']);
});

test('a result keeps only name, NIM, programme and photo', () => {
  const row = {
    ...testUser('u-1'),
    lastLoginAt: new Date(),
    createdAt: new Date(),
  };
  assert.deepEqual(toNimFinderResult(row), {
    fullName: row.fullName,
    nim: row.nim,
    major: 'IF',
    picture: null,
  });
});

// Regression (SPEC API change 4): whole user rows (email, gender, membership, campus, sign-in times) reached every
// member, because the route's schema doesn't strip responses.
test('GET /user/nim returns only the four fields, whatever the storage hands back', async () => {
  const full = {
    ...testUser('u-raka', { fullName: 'Raka Pratama', nim: '13524045' }),
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };
  const deps = {
    getUserByNimOrName: async () => [full],
  } as unknown as UserFinderDeps;
  const res = await callRouter(
    createUserFinderRouter(deps),
    testUser('u-nadia'),
    'GET',
    '/user/nim?search=Raka',
  );
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, [
    { fullName: 'Raka Pratama', nim: '13524045', major: 'IF', picture: null },
  ]);
});

test('fewer than 3 characters, spaces not counted, is refused', async () => {
  let asked = 0;
  const deps: UserFinderDeps = {
    getUserByNimOrName: async () => {
      asked++;
      return [];
    },
  };
  for (const search of ['ra', '  ra  ', '']) {
    const res = await callRouter(
      createUserFinderRouter(deps),
      testUser('u-nadia'),
      'GET',
      `/user/nim?search=${encodeURIComponent(search)}`,
    );
    assert.equal(res.status, 400, JSON.stringify(search));
  }
  assert.equal(asked, 0);
  const signedOut = await callRouter(
    createUserFinderRouter(deps),
    null,
    'GET',
    '/user/nim?search=Raka',
  );
  assert.equal(signedOut.status, 401);
});
