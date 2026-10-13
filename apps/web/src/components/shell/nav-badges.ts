/**
 * The counts the navigation shows next to a destination: today only Pengumuman's unread posts (SPEC story 16),
 * on the phone tab, the tablet rail and the desktop sidebar; hidden at 0. P1-B fills this in from its unread
 * count; the shell renders whatever it returns (`aria-hidden` badge, the words for screen readers).
 */
import type { Destination } from '~/lib/shell/routes';

export type NavBadges = Partial<Record<Destination, number>>;

export function useNavBadges(): NavBadges {
  return {};
}
