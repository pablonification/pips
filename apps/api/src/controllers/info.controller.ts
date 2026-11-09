import { databaseError } from '~/lib/database-error';
import postgres from 'postgres';
import { withAuthor } from '~/lib/author';
import { canDeleteContent } from '~/lib/authorization';
import { runInBackground } from '~/lib/background';
import { checkPostCategories } from '~/lib/category-audience';
import { getCategoriesByIds } from '~/repositories/category.repo';
import {
  claimRenotify,
  createInfo,
  createReadInfo,
  deleteInfo,
  deleteReadInfo,
  getInfoById,
  getInfoCreatorId,
  getListInfos,
  markAllInfosRead,
  notifyNewInfo,
  renotifyInfo,
} from '~/repositories/info.repo';
import { getUserRoles } from '~/repositories/user-role.repo';
import {
  createInfoRoute,
  deleteInfoRoute,
  getInfoByIdRoute,
  getListInfoRoute,
  postReadAllInfoRoute,
  postReadInfoRoute,
  postRenotifyInfoRoute,
} from '~/routes/info.route';
import { withDb, type WithoutDb } from './deps';
import { createAuthRouter } from './router-factory';

/** What the info routes need from storage, passed in so the route tests run without a database. */
export interface InfoDeps {
  createReadInfo: WithoutDb<typeof createReadInfo>;
  deleteReadInfo: WithoutDb<typeof deleteReadInfo>;
  markAllInfosRead: WithoutDb<typeof markAllInfosRead>;
  createInfo: WithoutDb<typeof createInfo>;
  notifyNewInfo: WithoutDb<typeof notifyNewInfo>;
  getInfoCreatorId: WithoutDb<typeof getInfoCreatorId>;
  deleteInfo: WithoutDb<typeof deleteInfo>;
  getListInfos: WithoutDb<typeof getListInfos>;
  getInfoById: WithoutDb<typeof getInfoById>;
  claimRenotify: WithoutDb<typeof claimRenotify>;
  renotifyInfo: WithoutDb<typeof renotifyInfo>;
  getUserRoles: WithoutDb<typeof getUserRoles>;
  getCategoriesByIds: WithoutDb<typeof getCategoriesByIds>;
}

const databaseDeps: InfoDeps = {
  createReadInfo: withDb(createReadInfo),
  deleteReadInfo: withDb(deleteReadInfo),
  markAllInfosRead: withDb(markAllInfosRead),
  createInfo: withDb(createInfo),
  notifyNewInfo: withDb(notifyNewInfo),
  getInfoCreatorId: withDb(getInfoCreatorId),
  deleteInfo: withDb(deleteInfo),
  getListInfos: withDb(getListInfos),
  getInfoById: withDb(getInfoById),
  claimRenotify: withDb(claimRenotify),
  renotifyInfo: withDb(renotifyInfo),
  getUserRoles: withDb(getUserRoles),
  getCategoriesByIds: withDb(getCategoriesByIds),
};

export function createInfoRouter(deps: InfoDeps = databaseDeps) {
  const infoRouter = createAuthRouter();

  infoRouter.openapi(postReadInfoRoute, async (c) => {
    const { id } = c.var.user;
    const { infoId } = c.req.valid('param');
    const { unread } = c.req.valid('json');

    const data = {
      userId: id,
      infoId,
    };

    if (unread) {
      await deps.deleteReadInfo(data);
    } else {
      await deps.createReadInfo(data);
    }
    return c.json({}, 200);
  });

  // Tandai semua dibaca: every post of the member's own feed, never anyone else's read marks.
  infoRouter.openapi(postReadAllInfoRoute, async (c) => {
    const { id, angkatan } = c.var.user;
    const marked = await deps.markAllInfosRead(id, angkatan);
    return c.json({ marked }, 200);
  });

  infoRouter.openapi(createInfoRoute, async (c) => {
    const {
      mediaUrls,
      forAngkatan,
      forCategories,
      forCourses,
      forGroups,
      ...data
    } = c.req.valid('json');
    const { id } = c.var.user;

    const roles = await deps.getUserRoles(id);
    // A post aimed at groups reaches only the author's own groups, as the composer offers them (`GET /auth/groups`);
    // admin may aim at any.
    if (
      forGroups?.length &&
      !roles.includes('admin') &&
      forGroups.some((group) => !(roles as string[]).includes(group))
    ) {
      return c.json({ error: 'You may not post to this group' }, 403);
    }

    const categoryCheck = checkPostCategories(
      roles,
      forCategories,
      await deps.getCategoriesByIds(forCategories),
    );
    if (!categoryCheck.ok) {
      return categoryCheck.reason === 'unknown'
        ? c.json({ error: 'Unknown category' }, 400)
        : c.json({ error: 'You may not post in this category' }, 403);
    }

    try {
      const info = await deps.createInfo(
        { ...data, creatorId: id },
        mediaUrls,
        forAngkatan,
        forCategories,
        forCourses,
        forGroups,
      );

      runInBackground(
        'New post push',
        deps.notifyNewInfo(
          info,
          mediaUrls,
          forAngkatan,
          forCategories,
          forCourses,
          forGroups,
        ),
      );

      return c.json(info, 201);
    } catch (err) {
      if (err instanceof postgres.PostgresError)
        return c.json(databaseError(err), 400);
      throw err;
    }
  });

  infoRouter.openapi(deleteInfoRoute, async (c) => {
    const { id: userId } = c.var.user;
    const { infoId } = c.req.valid('param');

    const info = await deps.getInfoCreatorId(infoId);
    if (!info) {
      return c.json({ error: 'Info not found' }, 404);
    }

    const roles = await deps.getUserRoles(userId);
    if (!canDeleteContent({ id: userId, roles }, info.creatorId)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const deleted = await deps.deleteInfo(infoId);
    if (!deleted) {
      return c.json({ error: 'Info not found' }, 404);
    }
    return c.json({}, 200);
  });

  infoRouter.openapi(getListInfoRoute, async (c) => {
    const infos = await deps.getListInfos(
      c.req.valid('query'),
      c.var.user.id,
      c.var.user.angkatan,
    );
    return c.json(
      {
        infos: infos.map(withAuthor),
      },
      200,
    );
  });

  infoRouter.openapi(getInfoByIdRoute, async (c) => {
    const { infoId } = c.req.valid('param');
    const info = await deps.getInfoById(
      infoId,
      c.var.user.id,
      c.var.user.angkatan,
    );
    if (!info) {
      return c.json({ error: 'Info not found' }, 404);
    }
    return c.json(withAuthor(info), 200);
  });

  infoRouter.openapi(postRenotifyInfoRoute, async (c) => {
    const { id: userId } = c.var.user;
    const { infoId } = c.req.valid('param');

    const info = await deps.getInfoById(infoId, userId, c.var.user.angkatan);
    if (info?.creatorId !== userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!info.canNotify) {
      return c.json({ error: 'Info cannot be notified' }, 400);
    }

    // Claimed before answering, sent after: a double click or a retry sends the push once, and a slow push service
    // doesn't hold the request open.
    if (!(await deps.claimRenotify(info.id, userId))) {
      return c.json({ error: 'Info cannot be notified' }, 400);
    }
    runInBackground('Re-sent post push', deps.renotifyInfo(info));

    return c.json({}, 200);
  });

  return infoRouter;
}

export const infoRouter = createInfoRouter();
