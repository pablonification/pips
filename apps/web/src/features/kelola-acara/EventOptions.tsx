/**
 * Ubah acara and Hapus acara (a proposal; FEATURES.md §15, SPEC story 112): in the event detail (the phone sheet
 * and desktop's side column), for whoever may manage that event's category, a `menuBtn`-style button opening
 * P0-A's Menu, like the prototype's `menuList`. Ubah acara is the add-event dialog filled from the event; Hapus
 * acara asks first (`OV.confirm`'s layout). The Garis set has no edit icon, so Ubah acara has none. The dialog's
 * code loads only when chosen.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';
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

export function EventOptions({ event }: { event: CalendarEvent }) {
  const user = useSession();
  if (!canManageEvent(user, event.category)) return null;
  return <Options event={event} />;
}

function Options({ event }: { event: CalendarEvent }) {
  const [open, setOpen] = useState<'ubah' | 'hapus' | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const desk = useMediaQuery(DESKTOP_QUERY);
  const setPick = useDeskPick();
  const closeEvent = useCloseEvent();

  const remove = useMutation({
    mutationFn: () => api.calendar.deleteCalendarEvent({ eventId: event.id }),
  });

  const deleted = () => {
    setOpen(null);
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

  return (
    <>
      <Menu
        trigger={
          <IconButton
            label={fill(t.opsi, { judul: event.title })}
            size="sm"
            className="ml-auto"
          >
            <IconLainnya size={20} />
          </IconButton>
        }
      >
        <MenuItem onSelect={() => setOpen('ubah')}>{t.ubah}</MenuItem>
        <MenuItem
          danger
          icon={<IconHapus size={20} />}
          onSelect={() => setOpen('hapus')}
        >
          {t.hapus}
        </MenuItem>
      </Menu>
      {open === 'ubah' ? (
        <Suspense fallback={null}>
          <EventDialog
            mode={{ kind: 'edit', event }}
            onOpenChange={(o) => {
              if (!o) setOpen(null);
            }}
            onSaved={(saved) => {
              setOpen(null);
              eventChanged(qc, event, saved);
              toast.success(t.diperbarui);
              // A moved date: Kalender goes to the event's new day.
              const day = dayKeyOf(saved.start);
              if (pathname === '/kalender' && day !== dayKeyOf(event.start))
                void navigate({
                  to: '/kalender',
                  search: (s) => ({ ...s, hari: day }),
                  replace: true,
                });
            }}
            onFailed={(e) => reportWriteFailure(e, qc)}
          />
        </Suspense>
      ) : null}
      <ConfirmDialog
        open={open === 'hapus'}
        onOpenChange={(o) => {
          if (!o && !remove.isPending) setOpen(null);
        }}
        title={t.hapusJudul}
        cancelLabel={t.batal}
        confirmLabel={t.hapusTombol}
        danger
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
    </>
  );
}
