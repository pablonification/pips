/**
 * Tambah testimoni on a Testi Matkul course page, for `akademik` only (not `admin`, as the API). A gold small button.
 * After adding, the course's testimonials are fetched again (the course list counts them with the same key) and the
 * new one joins the page's cards, the toast shows and focus goes to the page title. The server checks the role too.
 * The dialog's code loads only when it opens.
 */
import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import type { Course } from '~/api/generated';
import { Button, toast } from '~/components/garis';
import { IconTambah } from '~/components/icons/tambah';
import { focusPageTitle } from '~/components/shell/focus';
import { kelolaTesti as t } from '~/copy/kelola-testi';
import useSession from '~/hooks/auth/useSession';
import { can } from '~/lib/capabilities';
import { testimoniQuery } from '~/features/testi/queries';
import { reportWriteFailure } from '~/features/kelola-tulis/write';

const TestiDialog = lazy(() => import('./TestiDialog'));

/**
 * Tambah testimoni for a course: its button and its dialog. The page renders the button once, where its layout shows
 * it (the desk head from 1024 px, the course's header row below), and the dialog once, apart from the button, so the
 * dialog stays open with what was typed when a tablet turns across 1024 px and the button moves. Nothing for anyone
 * but `akademik`.
 */
export function useTambahTestimoni(course: Course | undefined): {
  button: ReactNode;
  dialog: ReactNode;
} {
  const user = useSession();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const saved = useRef(false);
  if (!course || !can(user, 'createTestimonial'))
    return { button: null, dialog: null };

  const done = async () => {
    saved.current = true;
    setOpen(false);
    toast.success(t.ditambahkan);
    await qc.invalidateQueries({
      queryKey: testimoniQuery(course.id).queryKey,
    });
  };

  return {
    button: (
      <Button variant="gold" size="sm" onClick={() => setOpen(true)}>
        <IconTambah size={16} />
        {t.tambah}
      </Button>
    ),
    dialog: open ? (
      <Suspense fallback={null}>
        <TestiDialog
          course={course}
          onOpenChange={setOpen}
          onSaved={() => void done()}
          onFailed={(e) => reportWriteFailure(e, qc)}
          onCloseAutoFocus={(e) => {
            if (!saved.current) return;
            saved.current = false;
            e.preventDefault();
            requestAnimationFrame(focusPageTitle);
          }}
        />
      </Suspense>
    ) : null,
  };
}
