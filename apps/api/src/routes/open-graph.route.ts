import { createRoute, z } from '@hono/zod-openapi';
import {
  OpenGraphErrorSchema,
  OpenGraphScrapeRequestSchema,
  OgObjectSchema,
} from '~/types/open-graph.types';
import {
  authorizaitonErrorResponse,
  ValidationErrorSchema,
} from '~/types/responses.type';

export const getOpenGraph = createRoute({
  operationId: 'openGraphScrape',
  tags: ['open-graph'],
  method: 'get',
  path: '/open-graph',
  description: 'Scrape Open Graph meta tags from a URL',
  request: {
    query: OpenGraphScrapeRequestSchema,
  },
  responses: {
    200: {
      description: 'Scrape successful',
      content: {
        'application/json': {
          schema: OgObjectSchema,
        },
      },
    },
    400: {
      description: 'Invalid URL',
      content: {
        'application/json': {
          schema: z.union([OpenGraphErrorSchema, ValidationErrorSchema]),
        },
      },
    },
    401: authorizaitonErrorResponse,
  },
});

export const getOpenGraphImage = createRoute({
  operationId: 'openGraphImage',
  tags: ['open-graph'],
  method: 'get',
  path: '/open-graph/image',
  description:
    "A link preview's image, fetched here so the member's browser never asks the other site: PNG, JPEG, GIF or WebP, at most 2 MiB",
  request: {
    query: OpenGraphScrapeRequestSchema,
  },
  responses: {
    200: {
      description: 'The image',
      content: {
        'image/png': { schema: z.string().openapi({ format: 'binary' }) },
        'image/jpeg': { schema: z.string().openapi({ format: 'binary' }) },
        'image/gif': { schema: z.string().openapi({ format: 'binary' }) },
        'image/webp': { schema: z.string().openapi({ format: 'binary' }) },
      },
    },
    400: {
      description: 'Not an image, too large, or not reachable',
      content: {
        'application/json': {
          schema: z.union([OpenGraphErrorSchema, ValidationErrorSchema]),
        },
      },
    },
    401: authorizaitonErrorResponse,
  },
});
