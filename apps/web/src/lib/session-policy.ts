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

/**
 * Whether the session check has settled in this visit, so a page may decide from the member it knows (Kelola's gate).
 * Answered; or it can't answer now: it failed once (the API down; retries keep going) or waits offline. Then the
 * device's saved member decides. Only a first try really on its way is waited for.
 */
export function sessionSettled(q: {
  isFetchedAfterMount: boolean;
  isFetching: boolean;
  failureCount: number;
  fetchStatus: 'fetching' | 'paused' | 'idle';
}) {
  return (
    (q.isFetchedAfterMount && !q.isFetching) ||
    q.failureCount > 0 ||
    q.fetchStatus === 'paused'
  );
}

/**
 * Only the session check signs out, so when another request answers 401 (the session ended, or another tab signed
 * out) the check is asked again and its answer decides: a 401 there runs the usual way to sign-in. Once for a
 * burst of 401s: none while the check is on its way, nor for `quietMs` after it answered. A role check's 401 asks
 * too; the check then answers with the member, and nothing changes.
 */
export function createSignedOutRecheck({
  recheck,
  now = Date.now,
  quietMs = 3_000,
}: {
  recheck: () => Promise<unknown>;
  now?: () => number;
  quietMs?: number;
}) {
  let asking = false;
  let answeredAt = -Infinity;
  return (error: unknown) => {
    if (!isSignedOutError(error) || asking) return;
    if (now() - answeredAt < quietMs) return;
    asking = true;
    void recheck()
      .catch(() => undefined)
      .then(() => {
        asking = false;
        answeredAt = now();
      });
  };
}
