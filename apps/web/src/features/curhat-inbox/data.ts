/**
 * The inbox's data (P3-C): the rooms and unread counts are the member side's (`features/curhat/data.ts`; for Welfare
 * the API sends every room and counts every room). The one write of its own is the pin.
 */
import { useMutation, type QueryClient } from '@tanstack/react-query';
import { api } from '~/api/client';
import { ApiError, type ListChatroom } from '~/api/generated';
import { ROOMS_KEY } from '~/features/curhat/data';

export const statusOf = (e: unknown) =>
  e instanceof ApiError ? e.status : undefined;

/** `PUT /curhat/chatroom/{chatroomId}/pin`: pin or unpin a room for yourself (Welfare only; 401 for anyone else). */
export const usePinRoom = () =>
  useMutation({
    mutationFn: ({
      chatroomId,
      isPinned,
    }: {
      chatroomId: string;
      isPinned: boolean;
    }) => api.curhat.pinChatroom({ chatroomId, requestBody: { isPinned } }),
  });

/** The pin as the server now has it, in the rooms cache (no refetch: the list reorders at once). */
export function setPinned(
  qc: QueryClient,
  chatroomId: string,
  isPinned: boolean,
) {
  qc.setQueryData<ListChatroom>(ROOMS_KEY, (rooms) => {
    const room = rooms?.[chatroomId];
    if (!rooms || !room) return rooms;
    return { ...rooms, [chatroomId]: { ...room, isPinned } };
  });
}
