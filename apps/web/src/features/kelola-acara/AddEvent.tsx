/**
 * Tambah acara's place in Kalender (brief step 5). The dialog lives in the URL (`/kalender?tambah=acara`):
 * opening adds a history entry, so Back on a phone closes the sheet; closing one opened here goes back, and one that
 * came with the page (a link from Layanan or Kelola, a reload) is closed in place. Without the capability the param
 * is dropped and nothing opens. The dialog's code loads only when it opens, so members never download it.
 *
 * After adding (the prototype's `addev` submit branch): Kalender on the event's day, on desktop the event chosen
 * when it's in your calendar (else nothing), the month refreshed, the toast, and focus on the page title.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { lazy, Suspense, useCallback, useEffect, useRef } from 'react';
import type { CalendarEvent, UserCourse } from '~/api/generated';
import { calendarEventsQuery, currentCoursesQuery } from '~/api/queries';
import { DESKTOP_QUERY, toast, useMediaQuery } from '~/components/garis';
import { focusPageTitle } from '~/components/shell/focus';
import useSession from '~/hooks/auth/useSession';
import { can, type EventCategory } from '~/lib/capabilities';
import { monthOf, type DayKey } from '~/lib/days';
import { useDeskPick } from '~/features/kalender/desk-pick';
import { reportWriteFailure } from '~/features/kelola-tulis/write';
import { addedToast, afterAdd, inMyCalendar } from './rules';

const EventDialog = lazy(() => import('./EventDialog'));

/** Whether this page opened the dialog itself (so closing it can go back instead of adding an entry). */
let openedHere = false;

export function useOpenAddEvent() {
  const navigate = useNavigate();
  return useCallback(() => {
    openedHere = true;
    void navigate({
      to: '/kalender',
      search: (s) => ({ ...s, tambah: 'acara' as const }),
    });
  }, [navigate]);
}

/** The ids of this semester's courses, from the cache Kalender already has. */
export function myCourseIds(taken: readonly UserCourse[] | undefined) {
  return new Set((taken ?? []).map((c) => c.courseId));
}

export function AddEventHost({ open, day }: { open: boolean; day: DayKey }) {
  const user = useSession();
  const categories: EventCategory[] = can(user, 'createAkademikEvent')
    ? ['akademik']
    : [];
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const desk = useMediaQuery(DESKTOP_QUERY);
  const setPick = useDeskPick();
  const saved = useRef(false);
  const allowed = categories.length > 0;

  const dropParam = useCallback(
    () =>
      void navigate({
        to: '/kalender',
        search: (s) => ({ ...s, tambah: undefined }),
        replace: true,
      }),
    [navigate],
  );
  // Nothing for anyone else, including a `?tambah=acara` link.
  useEffect(() => {
    if (open && !allowed) dropParam();
  }, [open, allowed, dropParam]);

  if (!open || !allowed) return null;

  const close = () => {
    if (openedHere && router.history.canGoBack()) {
      openedHere = false;
      router.history.back();
      return;
    }
    openedHere = false;
    dropParam();
  };

  const onSaved = (
    created: CalendarEvent,
    draft: Parameters<typeof addedToast>[0],
    course: Parameters<typeof addedToast>[1],
  ) => {
    saved.current = true;
    openedHere = false;
    const mine = myCourseIds(
      qc.getQueryData<UserCourse[]>(currentCoursesQuery().queryKey),
    );
    const next = afterAdd(created, mine, desk);
    const month = calendarEventsQuery(monthOf(next.hari));
    // Shown at once where it belongs, then fetched again from the API.
    if (inMyCalendar(created, mine))
      qc.setQueryData(month.queryKey, (old) =>
        old && !old.some((e) => e.id === created.id) ? [...old, created] : old,
      );
    void qc.invalidateQueries({ queryKey: month.queryKey });
    if (desk && !next.acara) setPick?.('none');
    // The dialog's URL is replaced by the event's day (and the event, on desktop).
    void navigate({
      to: '/kalender',
      search: (s) => ({
        ...s,
        tambah: undefined,
        hari: next.hari,
        acara: next.acara,
      }),
      replace: true,
    });
    toast.success(addedToast(draft, course));
  };

  return (
    <Suspense fallback={null}>
      <EventDialog
        mode={{ kind: 'add', categories, day }}
        onOpenChange={(o) => {
          if (!o) close();
        }}
        onSaved={onSaved}
        onFailed={(e) => reportWriteFailure(e, qc)}
        onCloseAutoFocus={(e) => {
          if (!saved.current) return;
          saved.current = false;
          e.preventDefault();
          requestAnimationFrame(focusPageTitle);
        }}
      />
    </Suspense>
  );
}
