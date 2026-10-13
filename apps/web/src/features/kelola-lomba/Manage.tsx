/**
 * Info Lomba's management for `cnc` (a proposal; FEATURES.md gap 3): Tambah lomba in P2-B's page-header slot, a
 * gold small button like `addEvBtn`. After adding, the list is fetched again (P2-B's `competitions` key), the toast
 * shows and focus goes to the page title. Nobody else sees it; the server checks the role too. The dialog's code
 * loads only when it opens.
 */
import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useRef, useState } from 'react';
import { Button, toast } from '~/components/garis';
import { IconTambah } from '~/components/icons/tambah';
import { focusPageTitle } from '~/components/shell/focus';
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

export function TambahLomba() {
  const user = useSession();
  const [open, setOpen] = useState(false);
  const after = useAfterSave();
  if (!can(user, 'createCompetition')) return null;
  return (
    <>
      <Button variant="gold" size="sm" onClick={() => setOpen(true)}>
        <IconTambah size={16} />
        {t.tambah}
      </Button>
      {open ? (
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
      ) : null}
    </>
  );
}
