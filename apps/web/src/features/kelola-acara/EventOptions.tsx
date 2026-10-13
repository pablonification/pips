/**
 * Ubah acara and Hapus acara (a proposal; FEATURES.md §15, SPEC story 112): in the event detail (the phone sheet
 * and desktop's side column), for whoever may manage that event's category, a `menuBtn`-style button opening
 * P0-A's Menu, like the prototype's `menuList`. Ubah acara is the add-event dialog filled from the event; Hapus
 * acara asks first (`OV.confirm`'s layout). The Garis set has no edit icon, so Ubah acara has none (its label keeps
 * the icon column). The dialog's code loads only when chosen.
 *
 * The dialogs live in one host per screen (`EventManageHost`), outside the slot that moves between the sheet and the
 * side column, so turning a tablet across 1024 px keeps an open dialog and what was typed (review m3). Kalender puts
 * the host around both layouts; elsewhere (Beranda's sheet, which never moves) the button brings its own.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from '@tanstack/react-router';
import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '~/api/client';
import type { CalendarEvent } from '~/api/generated';
import {
  ConfirmDialog,
  DESKTOP_QUERY,
  IconButton,
  Menu,
  MenuItem,
  toast,
  useMediaQuery,
} from '~/components/garis';
import { IconHapus } from '~/components/icons/hapus';
import { IconLainnya } from '~/components/icons/lainnya';
import { focusPageTitle } from '~/components/shell/focus';
import { fill } from '~/copy/fill';
import { kelolaAcara as t } from '~/copy/kelola-acara';
import useSession from '~/hooks/auth/useSession';
import { canManageEvent } from '~/lib/capabilities';
import { dayKeyOf } from '~/lib/days';
import { useDeskPick } from '~/features/kalender/desk-pick';
import { useCloseEvent } from '~/features/kalender/open';
import { reportWriteFailure } from '~/features/kelola-tulis/write';
import { eventChanged, eventDeleted } from './cache';

const EventDialog = lazy(() => import('./EventDialog'));

interface Target {
  kind: 'ubah' | 'hapus';
  event: CalendarEvent;
}

interface Host {
  open: (target: Target) => void;
  /** Ubah acara or Hapus acara is open. */
  managing: boolean;
}

const EventManageContext = createContext<Host | null>(null);

/**
 * Whether one of the host's dialogs is open. The phone sheet doesn't open under one it wasn't already under (coming
 * back from the desktop layout, where the event was in the side column): it would cover the dialog and take its focus.
 */
export const useEventManaging = () =>
  useContext(EventManageContext)?.managing ?? false;

/** Holds Ubah acara's and Hapus acara's dialogs for the event options inside it. */
export function EventManageHost({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);
  const host = useMemo(
    () => ({ open: setTarget, managing: target !== null }),
    [target],
  );
  return (
    <EventManageContext.Provider value={host}>
      {children}
      {target ? (
        <Dialogs
          key={target.event.id}
          target={target}
          onClose={() => setTarget(null)}
        />
      ) : null}
    </EventManageContext.Provider>
  );
}

export function EventOptions({ event }: { event: CalendarEvent }) {
  const user = useSession();
  const host = useContext(EventManageContext);
  if (!canManageEvent(user, event.category)) return null;
  const button = <OptionsButton event={event} />;
  return host ? button : <EventManageHost>{button}</EventManageHost>;
}

function OptionsButton({ event }: { event: CalendarEvent }) {
  const { open } = useContext(EventManageContext)!;
  return (
    <Menu
      trigger={
        <IconButton
          label={fill(t.opsi, { judul: event.title })}
          size="sm"
          // Overhangs the tag row instead of making it taller (review m8); touch layouts keep the 44 px area.
          className="-my-[5px] ml-auto"
        >
          <IconLainnya size={20} />
        </IconButton>
      }
    >
      <MenuItem inset onSelect={() => open({ kind: 'ubah', event })}>
        {t.ubah}
      </MenuItem>
      <MenuItem
        danger
        icon={<IconHapus size={20} />}
        onSelect={() => open({ kind: 'hapus', event })}
      >
        {t.hapus}
      </MenuItem>
    </Menu>
  );
}

function Dialogs({ target, onClose }: { target: Target; onClose: () => void }) {
  const { event } = target;
  const user = useSession();
  const allowed = canManageEvent(user, event.category);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const desk = useMediaQuery(DESKTOP_QUERY);
  const setPick = useDeskPick();
  const closeEvent = useCloseEvent();
  const saved = useRef(false);

  const remove = useMutation({
    mutationFn: () => api.calendar.deleteCalendarEvent({ eventId: event.id }),
  });

  // A role taken away while a dialog is open (a refused write asks for `me` again): the dialog goes with the options.
  useEffect(() => {
    if (!allowed) onClose();
  }, [allowed, onClose]);
  if (!allowed) return null;

  const deleted = () => {
    onClose();
    eventDeleted(qc, event);
    toast.success(t.dihapus);
    if (desk) {
      // The side column chooses nothing (the brief), on the same day.
      setPick?.('none');
      void navigate({
        to: '/kalender',
        search: (s) => ({ ...s, acara: undefined }),
        replace: true,
      });
    } else closeEvent(event.id);
    requestAnimationFrame(focusPageTitle);
  };

  const changed = (next: CalendarEvent) => {
    saved.current = true;
    onClose();
    eventChanged(qc, event, next);
    toast.success(t.diperbarui);
    if (pathname !== '/kalender') {
      closeEvent(event.id);
      return;
    }
    // Kalender on the event's (maybe new) day (review m1): desktop's side column shows it, from the URL; on phones
    // and tablets the detail closes onto the day's list.
    const hari = dayKeyOf(next.start);
    if (desk)
      void navigate({
        to: '/kalender',
        search: (s) => ({ ...s, hari, acara: next.id }),
        replace: true,
      });
    else closeEvent(event.id, { hari });
  };

  if (target.kind === 'ubah')
    return (
      <Suspense fallback={null}>
        <EventDialog
          mode={{ kind: 'edit', event }}
          onOpenChange={(o) => {
            if (!o) onClose();
          }}
          onSaved={changed}
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

  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => {
        if (!o && !remove.isPending) onClose();
      }}
      title={t.hapusJudul}
      cancelLabel={t.batal}
      confirmLabel={t.hapusTombol}
      danger
      busy={remove.isPending}
      onConfirm={() => {
        if (remove.isPending) return;
        remove.mutate(undefined, {
          onSuccess: deleted,
          onError: (e) => reportWriteFailure(e, qc),
        });
      }}
    >
      {t.hapusIsi}
    </ConfirmDialog>
  );
}
