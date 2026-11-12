import { ServerType } from '@hono/node-server';
import * as Sentry from '@sentry/node';
import { Server, type ServerOptions } from 'socket.io';
import { env } from '~/configs/env.config';
import { db, type Database } from '~/db/drizzle';
import { CURHAT_ADMIN_ROLE, curhatPushes } from '~/lib/curhat';
import { RATE_LIMITS, RATE_WINDOW_MS } from '~/lib/limits';
import { isAllowedOrigin } from '~/lib/origin';
import { sendNotificationToAll } from '~/lib/push-manager';
import { createRateLimiter } from '~/lib/rate-limit';
import {
  getChatroomMessageById,
  getAllChatroomIds,
  getChatroomOwner,
  getOwnedChatroomIds,
  saveMessage,
} from '~/repositories/chatroom.repo';
import {
  getPushSubscriptionsByUserIds,
  removeFailedPushSubscriptions,
} from '~/repositories/push.repo';
import { getUserRoles, getUsersByRole } from '~/repositories/user-role.repo';
import { createConnectionHandler, formAdminRoom } from './connection';

export { formAdminRoom };

let ioInstance: Server | undefined;

/**
 * Shared Socket.io instance, set up once in `setupWebsocket()`. Used by
 * controllers (e.g. form.controller.ts) to emit events from outside the
 * websocket connection handler, such as after a REST request is handled.
 */
export function getIo() {
  if (!ioInstance) {
    throw new Error('Websocket has not been set up yet');
  }
  return ioInstance;
}

/**
 * The socket server's options. CORS alone doesn't stop another website: a WebSocket handshake ignores it, and the
 * browser sends the member's cookie with it. So every transport's every request must come from the app
 * (`lib/origin.ts`), before any session is read.
 */
export function socketServerOptions(
  allowedOrigins: readonly string[],
): Partial<ServerOptions> {
  return {
    cors: {
      origin: [...allowedOrigins],
      credentials: true,
    },
    allowRequest: (req, callback) => {
      const header = (name: string) => {
        const value = req.headers[name];
        return Array.isArray(value) ? value[0] : value;
      };
      callback(
        null,
        isAllowedOrigin(
          {
            origin: header('origin'),
            referer: header('referer'),
            host: header('host'),
            forwardedHost: header('x-forwarded-host'),
          },
          allowedOrigins,
        ),
      );
    },
  };
}

export default function setupWebsocket(httpServer: ServerType) {
  const io = new Server(httpServer, socketServerOptions(env.ALLOWED_ORIGINS));
  ioInstance = io;

  io.on(
    'connection',
    createConnectionHandler({
      jwtSecret: env.JWT_SECRET,
      getUserRoles: async (userId) => await getUserRoles(db, userId),
      onError: (error) => Sentry.captureException(error),
      curhat: {
        getChatroom: async (chatroomId) =>
          await getChatroomOwner(db, chatroomId),
        getOwnedChatroomIds: async (userId) =>
          await getOwnedChatroomIds(db, userId),
        getAllChatroomIds: async () => await getAllChatroomIds(db),
        getMessage: async (messageId) =>
          await getChatroomMessageById(db, messageId),
        saveMessage: async (message) => await saveMessage(db, message),
        notifyParticipants: async (msg) => {
          await sendCurhatNotification(db, msg);
        },
        messageLimiter: createRateLimiter({
          limit: RATE_LIMITS.curhatMessages,
          windowMs: RATE_WINDOW_MS,
        }),
        onError: (error) => Sentry.captureException(error),
      },
    }),
  );
}

/**
 * Pushes a new message's other participants (`curhatPushes`), then forgets the devices the push service says are
 * gone.
 */
export async function sendCurhatNotification(
  database: Database,
  msg: { chatroomId: string; senderId: string },
  send: typeof sendNotificationToAll = sendNotificationToAll,
) {
  const [room, welfare] = await Promise.all([
    getChatroomOwner(database, msg.chatroomId),
    getUsersByRole(database, CURHAT_ADMIN_ROLE),
  ]);
  if (!room) return;
  for (const { userIds, push } of curhatPushes({
    room,
    welfareIds: welfare.map((u) => u.id),
    senderId: msg.senderId,
  })) {
    const subscriptions = await getPushSubscriptionsByUserIds(
      database,
      userIds,
    );
    if (subscriptions.length === 0) continue;
    const results = await send(subscriptions, push);
    await removeFailedPushSubscriptions(database, results);
  }
}
