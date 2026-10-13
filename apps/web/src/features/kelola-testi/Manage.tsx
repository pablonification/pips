/**
 * Tambah testimoni (a proposal; SPEC story 112) on a Testi Matkul course page, for `akademik` only (not `admin`,
 * as the API). A gold small button like `addEvBtn`. After adding, the course's testimonials are fetched again (the
 * course list counts them with the same key), the pager shows the new one, the toast shows and focus goes to the
 * page title. The server checks the role too. The dialog's code loads only when it opens.
 */
import { useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { lazy, Suspense, useRef, useState } from 'react';
import type { Course, Testimoni } from '~/api/generated';
import { Button, toast } from '~/components/garis';
import { IconTambah } from '~/components/icons/tambah';
import { focusPageTitle } from '~/components/shell/focus';
import { kelolaTesti as t } from '~/copy/kelola-testi';
import useSession from '~/hooks/auth/useSession';
import { can } from '~/lib/capabilities';
import { testimoniQuery } from '~/features/testi/queries';
import { reportWriteFailure } from '~/features/kelola-tulis/write';

const TestiDialog = lazy(() => import('./TestiDialog'));
const courseRoute = getRouteApi(
  '/_app/_left-navbar/layanan/testi_/$type/$semester/$courseId/',
);

export function TambahTestimoni({ course }: { course: Course }) {
  const user = useSession();
  if (!can(user, 'createTestimonial')) return null;
  return <Tambah course={course} />;
}

function Tambah({ course }: { course: Course }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = courseRoute.useNavigate();
  const saved = useRef(false);

  const done = async (created: Testimoni) => {
    saved.current = true;
    setOpen(false);
    toast.success(t.ditambahkan);
    const query = testimoniQuery(course.id);
    await qc.invalidateQueries({ queryKey: query.queryKey });
    const at = qc
      .getQueryData(query.queryKey)
      ?.findIndex((x) => x.id === created.id);
    if (at != null && at >= 0)
      void navigate({
        search: (prev) => ({ ...prev, page: at + 1 }),
        replace: true,
      });
  };

  return (
    <>
      <Button variant="gold" size="sm" onClick={() => setOpen(true)}>
        <IconTambah size={16} />
        {t.tambah}
      </Button>
      {open ? (
        <Suspense fallback={null}>
          <TestiDialog
            course={course}
            onOpenChange={setOpen}
            onSaved={(x) => void done(x)}
            onFailed={(e) => reportWriteFailure(e, qc)}
            onCloseAutoFocus={(e) => {
              if (!saved.current) return;
              saved.current = false;
              e.preventDefault();
              requestAnimationFrame(focusPageTitle);
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}
