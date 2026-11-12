import type { CookieOptions } from 'hono/utils/cookie';
import { env } from '~/configs/env.config';

export const SESSION_COOKIE = 'hmif-app.access-cookie';

/**
 * The session cookie set at Google sign-in (and staging's bypass). `SameSite=Lax`, not `None`: every deployment
 * has the web app and the API on one site (production app.hmif.dev and app-api.hmif.dev; staging and local
 * development on one origin through Vite's proxy), so no other website's request carries the member's session.
 */
export function sessionCookieOptions(): CookieOptions {
  return {
    path: '/',
    secure: true,
    httpOnly: true,
    maxAge: env.TOKEN_EXPIRATION,
    sameSite: 'Lax',
  };
}
