import { createRoute } from '@hono/zod-openapi';
import { CreditsSchema } from '~/types/markdown.types';
import { errorResponse } from '~/types/responses.type';

export const creditsMarkdownRoute = createRoute({
  operationId: 'getCredits',
  tags: ['markdown'],
  method: 'get',
  path: '/markdown/credits',
  responses: {
    200: {
      description: 'Credits markdown',
      content: {
        'application/json': {
          schema: CreditsSchema,
        },
      },
    },
    404: errorResponse,
  },
});
