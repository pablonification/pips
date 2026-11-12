import { z } from '@hono/zod-openapi';
import { isPushServiceEndpoint } from '~/lib/push-service';

export const PushSubscriptionSchema = z
  .object({
    endpoint: z.string().url().refine(isPushServiceEndpoint, {
      message: 'Not a push service',
    }),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  })
  .openapi('PushSubscription');

export const PushLogoutSchema = z.object({
  endpoint: z.string().url(),
});

export const PushBroadcastSchema = z.object({
  title: z.string(),
  options: z
    .object({
      body: z.string().optional(),
    })
    .optional(),
});
