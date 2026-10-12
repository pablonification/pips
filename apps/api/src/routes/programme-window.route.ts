import { createRoute } from '@hono/zod-openapi';
import { ListProgrammeWindowsSchema } from '~/types/programme-window.types';
import { errorResponse } from '~/types/responses.type';

export const listProgrammeWindowsRoute = createRoute({
  operationId: 'listProgrammeWindows',
  tags: ['programme-window'],
  method: 'get',
  path: '/programme-windows',
  description:
    "The programme windows and campaigns open now for the signed-in member, on the server's clock.",
  responses: {
    200: {
      description: 'Windows open for you',
      content: { 'application/json': { schema: ListProgrammeWindowsSchema } },
    },
    401: errorResponse,
  },
});
