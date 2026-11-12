/**
 * The login bypass key of the throwaway API that `e2e:real` starts (serve-api.mjs). Not a secret: no other API has
 * it, and the bypass route exists only with APP_ENV development or staging (apps/api/src/lib/login-bypass.ts).
 */
export const REAL_BYPASS_KEY = 'e2e-real-api-login-bypass-key-not-a-secret';
