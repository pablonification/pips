import { queryOptions, type QueryKey } from '@tanstack/react-query';
import { queryClient } from './client';
import * as api from './generated/operations';
import {
  CALENDAR_EVENTS_QUERY_KEY,
  CHATROOMS_QUERY_KEY,
  CREDITS_QUERY_KEY,
  CURRENT_COURSES_QUERY_KEY,
  CURHAT_UNREAD_KEY,
  FORM_QUERY_KEY,
  INFO_LIST_QUERY_KEY,
  INFO_QUERY_KEY,
  ME_QUERY_KEY,
  UNREAD_INFOS_KEY_PART,
  USER_ACADEMIC_QUERY_KEY,
} from './constants';

/*
 * Query options shared by route loaders (which start the request while the route's code downloads) and the
 * screens (which then pick up the same request instead of starting another). Keys from ./constants.
 */

/**
 * For route loaders: start a request while the route's code downloads, without waiting for it. Only once a
 * member is known (cached or checked): on a first visit nothing is asked for before the session check, so a
 * signed-out visitor's deep link never requests the page's data.
 */
export function prefetch(options: { queryKey: QueryKey; queryFn?: unknown }) {
  if (!queryClient.getQueryData([ME_QUERY_KEY])) return;
  void queryClient.prefetchQuery(
    options as Parameters<typeof queryClient.prefetchQuery>[0],
  );
}

/** Personal calendar for one month (1–12): Himpunan events plus Akademik events of this semester's courses. */
export const calendarEventsQuery = ({
  month,
  year,
}: {
  month: number;
  year: number;
}) =>
  queryOptions({
    queryKey: [CALENDAR_EVENTS_QUERY_KEY, { month, year }],
    queryFn: () => api.getPersonalCalendar({ month, year }),
  });

/** This semester's courses (Mata kuliahku, Ding Dong). */
export const currentCoursesQuery = () =>
  queryOptions({
    queryKey: [CURRENT_COURSES_QUERY_KEY],
    queryFn: () => api.getCurrentUserCourse(),
  });

export const userAcademicQuery = () =>
  queryOptions({
    queryKey: [USER_ACADEMIC_QUERY_KEY],
    queryFn: () => api.getUserAcademic(),
  });

export const formListQuery = () =>
  queryOptions({
    queryKey: [FORM_QUERY_KEY, 'list'],
    queryFn: () => api.listForms(),
  });

/** One definition for Curhat's list, Layanan's count and Beranda's row. */
export const curhatUnreadQuery = () =>
  queryOptions({
    queryKey: CURHAT_UNREAD_KEY,
    queryFn: () => api.unreadCountChatroomMessages(),
  });

export const chatroomsQuery = () =>
  queryOptions({
    queryKey: [CHATROOMS_QUERY_KEY],
    queryFn: () => api.getUserChatrooms(),
  });

export const creditsQuery = () =>
  queryOptions({
    queryKey: [CREDITS_QUERY_KEY],
    queryFn: () => api.getCredits(),
  });

/**
 * The newest unread posts, the feed's first page with only unread posts: Beranda's "Pengumuman belum dibaca", and the
 * first page the navigation badge counts (src/features/pengumuman/unread-query.ts), so a cold Beranda asks for it
 * once. Under the feed's key, so read marks refresh it, and kept on the device like that page
 * (persistence-policy.ts), so Beranda opens offline with it.
 */
export const unreadInfosQuery = () =>
  queryOptions({
    queryKey: [INFO_LIST_QUERY_KEY, UNREAD_INFOS_KEY_PART],
    queryFn: () =>
      api.getListInfo({ unread: 'true', sort: 'newest' }).then((r) => r.infos),
  });

export const infoDetailQuery = (infoId: string) =>
  queryOptions({
    queryKey: [INFO_QUERY_KEY, 'detail', infoId],
    queryFn: () => api.getInfoById({ infoId }),
  });

export const infoCommentsQuery = (infoId: string) =>
  queryOptions({
    queryKey: [INFO_QUERY_KEY, 'comments', infoId],
    queryFn: () =>
      api
        .getCommentsList({ infoId, sort: 'oldest' })
        .then((res) => res.comment),
  });
