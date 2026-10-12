import { createRoute, z } from '@hono/zod-openapi';
import { ErrorSchema, ValidationErrorSchema } from '~/types/responses.type';
import {
  NimFinderQuerySchema,
  NimFinderResultSchema,
} from '~/types/user-finder.types';

export const getUserRoute = createRoute({
  operationId: 'getUser',
  tags: ['user-finder'],
  method: 'get',
  path: '/user/nim',
  request: {
    query: NimFinderQuerySchema,
  },
  responses: {
    200: {
      description:
        'Members whose NIM or name contains the search (taken literally), closest NIM matches first, at most 30. Only name, NIM, programme and photo.',
      content: {
        'application/json': {
          schema: z.array(NimFinderResultSchema),
        },
      },
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: z.union([ErrorSchema, ValidationErrorSchema]),
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
});
