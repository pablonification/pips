import { createFactory } from 'hono/factory';
import { z } from 'zod';
import { db } from '~/db/drizzle';
import { UserRolesEnum } from '~/db/schema';
import { getUserRoles } from '~/repositories/user-role.repo';
import { JWTPayloadSchema } from '~/types/login.types';

const factory = createFactory<{
  Variables: {
    user: z.infer<typeof JWTPayloadSchema>;
  };
}>();

/**
 * Lets only members holding one of `accessRoles` through; anyone else gets 401 "Unauthorized". `getRoles` reads a
 * member's roles (the database by default; route tests pass a fake).
 */
export const roleMiddleware = (
  accessRoles: UserRolesEnum[],
  getRoles: (userId: string) => Promise<UserRolesEnum[]> = async (userId) =>
    await getUserRoles(db, userId),
) => {
  return factory.createMiddleware(async (c, next) => {
    const roles = await getRoles(c.var.user.id);

    if (!roles.some((r) => accessRoles.includes(r))) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await next();
  });
};
