/**
 * P3-B: Kalender's cached months after a change, so every screen (the strip, the grid, search) shows it at once;
 * the touched months are then fetched again from the API (P1-A's key, `GET /calendar/me`).
 */
import type { QueryClient } from '@tanstack/react-query';
import { CALENDAR_EVENTS_QUERY_KEY } from '~/api/constants';
import type { CalendarEvent } from '~/api/generated';
import { calendarEventsQuery } from '~/api/queries';
import { monthsTouched } from './rules';

type Months = CalendarEvent[] | undefined;

/** Every cached month without the event, then with it where it now falls (if given). */
function rewrite(
  qc: QueryClient,
  id: string,
  next: CalendarEvent | null,
  instants: string[],
) {
  for (const [key, list] of qc.getQueriesData<Months>({
    queryKey: [CALENDAR_EVENTS_QUERY_KEY],
  })) {
    if (Array.isArray(list) && list.some((e) => e.id === id))
      qc.setQueryData<Months>(
        key,
        list.filter((e) => e.id !== id),
      );
  }
  if (next) {
    const [month] = monthsTouched(next.start);
    qc.setQueryData<Months>(calendarEventsQuery(month).queryKey, (old) =>
      old ? [...old, next] : old,
    );
  }
  qc.removeQueries({ queryKey: [CALENDAR_EVENTS_QUERY_KEY, 'event', id] });
  for (const m of monthsTouched(...instants))
    void qc.invalidateQueries({ queryKey: calendarEventsQuery(m).queryKey });
}

/** After Ubah acara: the event moves to its new day; the old and the new month are fetched again. */
export function eventChanged(
  qc: QueryClient,
  before: CalendarEvent,
  after: CalendarEvent,
) {
  rewrite(qc, before.id, after, [before.start, after.start]);
}

/** After Hapus acara: gone from every month; its month is fetched again. */
export function eventDeleted(qc: QueryClient, event: CalendarEvent) {
  rewrite(qc, event.id, null, [event.start]);
}
