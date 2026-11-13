import type { RouteConfig } from '@hono/zod-openapi';
import { createFactory } from 'hono/factory';
import { z } from 'zod';
import { UserRolesEnum } from '~/db/schema';
import { JWTPayloadSchema } from '~/types/login.types';

const factory = createFactory<{
  Variables: {
    user: z.infer<typeof JWTPayloadSchema>;
  };
}>();

/** Lets only members holding one of `accessRoles` through; anyone else gets 401 "Unauthorized". */
const roleMiddleware = (
  accessRoles: readonly UserRolesEnum[],
  getRoles: (userId: string) => Promise<UserRolesEnum[]>,
) => {
  return factory.createMiddleware(async (c, next) => {
    const roles = await getRoles(c.var.user.id);

    if (!roles.some((r) => accessRoles.includes(r))) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await next();
  });
};

/**
 * `route` with a role check in front of it: pass the result straight to `router.openapi`, so the check is part of the
 * route's registration and runs before the request is validated. `getRoles` reads a member's roles (the controller's
 * deps, so route tests pass a fake). Checks that depend on the row (the author, the room's owner) stay in the handler.
 * Every route's access is listed in `lib/route-access.ts`.
 */
export function forRoles<R extends RouteConfig>(
  route: R,
  roles: readonly UserRolesEnum[],
  getRoles: (userId: string) => Promise<UserRolesEnum[]>,
): R {
  const own = route.middleware ?? [];
  return {
    ...route,
    middleware: [
      roleMiddleware(roles, getRoles),
      ...(Array.isArray(own) ? own : [own]),
    ],
  };
}
