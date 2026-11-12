import { z } from '@hono/zod-openapi';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import {
  competitionCategories,
  competitionMedias,
  competitions,
} from '~/db/schema';
import { env } from '~/configs/env.config';
import { isFileStoreUrl } from '~/lib/media-url';
import { addHours } from './calendar.types';
import { MediaSchema } from './media.types';

const CompetitionMediaSchema = createSelectSchema(competitionMedias).extend({
  media: MediaSchema,
});

export const CompetitionSchema = createSelectSchema(competitions, {
  registrationStart: z.union([z.string(), z.date()]),
  registrationDeadline: z.union([z.string(), z.date()]),
  createdAt: z.union([z.string(), z.date()]),
  categories: z.array(z.enum(competitionCategories)),
}).extend({
  medias: z.array(CompetitionMediaSchema).optional(),
});

export const CompetitionCategoriesSchema = z
  .array(z.enum(competitionCategories))
  .openapi('CompetitionCategories');

export const CreateCompetitionSchema = createInsertSchema(competitions, {
  registrationStart: z.coerce
    .date()
    .openapi({ example: new Date().toISOString() }),
  registrationDeadline: z.coerce.date().openapi({
    example: addHours(new Date(), 2).toISOString(),
  }),
  categories: CompetitionCategoriesSchema,
})
  .extend({
    mediaUrls: z
      .array(
        z
          .string()
          .url()
          .refine((url) => isFileStoreUrl(url, env.R2_PUBLIC_URL), {
            message: "Not a file in the app's file store",
          }),
      )
      .optional()
      .openapi({
        description: "Pictures must be files in the app's file store.",
        example: ['https://files.example.com/contoh-poster.jpg'],
      }),
  })
  .omit({
    id: true,
    createdAt: true,
  });

export const UpdateCompetitionBodySchema = createInsertSchema(competitions, {
  registrationStart: z.coerce.date().openapi({
    example: new Date().toISOString(),
  }),
  registrationDeadline: z.coerce.date().openapi({
    example: addHours(new Date(), 2).toISOString(),
  }),
  name: z.string().min(3, { message: 'Name must be at least 3 characters' }),
  organizer: z
    .string()
    .min(3, { message: 'Organizer must be at least 3 characters' }),
  sourceUrl: z.string().openapi({
    example: 'https://example.com',
  }),
  registrationUrl: z.string().openapi({
    example: 'https://example.com',
  }),
  // The same price as create: a string or null, so a free competition ("0" or null) can be edited too.
  categories: CompetitionCategoriesSchema,
})
  .extend({
    mediaUrls: z
      .array(
        z
          .string()
          .url()
          .refine((url) => isFileStoreUrl(url, env.R2_PUBLIC_URL), {
            message: "Not a file in the app's file store",
          }),
      )
      .optional()
      .openapi({
        description: "Pictures must be files in the app's file store.",
        example: ['https://files.example.com/contoh-poster.jpg'],
      }),
  })
  .partial()
  .omit({
    id: true,
    createdAt: true,
  });

export const UpdateCompetitionParamsSchema = z.object({
  id: z.string().min(1, { message: 'Required ID' }),
});

export const CompetitionsSchema = createSelectSchema(competitions, {
  createdAt: z.union([z.string(), z.date()]),
  registrationStart: z.union([z.string(), z.null()]),
  registrationDeadline: z.union([z.string(), z.null()]),
  categories: CompetitionCategoriesSchema,
})
  .extend({ medias: z.array(CompetitionMediaSchema).optional() })
  .openapi('Competition');

export const ListCompetitionsSchema = z.object({
  competitions: z.array(CompetitionsSchema),
});

export const CompetitionListQuerySchema = z.object({
  filter: z
    .string()
    .optional()
    .openapi({
      param: {
        in: 'query',
        description: 'is active or not',
        example: 'active',
      },
    }),
  sort: z
    .enum(['created', 'deadline'])
    .optional()
    .default('created')
    .openapi({
      param: {
        in: 'query',
        description: 'Sort info competitions',
        example: 'created',
      },
    }),
  category: z
    .enum(competitionCategories)
    .optional()
    .openapi({
      param: {
        in: 'query',
        description: 'category info competitions',
        example: 'Web Development',
      },
    }),
  offset: z.coerce.number().int().nonnegative().optional().openapi({
    example: 10,
  }),
});

export const CompetitionsIdParamSchema = z.object({
  competitionId: z.string().openapi({
    param: {
      in: 'path',
      description: 'Id of fetched/deleted competitions',
      example: '1',
    },
  }),
});
