import { ApiError } from '~/api/generated';

/*
 * When a failed session check signs you out (SPEC "Session, persistence and resilience"). Kept apart from the
 * API client so unit tests can load it.
 */

/** Only an authentication failure means "signed out": a 401 from the session check. */
export function isSignedOutError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

/** Retry the session check on anything but a 401: offline, a dropped request, a 5xx. */
export const sessionRetry = (_failureCount: number, error: unknown) =>
  !isSignedOutError(error);

/** Back off 1, 2, 4, 8, 16 s, then every 30 s. */
export const sessionRetryDelay = (attempt: number) =>
  Math.min(1000 * 2 ** attempt, 30_000);
