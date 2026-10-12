import { z } from '@hono/zod-openapi';

/** The author of a post or a comment, as other members see them (`src/lib/author.ts`). */
export const AuthorSchema = z
  .object({
    id: z.string(),
    fullName: z.string(),
    picture: z.string().nullable(),
    email: z.string(),
  })
  .openapi('Author');
