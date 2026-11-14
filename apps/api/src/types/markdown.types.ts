import { z } from '@hono/zod-openapi';
import { createSelectSchema } from 'drizzle-zod';
import { markdowns } from '~/db/schema';

export const MarkdownSchema = createSelectSchema(markdowns).openapi('Markdown');

/** The credits, and the photo of each credited member who has one, by student number. */
export const CreditsSchema = MarkdownSchema.extend({
  photos: z.record(z.string(), z.string()),
}).openapi('Credits');
