/**
 * The counts the navigation shows next to a destination: today only Pengumuman's unread posts (SPEC story 16),
 * on the phone tab, the tablet rail and the desktop sidebar; hidden at 0. P1-B fills this in from its unread
 * count; the shell renders whatever it returns (`aria-hidden` badge, the words for screen readers).
 */
// Only the count's own small module: the badge shows on every page (P1-B review minor 6).
import { unreadLabel } from '~/features/pengumuman/unread';
import { useUnreadIds } from '~/features/pengumuman/unread-query';
import type { Destination } from '~/lib/shell/routes';

export type NavBadges = Partial<Record<Destination, number>>;

/** P1-B: Pengumuman's unread posts, counted whatever the feed's search and filter (`unreadN`). */
export function useNavBadges(): NavBadges {
  const { data } = useUnreadIds();
  return data?.length ? { pengumuman: data.length } : {};
}

/** The badge as shown: "4", or "99+" past the cap (open question 2). */
export const badgeText = (n: number) => unreadLabel(n) ?? '';
