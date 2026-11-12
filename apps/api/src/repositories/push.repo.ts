import {
  and,
  desc,
  eq,
  inArray,
  InferInsertModel,
  isNotNull,
  notInArray,
  sql,
} from 'drizzle-orm';
import { Database } from '~/db/drizzle';
import { first, firstSure } from '~/db/helper';
import { PushSubscription, pushSubscriptions } from '~/db/schema';
import { sendNotificationToAll } from '~/lib/push-manager';

/** The most devices one member keeps; the most any real member had was 13. */
export const MAX_DEVICES_PER_MEMBER = 20;

/**
 * Create a push subscription. If subscription endpoint exist, update the existing subscription, as just registered.
 * Past `MAX_DEVICES_PER_MEMBER`, the member's least recently registered devices are removed.
 */
export async function createOrUpdatePushSubscription(
  db: Database,
  data: Omit<InferInsertModel<typeof pushSubscriptions>, 'createdAt'>,
) {
  return await db.transaction(async (tx) => {
    const row = await tx
      .insert(pushSubscriptions)
      .values(data)
      .onConflictDoUpdate({
        set: { ...data, createdAt: sql`now()` },
        target: [pushSubscriptions.endpoint],
      })
      .returning()
      .then(firstSure);
    if (data.userId) {
      const kept = tx
        .select({ endpoint: pushSubscriptions.endpoint })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, data.userId))
        .orderBy(
          desc(pushSubscriptions.createdAt),
          desc(pushSubscriptions.endpoint),
        )
        .limit(MAX_DEVICES_PER_MEMBER);
      await tx
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, data.userId),
            notInArray(pushSubscriptions.endpoint, kept),
          ),
        );
    }
    return row;
  });
}

export async function getPushSubscriptionsByUserIds(
  db: Database,
  userIds: string[],
) {
  if (userIds.length === 0) {
    return [];
  }

  return await db.query.pushSubscriptions.findMany({
    where: inArray(pushSubscriptions.userId, userIds),
  });
}

/**
 * The endpoints a push service says are gone: 410 (expired or unsubscribed) or 404 (unknown). Timeouts and other
 * failures aren't proof, so those subscriptions stay.
 */
export function goneEndpoints(
  results: Awaited<ReturnType<typeof sendNotificationToAll>>,
): string[] {
  const gone: string[] = [];
  for (const result of results) {
    if (
      result.status === 'fulfilled' &&
      !result.value.success &&
      (result.value.error.statusCode === 410 ||
        result.value.error.statusCode === 404)
    ) {
      gone.push(result.value.endpoint);
    }
  }
  return gone;
}

/**
 * Remove push subscriptions that are gone (`goneEndpoints`).
 * @param db
 * @param results results from sendNotificationToAll
 * @returns
 */
export async function removeFailedPushSubscriptions(
  db: Database,
  results: Awaited<ReturnType<typeof sendNotificationToAll>>,
) {
  const failedSubscriptions = goneEndpoints(results);

  if (failedSubscriptions.length === 0) {
    return;
  }

  await db
    .delete(pushSubscriptions)
    .where(inArray(pushSubscriptions.endpoint, failedSubscriptions));
}

export async function getAllPushSubscriptions(db: Database) {
  return await db.query.pushSubscriptions.findMany({
    where: isNotNull(pushSubscriptions.userId),
  });
}

export function toPushSubscriptionsHash(subscriptions: PushSubscription[]) {
  const result: Record<string, PushSubscription[]> = {};

  subscriptions.forEach((subscription) => {
    if (subscription.userId) {
      const array = result[subscription.userId] ?? [];

      array.push(subscription);

      result[subscription.userId] = array;
    }
  });

  return result;
}

export async function putLogoutPushSubscriptions(
  db: Database,
  data: { endpoint: string },
) {
  return await db
    .update(pushSubscriptions)
    .set({
      userId: null,
    })
    .where(eq(pushSubscriptions.endpoint, data.endpoint))
    .returning()
    .then(first);
}
