/**
 * Which of today's three nav items (Home, Timeline, Settings) is lit at a new URL, exactly as it was lit at the
 * old one: Home for everything that was under /home, Timeline for the feed and a post (not the composer, which
 * was /add-announcement), Settings for /settings. Kalender lit none. Goes with today's navbars, until P0-C.
 */
export type LegacyNavItem = 'home' | 'timeline' | 'settings';

const under = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

export function legacyNavItem(pathname: string): LegacyNavItem | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/' || under(path, '/layanan') || under(path, '/kelola')) {
    return 'home';
  }
  if (under(path, '/pengumuman') && !under(path, '/pengumuman/tulis')) {
    return 'timeline';
  }
  if (under(path, '/profil')) return 'settings';
  return null;
}

/**
 * Link props that light a nav item by `legacyNavItem` instead of the router's prefix match (which would light
 * Beranda at `/` for every page). The router lights an exact match itself; `inactiveProps` lights the rest with
 * the same class, `data-status` and `aria-current` the router would set.
 */
export function legacyNavLinkProps(
  item: LegacyNavItem,
  pathname: string,
  activeClassName: string,
) {
  const lit = legacyNavItem(pathname) === item;
  return {
    activeOptions: { exact: true },
    activeProps: { className: activeClassName },
    inactiveProps: lit
      ? {
          className: activeClassName,
          'data-status': 'active',
          'aria-current': 'page' as const,
        }
      : undefined,
  };
}
