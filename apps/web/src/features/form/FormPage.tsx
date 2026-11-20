import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { ApiError } from '~/api/generated';
import { EmptyState, ErrorState } from '~/components/garis';
import { PageBody } from '~/components/shell/page';
import { form as formCopy } from '~/copy/form';
import { isi } from '~/copy/isi';
import { loadFormIsi } from './load';
import { Loading, ToList } from './parts';
import { formQuery } from './queries';

const FormIsi = lazy(() => loadFormIsi().then((m) => ({ default: m.FormIsi })));
const FormFill = lazy(() =>
  import('~/components/form/FormFill').then((m) => ({ default: m.FormFill })),
);

const loading = (
  <PageBody>
    <Loading />
  </PageBody>
);

/**
 * Layanan › Form › a form. A form made before the builder (no owner: the PIXEL form) keeps the screen it has always
 * had; every other form is filled on one page under its gold cover (FormIsi).
 */
export function FormPage({ formId }: { formId: string }) {
  const detail = useQuery(formQuery(formId));
  const form = detail.data;
  if (form)
    return (
      <Suspense fallback={loading}>
        {form.owner === null ? (
          <FormFill formId={formId} />
        ) : (
          <FormIsi form={form} refetch={detail.refetch} />
        )}
      </Suspense>
    );
  if (detail.isError) {
    const notFound =
      detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <PageBody>
        {notFound ? (
          <EmptyState
            title={formCopy.tidakAda.judul}
            text={formCopy.tidakAda.isi}
            action={<ToList label={formCopy.keDaftar} />}
          />
        ) : (
          <ErrorState
            title={isi.keadaan.gagal}
            onRetry={() => void detail.refetch()}
            retrying={detail.isFetching}
          />
        )}
      </PageBody>
    );
  }
  return loading;
}
