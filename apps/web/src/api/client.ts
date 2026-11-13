import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { createSignedOutRecheck } from '~/lib/session-policy';
import {
  ANGKATAN_QUERY_KEY,
  CALENDAR_EVENTS_QUERY_KEY,
  CATEGORIES_QUERY_KEY,
  COURSE_CATALOGUE_QUERY_KEY,
  CREDITS_QUERY_KEY,
  CURRENT_COURSES_QUERY_KEY,
  INFO_LIST_QUERY_KEY,
  ME_QUERY_KEY,
  USER_ACADEMIC_QUERY_KEY,
} from './constants';
import { ApiClient, ApiError } from './generated';
import { PERSIST_MAX_AGE } from './persistence-policy';
import { RequestTimeoutError, timedHttpRequest } from './timed-request';

export const api = new ApiClient(
  {
    BASE: import.meta.env?.VITE_API_URL ?? '',
    WITH_CREDENTIALS: true,
    CREDENTIALS: 'include',
    // An id is one path part: the generated default (`encodeURI`) leaves `/` and `?` in it.
    ENCODE_PATH: encodeURIComponent,
  },
  // Every request has a time limit, so a stalled network ends in the screen's error and Coba lagi.
  timedHttpRequest(),
);

/** The HTTP status of a failed request, or undefined when the error wasn't an answer from the API (no network, timeout). */
export const statusOf = (e: unknown) =>
  e instanceof ApiError ? e.status : undefined;

// A 401 from any request asks the session check again (src/lib/session-policy.ts).
const signedOutRecheck = createSignedOutRecheck({
  recheck: () =>
    queryClient.refetchQueries(
      { queryKey: [ME_QUERY_KEY], type: 'active' },
      { cancelRefetch: false },
    ),
});

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.queryKey[0] !== ME_QUERY_KEY) signedOutRecheck(error);
    },
  }),
  mutationCache: new MutationCache({ onError: signedOutRecheck }),
  defaultOptions: {
    queries: {
      retry(failureCount, error) {
        if (failureCount >= 3) return false;
        // A request that ran out of time is tried once more, not three times: the member waits at most two limits.
        if (error instanceof RequestTimeoutError) return failureCount < 1;
        if (error instanceof ApiError) {
          if (error.status >= 400 && error.status < 500) return false;
        }
        return true;
      },
      gcTime: 1000 * 60 * 60 * 24, // 1 days
      // Data seen in the last minute is reused, not refetched on every tab switch.
      staleTime: 60 * 1000,
    },
  },
});

// Lists that only change with the semester or by an admin: fetched once per visit.
for (const key of [
  CATEGORIES_QUERY_KEY,
  ANGKATAN_QUERY_KEY,
  USER_ACADEMIC_QUERY_KEY,
  COURSE_CATALOGUE_QUERY_KEY,
  CREDITS_QUERY_KEY,
  'competition-categories',
]) {
  queryClient.setQueryDefaults([key], { staleTime: Infinity });
}
// Persisted queries must outlive the persisted cache's maximum age, or they'd be dropped once restored.
for (const key of [
  ME_QUERY_KEY,
  USER_ACADEMIC_QUERY_KEY,
  CURRENT_COURSES_QUERY_KEY,
  CALENDAR_EVENTS_QUERY_KEY,
  INFO_LIST_QUERY_KEY,
]) {
  queryClient.setQueryDefaults([key], { gcTime: PERSIST_MAX_AGE });
}
