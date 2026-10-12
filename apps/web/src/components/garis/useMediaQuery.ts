import { useCallback, useSyncExternalStore } from 'react';

/** Whether a media query matches, updating when it changes. False during server rendering. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** The desktop layout starts at 1024 px; below it, phones and tablets get sheets (garis.css). */
export const DESKTOP_QUERY = '(min-width: 1024px)';
