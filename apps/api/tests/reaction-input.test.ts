// What a reaction may be: one of the app's six, on exactly one post or comment. Checked before the database.
import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import { callRouter } from './support/router';
import { testUser } from './support/session';

let reactionRouter: typeof import('../src/controllers/reaction.controller').reactionRouter;
before(async () => {
  usePlaceholderEnv();
  ({ reactionRouter } = await import('../src/controllers/reaction.controller'));
});

const nadia = testUser('u-nadia', { nim: '13525913' });

test('a reaction outside the six, or with no or two targets, is refused with 400', async () => {
  for (const body of [
    { infoId: 'i-1', reaction: 'love' },
    { infoId: 'i-1', reaction: 'x'.repeat(20_000) },
    { infoId: 'i-1', reaction: '' },
    { reaction: 'fire' },
    { infoId: 'i-1', commentId: 'c-1', reaction: 'fire' },
    { infoId: '', reaction: 'fire' },
  ]) {
    const res = await callRouter(
      reactionRouter,
      nadia,
      'PUT',
      '/reaction',
      body,
    );
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 80));
  }
});
