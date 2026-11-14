import { db } from '~/db/drizzle';
import { creditNims } from '~/lib/credits';
import {
  CREDITS_MARKDOWN_ID,
  getMarkdownById,
  getPicturesByNim,
} from '~/repositories/markdown.repo.';
import { creditsMarkdownRoute } from '~/routes/markdown.route';
import { createAuthRouter } from './router-factory';

export const markdownRouter = createAuthRouter();

markdownRouter.openapi(creditsMarkdownRoute, async (c) => {
  const markdown = await getMarkdownById(db, CREDITS_MARKDOWN_ID);
  if (!markdown) {
    return c.json({ error: 'Markdown not found' }, 404);
  }
  const photos = await getPicturesByNim(db, creditNims(markdown.content));
  return c.json({ ...markdown, photos }, 200);
});
