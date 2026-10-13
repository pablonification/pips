import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import {
  Chatroom,
  chatroomLabels,
  chatroomLabelsManyToMany,
  ChatroomMessage,
  chatroomMessages,
  chatrooms,
} from '~/db/schema';
import { z } from '@hono/zod-openapi';

export const ChatroomMessageSchema = createSelectSchema(chatroomMessages)
  .omit({
    userId: true,
  })
  .extend({
    isSender: z.boolean().optional(),
    reply: createSelectSchema(chatroomMessages)
      .omit({
        userId: true,
        clientMessageId: true,
      })
      .optional(),
  })
  .openapi('ChatroomMessage');

export const ChatroomLabelSchema =
  createSelectSchema(chatroomLabels).openapi('ChatroomLabel');

export const ChatroomLabelsManyToManySchema = createSelectSchema(
  chatroomLabelsManyToMany,
)
  .extend({
    label: ChatroomLabelSchema,
  })
  .openapi('ChatroomLabelManyToMany');

export const ChatroomSchema = createSelectSchema(chatrooms)
  .omit({
    userId: true,
  })
  .extend({
    messages: z.array(ChatroomMessageSchema).optional(),
    labels: z.array(ChatroomLabelsManyToManySchema).optional(),
    isPinned: z.boolean().optional(),
    canDelete: z.boolean().optional(),
  })
  .openapi('Chatroom');

export const ListChatroomSchema = z
  .record(z.string(), ChatroomSchema)
  .openapi('ListChatroom');

export const ChatroomIdParamsSchema = z.object({
  chatroomId: z.string().openapi({
    param: {
      in: 'path',
      description: 'Id of chatroom',
      example: 'uuid',
    },
  }),
});

export const PutLabelChatroomSchema = z.object({
  labelIds: z.string().array(),
});

export const CreateLabelChatroomBodySchema = createInsertSchema(
  chatroomLabels,
).omit({
  id: true,
});

export const PinChatroomBodySchema = z.object({
  isPinned: z.boolean(),
});

export type TChatroom = Chatroom & {
  messages: ChatroomMessage[];
};

// --- Chat socket contract (`websocket/curhat.ts`). The web client relies on these shapes. ---

/** `message`: what a client sends. Any `userId` is ignored: the sender is the signed-in member. */
export const CurhatMessagePayloadSchema = z
  .object({
    chatroomId: z.string().min(1),
    message: z.string(),
    replyId: z.string().min(1).nullish(),
    /**
     * The device's id for this message (a UUID, P2-C). Sending it again with the same id, after a lost
     * acknowledgement, saves nothing new: the acknowledgement carries the message saved the first time.
     */
    clientMessageId: z.string().uuid().nullish(),
  })
  .openapi('CurhatMessagePayload');

/** `curhat:join`: join a room created after connecting. */
export const CurhatJoinPayloadSchema = z
  .object({
    chatroomId: z.string().min(1),
  })
  .openapi('CurhatJoinPayload');

/**
 * Why the server refused: `unauthorized` (no valid session), `forbidden` (not your room, or no such room),
 * `invalid` (empty text, a reply to a message outside the room, a malformed payload), `server` (saving failed).
 */
export const CurhatSocketErrorSchema = z
  .enum(['unauthorized', 'forbidden', 'invalid', 'server'])
  .openapi('CurhatSocketError');

/** A message on the socket, as JSON carries it (`createdAt` an ISO string); never the sender's id. */
const CurhatQuotedMessageSchema = z.object({
  id: z.string(),
  chatroomId: z.string(),
  replyId: z.string().nullable(),
  content: z.string(),
  createdAt: z.string().datetime(),
});

export const CurhatSocketMessageSchema = CurhatQuotedMessageSchema.extend({
  isSender: z.boolean(),
  /** The device's id for the message, only for its sender (`isSender`); null for everyone else and older clients. */
  clientMessageId: z.string().nullable(),
  reply: CurhatQuotedMessageSchema.optional(),
}).openapi('CurhatSocketMessage');

/** The acknowledgement of `message`: the saved message as its sender sees it, or why it wasn't saved. */
export const CurhatMessageAckSchema = z
  .discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), message: CurhatSocketMessageSchema }),
    z.object({ ok: z.literal(false), error: CurhatSocketErrorSchema }),
  ])
  .openapi('CurhatMessageAck');

/** The acknowledgement of `curhat:join`. */
export const CurhatJoinAckSchema = z
  .discriminatedUnion('ok', [
    z.object({ ok: z.literal(true) }),
    z.object({ ok: z.literal(false), error: CurhatSocketErrorSchema }),
  ])
  .openapi('CurhatJoinAck');

/** `reply`: a message someone else in the room just sent, as the receiver sees it (never the sender's id). */
export const CurhatReplyEventSchema = CurhatSocketMessageSchema.omit({
  reply: true,
}).openapi('CurhatReplyEvent');

export type CurhatSocketError = z.infer<typeof CurhatSocketErrorSchema>;
export type CurhatMessageAck = z.infer<typeof CurhatMessageAckSchema>;
export type CurhatJoinAck = z.infer<typeof CurhatJoinAckSchema>;
