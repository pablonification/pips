/**
 * Kalender's reads, shared by Beranda's agenda card, Kalender and search. Each month is fetched once under P0-B's
 * key (`calendarEventsQuery`), so the strip, the grid and search share it, the persisted cache keeps today ±7 days,
 * and P3-B's writes refresh every screen. Always both `month` and `year` (the API's defaults are the server's).
 */
import {
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { api } from '~/api/client';
import { CALENDAR_EVENTS_QUERY_KEY } from '~/api/constants';
import { ApiError, type CalendarEvent } from '~/api/generated';
import { calendarEventsQuery, currentCoursesQuery } from '~/api/queries';
import type { Month } from '~/lib/days';
import { coursesById, mergeEvents, type CalEvent } from './rules';

export interface MonthsState {
  /** The months' events, each once, by start. */
  events: CalEvent[];
  /** Every month has arrived (from the network or the device). */
  ready: boolean;
  /** A month is still on its way, nothing kept for it. */
  loading: boolean;
  /** A month failed and nothing is kept for it. */
  failed: boolean;
  /** Offline, and a month isn't kept on this device. */
  offline: boolean;
  /** When the oldest month on screen was last updated (for "Offline · diperbarui 07.45"). */
  updatedAt: number;
  retry: () => void;
}

function combine(results: UseQueryResult<CalendarEvent[]>[]): MonthsState {
  const missing = results.filter((r) => r.data === undefined);
  return {
    events: mergeEvents(results.map((r) => r.data)),
    ready: missing.length === 0,
    loading: missing.some((r) => r.fetchStatus === 'fetching'),
    failed: missing.some((r) => r.isError && r.fetchStatus !== 'fetching'),
    offline: missing.some((r) => r.fetchStatus === 'paused'),
    updatedAt: Math.min(
      ...results.map((r) => r.dataUpdatedAt || Infinity),
      Date.now(),
    ),
    retry: () => {
      for (const r of results) if (r.data === undefined) void r.refetch();
    },
  };
}

/** The events of some months (Beranda's strip: one or two; Kalender's grid: up to three). */
export function useMonthsEvents(months: readonly Month[]): MonthsState {
  return useQueries({
    queries: months.map((m) => calendarEventsQuery(m)),
    combine,
  });
}

/** This semester's courses, by id (P0-B's key: Mata kuliahku's changes refresh it). */
export function useCourses() {
  const q = useQuery(currentCoursesQuery());
  const byId = useMemo(() => coursesById(q.data), [q.data]);
  return { ...q, byId };
}

/**
 * One event by id: from any month already loaded, else `GET /calendar/event/{id}` (a shared link to another month).
 * `missing` once the API says there is no such event.
 */
export function useEvent(
  id: string | undefined,
  loaded: readonly CalEvent[],
  loadedReady = true,
) {
  const qc = useQueryClient();
  const cached = useMemo(() => {
    if (!id) return undefined;
    const found = loaded.find((e) => e.id === id);
    if (found) return found;
    for (const [, list] of qc.getQueriesData<CalendarEvent[]>({
      queryKey: [CALENDAR_EVENTS_QUERY_KEY],
    }))
      if (Array.isArray(list)) {
        const e = list.find((x) => x.id === id);
        if (e) return e;
      }
    return undefined;
  }, [id, loaded, qc]);
  const q = useQuery({
    queryKey: [CALENDAR_EVENTS_QUERY_KEY, 'event', id],
    queryFn: () => api.calendar.getCalendarEventById({ eventId: id! }),
    enabled: !!id && !cached && loadedReady,
    retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2,
  });
  const event = cached ?? q.data;
  const missing =
    !event && q.error instanceof ApiError && q.error.status === 404;
  return { event, missing, loading: !event && q.isFetching };
}

const onlineSubscribe = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

/** Whether the browser is online. */
export const useOnline = () =>
  useSyncExternalStore(
    onlineSubscribe,
    () => navigator.onLine,
    () => true,
  );

/** The time now, renewed every minute, so ended events fade and "hari ini" moves at midnight. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** After `ms`, true while `active`: skeletons appear only for a load slower than 300 ms (SPEC "States"). */
export function useDelayed(active: boolean, ms = 300): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!active) {
      setLate(false);
      return;
    }
    const id = setTimeout(() => setLate(true), ms);
    return () => clearTimeout(id);
  }, [active, ms]);
  return active && late;
}
