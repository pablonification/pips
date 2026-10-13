/**
 * Opening and closing an event (brief item 6). The open event lives in the URL (`acara`, P0-B's param), so reload and
 * shared links reopen it:
 * - phones and tablets: a sheet over Beranda or Kalender (the page it was opened from); from anywhere else, over
 *   Kalender on the event's day;
 * - desktop: Kalender with the event in its side column, from anywhere (the prototype's `openEvent`).
 * Opening adds a history entry, so Back closes the sheet; closing one opened here goes back, and one that came with
 * the page (a shared link, a reload) is closed in place.
 */
import { useLocation, useNavigate, useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { DESKTOP_QUERY, useMediaQuery } from '~/components/garis';
import { startDay, type CalEvent } from './rules';

/** The event this page opened itself (so closing it can go back instead of adding an entry). */
let openedHere: string | null = null;

export function useOpenEvent() {
  const navigate = useNavigate();
  const desk = useMediaQuery(DESKTOP_QUERY);
  const { pathname } = useLocation();
  return useCallback(
    (e: CalEvent) => {
      const hari = startDay(e);
      if (desk) {
        // Already on Kalender: choosing another event replaces the entry, as choosing a day does.
        void navigate({
          to: '/kalender',
          search: { hari, acara: e.id },
          replace: pathname === '/kalender',
        });
        return;
      }
      openedHere = e.id;
      if (pathname === '/')
        void navigate({ to: '/', search: (s) => ({ ...s, acara: e.id }) });
      else if (pathname === '/kalender')
        void navigate({
          to: '/kalender',
          search: (s) => ({ ...s, acara: e.id }),
        });
      else void navigate({ to: '/kalender', search: { hari, acara: e.id } });
    },
    [desk, navigate, pathname],
  );
}

export function useCloseEvent() {
  const navigate = useNavigate();
  const router = useRouter();
  const { pathname } = useLocation();
  return useCallback(
    /** `then.hari` (P3-B, after Ubah acara on Kalender): close onto that day, replacing the entry instead of going back. */
    (id: string, then?: { hari: string }) => {
      if (then) {
        openedHere = null;
        void navigate({
          to: '/kalender',
          search: (s) => ({ ...s, acara: undefined, hari: then.hari }),
          replace: true,
        });
        return;
      }
      if (openedHere === id && router.history.canGoBack()) {
        openedHere = null;
        router.history.back();
        return;
      }
      openedHere = null;
      const to = pathname === '/kalender' ? '/kalender' : '/';
      void navigate({
        to,
        search: (s) => ({ ...s, acara: undefined }),
        replace: true,
      });
    },
    [navigate, pathname, router],
  );
}
