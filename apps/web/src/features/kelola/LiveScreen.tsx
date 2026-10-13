import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ApiError } from '~/api/generated';
import { formDetailQuery } from '~/components/form/data';
import {
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  OfflineBanner,
  Plaque,
  RuledList,
  SectionHead,
  Skeleton,
  SkeletonBar,
  SkeletonBlock,
  SkeletonRow,
} from '~/components/garis';
import { IconLanjut } from '~/components/icons/lanjut';
import { DeskHead, PageBody } from '~/components/shell/page';
import { fill } from '~/copy/fill';
import { kelola as copy } from '~/copy/kelola';
import { useOnline } from '~/features/profil/useOnline';
import { clockWhen } from '~/lib/form/format';
import { serviceById } from '~/lib/services';
import { responsesCsv } from './csv';
import { useRoleLoss } from './KelolaGate';
import { Bars, ExportButton, ResponseRow, useCsvExport } from './parts';
import {
  fetchAllResponses,
  formAnalyticsQuery,
  formResponsesCountQuery,
  latestResponsesQuery,
} from './queries';
import { formIsOpen, liveTotal, plaqueLine, questionBars } from './rules';
import { useFormLive } from './useFormLive';

/**
 * Live Counting (garis/screens-more.js `scrLive`): the plaque (live square and the form's title, the count, the last
 * response's time), Pengisi terbaru with Semua to Rekap Form, Analitik jawaban as CSS bars, and Export CSV. The count
 * and the rows follow the admin socket; the bars refresh on load and refocus. Each block fails on its own.
 */
export function LiveScreen({ formId }: { formId: string }) {
  const form = useQuery(formDetailQuery(formId));
  const count = useQuery(formResponsesCountQuery(formId));
  const latest = useQuery(latestResponsesQuery(formId));
  const analytics = useQuery(formAnalyticsQuery(formId));
  useRoleLoss(count.error, latest.error, analytics.error);
  const online = useOnline();
  const missing = form.error instanceof ApiError && form.error.status === 404;
  const live = useFormLive(formId, !missing);

  const title = form.data?.title ?? '';
  const queryClient = useQueryClient();
  const exporter = useCsvExport(
    async () => {
      const [detail, all] = await Promise.all([
        queryClient.fetchQuery(formDetailQuery(formId)),
        fetchAllResponses(formId),
      ]);
      return {
        file: responsesCsv(detail.title, detail.sections ?? [], all),
        count: all.length,
      };
    },
    (n) => fill(copy.ekspor.jawaban, { jumlah: n }),
  );

  // The time the page last heard from the API, for the offline banner.
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const lastFetch = Math.max(count.dataUpdatedAt, latest.dataUpdatedAt);
  useEffect(() => {
    if (lastFetch) setUpdatedAt(lastFetch);
  }, [lastFetch]);

  if (missing)
    return (
      <>
        <DeskHead title={serviceById('live').label} />
        <PageBody>
          <EmptyState
            title={copy.live.tidakDitemukan}
            text={copy.live.tidakDitemukanIsi}
            action={
              <Button variant="paper" size="sm" asChild>
                <Link to="/kelola">{copy.live.keKelola}</Link>
              </Button>
            }
          />
        </PageBody>
      </>
    );

  const total = liveTotal(count.data, live.last?.total);
  const newest = [latest.data?.[0]?.submittedAt, live.last?.submittedAt]
    .filter((x): x is string => !!x)
    .sort()
    .at(-1);
  const showSquare = live.connected && !!form.data && formIsOpen(form.data);

  return (
    <>
      <DeskHead title={serviceById('live').label} />
      <PageBody className="gap-[22px]">
        {!online && (form.data || count.data !== undefined) ? (
          <OfflineBanner
            updatedAt={updatedAt ? clockWhen(updatedAt) : undefined}
          />
        ) : null}

        {form.isError || count.isError ? (
          <ErrorState
            title={form.isError ? copy.live.gagalForm : copy.live.gagalJumlah}
            onRetry={() => {
              if (form.isError) void form.refetch();
              if (count.isError) void count.refetch();
            }}
            retrying={form.isFetching || count.isFetching}
          />
        ) : form.isPending || total === undefined ? (
          <Skeleton label={copy.live.memuat}>
            <SkeletonBlock height={150} className="rounded-card" />
          </Skeleton>
        ) : (
          <Plaque className="g-live-plaque">
            <p className="g-live t-label strong">
              {showSquare ? <i aria-hidden="true" data-live="" /> : null}
              {title}
            </p>
            <p aria-live="polite" aria-atomic="true">
              <span className="t-figure-xl">{total}</span>
              <span className="sr-only"> {copy.live.orangMengisi}</span>
            </p>
            <p className="sub t-sm">{plaqueLine(newest)}</p>
          </Plaque>
        )}

        <div>
          <SectionHead
            title={copy.live.pengisiTerbaru}
            action={
              <LinkButton asChild>
                <Link to="/kelola/live/$formId/rekap" params={{ formId }}>
                  {copy.live.semua}
                  <IconLanjut size={16} />
                </Link>
              </LinkButton>
            }
          />
          {latest.isPending ? (
            <Skeleton label={copy.live.memuat}>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonRow key={i} lines={['70%']} />
              ))}
            </Skeleton>
          ) : latest.isError ? (
            <ErrorState
              title={copy.live.gagalPengisi}
              onRetry={() => void latest.refetch()}
              retrying={latest.isFetching}
            />
          ) : latest.data.length === 0 ? (
            <EmptyState title={copy.live.belumAdaPengisi} />
          ) : (
            <RuledList>
              {latest.data.map((r) => (
                <ResponseRow key={r.id} response={r} />
              ))}
            </RuledList>
          )}
        </div>

        {analytics.isPending ? (
          <Skeleton label={copy.live.memuat}>
            <SkeletonBar width="40%" />
            <SkeletonBar width="100%" />
            <SkeletonBar width="80%" />
          </Skeleton>
        ) : analytics.isError ? (
          <div>
            <SectionHead title={copy.live.analitik} />
            <ErrorState
              title={copy.live.gagalAnalitik}
              onRetry={() => void analytics.refetch()}
              retrying={analytics.isFetching}
            />
          </div>
        ) : analytics.data.questions.length ? (
          <div className="grid gap-3">
            <SectionHead title={copy.live.analitik} />
            {analytics.data.questions.map((q, i) => (
              <div className="grid gap-3" key={q.questionId}>
                <p className={i ? 'mt-1.5 t-label' : 't-label'}>{q.label}</p>
                <Bars bars={questionBars(q)} />
              </div>
            ))}
          </div>
        ) : null}

        <div className="g-live-actions">
          <ExportButton
            busy={exporter.busy}
            onClick={() => void exporter.start()}
          />
        </div>
      </PageBody>
    </>
  );
}
