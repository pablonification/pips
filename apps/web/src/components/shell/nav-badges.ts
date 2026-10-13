/**
 * The counts the navigation shows next to a destination: today only Pengumuman's unread posts (SPEC story 16),
 * on the phone tab, the tablet rail and the desktop sidebar; hidden at 0. The feature registers its count at start
 * (src/main.tsx), so the badge shows on every page while the shell imports no feature code; the shell renders
 * whatever it returns (`aria-hidden` badge, the words for screen readers).
 */
import type { Destination } from '~/lib/shell/routes';

export type NavBadges = Partial<Record<Destination, number>>;

export interface NavBadgeSource {
  /** A hook returning the counts per destination. */
  useBadges: () => NavBadges;
  /** A count as shown, for example "99+" past a cap. */
  label: (n: number) => string;
}

let source: NavBadgeSource | null = null;
const noBadges = (): NavBadges => ({});

/** Registered once, at start (src/main.tsx), before the first render. */
export function registerNavBadges(badges: NavBadgeSource) {
  source = badges;
}

export function useNavBadges(): NavBadges {
  // The source is set before the first render and never changes, so every render calls the same hook.
  const useRegisteredBadges = source?.useBadges ?? noBadges;
  return useRegisteredBadges();
}

/** The badge as shown: "4", or the registered cap ("99+"). */
export const badgeText = (n: number) => source?.label(n) ?? String(n);
