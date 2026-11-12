import { createHash, timingSafeEqual } from 'node:crypto';

/** A bypass key shorter than this leaves the route off: it signs anyone in as any member, so it must be unguessable. */
const MIN_LOGIN_BYPASS_KEY_LENGTH = 32;

/**
 * Whether `GET /api/auth/login/bypass` exists: only on development or staging, and only with a strong key set.
 * Production never has it, whatever its key.
 */
export function isLoginBypassEnabled(config: {
  APP_ENV?: string;
  LOGIN_BYPASS_KEY?: string;
}) {
  return (
    (config.APP_ENV === 'development' || config.APP_ENV === 'staging') &&
    typeof config.LOGIN_BYPASS_KEY === 'string' &&
    config.LOGIN_BYPASS_KEY.length >= MIN_LOGIN_BYPASS_KEY_LENGTH
  );
}

/** Compares in constant time (both sides hashed first, so their lengths don't leak either). */
export function bypassTokenMatches(token: string, key: string) {
  const a = createHash('sha256').update(token).digest();
  const b = createHash('sha256').update(key).digest();
  return timingSafeEqual(a, b);
}
