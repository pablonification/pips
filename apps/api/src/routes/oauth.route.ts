import { createRoute, z } from '@hono/zod-openapi';
import {
  ListConnectedAppsSchema,
  OAuthApproveSchema,
  OAuthClientIdParamSchema,
  OAuthDecisionSchema,
  OAuthRequestIdParamSchema,
  OAuthRequestSchema,
} from '~/types/oauth.types';
import {
  ErrorSchema,
  errorResponse,
  ValidationErrorSchema,
} from '~/types/responses.type';

export const getOAuthRequestRoute = createRoute({
  operationId: 'getOAuthRequest',
  tags: ['oauth'],
  method: 'get',
  path: '/oauth/requests/{requestId}',
  description:
    'An app asking to act as the signed-in member through MCP, as the consent page shows it. 404 once decided or expired.',
  request: { params: OAuthRequestIdParamSchema },
  responses: {
    200: {
      description: 'The request',
      content: { 'application/json': { schema: OAuthRequestSchema } },
    },
    404: errorResponse,
  },
});

export const approveOAuthRequestRoute = createRoute({
  operationId: 'approveOAuthRequest',
  tags: ['oauth'],
  method: 'post',
  path: '/oauth/requests/{requestId}/approve',
  description:
    'The member lets the app act as them, with the scopes they chose: only what the app asked for or fewer, and always reading. Answers where to send the browser: the app, with a code it exchanges once.',
  request: {
    params: OAuthRequestIdParamSchema,
    body: {
      required: false,
      content: { 'application/json': { schema: OAuthApproveSchema } },
    },
  },
  responses: {
    200: {
      description: 'Approved',
      content: { 'application/json': { schema: OAuthDecisionSchema } },
    },
    400: {
      description: 'A scope the app did not ask for',
      content: {
        'application/json': {
          schema: z.union([ErrorSchema, ValidationErrorSchema]),
        },
      },
    },
    404: errorResponse,
  },
});

export const denyOAuthRequestRoute = createRoute({
  operationId: 'denyOAuthRequest',
  tags: ['oauth'],
  method: 'post',
  path: '/oauth/requests/{requestId}/deny',
  description:
    'The member refuses. Answers where to send the browser: the app, with error=access_denied.',
  request: { params: OAuthRequestIdParamSchema },
  responses: {
    200: {
      description: 'Denied',
      content: { 'application/json': { schema: OAuthDecisionSchema } },
    },
    404: errorResponse,
  },
});

export const listConnectedAppsRoute = createRoute({
  operationId: 'listConnectedApps',
  tags: ['oauth'],
  method: 'get',
  path: '/oauth/apps',
  description:
    'The apps the signed-in member has connected through MCP and not revoked.',
  responses: {
    200: {
      description: 'Connected apps, newest first',
      content: { 'application/json': { schema: ListConnectedAppsSchema } },
    },
  },
});

export const revokeConnectedAppRoute = createRoute({
  operationId: 'revokeConnectedApp',
  tags: ['oauth'],
  method: 'delete',
  path: '/oauth/apps/{clientId}',
  description:
    'Revokes every token the member gave this app. 404 when it was not connected.',
  request: { params: OAuthClientIdParamSchema },
  responses: {
    200: {
      description: 'Revoked',
      content: { 'application/json': { schema: z.object({}) } },
    },
    404: errorResponse,
  },
});
