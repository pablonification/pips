import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { lazy, Suspense, useEffect } from 'react';
import type { ManageForm } from '~/api/generated';
import {
  Button,
  ErrorState,
  Skeleton,
  SkeletonBlock,
} from '~/components/garis';
import { IconMata } from '~/components/icons/mata';
import { PageBody, usePageTitle } from '~/components/shell/page';
import { setTitleFor } from '~/components/shell/shell-state';
import { kelolaForm as copy } from '~/copy/kelola-form';
import { loadFormIsi } from '~/features/form/load';
import { manageFormQuery } from './data';
import { previewDetail } from './rules';
import '~/styles/garis/form-builder.css';

const FormIsi = lazy(() => loadFormIsi().then((m) => ({ default: m.FormIsi })));

const loading = (
  <PageBody>
    <Skeleton label={copy.memuat}>
      <SkeletonBlock height={160} />
    </Skeleton>
  </PageBody>
);

/** Pratinjau: the member's own form (Layanan › Form) as its maker built it, under a bar that says nothing is sent. */
export function PreviewScreen({ formId }: { formId: string }) {
  const form = useQuery(manageFormQuery(formId));
  usePageTitle(copy.pratinjau.judul);
  // Opened straight from its address, the breadcrumb to the builder still reads the form's title.
  const title = form.data
    ? form.data.title.trim() || copy.daftar.tanpaJudul
    : null;
  useEffect(() => {
    if (title) setTitleFor(`/kelola/form/${formId}`, title);
  }, [formId, title]);
  if (form.isPending) return loading;
  if (form.isError)
    return (
      <PageBody>
        <ErrorState
          title={copy.gagal}
          onRetry={() => void form.refetch()}
          retrying={form.isFetching}
        />
      </PageBody>
    );
  return <Preview form={form.data} refetch={form.refetch} />;
}

function Preview({
  form,
  refetch,
}: {
  form: ManageForm;
  refetch: () => Promise<unknown>;
}) {
  const navigate = useNavigate();
  const close = () =>
    void navigate({ to: '/kelola/form/$formId', params: { formId: form.id } });
  const bar = (
    <div className="fb-pv-bar">
      <IconMata size={16} />
      <span className="flex-1">{copy.pratinjau.bar}</span>
      <Button variant="gold" size="sm" onClick={close}>
        {copy.pratinjau.tutupPratinjau}
      </Button>
    </div>
  );
  return (
    <Suspense fallback={loading}>
      <FormIsi form={previewDetail(form)} refetch={refetch} preview={bar} />
    </Suspense>
  );
}
