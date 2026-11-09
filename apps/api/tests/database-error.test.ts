import { strict as assert } from 'node:assert';
import postgres from 'postgres';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import { callRouter } from './support/router';
import { testUser } from './support/session';

let createCommentRouter: typeof import('../src/controllers/comment.controller').createCommentRouter;
let createInfoRouter: typeof import('../src/controllers/info.controller').createInfoRouter;
let logger: typeof import('../src/logger').logger;
before(async () => {
  usePlaceholderEnv();
  ({ createCommentRouter } =
    await import('../src/controllers/comment.controller'));
  ({ createInfoRouter } = await import('../src/controllers/info.controller'));
  ({ logger } = await import('../src/logger'));
  // Keep the test's output quiet; the detail is still passed to the logger.
  (logger as any).error = () => logger;
});

const SECRET_DETAIL =
  'insert or update on table "comments" violates foreign key constraint "comments_replied_info_id_infos_id_fk"';
const dbError = () =>
  new (postgres as any).PostgresError({
    message: SECRET_DETAIL,
    code: '23503',
  });

const nadia = testUser('u-nadia');

/** Every dependency throws the database's error. */
const failing = new Proxy(
  {},
  {
    get: (_t, name: string) => async () => {
      if (name === 'getUserRoles') return [];
      if (name === 'getCategoriesByIds')
        return [{ id: 'c1', rolesAllowed: null }];
      throw dbError();
    },
  },
) as any;

test("the database's own message never reaches the client", async () => {
  const comment = await callRouter(
    createCommentRouter(failing),
    nadia,
    'POST',
    '/comment',
    {
      content: 'halo',
      repliedInfoId: 'missing',
    },
  );
  assert.equal(comment.status, 400);
  assert.deepEqual(comment.body, { error: 'Invalid request' });

  const info = await callRouter(
    createInfoRouter(failing),
    nadia,
    'POST',
    '/info',
    {
      title: 'judul',
      content: 'isi',
      forCategories: ['c1'],
    },
  );
  assert.equal(info.status, 400);
  assert.deepEqual(info.body, { error: 'Invalid request' });
});
