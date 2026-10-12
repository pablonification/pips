import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import { AUTHOR_COLUMNS, toAuthor } from '../src/lib/author';
import type { CommentDeps } from '../src/controllers/comment.controller';
import type { InfoDeps } from '../src/controllers/info.controller';
import { callRouter } from './support/router';
import { pathsOfKey, testUser } from './support/session';

const nadia = testUser('u-nadia');
const raka = testUser('u-raka', { nim: '13524045', angkatan: 2024 });

/** Raka's whole `users` row, as the repositories used to hand it over. */
const rakaRow = {
  ...raka,
  createdAt: new Date('2024-08-01T00:00:00Z'),
  lastLoginAt: new Date('2026-10-08T01:00:00Z'),
};

const AUTHOR_KEYS = ['email', 'fullName', 'id', 'picture'];
/** Fields of a member that no post, comment or reaction may carry, at any depth. */
const PRIVATE_KEYS = [
  'nim',
  'gender',
  'region',
  'membershipStatus',
  'lastLoginAt',
];

function assertOnlyAuthor(body: unknown, creators: unknown[]) {
  for (const creator of creators) {
    assert.deepEqual(Object.keys(creator as object).sort(), AUTHOR_KEYS);
  }
  for (const key of PRIVATE_KEYS) {
    assert.deepEqual(pathsOfKey(body, key), [], key);
  }
}

test('an author is an allow-list: id, name, photo and email, nothing else', () => {
  assert.deepEqual(toAuthor(rakaRow), {
    id: raka.id,
    fullName: raka.fullName,
    picture: null,
    email: raka.email,
  });
  assert.deepEqual(Object.keys(AUTHOR_COLUMNS).sort(), AUTHOR_KEYS);
});

let createInfoRouter: typeof import('../src/controllers/info.controller').createInfoRouter;
let createCommentRouter: typeof import('../src/controllers/comment.controller').createCommentRouter;
before(async () => {
  usePlaceholderEnv();
  ({ createInfoRouter } = await import('../src/controllers/info.controller'));
  ({ createCommentRouter } =
    await import('../src/controllers/comment.controller'));
});

// --- the queries read only the author's columns ---

test('the feed and a post read only the author columns from users', async () => {
  const { db } = await import('../src/db/drizzle');
  const { infoRelations } = await import('../src/repositories/info.repo');
  const { sql } = db.query.infos
    .findMany({ with: infoRelations(nadia.id) })
    .toSQL();
  const creator = /"infos_creator"\."data" as "creator"/.test(sql);
  assert.ok(creator, 'the creator is selected');
  // The creator's sub-select names exactly its four columns.
  const sub = sql.match(
    /select json_build_array\(([^)]*)\) as "data" from \(select \* from "users" "infos_creator"/,
  );
  assert.ok(sub, sql);
  assert.deepEqual(
    [...sub[1].matchAll(/"infos_creator"\."(\w+)"/g)].map((m) => m[1]),
    ['id', 'full_name', 'picture', 'email'],
  );
});

test('the comment list reads only the author columns from users', async () => {
  const { db } = await import('../src/db/drizzle');
  const { commentListQuery } = await import('../src/repositories/comment.repo');
  const { sql } = commentListQuery(db, { infoId: 'i1' } as never).toSQL();
  const selected = sql.slice(0, sql.indexOf(' from '));
  assert.deepEqual(
    [...selected.matchAll(/"users"\."(\w+)"/g)].map((m) => m[1]),
    ['id', 'full_name', 'picture', 'email'],
  );
});

// --- the routes, storage handing over whole user rows ---

function infoRouter() {
  const info = (id: string) => ({
    id,
    title: 'Kuis 2 dimajukan',
    content: 'Kuis 2 IF2123 dimajukan ke Selasa.',
    creatorId: raka.id,
    createdAt: new Date('2026-10-08T01:00:00Z'),
    creator: rakaRow,
    infoMedias: [],
    infoCategories: [],
    infoCourses: [],
    infoAngkatan: [],
    infoGroups: [],
    comments: 0,
    reactions: { totalReactions: 0, reactionsCount: [] },
    isRead: false,
    canNotify: false,
  });
  return createInfoRouter({
    getListInfos: async () => [info('i1'), info('i2')],
    getInfoById: async (id: string) => (id === 'i1' ? info('i1') : undefined),
  } as unknown as InfoDeps);
}

// Regression (review M3): the feed and a post sent each author's whole users row (email, gender, campus,
// membership, angkatan, sign-in times) to every signed-in member.
test('GET /info and GET /info/{id} carry only the author fields', async () => {
  const list = await callRouter(infoRouter(), nadia, 'GET', '/info');
  assert.equal(list.status, 200);
  assertOnlyAuthor(
    list.body,
    list.body.infos.map((i: { creator: unknown }) => i.creator),
  );
  assert.equal(list.body.infos[0].creatorId, raka.id);

  const one = await callRouter(infoRouter(), nadia, 'GET', '/info/i1');
  assert.equal(one.status, 200);
  assertOnlyAuthor(one.body, [one.body.creator]);
});

function commentRouter() {
  const comment = {
    id: 'c1',
    repliedInfoId: 'i1',
    creatorId: raka.id,
    content: 'Siap, makasih infonya!',
    createdAt: new Date('2026-10-08T01:30:00Z'),
  };
  const deps: Partial<CommentDeps> = {
    getCommentList: async () => [
      {
        ...comment,
        creator: rakaRow,
        reactions: { totalReactions: 0, reactionsCount: [] },
      },
    ],
    getCommentById: async () => ({ ...comment, creator: rakaRow }),
    createComment: async () => ({ ...comment, creatorId: nadia.id }),
    updateCommentContent: async () => comment,
    deleteComment: async () => comment,
    getUserRoles: async () => [],
  };
  return createCommentRouter(deps as unknown as CommentDeps);
}

// Regression (review M3): the comment list and a comment sent each commenter's whole users row.
test('every comment route carries only the author fields', async () => {
  const list = await callRouter(
    commentRouter(),
    nadia,
    'GET',
    '/comments?infoId=i1',
  );
  assert.equal(list.status, 200);
  assertOnlyAuthor(
    list.body,
    list.body.comment.map((c: { creator: unknown }) => c.creator),
  );

  const one = await callRouter(commentRouter(), nadia, 'GET', '/comment/c1');
  assert.equal(one.status, 200);
  assertOnlyAuthor(one.body, [one.body.creator]);

  // Your own comment, as you post, edit or delete it: the same four fields.
  const posted = await callRouter(commentRouter(), nadia, 'POST', '/comment', {
    repliedInfoId: 'i1',
    content: 'Makasih!',
  });
  assert.equal(posted.status, 201);
  assertOnlyAuthor(posted.body, [posted.body.creator]);

  const edited = await callRouter(commentRouter(), raka, 'PUT', '/comment/c1', {
    content: 'Siap!',
  });
  assert.equal(edited.status, 200);
  assertOnlyAuthor(edited.body, [edited.body.creator]);

  const deleted = await callRouter(
    commentRouter(),
    raka,
    'DELETE',
    '/comment/c1',
  );
  assert.equal(deleted.status, 200);
  assertOnlyAuthor(deleted.body, [deleted.body.creator]);
});
