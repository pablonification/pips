import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { Database } from '~/db/drizzle';
import {
  chatroomMessageReads,
  chatroomMessages,
  chatrooms,
  userPinnedChatrooms,
  Chatroom,
  ChatroomMessage,
  UserPinnedChatrooms,
  users,
} from '~/db/schema';
import { TChatroom } from '~/types/curhat.types';
import { canCreateChatroom } from '~/lib/curhat';
import { getUsersByRole } from './user-role.repo';

type ChatroomWithMessages = Chatroom & {
  messages: ChatroomMessage[];
};
function processChatrooms(
  crms: ChatroomWithMessages[],
  pinned: UserPinnedChatrooms[],
) {
  const chatroomMap = new Map<string, TChatroom>();

  crms
    .map((chatroom) => {
      const messages = chatroom.messages ?? [];
      const messageMap = new Map(messages.map((msg) => [msg.id, msg]));

      return {
        ...chatroom,
        messages: messages
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((message) => {
            const reply = message.replyId
              ? (messageMap.get(message.replyId) ?? null)
              : null;
            if (reply) {
              const { userId, ...replyWithoutUserId } = reply;
              return {
                ...message,
                reply: replyWithoutUserId,
              };
            }
            return {
              ...message,
              reply: undefined,
            };
          }),
        isPinned: pinned.some((p) => p.chatroomId === chatroom.id),
      };
    })
    .forEach((chatroom) => chatroomMap.set(chatroom.id, chatroom));

  return chatroomMap;
}

export async function getUserChatrooms(db: Database, userId: string) {
  const crms = await db.query.chatrooms.findMany({
    where: eq(chatrooms.userId, userId),
    with: {
      messages: true,
    },
  });
  return processChatrooms(crms, []);
}

export async function getWelfareChatrooms(db: Database, userId: string) {
  const [crms, pinned] = await Promise.all([
    db.query.chatrooms.findMany({
      with: {
        messages: true,
      },
    }),
    db.query.userPinnedChatrooms.findMany({
      where: eq(userPinnedChatrooms.userId, userId),
    }),
  ]);

  return processChatrooms(crms, pinned);
}

export interface NewChatroomMessage {
  userId: string;
  chatroomId: string;
  content: string;
  replyId: string | null;
  /** The sender's device id for the message (P2-C); null from older clients. */
  clientMessageId: string | null;
}

/**
 * The insert behind `saveMessage`: a message whose `clientMessageId` the room already has is skipped
 * (`chatroom_messages_client_message_idx`, unique on room and device id; NULLs never conflict). Exported for its SQL.
 */
export function insertMessageQuery(db: Database, message: NewChatroomMessage) {
  return db
    .insert(chatroomMessages)
    .values(message)
    .onConflictDoNothing({
      target: [chatroomMessages.chatroomId, chatroomMessages.clientMessageId],
    })
    .returning();
}

/**
 * Saves a message once per device id (P2-C): a resend with a `clientMessageId` the room already has saves nothing
 * and gives back the message saved the first time, with `created: false`. Two sends racing with the same id are
 * settled by the unique index: the second waits for the first, skips, then reads it.
 */
export async function saveMessage(
  db: Database,
  message: NewChatroomMessage,
): Promise<{ message: ChatroomMessage; created: boolean }> {
  const [inserted] = await insertMessageQuery(db, message);
  if (inserted) return { message: inserted, created: true };
  const existing = await db.query.chatroomMessages.findFirst({
    where: and(
      eq(chatroomMessages.chatroomId, message.chatroomId),
      eq(chatroomMessages.clientMessageId, message.clientMessageId ?? ''),
    ),
  });
  if (!existing) throw new Error('A skipped message was not found');
  return { message: existing, created: false };
}

export async function getChatroomById(db: Database, chatroomId: string) {
  return await db.query.chatrooms.findFirst({
    where: eq(chatrooms.id, chatroomId),
    with: {
      messages: true,
    },
  });
}

/** A room's id and owner: what the access check needs, without its messages. */
export async function getChatroomOwner(db: Database, chatroomId: string) {
  return await db.query.chatrooms.findFirst({
    columns: { id: true, userId: true },
    where: eq(chatrooms.id, chatroomId),
  });
}

export async function getOwnedChatroomIds(db: Database, userId: string) {
  const rows = await db
    .select({ id: chatrooms.id })
    .from(chatrooms)
    .where(eq(chatrooms.userId, userId));
  return rows.map((r) => r.id);
}

/**
 * Locks the member's row until the transaction ends, so two room creates for the same member run one after the
 * other: the second waits, then counts the first one's room.
 */
export function lockMemberQuery(userId: string) {
  return sql`select ${users.id} from ${users} where ${users.id} = ${userId} for update`;
}

/**
 * Creates a room for `data.userId` unless they already have the most rooms allowed; answers `null` then. The
 * count and the insert run in one transaction behind a lock on the member's row, so parallel requests can't all
 * see the same count and slip past the limit (C4).
 */
export async function createChatroomWithinLimit(
  db: Database,
  data: { title: string; userId: string },
) {
  return await db.transaction(async (tx) => {
    await tx.execute(lockMemberQuery(data.userId));
    const [row] = await tx
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(chatrooms)
      .where(eq(chatrooms.userId, data.userId));
    if (!canCreateChatroom(Number(row?.count ?? 0))) return null;
    const [room] = await tx.insert(chatrooms).values(data).returning();
    return room;
  });
}

export async function getChatroomMessageById(db: Database, messageId: string) {
  return await db.query.chatroomMessages.findFirst({
    where: eq(chatroomMessages.id, messageId),
  });
}

export async function deleteChatroom(db: Database, chatroomId: string) {
  return await db.transaction(async (tx) => {
    return await tx.delete(chatrooms).where(eq(chatrooms.id, chatroomId));
  });
}

/**
 * Unread messages per room for `userId`, counted in one statement: the member's own rooms (every room when
 * `everyRoom`, for Welfare), only messages they didn't send, and only those without their read mark. Rooms with
 * nothing unread are left out. The same rule as `countUnread` in `src/lib/curhat.ts`.
 */
export function unreadCountsQuery(
  db: Database,
  userId: string,
  everyRoom: boolean,
) {
  return db
    .select({
      chatroomId: chatroomMessages.chatroomId,
      unreadCount: sql<number>`cast(count(*) as int)`,
    })
    .from(chatroomMessages)
    .innerJoin(chatrooms, eq(chatrooms.id, chatroomMessages.chatroomId))
    .leftJoin(
      chatroomMessageReads,
      and(
        eq(chatroomMessageReads.chatroomMessageId, chatroomMessages.id),
        eq(chatroomMessageReads.userId, userId),
      ),
    )
    .where(
      and(
        everyRoom ? undefined : eq(chatrooms.userId, userId),
        ne(chatroomMessages.userId, userId),
        isNull(chatroomMessageReads.userId),
      ),
    )
    .groupBy(chatroomMessages.chatroomId);
}

export async function getUnreadCounts(
  db: Database,
  userId: string,
  everyRoom: boolean,
) {
  return await unreadCountsQuery(db, userId, everyRoom);
}

/**
 * Marks every message in the room that `userId` didn't send as read by them. Safe to repeat: a message already
 * marked is left alone (`on conflict do nothing` on the (user, message) key).
 */
export function markChatroomReadQuery(chatroomId: string, userId: string) {
  return sql`insert into ${chatroomMessageReads} (user_id, chatroom_message_id)
    select ${userId}, ${chatroomMessages.id} from ${chatroomMessages}
    where ${chatroomMessages.chatroomId} = ${chatroomId} and ${chatroomMessages.userId} <> ${userId}
    on conflict do nothing`;
}

export async function markChatroomRead(
  db: Database,
  chatroomId: string,
  userId: string,
) {
  await db.execute(markChatroomReadQuery(chatroomId, userId));
}

export async function pinChatroom(
  db: Database,
  chatroomId: string,
  userId: string,
  isPinned: boolean,
) {
  await db.transaction(async (tx) => {
    if (isPinned) {
      return await tx
        .insert(userPinnedChatrooms)
        .values({ userId, chatroomId });
    } else {
      return await tx
        .delete(userPinnedChatrooms)
        .where(
          and(
            eq(userPinnedChatrooms.chatroomId, chatroomId),
            eq(userPinnedChatrooms.userId, userId),
          ),
        );
    }
  });
}

/**
 * Get the ids of all curhat admin and the user who created the chatroom
 */
export async function getChatroomParticipantIds(
  db: Database,
  chatroomId: string,
) {
  const chatroomPromise = getChatroomById(db, chatroomId);
  const adminUsersPromise = getUsersByRole(db, 'curhatadmin');

  const [chatroom, adminUsers] = await Promise.all([
    chatroomPromise,
    adminUsersPromise,
  ]);

  if (!chatroom) {
    return [];
  }

  return [chatroom.userId, ...adminUsers.map((u) => u.id)].filter(
    (id): id is string => id !== null,
  );
}
