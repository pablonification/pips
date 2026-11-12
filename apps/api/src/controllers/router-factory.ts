import { Hook, OpenAPIHono, z } from '@hono/zod-openapi';
import { deleteCookie } from 'hono/cookie';
import { jwt } from 'hono/jwt';
import type { RequestIdVariables } from 'hono/request-id';
import { env } from '~/configs/env.config';
import { JWT_ALG } from '~/lib/jwt';
import { SESSION_COOKIE } from '~/lib/session-cookie';
import { JWTPayloadSchema } from '~/types/login.types';

const defaultHook: Hook<any, any, any, any> = (result, c) => {
  if (!result.success) {
    return c.json({ errors: result.error.flatten() }, 400);
  }
};

/** A router with no middleware. */
export function createRouter() {
  return new OpenAPIHono<{
    Variables: RequestIdVariables;
  }>({ defaultHook });
}

/** A router that requires a session and puts the member in `c.var.user`. */
export function createAuthRouter() {
  const authRouter = new OpenAPIHono<{
    Variables: {
      user: z.infer<typeof JWTPayloadSchema>;
    } & RequestIdVariables;
  }>({ defaultHook });

  authRouter.use(
    jwt({
      secret: env.JWT_SECRET,
      cookie: SESSION_COOKIE,
      alg: JWT_ALG,
    }),
  );

  // A token signed before the member's record changed shape is a session to sign in again.
  authRouter.use(async (c, next) => {
    const payload = JWTPayloadSchema.safeParse(c.var.jwtPayload);
    if (!payload.success) {
      deleteCookie(c, SESSION_COOKIE);
      return c.text('Unauthorized', 401);
    }
    c.set('user', payload.data);
    await next();
  });

  return authRouter;
}
