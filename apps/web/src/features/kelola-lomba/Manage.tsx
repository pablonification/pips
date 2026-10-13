/**
 * Info Lomba's management for `cnc` (a proposal; FEATURES.md gap 3): Tambah lomba in P2-B's page-header slot, a
 * gold small button like `addEvBtn`; Ubah lomba and Hapus lomba in a `menuBtn`-style button on each card. After a
 * change, the list is fetched again (P2-B's `competitions` key), the toast shows and focus goes to the page title.
 * Nobody else sees them; the server checks the role too. The dialog's code loads only when it opens.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import { api } from '~/api/client';
import type { Competition } from '~/api/generated';
import {
  Button,
  ConfirmDialog,
  IconButton,
  Menu,
  MenuItem,
  toast,
} from '~/components/garis';
import { IconHapus } from '~/components/icons/hapus';
import { IconLainnya } from '~/components/icons/lainnya';
import { IconTambah } from '~/components/icons/tambah';
import { focusPageTitle } from '~/components/shell/focus';
import { fill } from '~/copy/fill';
import { kelolaLomba as t } from '~/copy/kelola-lomba';
import useSession from '~/hooks/auth/useSession';
import { can } from '~/lib/capabilities';
import { reportWriteFailure } from '~/features/kelola-tulis/write';
import '~/features/kelola-tulis/kelola-tulis.css';

const LombaDialog = lazy(() => import('./LombaDialog'));

/** P2-B's list key: every page is fetched again. */
const COMPETITIONS_KEY = ['competitions'];

/** After a save: the toast, and focus on the page title once the dialog has closed. */
function useAfterSave() {
  const qc = useQueryClient();
  const saved = useRef(false);
  return {
    qc,
    done(message: string) {
      saved.current = true;
      void qc.invalidateQueries({ queryKey: COMPETITIONS_KEY });
      toast.success(message);
    },
    onCloseAutoFocus(e: Event) {
      if (!saved.current) return;
      saved.current = false;
      e.preventDefault();
      requestAnimationFrame(focusPageTitle);
    },
  };
}

/**
 * Tambah lomba: the button, and its one dialog. The screen puts the button in the desktop head and the top bar, and
 * the dialog once outside both, so turning a tablet across 1024 px (the button moving between them) keeps the dialog
 * and what was typed (review m3).
 */
export function useTambahLomba(): { button: ReactNode; dialog: ReactNode } {
  const user = useSession();
  const [open, setOpen] = useState(false);
  const after = useAfterSave();
  if (!can(user, 'createCompetition')) return { button: null, dialog: null };
  return {
    button: (
      <Button variant="gold" size="sm" onClick={() => setOpen(true)}>
        <IconTambah size={16} />
        {t.tambah}
      </Button>
    ),
    dialog: open ? (
      <Suspense fallback={null}>
        <LombaDialog
          onOpenChange={setOpen}
          onSaved={() => {
            after.done(t.ditambahkan);
            setOpen(false);
          }}
          onFailed={(e) => reportWriteFailure(e, after.qc)}
          onCloseAutoFocus={after.onCloseAutoFocus}
        />
      </Suspense>
    ) : null,
  };
}

/** For `cnc`: "Opsi untuk {name}" at the card's top right, with Ubah lomba and Hapus lomba (danger). */
export function LombaOptions({ competition }: { competition: Competition }) {
  const user = useSession();
  if (!can(user, 'manageCompetition')) return null;
  return <Options c={competition} />;
}

function Options({ c }: { c: Competition }) {
  const [open, setOpen] = useState<'ubah' | 'hapus' | null>(null);
  const after = useAfterSave();
  const remove = useMutation({
    mutationFn: () =>
      api.competitions.deleteCompetition({ competitionId: c.id }),
  });

  return (
    <>
      <Menu
        trigger={
          <IconButton label={fill(t.opsi, { nama: c.name })} size="sm">
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
          <LombaDialog
            competition={c}
            onOpenChange={(o) => {
              if (!o) setOpen(null);
            }}
            onSaved={() => {
              after.done(t.diperbarui);
              setOpen(null);
            }}
            onFailed={(e) => reportWriteFailure(e, after.qc)}
            onCloseAutoFocus={after.onCloseAutoFocus}
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
        busy={remove.isPending}
        onConfirm={() => {
          if (remove.isPending) return;
          remove.mutate(undefined, {
            onSuccess: () => {
              after.done(t.dihapus);
              setOpen(null);
            },
            onError: (e) => reportWriteFailure(e, after.qc),
          });
        }}
        onCloseAutoFocus={after.onCloseAutoFocus}
      >
        {fill(t.hapusIsi, { nama: c.name })}
      </ConfirmDialog>
    </>
  );
}
