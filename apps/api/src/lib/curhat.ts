import type { Chatroom, ChatroomMessage } from '~/db/schema';

/** A member may keep at most this many Curhat rooms at once. */
export const CURHAT_MAX_ROOMS = 3;

/** The role that reads and answers every room (HMIF Welfare). */
export const CURHAT_ADMIN_ROLE = 'curhatadmin';

/**
 * The socket.io room every Welfare socket of the Curhat area joins (P3-C), so a room a member starts later can be
 * joined by all of them at once (`socketsJoin`). Room ids are UUIDs, so it can't clash with one.
 */
export const CURHAT_WELFARE_ROOM = 'curhat:welfare';

/** Whether `roles` read and answer every room (Welfare). */
export function isCurhatAdmin(roles: readonly string[]): boolean {
  return roles.includes(CURHAT_ADMIN_ROLE);
}

/**
 * Who may read, join and post in a Curhat room: its owner, or anyone with `curhatadmin`. Used by the chat socket
 * (joining and every message), the read marks and the unread counts; P3-B's Welfare inbox reuses it.
 */
export function canAccessChatroom(
  user: { id: string },
  roles: readonly string[],
  room: Pick<Chatroom, 'userId'> | null | undefined,
): boolean {
  if (!room) return false;
  if (isCurhatAdmin(roles)) return true;
  return room.userId !== null && room.userId === user.id;
}

/** Whether a member who already has `roomCount` rooms may start another. */
export function canCreateChatroom(roomCount: number): boolean {
  return roomCount < CURHAT_MAX_ROOMS;
}

type StoredMessage = Pick<
  ChatroomMessage,
  'id' | 'chatroomId' | 'replyId' | 'content' | 'createdAt'
> & { userId?: string | null; clientMessageId?: string | null };

/** A message as it leaves the API: an allow-list, so the sender's id never does. */
export interface ChatroomMessageResponse {
  id: string;
  chatroomId: string;
  replyId: string | null;
  content: string;
  createdAt: Date;
  isSender?: boolean;
  /**
   * Whether the room's owner wrote it (P3-C, OPEN-QUESTIONS A7): Welfare tells the member's messages from a
   * teammate's. It says nothing about who anyone is.
   */
  fromOwner: boolean;
  /** The sender's device id for the message (P2-C), shown only to the sender; null for everyone else. */
  clientMessageId: string | null;
  reply?: Omit<
    ChatroomMessageResponse,
    'isSender' | 'reply' | 'clientMessageId' | 'fromOwner'
  >;
}

function messageFields(message: StoredMessage) {
  return {
    id: message.id,
    chatroomId: message.chatroomId,
    replyId: message.replyId ?? null,
    content: message.content,
    createdAt: message.createdAt,
  };
}

/**
 * Serialises a message of a room owned by `ownerId` for `viewerId`: `isSender` says whether they wrote it, and
 * `fromOwner` whether the room's owner did (P3-C); the quoted message comes without its sender. The device's id for
 * the message goes only to its sender, who matches it to what they sent (P2-C).
 */
export function toChatroomMessageResponse(
  message: StoredMessage & { reply?: StoredMessage | null },
  viewerId: string,
  ownerId: string | null | undefined,
): ChatroomMessageResponse {
  const isSender = message.userId === viewerId;
  const response: ChatroomMessageResponse = {
    ...messageFields(message),
    isSender,
    fromOwner: ownerId != null && message.userId === ownerId,
    clientMessageId: isSender ? (message.clientMessageId ?? null) : null,
  };
  if (message.reply) response.reply = messageFields(message.reply);
  return response;
}

interface RoomLabel {
  chatroomId: string;
  labelId: string;
  label: { id: string; title: string };
}

interface StoredRoom {
  id: string;
  title: string | null;
  userId?: string | null;
  messages?: Array<StoredMessage & { reply?: StoredMessage | null }>;
  labels?: RoomLabel[];
  isPinned?: boolean;
}

/** A room as it leaves the API: an allow-list, so its owner's id never does. Only the owner may delete it. */
export function toChatroomResponse(room: StoredRoom, viewerId: string) {
  const response: {
    id: string;
    title: string | null;
    messages?: ChatroomMessageResponse[];
    labels?: RoomLabel[];
    isPinned?: boolean;
    canDelete: boolean;
  } = {
    id: room.id,
    title: room.title,
    canDelete: room.userId != null && room.userId === viewerId,
  };
  if (room.messages) {
    response.messages = room.messages.map((m) =>
      toChatroomMessageResponse(m, viewerId, room.userId),
    );
  }
  if (room.labels) {
    response.labels = room.labels.map((l) => ({
      chatroomId: l.chatroomId,
      labelId: l.labelId,
      label: { id: l.label.id, title: l.label.title },
    }));
  }
  if (room.isPinned !== undefined) response.isPinned = room.isPinned;
  return response;
}

/**
 * Unread messages per room for `viewer`: only rooms they may access, only messages they didn't send, and only
 * those without a read mark. Rooms with nothing unread are left out, as the SQL `GROUP BY` did before.
 */
export function countUnread(
  rooms: ReadonlyArray<
    Pick<StoredRoom, 'id' | 'userId'> & {
      messages?: ReadonlyArray<{ id: string; userId?: string | null }>;
    }
  >,
  readMessageIds: ReadonlySet<string>,
  viewer: { id: string },
  roles: readonly string[],
): Array<{ chatroomId: string; unreadCount: number }> {
  const counts: Array<{ chatroomId: string; unreadCount: number }> = [];
  for (const room of rooms) {
    if (!canAccessChatroom(viewer, roles, { userId: room.userId ?? null }))
      continue;
    const unreadCount = (room.messages ?? []).filter(
      (m) => m.userId !== viewer.id && !readMessageIds.has(m.id),
    ).length;
    if (unreadCount > 0) counts.push({ chatroomId: room.id, unreadCount });
  }
  return counts;
}
