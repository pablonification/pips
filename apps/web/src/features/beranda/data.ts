/**
 * Beranda's reads (P1-A brief, "Data"). Every call through the generated client and P0-B's shared keys, so other
 * screens' writes refresh Beranda: Pengumuman's read marks (`INFO_LIST_QUERY_KEY`), Curhat's read marks and rooms
 * (`CHATROOMS_QUERY_KEY`, the same unread key P1-C's Layanan uses), forms (`FORM_QUERY_KEY`). Each section loads and
 * fails on its own; the agenda card never waits for them.
 */
import { queryOptions, useQuery } from '@tanstack/react-query';
import { api } from '~/api/client';
import { CHATROOMS_QUERY_KEY } from '~/api/constants';
import { chatroomsQuery, formListQuery, unreadInfosQuery } from '~/api/queries';

/** Unread Curhat messages per room. Under the chatrooms key, so Curhat's own refreshes renew it too. */
export const curhatUnreadQuery = () =>
  queryOptions({
    queryKey: [CHATROOMS_QUERY_KEY, 'unread'],
    queryFn: () => api.curhat.unreadCountChatroomMessages(),
  });

/**
 * The Kelola summary's forms and count (admin only) are Kelola's own queries (review P3-A m6): one request serves
 * both screens, and a live event on the live page refreshes the card's number too.
 */
export {
  adminFormsQuery,
  formResponsesCountQuery as responsesCountQuery,
} from '~/features/kelola/queries';

export const useChatrooms = () => useQuery(chatroomsQuery());
export const useCurhatUnread = () => useQuery(curhatUnreadQuery());
export const useForms = () => useQuery(formListQuery());
export const useUnreadInfos = () => useQuery(unreadInfosQuery());
