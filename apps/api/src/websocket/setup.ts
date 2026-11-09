import { ServerType } from '@hono/node-server';
import * as Sentry from '@sentry/node';
import { Server, type ServerOptions } from 'socket.io';
import { env } from '~/configs/env.config';
import { db } from '~/db/drizzle';
import { isAllowedOrigin } from '~/lib/origin';
import { sendNotificationToAll } from '~/lib/push-manager';
import {
  getChatroomMessageById,
  getAllChatroomIds,
  getChatroomOwner,
  getChatroomParticipantIds,
  getOwnedChatroomIds,
  saveMessage,
} from '~/repositories/chatroom.repo';
import { getPushSubscriptionsByUserIds } from '~/repositories/push.repo';
import { getUserRoles } from '~/repositories/user-role.repo';
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
        notifyParticipants: sendNotification,
        onError: (error) => Sentry.captureException(error),
      },
    }),
  );
}

/**
 * Send notification to all participants in a chatroom except the sender.
 */
async function sendNotification(msg: {
  chatroomId: string;
  senderId: string;
  content: string;
}) {
  const participantIds = (
    await getChatroomParticipantIds(db, msg.chatroomId)
  ).filter((ids) => ids !== msg.senderId);

  const pushSubscriptions = await getPushSubscriptionsByUserIds(
    db,
    participantIds,
  );

  await sendNotificationToAll(pushSubscriptions, {
    title: 'New Curhat Message',
    options: {
      body: msg.content,
      data: {
        url: '/home/curhat',
      },
    },
  });
}
