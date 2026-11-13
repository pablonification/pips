import { db } from '~/db/drizzle';
import { runInBackground } from '~/lib/background';
import { sendNotificationToAll } from '~/lib/push-manager';
import { forRoles } from '~/middlewares/role.middleware';
import {
  createOrUpdatePushSubscription,
  getAllPushSubscriptions,
  putLogoutPushSubscriptions,
  removeFailedPushSubscriptions,
} from '~/repositories/push.repo';
import { getUserRoles } from '~/repositories/user-role.repo';
import {
  pushBroadcastRoute,
  pushLogoutRoute,
  registerPushRoute,
} from '~/routes/push.route';
import { withDb, type WithoutDb } from './deps';
import { createAuthRouter, createRouter } from './router-factory';

export const pushPubRouter = createRouter();

/** Who may broadcast is read through `deps`, so the route tests run without a database. */
export interface PushDeps {
  getUserRoles: WithoutDb<typeof getUserRoles>;
}

export function createPushRouter(
  deps: PushDeps = { getUserRoles: withDb(getUserRoles) },
) {
  const pushRouter = createAuthRouter();

  pushRouter.openapi(registerPushRoute, async (c) => {
    await createOrUpdatePushSubscription(db, {
      ...c.req.valid('json'),
      userId: c.var.user.id,
    });

    return c.json({}, 201);
  });

  pushRouter.openapi(
    forRoles(pushBroadcastRoute, ['ring1'], deps.getUserRoles),
    async (c) => {
      const subscriptions = await getAllPushSubscriptions(db);
      runInBackground(
        'Broadcast push',
        sendNotificationToAll(subscriptions, c.req.valid('json')).then(
          async (results) => {
            await removeFailedPushSubscriptions(db, results);
          },
        ),
      );

      return c.json({}, 200);
    },
  );

  return pushRouter;
}

export const pushRouter = createPushRouter();

pushPubRouter.openapi(pushLogoutRoute, async (c) => {
  await putLogoutPushSubscriptions(db, {
    ...c.req.valid('json'),
  });

  return c.json({}, 200);
});
