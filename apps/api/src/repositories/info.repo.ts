import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  InferInsertModel,
  lte,
  notInArray,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import { z } from 'zod';
import { Database } from '~/db/drizzle';
import { first, firstSure } from '~/db/helper';
import { rolesEnums, rolesGroup } from '~/db/roles-group';
import {
  angkatan,
  categories,
  comments,
  Info,
  infoAngkatan,
  infoCategories,
  infoCourses,
  infoGroups,
  infoMedias,
  infos,
  userCourses,
  userReadInfos,
  userRoles,
  UserRolesEnum,
  users,
  userUnsubscribeCategories,
} from '~/db/schema';
import { sendNotificationToAll } from '~/lib/push-manager';
import { prefixTsQuery } from '~/lib/search';
import { getCurrentSemesterCodeAndYear } from '~/repositories/course.repo';
import {
  getPushSubscriptionsByUserIds,
  removeFailedPushSubscriptions,
} from '~/repositories/push.repo';
import {
  CreateInfoBodySchema,
  InfoSchema,
  ListInfoParamsSchema,
} from '~/types/info.types';
import { createMediasFromUrl } from './media.repo';
import { getReactions } from './reaction.repo';
import { getUserRoles } from './user-role.repo';
import { env } from '~/configs/env.config';
import { canRenotify, DEFAULT_RENOTIFY_HOURS } from '~/lib/renotify';
import { AUTHOR_COLUMNS } from '~/lib/author';

const INFOS_PER_PAGE = 10;

/**
 * What a post comes with, in the feed and on its own page. The author is cut to `AUTHOR_COLUMNS` in the query
 * itself, so other members' private fields are never even read.
 */
export function infoRelations(userId: string) {
  return {
    infoMedias: {
      with: {
        media: true,
      },
      orderBy: asc(infoMedias.order),
    },
    infoCategories: {
      with: {
        category: true,
      },
    },
    infoCourses: {
      with: {
        course: true,
      },
    },
    infoAngkatan: {
      with: {
        angkatan: true,
      },
    },
    infoGroups: {
      columns: {
        role: true,
      },
    },
    creator: { columns: AUTHOR_COLUMNS },
    userReadInfos: {
      where: eq(userReadInfos.userId, userId),
      limit: 1,
    },
  } as const;
}

export async function createInfo(
  db: Database,
  data: Omit<
    InferInsertModel<typeof infos>,
    'createdAt' | 'isForAngkatan' | 'isForGroups'
  >,
  mediaUrls: z.infer<typeof CreateInfoBodySchema.shape.mediaUrls>,
  forAngkatan: z.infer<typeof CreateInfoBodySchema.shape.forAngkatan>,
  forCategories: z.infer<typeof CreateInfoBodySchema.shape.forCategories>,
  forCourses: z.infer<typeof CreateInfoBodySchema.shape.forCourses>,
  forGroups: z.infer<typeof CreateInfoBodySchema.shape.forGroups>,
) {
  // Who may post in each category is checked before this (checkPostCategories in the controller).
  // Any error rolls the whole transaction back.
  return await db.transaction(async (tx) => {
    const isForAngkatan = forAngkatan !== undefined && forAngkatan.length > 0;
    const isForCourses =
      !isForAngkatan && forCourses !== undefined && forCourses.length > 0;
    const isForGroups =
      !isForCourses && forGroups !== undefined && forGroups.length > 0;
    const newInfo = await tx
      .insert(infos)
      .values({
        ...data,
        isForAngkatan,
        isForGroups,
      })
      .returning()
      .then(firstSure);

    await createInfoCategory(
      tx,
      forCategories.map((categoryId) => ({
        infoId: newInfo.id,
        categoryId,
      })),
    );

    if (mediaUrls && mediaUrls.length > 0) {
      const newMedias = await createMediasFromUrl(
        tx,
        mediaUrls,
        newInfo.creatorId,
      );

      await createInfoMedia(
        tx,
        newMedias.map((media, idx) => ({
          infoId: newInfo.id,
          mediaId: media.id,
          order: idx,
        })),
      );
    }

    if (forAngkatan && forAngkatan.length > 0) {
      await createInfoAngkatan(
        tx,
        forAngkatan.map((angkatanId) => ({
          infoId: newInfo.id,
          angkatanId,
        })),
      );
    } else if (forCourses && forCourses.length > 0) {
      await createInfoCourses(
        tx,
        forCourses.map((course) => ({
          infoId: newInfo.id,
          courseId: course.courseId,
          class: course.class,
        })),
      );
    } else if (forGroups && forGroups.length > 0) {
      // A post is for courses or for groups, never both; every group must be a real role.
      if (
        forGroups.some((role) => !rolesEnums.includes(role as UserRolesEnum))
      ) {
        throw new Error('Invalid role');
      }
      await createInfoGroups(
        tx,
        forGroups.map((role) => ({
          infoId: newInfo.id,
          role: role as UserRolesEnum,
        })),
      );
    }

    return newInfo;
  });
}

const createInfoCategory = async (
  db: Database,
  data: Array<InferInsertModel<typeof infoCategories>>,
) => {
  return await db
    .insert(infoCategories)
    .values(data)
    .returning()
    .then(firstSure);
};

const createInfoMedia = async (
  db: Database,
  data: Array<Omit<InferInsertModel<typeof infoMedias>, 'createdAt'>>,
) => {
  return await db.insert(infoMedias).values(data).returning();
};

const createInfoAngkatan = async (
  db: Database,
  data: Array<InferInsertModel<typeof infoAngkatan>>,
) => {
  return await db.insert(infoAngkatan).values(data).returning();
};

const createInfoCourses = async (
  db: Database,
  data: Array<InferInsertModel<typeof infoCourses>>,
) => {
  return await db.insert(infoCourses).values(data).returning();
};

const createInfoGroups = async (
  db: Database,
  data: Array<InferInsertModel<typeof infoGroups>>,
) => {
  return await db.insert(infoGroups).values(data).returning();
};

export async function createReadInfo(
  db: Database,
  data: Omit<InferInsertModel<typeof userReadInfos>, 'createdAt'>,
) {
  return await db
    .insert(userReadInfos)
    .values(data)
    .onConflictDoNothing()
    .returning()
    .then(firstSure);
}

export async function deleteReadInfo(
  db: Database,
  data: { userId: string; infoId: string },
) {
  return await db
    .delete(userReadInfos)
    .where(
      and(
        eq(userReadInfos.userId, data.userId),
        eq(userReadInfos.infoId, data.infoId),
      ),
    )
    .returning()
    .then(first);
}

export async function deleteInfo(db: Database, id: string) {
  return await db.delete(infos).where(eq(infos.id, id)).returning().then(first);
}

export async function getInfoCreatorId(db: Database, id: string) {
  return await db
    .select({ creatorId: infos.creatorId })
    .from(infos)
    .where(eq(infos.id, id))
    .then(first);
}

export async function getListInfos(
  db: Database,
  q: z.infer<typeof ListInfoParamsSchema>,
  userId: string,
  angkatanYear?: number,
): Promise<Array<z.infer<typeof InfoSchema>>> {
  q.search = q.search?.trim();
  const searchPhrase = q.search ? prefixTsQuery(q.search) : undefined;
  const searchQ =
    searchPhrase === undefined
      ? undefined
      : searchPhrase === null
        ? sql`false`
        : sql`(setweight(to_tsvector('indonesian', ${infos.title}), 'A') || setweight(to_tsvector('indonesian', ${infos.content}), 'B')) @@ to_tsquery('indonesian', ${searchPhrase})`;
  let unreadQ: SQL<unknown> | undefined;
  let excludeCategoryQ: SQL<unknown> | undefined;

  if (q.unread === 'true') {
    const getReadInfosByUser = db
      .select({ infoId: userReadInfos.infoId })
      .from(userReadInfos)
      .where(eq(userReadInfos.userId, userId));
    unreadQ = notInArray(infos.id, getReadInfosByUser);
  }

  if (q.excludeCategory && q.excludeCategory.length > 0) {
    // `any`: the query is built up in steps below, which changes its builder type.
    let getInfosToExclude: any = db
      .select({ infoId: infoCategories.infoId })
      .from(infos)
      .innerJoin(infoCategories, eq(infoCategories.infoId, infos.id))
      .innerJoin(categories, eq(infoCategories.categoryId, categories.id));

    if (typeof q.excludeCategory === 'string') {
      getInfosToExclude = getInfosToExclude.where(
        eq(categories.name, q.excludeCategory),
      );
    } else {
      getInfosToExclude = getInfosToExclude.where(
        inArray(categories.name, q.excludeCategory),
      );
    }

    excludeCategoryQ = notInArray(infos.id, getInfosToExclude);
  }

  const where = and(
    searchQ,
    excludeCategoryQ,
    unreadQ,
    await getFeedAudienceQuery(db, userId, angkatanYear),
  );

  const listInfo = await db.query.infos.findMany({
    where,
    limit: INFOS_PER_PAGE,
    offset: q.offset,
    orderBy: q.sort === 'oldest' ? asc(infos.createdAt) : desc(infos.createdAt),
    with: infoRelations(userId),
  });

  if (listInfo.length === 0) return [];

  const infoIds = listInfo.map((info) => info.id);
  const reactions = await getReactions(db, { infoIds }, userId);

  const commentsCount = await db
    .select({ count: count(comments.id), infoId: comments.repliedInfoId })
    .from(comments)
    .where(inArray(comments.repliedInfoId, infoIds))
    .groupBy(comments.repliedInfoId);

  return await Promise.all(
    listInfo.map(async (info) => {
      return {
        ...info,
        reactions: reactions[info.id],
        comments: commentsCount.find((c) => c.infoId === info.id)?.count ?? 0,
        isRead: info.userReadInfos.length > 0,
        userReadInfos: undefined,
        infoGroups: info.infoGroups.map((group) => ({
          role: group.role,
          group: rolesGroup[group.role],
        })),
        canNotify: canNotify(info),
      };
    }),
  );
}

/**
 * The posts the feed shows a member, whatever its search and filters: those for their groups and, when they have an
 * angkatan, for it. The feed and Tandai semua dibaca share it, so marking everything read never reaches a post the
 * member can't see.
 */
async function getFeedAudienceQuery(
  db: Database,
  userId: string,
  angkatanYear: number | undefined,
) {
  const userRoles = await getUserRoles(db, userId);
  return and(
    angkatanYear === undefined
      ? undefined
      : getInfoAngkatanQuery(db, userId, angkatanYear),
    getInfoGroupQuery(db, userRoles),
  );
}

/**
 * Tandai semua dibaca marks read, for the member, every post their feed shows, in one statement.
 * Posts already read stay as they were. Returns how many were marked now.
 */
export async function markAllInfosRead(
  db: Database,
  userId: string,
  angkatanYear: number | undefined,
): Promise<number> {
  const audience = await getFeedAudienceQuery(db, userId, angkatanYear);
  const rows = await db.execute(
    sql`insert into ${userReadInfos} (${sql.identifier(userReadInfos.userId.name)}, ${sql.identifier(userReadInfos.infoId.name)})
      select ${userId}, ${infos.id} from ${infos} ${audience ? sql`where ${audience}` : sql``}
      on conflict do nothing
      returning 1`,
  );
  return rows.length;
}

/**
 * The posts `userId` may open: the same audience as the feed, its groups and its angkatan (a post for other angkatan
 * must not open by its link, since the composer says only they can see it).
 */
async function infoAudience(
  db: Database,
  userId: string,
  angkatanYear: number | undefined,
) {
  const userRoles = await getUserRoles(db, userId);
  return and(
    getInfoGroupQuery(db, userRoles),
    getInfoAngkatanQuery(db, userId, angkatanYear),
  );
}

/** Whether `userId` may open the post `infoId` (as `getInfoById`): its comments and reactions follow it. */
export async function canSeeInfo(
  db: Database,
  infoId: string,
  userId: string,
  angkatanYear: number | undefined,
) {
  const row = await db
    .select({ id: infos.id })
    .from(infos)
    .where(
      and(eq(infos.id, infoId), await infoAudience(db, userId, angkatanYear)),
    )
    .then(first);
  return row !== undefined;
}

export async function getInfoById(
  db: Database,
  id: string,
  userId: string,
  angkatanYear: number | undefined,
) {
  const info = await db.query.infos.findFirst({
    where: and(eq(infos.id, id), await infoAudience(db, userId, angkatanYear)),
    with: infoRelations(userId),
  });

  const commentsCount = await db
    .select({ count: count(comments.id) })
    .from(comments)
    .where(eq(comments.repliedInfoId, id))
    .then(firstSure);

  if (!info) return info;

  const reactions = await getReactions(db, { infoIds: [info.id] }, userId);
  return {
    ...info,
    reactions: reactions[info.id],
    comments: commentsCount.count,
    userReadInfos: undefined,
    isRead: info.userReadInfos.length > 0,
    infoGroups: info.infoGroups.map((group) => ({
      role: group.role,
      group: rolesGroup[group.role],
    })),
    canNotify: canNotify(info),
  };
}

export async function notifyNewInfo(
  db: Database,
  info: Info,
  mediaUrls: z.infer<typeof CreateInfoBodySchema.shape.mediaUrls>,
  forAngkatan: z.infer<typeof CreateInfoBodySchema.shape.forAngkatan>,
  forCategories: z.infer<typeof CreateInfoBodySchema.shape.forCategories>,
  forCourses: z.infer<typeof CreateInfoBodySchema.shape.forCourses>,
  forGroups: z.infer<typeof CreateInfoBodySchema.shape.forGroups>,
) {
  let receivers: string[] = [];

  if (forCategories.length === 0 && (!forCourses || forCourses.length === 0)) {
    return;
  }

  const unsubs = await db
    .select({
      userId: userUnsubscribeCategories.userId,
    })
    .from(userUnsubscribeCategories)
    .where(inArray(userUnsubscribeCategories.categoryId, forCategories))
    .groupBy(userUnsubscribeCategories.userId)
    .having(
      eq(count(userUnsubscribeCategories.categoryId), forCategories.length),
    )
    .then((res) => res.map((r) => r.userId));

  if (forCourses && forCourses.length > 0) {
    const { semesterCodeTaken, semesterYearTaken } =
      getCurrentSemesterCodeAndYear();
    receivers = await db
      .select({ userId: userCourses.userId })
      .from(userCourses)
      .where(
        and(
          or(
            inArray(
              userCourses.courseId,
              forCourses
                .filter((c) => c.class === undefined)
                .map((c) => c.courseId),
            ),
            ...forCourses
              .filter((c) => c.class !== undefined)
              .map((c) =>
                and(
                  eq(userCourses.courseId, c.courseId),
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- the filter above drops courses with no class
                  eq(userCourses.class, c.class!),
                ),
              ),
          ),
          eq(userCourses.semesterCodeTaken, semesterCodeTaken),
          eq(userCourses.semesterYearTaken, semesterYearTaken),
        ),
      )
      .then((res) => res.map((r) => r.userId));
  } else if (forAngkatan && forAngkatan.length > 0) {
    receivers = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(angkatan, eq(users.angkatan, angkatan.year))
      .where(inArray(angkatan.id, forAngkatan))
      .then((res) => res.map((r) => r.userId));
  } else if (forGroups && forGroups.length > 0) {
    receivers = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(inArray(userRoles.role, forGroups as UserRolesEnum[]))
      .then((res) => res.map((r) => r.userId));
  } else {
    receivers = await db
      .selectDistinct({ userId: users.id })
      .from(users)
      .then((res) => res.map((r) => r.userId));
  }

  const receiversSet = new Set(receivers);

  unsubs.forEach((userId) => receiversSet.delete(userId));

  const subscriptions = await getPushSubscriptionsByUserIds(
    db,
    Array.from(receiversSet),
  );

  if (subscriptions.length === 0) {
    return;
  }

  await sendNotificationToAll(
    subscriptions,
    {
      title: info.title,
      options: {
        body: info.content,
        data: {
          url: `/timeline/${info.id}`,
        },
      },
    },
    {
      urgency: 'high',
    },
  ).then(async (results) => {
    await removeFailedPushSubscriptions(db, results);
  });
}

/**
 * Claims a re-send (Umumkan ulang) for the post's author: moves `lastNotifiedAt` to now only if the post is still
 * open to re-send (`canNotify`'s rule), in one statement, so of two requests at once (a double click, a retry) only
 * one wins. True when this request claimed it.
 */
export async function claimRenotify(
  db: Database,
  infoId: string,
  creatorId: string,
  now: number = Date.now(),
  hours: number = env.RENOTIFY_DIFF_HOURS ?? DEFAULT_RENOTIFY_HOURS,
): Promise<boolean> {
  const claimed = await db
    .update(infos)
    .set({ lastNotifiedAt: new Date(now) })
    .where(
      and(
        eq(infos.id, infoId),
        eq(infos.creatorId, creatorId),
        lte(infos.lastNotifiedAt, new Date(now - hours * 60 * 60 * 1000)),
      ),
    )
    .returning({ id: infos.id });
  return claimed.length > 0;
}

/**
 * Pushes a post again to its subscribed members. It doesn't check whether the post may be re-sent: claim it first
 * (`claimRenotify`).
 */
export async function renotifyInfo(
  db: Database,
  info: z.infer<typeof InfoSchema>,
) {
  await notifyNewInfo(
    db,
    info as Info,
    info.infoMedias?.map((m) => m.media.url),
    info.infoAngkatan?.map((a) => a.angkatan.id),
    info.infoCategories?.map((c) => c.category.id) ?? [],
    info.infoCourses?.map((c) => ({
      courseId: c.course.id,
      class: c.class ?? undefined,
    })),
    info.infoGroups?.map((g) => g.role),
  );
}

/** A post for angkatan is for those angkatan and its author; with no angkatan of their own, only its author sees it. */
function getInfoAngkatanQuery(
  db: Database,
  userId: string,
  angkatanYear: number | undefined,
) {
  return or(
    eq(infos.isForAngkatan, false),
    eq(infos.creatorId, userId),
    angkatanYear === undefined
      ? undefined
      : exists(
          db
            .select({ infoId: infoAngkatan.infoId })
            .from(infoAngkatan)
            .innerJoin(angkatan, eq(angkatan.id, infoAngkatan.angkatanId))
            .where(
              and(
                eq(angkatan.year, angkatanYear),
                eq(infoAngkatan.infoId, infos.id),
              ),
            ),
        ),
  );
}

function getInfoGroupQuery(db: Database, userRoles: UserRolesEnum[]) {
  return or(
    eq(infos.isForGroups, false),
    userRoles.length === 0
      ? undefined
      : exists(
          db
            .select({ infoId: infoGroups.infoId })
            .from(infoGroups)
            .where(
              and(
                eq(infoGroups.infoId, infos.id),
                inArray(infoGroups.role, userRoles),
              ),
            ),
        ),
  );
}

/** Whether the info's author may push it again now (src/lib/renotify.ts). */
export function canNotify(info: Pick<Info, 'lastNotifiedAt'>): boolean {
  return canRenotify(
    info.lastNotifiedAt,
    Date.now(),
    env.RENOTIFY_DIFF_HOURS ?? DEFAULT_RENOTIFY_HOURS,
  );
}
