import { createRoute } from '@hono/zod-openapi';
import { BodyParamsSchema, PresignedUrlSchema } from '~/types/media.types';
import { ErrorSchema, ValidationErrorSchema } from '~/types/responses.type';
import { z } from '@hono/zod-openapi';

export const createPresignedUrl = createRoute({
  operationId: 'createPresignedUrl',
  tags: ['media'],
  method: 'post',
  path: '/media/upload',
  description: 'Creates presigned URL for file upload to S3',
  request: {
    body: {
      content: {
        'application/json': {
          schema: BodyParamsSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Returns created presigned URL',
      content: {
        'application/json': {
          schema: PresignedUrlSchema,
        },
      },
    },
    400: {
      description: 'Bad request: validation error, or a file type not allowed',
      content: {
        'application/json': {
          schema: z.union([ValidationErrorSchema, ErrorSchema]),
        },
      },
    },
  },
});
