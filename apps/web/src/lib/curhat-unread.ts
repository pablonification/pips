/**
 * Curhat Yuk!'s unread counts (`GET /curhat/chatrooms/unread`), summed for Curhat's list, Layanan's count and
 * Beranda's "Balasan baru dari Welfare". Shared, so no feature imports another; the query is `curhatUnreadQuery` in
 * src/api/queries.ts. Unit-tested in tests/curhat-rules.test.ts.
 */
import { CHATROOMS_QUERY_KEY } from '~/api/constants';

/** Unread Curhat messages per room. Under the chatrooms key, so Curhat's own refreshes renew it too. */
export const CURHAT_UNREAD_KEY = [CHATROOMS_QUERY_KEY, 'unread'] as const;

export interface UnreadRow {
  chatroomId: string;
  unreadCount: number;
}

/** Unread Welfare messages per room (rooms without any are left out). */
export function unreadByRoom(
  rows: ReadonlyArray<UnreadRow> | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows ?? [])
    if (r.unreadCount > 0) out[r.chatroomId] = r.unreadCount;
  return out;
}

/** Unread messages summed over your rooms; a negative count counts as 0. */
export function totalUnread(
  rows: ReadonlyArray<{ unreadCount: number }> | undefined,
): number {
  return (rows ?? []).reduce((n, r) => n + Math.max(0, r.unreadCount), 0);
}
