import { and, eq, inArray, InferInsertModel, sql } from 'drizzle-orm';
import { Database } from '~/db/drizzle';
import {
  chatroomMessageReads,
  chatroomMessages,
  chatrooms,
  userPinnedChatrooms,
  Chatroom,
  ChatroomMessage,
  UserPinnedChatrooms,
} from '~/db/schema';
import { TChatroom } from '~/types/curhat.types';
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

export async function createChatroom(
  db: Database,
  data: InferInsertModel<typeof chatrooms>,
) {
  return await db.transaction(async (tx) => {
    return await tx.insert(chatrooms).values(data).returning();
  });
}

export async function saveMessage(
  db: Database,
  userId: string,
  chatroomId: string,
  message: string,
  replyId: string | null,
) {
  return await db.transaction(async (tx) => {
    return await tx
      .insert(chatroomMessages)
      .values({
        chatroomId,
        userId,
        content: message,
        replyId,
      })
      .returning();
  });
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

export async function countUserChatrooms(db: Database, userId: string) {
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(chatrooms)
    .where(eq(chatrooms.userId, userId));
  return Number(row?.count ?? 0);
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

/** The ids of the messages in these rooms that `userId` has marked read. */
export async function getReadMessageIds(
  db: Database,
  userId: string,
  chatroomIds: string[],
) {
  if (chatroomIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ id: chatroomMessageReads.chatroomMessageId })
    .from(chatroomMessageReads)
    .innerJoin(
      chatroomMessages,
      eq(chatroomMessages.id, chatroomMessageReads.chatroomMessageId),
    )
    .where(
      and(
        eq(chatroomMessageReads.userId, userId),
        inArray(chatroomMessages.chatroomId, chatroomIds),
      ),
    );
  return new Set(rows.map((r) => r.id));
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
