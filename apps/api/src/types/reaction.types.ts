import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { reactions } from '~/db/schema';

export const ReactionSchema = createSelectSchema(reactions, {
  createdAt: z.union([z.string(), z.date()]),
}).openapi('Reaction');

export const CreateOrUpdateReactionSchema = createInsertSchema(reactions).omit({
  id: true,
  createdAt: true,
  creatorId: true,
});

/** The pixel reactions the app offers (apps/web/src/components/garis/pixel-art.ts). */
export const REACTION_KINDS = [
  'grin',
  'heart-eyes',
  'fire',
  'cry',
  'screaming',
  'party',
] as const;

export const CreateOrUpdateReactionParamsSchema = z
  .object({
    infoId: z.string().min(1).optional().openapi({
      example: '1',
    }),
    commentId: z.string().min(1).optional().openapi({
      example: '1',
    }),
    reaction: z.enum(REACTION_KINDS).openapi({
      example: 'fire',
    }),
  })
  .refine((r) => (r.infoId === undefined) !== (r.commentId === undefined), {
    message: 'A reaction is on a post or on a comment',
  });

export const ReactionQuerySchema = z.object({
  infoId: z.string().optional(),
  commentId: z.string().optional(),
});

export const ReactionCountSchema = z
  .object({
    reaction: z.string(),
    count: z.number(),
  })
  .array();

export const ReactionResponseSchema = z
  .object({
    totalReactions: z.number(),
    reactionsCount: ReactionCountSchema,
    userReaction: z.string().optional(),
  })
  .openapi('ReactionAggregate');

export const ReactionIdSchema = z.object({
  reactionId: z.string(),
});

export const CommentIdSchema = z.object({
  commentId: z.string(),
});

export const InfoIdSchema = z.object({
  infoId: z.string(),
});
