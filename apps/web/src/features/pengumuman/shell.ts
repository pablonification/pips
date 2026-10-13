/**
 * Pengumuman's unread count for the shell's navigation badge (SPEC story 16), counted whatever the feed's search
 * and filter (`unreadN`). Registered at start (src/main.tsx), so the badge shows on every page; it loads only the
 * count's small modules, not the feature's rules, copy or dates (review minor 6), and the shell imports no feature
 * code.
 */
import {
  registerNavBadges,
  type NavBadges,
} from '~/components/shell/nav-badges';
import { unreadLabel } from './unread';
import { useUnreadIds } from './unread-query';

function useUnreadBadges(): NavBadges {
  const { data } = useUnreadIds();
  return data?.length ? { pengumuman: data.length } : {};
}

registerNavBadges({
  useBadges: useUnreadBadges,
  label: (n) => unreadLabel(n) ?? '',
});
