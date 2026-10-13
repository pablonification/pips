import {
  createChatroomRoute,
  deleteChatroomRoute,
  getUserChatroomsRoute,
  unreadCountChatroomMessages,
  pinChatroomRoute,
  readChatroomMessages,
} from '~/routes/curhat.route';
import { createAuthRouter } from './router-factory';
import {
  createChatroomWithinLimit,
  deleteChatroom,
  getChatroomOwner,
  getUnreadCounts,
  getUserChatrooms,
  getWelfareChatrooms,
  markChatroomRead,
  pinChatroom,
} from '~/repositories/chatroom.repo';
import { db } from '~/db/drizzle';
import { animals, colors, uniqueNamesGenerator } from 'unique-names-generator';
import { getUserRoles } from '~/repositories/user-role.repo';
import postgres from 'postgres';
import type { Chatroom } from '~/db/schema';
import { TChatroom } from '~/types/curhat.types';
import {
  CURHAT_ADMIN_ROLE,
  CURHAT_WELFARE_ROOM,
  canAccessChatroom,
  toChatroomResponse,
} from '~/lib/curhat';
import { getIo } from '~/websocket/setup';

/** What the Curhat routes need from storage, passed in so the route tests run without a database. */
export interface CurhatDeps {
  getUserRoles: (userId: string) => Promise<string[]>;
  getUserChatrooms: (userId: string) => Promise<Map<string, TChatroom>>;
  getWelfareChatrooms: (userId: string) => Promise<Map<string, TChatroom>>;
  /** Counts the member's rooms and creates one in a single locked step; `null` when they're at the limit. */
  createChatroomWithinLimit: (data: {
    title: string;
    userId: string;
  }) => Promise<Chatroom | null>;
  getChatroomOwner: (
    chatroomId: string,
  ) => Promise<{ id: string; userId: string | null } | undefined>;
  deleteChatroom: (chatroomId: string) => Promise<void>;
  /** Unread counts per room, in the database; `everyRoom` for Welfare. The rule is `countUnread`'s. */
  getUnreadCounts: (
    userId: string,
    everyRoom: boolean,
  ) => Promise<Array<{ chatroomId: string; unreadCount: number }>>;
  markChatroomRead: (chatroomId: string, userId: string) => Promise<void>;
  pinChatroom: (
    chatroomId: string,
    userId: string,
    isPinned: boolean,
  ) => Promise<void>;
  /**
   * A member started a room: every connected Welfare socket of the Curhat area joins it (P3-C), so its first message
   * reaches Welfare live. The socket's per-receiver check still drops a socket whose role was taken away.
   */
  welfareJoin: (chatroomId: string) => void;
}

const databaseDeps: CurhatDeps = {
  getUserRoles: async (userId) => await getUserRoles(db, userId),
  getUserChatrooms: async (userId) => await getUserChatrooms(db, userId),
  getWelfareChatrooms: async (userId) => await getWelfareChatrooms(db, userId),
  createChatroomWithinLimit: async (data) =>
    await createChatroomWithinLimit(db, data),
  getChatroomOwner: async (chatroomId) =>
    await getChatroomOwner(db, chatroomId),
  deleteChatroom: async (chatroomId) => {
    await deleteChatroom(db, chatroomId);
  },
  getUnreadCounts: async (userId, everyRoom) =>
    await getUnreadCounts(db, userId, everyRoom),
  markChatroomRead: async (chatroomId, userId) => {
    await markChatroomRead(db, chatroomId, userId);
  },
  pinChatroom: async (chatroomId, userId, isPinned) => {
    await pinChatroom(db, chatroomId, userId, isPinned);
  },
  welfareJoin: (chatroomId) => {
    getIo().in(CURHAT_WELFARE_ROOM).socketsJoin(chatroomId);
  },
};

/** The rooms `userId` may see: every room for Welfare, their own for everyone else. */
async function visibleChatrooms(deps: CurhatDeps, userId: string) {
  const roles = await deps.getUserRoles(userId);
  const rooms = roles.includes(CURHAT_ADMIN_ROLE)
    ? await deps.getWelfareChatrooms(userId)
    : await deps.getUserChatrooms(userId);
  return { roles, rooms };
}

export function createCurhatRouter(deps: CurhatDeps = databaseDeps) {
  const curhatRouter = createAuthRouter();

  curhatRouter.openapi(createChatroomRoute, async (c) => {
    const { id: userId } = c.var.user;
    const newChatroom = await deps.createChatroomWithinLimit({
      title: uniqueNamesGenerator({
        dictionaries: [colors, animals],
        separator: ' ',
      }),
      userId,
    });
    if (!newChatroom) {
      return c.json(
        {
          error: 'You have reached the maximum chatrooms limit',
        },
        400,
      );
    }
    try {
      deps.welfareJoin(newChatroom.id);
    } catch {
      // No socket server (it isn't set up): nobody is connected to join it. The room is made either way.
    }
    return c.json(
      toChatroomResponse({ ...newChatroom, messages: [] }, userId),
      201,
    );
  });

  curhatRouter.openapi(getUserChatroomsRoute, async (c) => {
    const { id: userId } = c.var.user;
    const { rooms } = await visibleChatrooms(deps, userId);

    const mappedChatrooms: Record<
      string,
      ReturnType<typeof toChatroomResponse>
    > = {};
    rooms.forEach((val, key) => {
      mappedChatrooms[key] = toChatroomResponse(val, userId);
    });

    return c.json(mappedChatrooms, 200);
  });

  curhatRouter.openapi(deleteChatroomRoute, async (c) => {
    const { id: userId } = c.var.user;
    const { chatroomId } = c.req.valid('param');
    const chatroom = await deps.getChatroomOwner(chatroomId);
    if (!chatroom) {
      return c.json({ error: 'Chatroom not found' }, 404);
    }

    if (chatroom.userId !== userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await deps.deleteChatroom(chatroomId);
    return c.json({ message: 'Chatroom deleted' }, 200);
  });

  curhatRouter.openapi(unreadCountChatroomMessages, async (c) => {
    const { id: userId } = c.var.user;

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    try {
      const roles = await deps.getUserRoles(userId);
      const everyRoom = roles.includes(CURHAT_ADMIN_ROLE);
      return c.json(await deps.getUnreadCounts(userId, everyRoom), 200);
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  });

  curhatRouter.openapi(readChatroomMessages, async (c) => {
    const { id: userId } = c.var.user;
    const { chatroomId } = c.req.valid('param');
    const chatroom = await deps.getChatroomOwner(chatroomId);
    if (!chatroom) {
      return c.json({ error: 'Chatroom not found' }, 404);
    }
    const roles = await deps.getUserRoles(userId);
    if (!canAccessChatroom({ id: userId }, roles, chatroom)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await deps.markChatroomRead(chatroomId, userId);
    return c.json({ message: 'Chatroom messages read' }, 200);
  });

  curhatRouter.openapi(pinChatroomRoute, async (c) => {
    const { id: userId } = c.var.user;
    const { chatroomId } = c.req.valid('param');
    const { isPinned } = c.req.valid('json');

    const roles = await deps.getUserRoles(userId);

    if (!roles.includes(CURHAT_ADMIN_ROLE)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
      await deps.pinChatroom(chatroomId, userId, isPinned);
      if (isPinned) {
        return c.json({ message: 'Chatroom pinned' }, 200);
      } else {
        return c.json({ message: 'Chatroom unpinned' }, 200);
      }
    } catch (e) {
      if (e instanceof postgres.PostgresError) {
        return c.json({ error: 'Failed to pin chatroom' }, 400);
      } else {
        return c.json({ error: 'Something went wrong' }, 500);
      }
    }
  });

  return curhatRouter;
}

export const curhatRouter = createCurhatRouter();
