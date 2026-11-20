import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  SkeletonBlock,
} from '~/components/garis';
import { PageBody, usePageTitle } from '~/components/shell/page';
import { kelolaForm as copy } from '~/copy/kelola-form';
import { statusOf } from '~/api/client';
import { useRoleLoss } from '../kelola/KelolaGate';
import { loadBuilder, manageFormQuery } from './data';
import '~/styles/garis/form-builder.css';

const Builder = lazy(() => loadBuilder().then((m) => ({ default: m.Builder })));

export type BuilderTab = 'pertanyaan' | 'jawaban' | 'setelan';

interface Props {
  formId: string;
  tab: BuilderTab | undefined;
  lihat: 'satu' | undefined;
  no: number | undefined;
}

/** A form in the builder: loads it, then the page for what the caller may do with it. */
export function BuilderScreen(props: Props) {
  const form = useQuery(manageFormQuery(props.formId));
  useRoleLoss(form.error);
  usePageTitle(
    form.data ? form.data.title.trim() || copy.daftar.tanpaJudul : null,
  );
  if (form.isPending) return <Loading />;
  if (form.isError)
    return (
      <PageBody>
        {statusOf(form.error) === 404 || statusOf(form.error) === 403 ? (
          <EmptyState
            title={copy.tidakDitemukan}
            text={copy.tidakDitemukanIsi}
            action={
              <Button asChild variant="paper">
                <Link to="/kelola/form">{copy.keDaftar}</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState
            title={copy.gagal}
            onRetry={() => void form.refetch()}
            retrying={form.isFetching}
          />
        )}
      </PageBody>
    );
  return (
    <Suspense fallback={<Loading />}>
      <Builder key={form.data.id} form={form.data} {...props} />
    </Suspense>
  );
}

function Loading() {
  return (
    <PageBody>
      <Skeleton label={copy.memuat}>
        <SkeletonBlock height={48} />
        <SkeletonBlock height={160} />
        <SkeletonBlock height={160} />
      </Skeleton>
    </PageBody>
  );
}
