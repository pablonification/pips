/**
 * Curhat's data (P2-C): the rooms (`GET /curhat/chatrooms`, there is no per-room endpoint), the unread counts, and
 * the writes. Everything lives under CHATROOMS_QUERY_KEY, so one refresh renews the rooms and the counts that
 * Beranda's "Balasan baru dari Welfare" (P1-A) and Layanan's count (P1-C) read. None of it is written to the
 * device: CHATROOMS_QUERY_KEY isn't on the persisted list (src/api/persistence-policy.ts; tests/curhat-rules.test.ts).
 */
import { useMutation, useQuery, type QueryClient } from '@tanstack/react-query';
import { createContext, useContext, useSyncExternalStore } from 'react';
import { api } from '~/api/client';
import type { Chatroom, ChatroomMessage, ListChatroom } from '~/api/generated';
import { chatroomsQuery, curhatUnreadQuery } from '~/api/queries';
import type { CurhatClient, CurhatClientState } from './client';
import { ROOMS_KEY, UNREAD_KEY } from './keys';
import {
  addUnread,
  clearUnread,
  totalUnread,
  unreadByRoom,
  withMessage,
  type UnreadRow,
} from './rules';

export { ROOMS_KEY, UNREAD_KEY };

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

/* ================= The cache ================= */

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
  qc.setQueryData<UnreadRow[]>(UNREAD_KEY, (rows) =>
    rows ? clearUnread(rows, chatroomId) : rows,
  );
}

export function addRoom(qc: QueryClient, room: Chatroom) {
  qc.setQueryData<ListChatroom>(ROOMS_KEY, (rooms) =>
    rooms ? { ...rooms, [room.id]: { messages: [], ...room } } : rooms,
  );
}

/** Mark a room read on the server (story 97), clearing its count at once; the counts are then fetched again. */
export function markRoomRead(qc: QueryClient, chatroomId: string) {
  qc.setQueryData<UnreadRow[]>(UNREAD_KEY, (rows) =>
    rows ? clearUnread(rows, chatroomId) : rows,
  );
  return api.curhat
    .readChatroomMessages({ chatroomId })
    .catch(() => undefined)
    .finally(() => void qc.invalidateQueries({ queryKey: UNREAD_KEY }));
}

/** A message arrived over the socket: into its room; counted unless that room is open, where it's read at once. */
export function receiveMessage(
  qc: QueryClient,
  client: Pick<CurhatClient, 'openRoom'>,
  message: ChatroomMessage,
) {
  if (!putMessage(qc, message)) {
    // A room this screen doesn't know yet: fetch the rooms again.
    void qc.invalidateQueries({ queryKey: ROOMS_KEY, exact: true });
  }
  if (message.isSender) return;
  if (client.openRoom === message.chatroomId)
    void markRoomRead(qc, message.chatroomId);
  else
    qc.setQueryData<UnreadRow[]>(UNREAD_KEY, (rows) =>
      addUnread(rows, message.chatroomId),
    );
}

/* ================= Writes ================= */

export const useCreateRoom = () =>
  useMutation({ mutationFn: () => api.curhat.createChatroom() });

export const useDeleteRoom = () =>
  useMutation({
    mutationFn: (chatroomId: string) =>
      api.curhat.deleteChatroom({ chatroomId }),
  });

/* ================= The connection ================= */

/** The area's connection, from the Curhat layout; null for Welfare (today's screen opens its own). */
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
