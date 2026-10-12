import type { DehydratedState } from '@tanstack/react-query';
import {
  CALENDAR_EVENTS_QUERY_KEY,
  CURRENT_COURSES_QUERY_KEY,
  INFO_LIST_QUERY_KEY,
  ME_QUERY_KEY,
  USER_ACADEMIC_QUERY_KEY,
} from './constants';

/*
 * What the query cache keeps on the device between visits (SPEC "Performance architecture and budgets"):
 * exactly the profile, calendar events for today ±7 days, the first page of announcements and the courses,
 * kept at most 7 days. The service registry is code (src/lib/services.ts), so it is always there.
 * Pure, so tests/persistence-policy.test.ts can check it.
 */

export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
/** Change when a persisted query's shape changes, so old caches are dropped instead of misread. */
export const PERSIST_BUSTER = 'pips-query-cache-1';

type Key = readonly unknown[];
const DAY = 24 * 60 * 60 * 1000;

const isEmpty = (v: unknown) =>
  v === undefined || v === null || (Array.isArray(v) && v.length === 0);

/** Months (1–12) touched by today ±7 days, in the device's time zone. */
function monthsInWindow(now: Date) {
  const months = new Set<string>();
  for (
    let t = now.getTime() - 7 * DAY;
    t <= now.getTime() + 7 * DAY;
    t += DAY
  ) {
    const d = new Date(t);
    months.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
  }
  return months;
}

/** Whether a successful query with this key is written to the device. */
export function shouldPersistKey(key: Key, now: Date = new Date()): boolean {
  switch (key[0]) {
    case ME_QUERY_KEY:
    case USER_ACADEMIC_QUERY_KEY:
    case CURRENT_COURSES_QUERY_KEY:
      return key.length === 1;
    case CALENDAR_EVENTS_QUERY_KEY: {
      const range = key[1] as { month?: number; year?: number } | undefined;
      return (
        key.length === 2 &&
        typeof range?.month === 'number' &&
        typeof range?.year === 'number' &&
        monthsInWindow(now).has(`${range.year}-${range.month}`)
      );
    }
    case INFO_LIST_QUERY_KEY:
      // The feed as it opens: no search, filter or sort.
      return key.slice(1).every(isEmpty);
    default:
      return false;
  }
}

/**
 * Any data the member has seen, whatever the last refresh did: during a server outage a query keeps its data
 * but turns `error`, and dropping it then would open the next launch with nothing (SPEC story 135). Never a
 * signed-out `me` (null), and never a query without data.
 */
export function shouldPersistQuery(query: {
  queryKey: Key;
  state: { data: unknown };
}): boolean {
  return (
    query.state.data !== null &&
    query.state.data !== undefined &&
    shouldPersistKey(query.queryKey)
  );
}

/**
 * Whether a snapshot belongs to a signed-in member (it holds their `me`). Signed out, or before anyone has
 * signed in, nothing is written to the device.
 */
export function isSignedInSnapshot(state: DehydratedState): boolean {
  return state.queries.some(
    (q) =>
      q.queryKey[0] === ME_QUERY_KEY &&
      q.queryKey.length === 1 &&
      q.state.data !== null &&
      q.state.data !== undefined,
  );
}

type InfiniteData = { pages: unknown[]; pageParams: unknown[] };
const isInfinite = (data: unknown): data is InfiniteData =>
  !!data &&
  typeof data === 'object' &&
  Array.isArray((data as InfiniteData).pages) &&
  Array.isArray((data as InfiniteData).pageParams);

/**
 * What is written to the device: announcements keep only their first page, and every query is stored as plain
 * successful data, without the error or fetch state of its last refresh (an error can't always be stored, and
 * restored data is refreshed on the next visit anyway).
 */
export function trimForDevice(state: DehydratedState): DehydratedState {
  return {
    ...state,
    queries: state.queries.map((q) => {
      const data = q.state.data;
      const trimmed =
        q.queryKey[0] === INFO_LIST_QUERY_KEY && isInfinite(data)
          ? {
              pages: data.pages.slice(0, 1),
              pageParams: data.pageParams.slice(0, 1),
            }
          : data;
      const query = { ...q };
      delete query.promise;
      return {
        ...query,
        state: {
          ...q.state,
          data: trimmed,
          status: 'success',
          fetchStatus: 'idle',
          error: null,
          fetchFailureCount: 0,
          fetchFailureReason: null,
        },
      };
    }),
  };
}
