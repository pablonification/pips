/**
 * Beranda's reads. Every call goes through the generated client and the shared query keys, so other screens' writes
 * refresh Beranda: Pengumuman's read marks (`INFO_LIST_QUERY_KEY`), Curhat's read marks and rooms
 * (`CHATROOMS_QUERY_KEY`; the unread count is the shared `curhatUnreadQuery`, as on Curhat and Layanan), forms
 * (`FORM_QUERY_KEY`). Each section loads and fails on its own; the agenda card never waits for them.
 */
import { useQuery } from '@tanstack/react-query';
import {
  chatroomsQuery,
  curhatUnreadQuery,
  formListQuery,
  unreadInfosQuery,
} from '~/api/queries';

/**
 * The Kelola summary's forms and count (admin only) are Kelola's own queries: one request serves both screens, and a
 * live event on the live page refreshes the card's number too.
 */
export {
  adminFormsQuery,
  formResponsesCountQuery as responsesCountQuery,
} from '~/features/kelola/queries';

export const useChatrooms = () => useQuery(chatroomsQuery());
export const useCurhatUnread = () => useQuery(curhatUnreadQuery());
export const useForms = () => useQuery(formListQuery());
export const useUnreadInfos = () => useQuery(unreadInfosQuery());
