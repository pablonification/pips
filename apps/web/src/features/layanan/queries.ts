import { queryOptions } from '@tanstack/react-query';
import { api } from '~/api/client';
import { CHATROOMS_QUERY_KEY } from '~/api/constants';

/** Unread Curhat messages per room. Under the chatrooms key, so Curhat's own refreshes renew it too. */
export const curhatUnreadQuery = () =>
  queryOptions({
    queryKey: [CHATROOMS_QUERY_KEY, 'unread'],
    queryFn: () => api.curhat.unreadCountChatroomMessages(),
  });
