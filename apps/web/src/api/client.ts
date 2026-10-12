import { QueryClient } from '@tanstack/react-query';
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

export const api = new ApiClient({
  BASE: import.meta.env.VITE_API_URL,
  WITH_CREDENTIALS: true,
  CREDENTIALS: 'include',
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry(failureCount, error) {
        if (failureCount >= 3) return false;
        if (error instanceof ApiError) {
          if (error.status >= 400 && error.status < 500) return false;
        }
        return true;
      },
      gcTime: 1000 * 60 * 60 * 24, // 1 days
      // Data seen in the last minute is reused, not refetched on every tab switch (SPEC story 134).
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
