import { db } from '~/db/drizzle';
import { getCommentById } from '~/repositories/comment.repo';
import { canSeeInfo } from '~/repositories/info.repo';
import {
  createOrUpdateReaction,
  deleteReaction,
  getReactions,
} from '~/repositories/reaction.repo';
import {
  CreateOrUpdateReactionRoute,
  deleteCommentReactionRoute,
  deleteInfoReactionRoute,
  getReactionsRoute,
} from '~/routes/reaction.route';
import { createAuthRouter } from './router-factory';

export const reactionRouter = createAuthRouter();

/**
 * Whether the member may see every post a reaction is on: the post itself, or the post its comment is on. A post's
 * reactions follow its audience, as its comments do.
 */
async function maySee(
  target: { infoId?: string | null; commentId?: string | null },
  user: { id: string; angkatan: number },
) {
  const infoIds: Array<string | undefined> = [];
  if (target.infoId) infoIds.push(target.infoId);
  if (target.commentId)
    infoIds.push(
      (await getCommentById(db, { commentId: target.commentId }))
        ?.repliedInfoId,
    );
  for (const infoId of infoIds)
    if (!infoId || !(await canSeeInfo(db, infoId, user.id, user.angkatan)))
      return false;
  return true;
}

reactionRouter.openapi(getReactionsRoute, async (c) => {
  const q = c.req.valid('query');
  if (!q.commentId && !q.infoId) {
    return c.json({ error: 'commentId or infoId is required' }, 400);
  }
  const id = q.commentId ? q.commentId : q.infoId;
  if (
    !(await maySee(
      q.commentId ? { commentId: q.commentId } : { infoId: q.infoId },
      c.var.user,
    ))
  )
    return c.json({ error: 'No reactions found' }, 404);
  const reactions = await getReactions(
    db,
    q.commentId
      ? { commentIds: [q.commentId] }
      : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        { infoIds: [q.infoId!] },
    c.var.user.id,
  );
  if (!id || !reactions[id])
    return c.json({ error: 'No reactions found' }, 404);
  return c.json(reactions[id], 200);
});

reactionRouter.openapi(CreateOrUpdateReactionRoute, async (c) => {
  const data = c.req.valid('json');
  if (!(await maySee(data, c.var.user)))
    return c.json({ error: 'Reaction not found' }, 404);
  const reaction = await createOrUpdateReaction(db, data, c.var.user.id);

  if (!reaction) return c.json({ error: 'Reaction not found' }, 404);
  return c.json(reaction, 200);
});

reactionRouter.openapi(deleteCommentReactionRoute, async (c) => {
  const { commentId } = c.req.valid('param');
  const reaction = await deleteReaction(
    db,
    commentId,
    c.var.user.id,
    'comment',
  );

  if (!reaction) return c.json({ error: 'Reaction not found' }, 404);
  return c.json(reaction, 200);
});

reactionRouter.openapi(deleteInfoReactionRoute, async (c) => {
  const { infoId } = c.req.valid('param');
  const reaction = await deleteReaction(db, infoId, c.var.user.id, 'info');

  if (!reaction) return c.json({ error: 'Reaction not found' }, 404);
  return c.json(reaction, 200);
});
