/**
 * Each comment's reaction summary, in the shape `CommentWithReactions` documents (`ReactionAggregate`).
 * Every comment asked for gets a summary, an empty one when it has no reactions: sending `reactions: []` breaks
 * that schema and the client reading the counts.
 */
interface CommentReactionSummary {
  totalReactions: number;
  reactionsCount: Array<{ reaction: string; count: number }>;
  userReaction?: string;
}

export function summarizeCommentReactions(
  commentIds: string[],
  counts: Array<{ commentId: string | null; reaction: string; count: number }>,
  own: Array<{ commentId: string | null; reaction: string }>,
): Record<string, CommentReactionSummary> {
  const result: Record<string, CommentReactionSummary> = {};
  for (const id of commentIds) {
    const userReaction = own.find((r) => r.commentId === id)?.reaction;
    result[id] = {
      totalReactions: 0,
      reactionsCount: [],
      ...(userReaction ? { userReaction } : {}),
    };
  }
  for (const r of counts) {
    const summary = r.commentId ? result[r.commentId] : undefined;
    if (!summary) continue;
    summary.totalReactions += r.count;
    summary.reactionsCount.push({ reaction: r.reaction, count: r.count });
  }
  return result;
}
