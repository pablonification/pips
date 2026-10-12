/**
 * The algorithm the API signs its session tokens with. Hono's `sign` defaults to it, and since Hono 4.10
 * `jwt()` and `verify()` must be told which algorithm to accept.
 */
export const JWT_ALG = 'HS256' as const;
