import type { Socket } from 'socket.io';
import type { ChatroomMessage } from '~/db/schema';
import {
  canAccessChatroom,
  CURHAT_WELFARE_ROOM,
  isCurhatAdmin,
  toChatroomMessageResponse,
  type ChatroomMessageResponse,
} from '~/lib/curhat';
import {
  CurhatJoinPayloadSchema,
  CurhatMessagePayloadSchema,
  type CurhatJoinAck,
  type CurhatMessageAck,
  type CurhatSocketError,
} from '~/types/curhat.types';
import { sessionExpired, type SocketSession } from './session';

/** What the chat socket needs from storage and push, passed in so tests run without a database. */
export interface CurhatSocketDeps {
  /** Read again on every access check, so a role taken away applies at once, not at the next connection. */
  getUserRoles: (userId: string) => Promise<string[]>;
  getChatroom: (
    chatroomId: string,
  ) => Promise<{ id: string; userId: string | null } | undefined>;
  getOwnedChatroomIds: (userId: string) => Promise<string[]>;
  /** Every room's id: a Welfare socket of the Curhat area joins them all (P3-C). */
  getAllChatroomIds: () => Promise<string[]>;
  getMessage: (messageId: string) => Promise<ChatroomMessage | undefined>;
  /**
   * Saves a message once per `clientMessageId` in its room: a repeat saves nothing and gives back the first copy with
   * `created: false` (`repositories/chatroom.repo.ts`).
   */
  saveMessage: (message: {
    userId: string;
    chatroomId: string;
    content: string;
    replyId: string | null;
    clientMessageId: string | null;
  }) => Promise<{ message: ChatroomMessage; created: boolean }>;
  /** Tells the room's other participants (owner and Welfare), never the sender. */
  notifyParticipants: (message: {
    chatroomId: string;
    senderId: string;
    content: string;
  }) => Promise<void>;
  onError?: (error: unknown) => void;
}

type Ack<T> = (answer: T) => void;

function ackOf<T>(ack: unknown): Ack<T> {
  return typeof ack === 'function' ? (ack as Ack<T>) : () => {};
}

const refuse = (error: CurhatSocketError) => ({ ok: false as const, error });

/** A message as JSON carries it on the socket (`CurhatSocketMessageSchema`). */
function onTheWire(message: ChatroomMessageResponse) {
  const { reply, ...fields } = message;
  return {
    ...fields,
    isSender: message.isSender === true,
    createdAt: message.createdAt.toISOString(),
    ...(reply
      ? { reply: { ...reply, createdAt: reply.createdAt.toISOString() } }
      : {}),
  };
}

/**
 * Curhat on one socket. The member is the signed-in session, never an id the client sends; every join and every
 * message checks `canAccessChatroom`. Old clients still work: a handshake `chatroomId` joins that room after the
 * check, and `message` without an acknowledgement callback is still saved and relayed. A `clientMessageId` (the
 * device's id for the message) makes sending it again safe: the repeat is answered with the copy already saved.
 *
 * Handlers are registered at once and wait for the session, so nothing sent right after connecting is lost.
 */
export function registerCurhatSocket(
  socket: Socket,
  session: Promise<SocketSession | null>,
  deps: CurhatSocketDeps,
) {
  /** The room, when `userId` may access it; its owner says whose messages are the member's (`fromOwner`). */
  async function accessibleRoom(userId: string, chatroomId: string) {
    const room = await deps.getChatroom(chatroomId);
    const roles = await deps.getUserRoles(userId);
    return canAccessChatroom({ id: userId }, roles, room) ? room : undefined;
  }

  async function mayAccess(userId: string, chatroomId: string) {
    return (await accessibleRoom(userId, chatroomId)) !== undefined;
  }

  /** The session, while its token is valid. Once it has expired the socket is cut off (`connection.ts` too). */
  async function liveSession() {
    const s = await session;
    if (!s) return null;
    if (sessionExpired(s)) {
      socket.disconnect(true);
      return null;
    }
    return s;
  }

  socket.on('message', async (payload: unknown, ack?: unknown) => {
    const answer = ackOf<CurhatMessageAck>(ack);
    try {
      answer(await receiveMessage(payload));
    } catch (error) {
      deps.onError?.(error);
      answer(refuse('server'));
    }
  });

  async function receiveMessage(payload: unknown): Promise<CurhatMessageAck> {
    const s = await liveSession();
    if (!s) return refuse('unauthorized');

    const parsed = CurhatMessagePayloadSchema.safeParse(payload);
    if (!parsed.success || parsed.data.message.trim() === '') {
      return refuse('invalid');
    }
    const { chatroomId, message: content } = parsed.data;
    const replyId = parsed.data.replyId ?? null;

    const room = await accessibleRoom(s.userId, chatroomId);
    if (!room) return refuse('forbidden');

    let quoted: ChatroomMessage | undefined;
    if (replyId) {
      quoted = await deps.getMessage(replyId);
      if (!quoted || quoted.chatroomId !== chatroomId) return refuse('invalid');
    }

    const { message: saved, created } = await deps.saveMessage({
      userId: s.userId,
      chatroomId,
      content,
      replyId,
      clientMessageId: parsed.data.clientMessageId ?? null,
    });

    if (!created) {
      // A resend after a lost acknowledgement (P2-C): answer with the copy saved the first time; it was relayed and
      // notified then. An id that is someone else's in this room is never answered with their message.
      if (saved.userId !== s.userId) return refuse('invalid');
      const firstQuote = saved.replyId
        ? await deps.getMessage(saved.replyId)
        : undefined;
      return {
        ok: true,
        message: onTheWire(
          toChatroomMessageResponse(
            { ...saved, reply: firstQuote ?? null },
            s.userId,
            room.userId,
          ),
        ),
      };
    }

    await socket.join(chatroomId);
    const receivers = await socket.nsp.in(chatroomId).fetchSockets();
    for (const receiver of receivers) {
      if (receiver.id === socket.id) continue;
      // `reply` keeps today's shape (no quoted message); `isSender` is for whoever receives it.
      const receiverId = (receiver.data as { userId?: string }).userId;
      // Someone who lost access since joining (Welfare's role taken away) leaves the room instead.
      if (!receiverId || !(await mayAccess(receiverId, chatroomId))) {
        receiver.leave(chatroomId);
        continue;
      }
      receiver.emit(
        'reply',
        onTheWire(
          toChatroomMessageResponse(saved, receiverId ?? '', room.userId),
        ),
      );
    }

    deps
      .notifyParticipants({ chatroomId, senderId: s.userId, content })
      .catch((error) => deps.onError?.(error));

    return {
      ok: true,
      message: onTheWire(
        toChatroomMessageResponse(
          { ...saved, reply: quoted ?? null },
          s.userId,
          room.userId,
        ),
      ),
    };
  }

  async function joinRoom(payload: unknown): Promise<CurhatJoinAck> {
    const s = await liveSession();
    if (!s) return refuse('unauthorized');
    const parsed = CurhatJoinPayloadSchema.safeParse(payload);
    if (!parsed.success) return refuse('invalid');
    if (!(await mayAccess(s.userId, parsed.data.chatroomId))) {
      return refuse('forbidden');
    }
    await socket.join(parsed.data.chatroomId);
    return { ok: true };
  }

  socket.on('curhat:join', async (payload: unknown, ack?: unknown) => {
    const answer = ackOf<CurhatJoinAck>(ack);
    try {
      answer(await joinRoom(payload));
    } catch (error) {
      deps.onError?.(error);
      answer(refuse('server'));
    }
  });

  void (async () => {
    const s = await session;
    if (!s) return;
    const auth = (socket.handshake.auth ?? {}) as Record<string, unknown>;
    // One connection for the whole Curhat area: every room the member owns. Welfare's (P3-C) joins every room,
    // and the Welfare group room, through which a room started later is joined (`curhat.controller.ts`).
    if (auth.curhat === true) {
      if (isCurhatAdmin(s.roles)) {
        // The group room first: a room created while the list is read is then joined through it (`welfareJoin`).
        await socket.join(CURHAT_WELFARE_ROOM);
        await socket.join(await deps.getAllChatroomIds());
      } else {
        const owned = await deps.getOwnedChatroomIds(s.userId);
        if (owned.length) await socket.join(owned);
      }
    }
    // Today's screens open one socket per room.
    if (typeof auth.chatroomId === 'string' && auth.chatroomId) {
      if (await mayAccess(s.userId, auth.chatroomId)) {
        await socket.join(auth.chatroomId);
      }
    }
  })().catch((error) => deps.onError?.(error));
}
