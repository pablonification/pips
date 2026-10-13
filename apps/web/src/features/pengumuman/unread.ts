/**
 * Pengumuman's unread count, on its own: the shell's navigation badge loads this on every page, so it imports only
 * the query key, not the feature's rules, copy, dates or pixel art (review minor 6). Pure, for the unit tests; the
 * query is in ./unread-query.ts.
 */
import { INFO_LIST_QUERY_KEY } from '~/api/constants';

/** The API's page size for `GET /api/info`. */
export const PAGE_SIZE = 10;

/** Open question 2: no count endpoint, so the count pages `GET /api/info?unread=true` in the background. */
export const UNREAD_PAGES = 10;
export const UNREAD_SHOWN_MAX = 99;

export const UNREAD_KEY = [INFO_LIST_QUERY_KEY, 'unread-ids'] as const;

/** The count as the badges and the chip show it: hidden at 0, "99+" past the cap. */
export function unreadLabel(n: number) {
  if (n <= 0) return null;
  return n > UNREAD_SHOWN_MAX ? `${UNREAD_SHOWN_MAX}+` : String(n);
}

/**
 * Pages the unread ids: `fetchPage(offset)` until a short page or `UNREAD_PAGES` pages. The count ignores the
 * feed's search and filter (`unreadN` counts every visible unread post).
 */
export async function pageUnreadIds(
  fetchPage: (offset: number) => Promise<{ id: string }[]>,
) {
  const ids: string[] = [];
  for (let page = 0; page < UNREAD_PAGES; page++) {
    const infos = await fetchPage(page * PAGE_SIZE);
    for (const i of infos) if (!ids.includes(i.id)) ids.push(i.id);
    if (infos.length < PAGE_SIZE) break;
  }
  return ids;
}
