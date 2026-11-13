/**
 * Curhat's data: the rooms (`GET /curhat/chatrooms`, there is no per-room endpoint), the unread counts, and the
 * writes. Everything lives under CHATROOMS_QUERY_KEY, so one refresh renews the rooms and the counts that Beranda's
 * "Balasan baru dari Welfare" and Layanan's count read. None of it is written to the device: CHATROOMS_QUERY_KEY isn't
 * on the persisted list (src/api/persistence-policy.ts; tests/curhat-rules.test.ts).
 */
import {
  useMutation,
  useQuery,
  type QueryClient,
  type QueryFilters,
} from '@tanstack/react-query';
import { createContext, useContext, useSyncExternalStore } from 'react';
import { api } from '~/api/client';
import type { Chatroom, ChatroomMessage, ListChatroom } from '~/api/generated';
import { chatroomsQuery, curhatUnreadQuery } from '~/api/queries';
import type { CurhatClient, CurhatClientState } from './client';
import { CURHAT_UNREAD_KEY } from '~/api/constants';
import { ROOMS_KEY } from './keys';
import {
  addUnread,
  clearUnread,
  totalUnread,
  unreadByRoom,
  withMessage,
  type UnreadRow,
} from './rules';

export { ROOMS_KEY };

export const useRooms = () => useQuery(chatroomsQuery());

/** Unread counts per room and in total, for the list, and for Beranda and Layanan. */
export function useCurhatUnread() {
  const query = useQuery(curhatUnreadQuery());
  return {
    query,
    byRoom: unreadByRoom(query.data),
    total: totalUnread(query.data),
  };
}

/** A message (Welfare's reply, or yours once the server saved it) goes into its room, once. */
export function putMessage(qc: QueryClient, message: ChatroomMessage): boolean {
  let found = false;
  qc.setQueryData<ListChatroom>(ROOMS_KEY, (rooms) => {
    const room = rooms?.[message.chatroomId];
    if (!rooms || !room) return rooms;
    found = true;
    return {
      ...rooms,
      [room.id]: { ...room, messages: withMessage(room.messages, message) },
    };
  });
  return found;
}

export function removeRoom(qc: QueryClient, chatroomId: string) {
  qc.setQueryData<ListChatroom>(ROOMS_KEY, (rooms) => {
    if (!rooms || !(chatroomId in rooms)) return rooms;
    const next = { ...rooms };
    delete next[chatroomId];
    return next;
  });
  qc.setQueryData<UnreadRow[]>(CURHAT_UNREAD_KEY, (rows) =>
    rows ? clearUnread(rows, chatroomId) : rows,
  );
}

export function addRoom(qc: QueryClient, room: Chatroom) {
  qc.setQueryData<ListChatroom>(ROOMS_KEY, (rooms) =>
    rooms ? { ...rooms, [room.id]: { messages: [], ...room } } : rooms,
  );
}

/** Mark a room read on the server, clearing its count at once; the counts are then fetched again. */
export function markRoomRead(qc: QueryClient, chatroomId: string) {
  qc.setQueryData<UnreadRow[]>(CURHAT_UNREAD_KEY, (rows) =>
    rows ? clearUnread(rows, chatroomId) : rows,
  );
  return api.curhat
    .readChatroomMessages({ chatroomId })
    .catch(() => undefined)
    .finally(() => void qc.invalidateQueries({ queryKey: CURHAT_UNREAD_KEY }));
}

/**
 * Reads again from the server, dropping a read still on its way: that one started before whatever called for this,
 * so its answer would be older than what the screen shows. Invalidating alone would wait for a first read instead.
 */
export function readAgain(qc: QueryClient, filters: QueryFilters) {
  void qc.cancelQueries(filters).then(() => qc.invalidateQueries(filters));
}

/** A message arrived over the socket: into its room, and counted unless you sent it (the open room then reads it). */
export function receiveMessage(qc: QueryClient, message: ChatroomMessage) {
  const known = putMessage(qc, message);
  // The server saved the message before sending it, so a read started now holds it and one started earlier may not:
  // a read on its way is dropped and made again. A room this screen doesn't know yet is read for, too.
  const rooms = { queryKey: ROOMS_KEY, exact: true };
  if (!known || qc.isFetching(rooms) > 0) readAgain(qc, rooms);
  if (qc.isFetching({ queryKey: CURHAT_UNREAD_KEY }) > 0)
    readAgain(qc, { queryKey: CURHAT_UNREAD_KEY });
  if (message.isSender) return;
  qc.setQueryData<UnreadRow[]>(CURHAT_UNREAD_KEY, (rows) =>
    addUnread(rows, message.chatroomId),
  );
}

export const useCreateRoom = () =>
  useMutation({ mutationFn: () => api.curhat.createChatroom() });

export const useDeleteRoom = () =>
  useMutation({
    mutationFn: (chatroomId: string) =>
      api.curhat.deleteChatroom({ chatroomId }),
  });

/** The area's connection, from the members' Curhat layout or Welfare's inbox (curhat-inbox/Area.tsx); null elsewhere. */
export const CurhatClientContext = createContext<CurhatClient | null>(null);

export const useCurhatClient = () => useContext(CurhatClientContext);

const IDLE: CurhatClientState = { status: 'connecting', outbox: [] };
const noop = () => () => undefined;

/** The connection's status and what you sent that isn't delivered yet. */
export function useCurhatState(): CurhatClientState {
  const client = useCurhatClient();
  return useSyncExternalStore(
    client?.subscribe ?? noop,
    client?.getSnapshot ?? (() => IDLE),
    () => IDLE,
  );
}
