import { databaseError } from '~/lib/database-error';
import postgres from 'postgres';
import { toAuthor, withAuthor } from '~/lib/author';
import { canDeleteContent, canEditContent } from '~/lib/authorization';
import {
  createComment,
  deleteComment,
  getCommentById,
  getCommentList,
  updateCommentContent,
} from '~/repositories/comment.repo';
import { canSeeInfo } from '~/repositories/info.repo';
import { getUserRoles } from '~/repositories/user-role.repo';
import {
  deleteCommentRoute,
  getCommentsByIdRoute,
  getCommentsListRoute,
  postCommentRoute,
  updateCommentContentRoute,
} from '~/routes/comment.route';
import { withDb, type WithoutDb } from './deps';
import { createAuthRouter } from './router-factory';

/** What the comment routes need from storage, passed in so the route tests run without a database. */
export interface CommentDeps {
  getCommentList: WithoutDb<typeof getCommentList>;
  getCommentById: WithoutDb<typeof getCommentById>;
  createComment: WithoutDb<typeof createComment>;
  deleteComment: WithoutDb<typeof deleteComment>;
  updateCommentContent: WithoutDb<typeof updateCommentContent>;
  getUserRoles: WithoutDb<typeof getUserRoles>;
  canSeeInfo: WithoutDb<typeof canSeeInfo>;
}

const databaseDeps: CommentDeps = {
  getCommentList: withDb(getCommentList),
  getCommentById: withDb(getCommentById),
  createComment: withDb(createComment),
  deleteComment: withDb(deleteComment),
  updateCommentContent: withDb(updateCommentContent),
  getUserRoles: withDb(getUserRoles),
  canSeeInfo: withDb(canSeeInfo),
};

export function createCommentRouter(deps: CommentDeps = databaseDeps) {
  const commentRouter = createAuthRouter();

  // A post's comments are seen by whoever may open the post, and by no one else.
  const maySee = async (
    infoId: string,
    user: { id: string; angkatan: number },
  ) => await deps.canSeeInfo(infoId, user.id, user.angkatan);

  commentRouter.openapi(getCommentsListRoute, async (c) => {
    const query = c.req.valid('query');
    if (!(await maySee(query.infoId, c.var.user))) {
      return c.json({ error: 'Info not found' }, 404);
    }
    const comment = await deps.getCommentList(query, c.var.user.id);
    return c.json({ comment: comment.map(withAuthor) }, 200);
  });

  commentRouter.openapi(getCommentsByIdRoute, async (c) => {
    const param = c.req.valid('param');
    const comment = await deps.getCommentById(param);
    if (!comment || !(await maySee(comment.repliedInfoId, c.var.user))) {
      return c.json({ error: 'Comment not found' }, 404);
    }
    return c.json(withAuthor(comment), 200);
  });

  commentRouter.openapi(postCommentRoute, async (c) => {
    try {
      const data = c.req.valid('json');
      const userId = c.var.user.id;
      if (!(await maySee(data.repliedInfoId, c.var.user))) {
        return c.json({ error: 'Info not found' }, 404);
      }
      const comment = await deps.createComment(data, userId);
      return c.json({ ...comment, creator: toAuthor(c.var.user) }, 201);
    } catch (err) {
      if (err instanceof postgres.PostgresError)
        return c.json(databaseError(err), 400);
      throw err;
    }
  });

  commentRouter.openapi(deleteCommentRoute, async (c) => {
    const { id: userId } = c.var.user;
    const { commentId } = c.req.valid('param');

    const existing = await deps.getCommentById({ commentId });
    if (!existing) {
      return c.json({ error: 'Comment not found' }, 404);
    }

    const roles = await deps.getUserRoles(userId);
    if (!canDeleteContent({ id: userId, roles }, existing.creatorId)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const comment = await deps.deleteComment(commentId);
    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }
    return c.json({ ...comment, creator: toAuthor(existing.creator) }, 200);
  });

  commentRouter.openapi(updateCommentContentRoute, async (c) => {
    try {
      const data = c.req.valid('json');
      const param = c.req.valid('param');

      const existing = await deps.getCommentById(param);
      if (!existing) return c.json({ error: 'Comment not found' }, 404);
      if (!canEditContent(c.var.user, existing.creatorId)) {
        return c.json({ error: 'Forbidden' }, 403);
      }

      const comment = await deps.updateCommentContent(param, data);
      if (!comment) return c.json({ error: 'Comment not found' }, 404);
      return c.json({ ...comment, creator: toAuthor(c.var.user) }, 200);
    } catch (e) {
      if (e instanceof Error) return c.json(databaseError(e), 400);
      return c.json({ error: 'Bad request' }, 400);
    }
  });

  return commentRouter;
}

export const commentRouter = createCommentRouter();
