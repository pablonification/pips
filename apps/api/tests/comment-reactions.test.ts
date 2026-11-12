import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { summarizeCommentReactions } from '../src/lib/comment-reactions';

/** `ReactionAggregate` (src/types/reaction.types.ts): a total, a list of counts, and the member's own reaction if any. */
function assertAggregate(summary: unknown) {
  const s = summary as Record<string, unknown>;
  assert.equal(typeof s.totalReactions, 'number');
  assert.ok(Array.isArray(s.reactionsCount));
  assert.ok(s.userReaction === undefined || typeof s.userReaction === 'string');
}

// A comment nobody reacted to must come back with empty counts, not a bare `reactions: []`: the post page can't read
// that shape and fails to load the comments.
test('a comment with no reactions gets an empty summary, in the documented shape', () => {
  const result = summarizeCommentReactions(['c-quiet'], [], []);
  assert.deepEqual(result, {
    'c-quiet': { totalReactions: 0, reactionsCount: [] },
  });
  assertAggregate(result['c-quiet']);
});

test('every comment asked for has a summary, with its counts and the member’s own reaction', () => {
  const result = summarizeCommentReactions(
    ['c-1', 'c-2', 'c-3'],
    [
      { commentId: 'c-1', reaction: 'fire', count: 3 },
      { commentId: 'c-1', reaction: 'love', count: 1 },
      { commentId: 'c-3', reaction: 'fire', count: 2 },
      { commentId: null, reaction: 'fire', count: 9 },
      { commentId: 'c-other', reaction: 'fire', count: 5 },
    ],
    [{ commentId: 'c-3', reaction: 'fire' }],
  );
  assert.deepEqual(result, {
    'c-1': {
      totalReactions: 4,
      reactionsCount: [
        { reaction: 'fire', count: 3 },
        { reaction: 'love', count: 1 },
      ],
    },
    'c-2': { totalReactions: 0, reactionsCount: [] },
    'c-3': {
      totalReactions: 2,
      reactionsCount: [{ reaction: 'fire', count: 2 }],
      userReaction: 'fire',
    },
  });
  for (const summary of Object.values(result)) {
    assertAggregate(summary);
  }
});
