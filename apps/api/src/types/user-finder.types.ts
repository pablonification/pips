import { z } from '@hono/zod-openapi';

/** One member as NIM Finder shows them: nothing beyond name, NIM, programme and photo. */
export const NimFinderResultSchema = z
  .object({
    fullName: z.string(),
    nim: z.string(),
    major: z.enum(['IF', 'STI']),
    picture: z.string().nullable(),
  })
  .openapi('NimFinderResult');

export const NimFinderQuerySchema = z.object({
  search: z.string().trim().min(3),
});
