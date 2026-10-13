import { CHATROOMS_QUERY_KEY } from '~/api/constants';

/** The rooms (`GET /curhat/chatrooms`). */
export const ROOMS_KEY = [CHATROOMS_QUERY_KEY] as const;
/** The unread counts: the same key P1-A's Beranda and P1-C's Layanan read, so they share one request and one entry. */
export const UNREAD_KEY = [CHATROOMS_QUERY_KEY, 'unread'] as const;
