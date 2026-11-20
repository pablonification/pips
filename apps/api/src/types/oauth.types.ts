import { z } from '@hono/zod-openapi';

export const OAuthRequestIdParamSchema = z.object({
  requestId: z
    .string()
    .min(1)
    .max(200)
    .openapi({
      param: {
        in: 'path',
        description: 'The id the consent page got in its address',
      },
    }),
});

export const OAuthClientIdParamSchema = z.object({
  clientId: z
    .string()
    .min(1)
    .max(200)
    .openapi({ param: { in: 'path', description: 'A connected app' } }),
});

const ScopeSchema = z.enum(['pips.read', 'pips.write']).openapi('OAuthScope');

export const OAuthRequestSchema = z
  .object({
    /** As the app named itself: plain text, never a link. Empty when it gave none. */
    clientName: z.string(),
    /** Where the member is sent back after deciding. */
    redirectHost: z.string(),
    scopes: z.array(ScopeSchema),
  })
  .openapi('OAuthRequest');

export const OAuthApproveSchema = z
  .object({
    /** What the member allows, at most what the app asked for. `pips.read` is always kept. Omitted: all it asked. */
    scopes: z.array(ScopeSchema).max(2).optional(),
  })
  .openapi('OAuthApprove');

export const OAuthDecisionSchema = z
  .object({
    /** The app's address with the code (approved) or `error=access_denied` (denied). */
    redirectTo: z.string(),
  })
  .openapi('OAuthDecision');

export const ConnectedAppSchema = z
  .object({
    clientId: z.string(),
    name: z.string(),
    connectedAt: z.union([z.string(), z.date()]),
    lastUsedAt: z.union([z.string(), z.date()]).nullable(),
    /** What the app may do now: `pips.read` alone, or with `pips.write`. */
    scopes: z.array(ScopeSchema),
  })
  .openapi('ConnectedApp');

export const ListConnectedAppsSchema = z
  .object({ apps: z.array(ConnectedAppSchema) })
  .openapi('ListConnectedApps');
