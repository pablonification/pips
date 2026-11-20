import { sign } from 'hono/jwt';
import { env } from '~/configs/env.config';
import { JWT_ALG } from './jwt';

/**
 * Signs a session token for `payload` (a member as `JWTPayloadSchema` reads them), the way sign-in does.
 * `since`: when the member signed in, in seconds (a renewal passes the first token's value on). `expiresIn`: seconds.
 */
export async function signSessionToken(
  payload: object,
  {
    since = Date.now() / 1000,
    expiresIn = env.TOKEN_EXPIRATION,
  }: { since?: number; expiresIn?: number } = {},
) {
  return await sign(
    { ...payload, since, exp: Date.now() / 1000 + expiresIn },
    env.JWT_SECRET,
    JWT_ALG,
  );
}
