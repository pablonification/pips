import { CHATROOMS_QUERY_KEY, CURHAT_UNREAD_KEY } from '~/api/constants';

/** The rooms (`GET /curhat/chatrooms`). */
export const ROOMS_KEY = [CHATROOMS_QUERY_KEY] as const;
/** The unread counts: the same key Beranda and Layanan read, so they share one request and one entry. */
export const UNREAD_KEY = CURHAT_UNREAD_KEY;
