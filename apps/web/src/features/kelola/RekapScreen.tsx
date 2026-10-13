import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { formDetailQuery } from '~/components/form/data';
import {
  Button,
  EmptyState,
  ErrorState,
  RuledList,
  Searchbox,
  SectionHead,
  Skeleton,
  SkeletonRow,
} from '~/components/garis';
import { IconLanjut } from '~/components/icons/lanjut';
import { DeskHead, PageBody } from '~/components/shell/page';
import { fill } from '~/copy/fill';
import { kelola as copy } from '~/copy/kelola';
import { DEBOUNCE_TIME } from '~/lib/constants';
import { responsesCsv } from './csv';
import { useRoleLoss } from './KelolaGate';
import { ExportButton, ResponseRow, useCsvExport } from './parts';
import { fetchAllResponses, responsesPageQuery } from './queries';
import { pageCount } from './rules';

/**
 * Rekap Form (/kelola/live/$formId/rekap; no locked screen, open question 2's default): every response, searchable
 * by NIM or name with NIM Finder's field, 20 a page with Testi Matkul's pager, and Export CSV of the matches. The
 * query (`q`) and the page (`halaman`) live in the URL. Per-question answers are only in the CSV.
 */
export function RekapScreen({
  formId,
  q = '',
  halaman = 1,
}: {
  formId: string;
  q?: string;
  halaman?: number;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useQuery(formDetailQuery(formId));
  const page = useQuery(responsesPageQuery(formId, halaman, q));
  useRoleLoss(page.error);

  // The field's text; the search follows it after a pause, replacing the URL's entry, and starts at page 1.
  const [text, setText] = useState(q);
  useEffect(() => setText((t) => (t.trim() === q ? t : q)), [q]);
  useEffect(() => {
    const next = text.trim();
    if (next === q) return;
    const t = setTimeout(
      () =>
        void navigate({
          to: '/kelola/live/$formId/rekap',
          params: { formId },
          search: { q: next || undefined },
          replace: true,
        }),
      DEBOUNCE_TIME,
    );
    return () => clearTimeout(t);
  }, [text, q, formId, navigate]);

  const goPage = (n: number) =>
    void navigate({
      to: '/kelola/live/$formId/rekap',
      params: { formId },
      search: { q: q || undefined, halaman: n > 1 ? n : undefined },
    });

  const exporter = useCsvExport(
    async () => {
      const [detail, all] = await Promise.all([
        queryClient.fetchQuery(formDetailQuery(formId)),
        fetchAllResponses(formId, q),
      ]);
      return {
        file: responsesCsv(detail.title, detail.sections ?? [], all),
        count: all.length,
      };
    },
    (n) => fill(copy.ekspor.jawaban, { jumlah: n }),
  );

  const pages = page.data ? pageCount(page.data.total) : 1;

  return (
    <>
      <DeskHead title={copy.rekap.judul} />
      <PageBody className="gap-3">
        <Searchbox
          label={copy.rekap.cari}
          placeholder={copy.rekap.cariPlaceholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="t-cap text-fg-3" role="status">
          {page.data ? fill(copy.rekap.hasil, { jumlah: page.data.total }) : ''}
        </p>
        <div>
          <SectionHead title={form.data?.title ?? ''} />
          {page.isPending ? (
            <Skeleton label={copy.rekap.memuat}>
              {[0, 1, 2, 3, 4].map((i) => (
                <SkeletonRow key={i} lines={['70%']} />
              ))}
            </Skeleton>
          ) : page.isError ? (
            <ErrorState
              title={copy.rekap.gagal}
              onRetry={() => void page.refetch()}
              retrying={page.isFetching}
            />
          ) : page.data.responses.length === 0 ? (
            <EmptyState title={copy.rekap.tidakCocok} />
          ) : (
            <RuledList>
              {page.data.responses.map((r) => (
                <ResponseRow key={r.id} response={r} withAngkatan />
              ))}
            </RuledList>
          )}
        </div>
        {pages > 1 ? (
          <div className="g-pager">
            <Button
              variant="paper"
              size="sm"
              aria-label={copy.rekap.halamanSebelumnya}
              aria-disabled={halaman <= 1 || undefined}
              onClick={() => {
                if (halaman > 1) goPage(halaman - 1);
              }}
            >
              <span className="flip">
                <IconLanjut size={16} />
              </span>
              <span className="lbl">{copy.rekap.sebelumnya}</span>
            </Button>
            <span className="t-cap text-fg-2 num">
              {fill(copy.rekap.halaman, { nomor: halaman, jumlah: pages })}
            </span>
            <Button
              variant="paper"
              size="sm"
              aria-label={copy.rekap.halamanBerikutnya}
              aria-disabled={halaman >= pages || undefined}
              onClick={() => {
                if (halaman < pages) goPage(halaman + 1);
              }}
            >
              <span className="lbl">{copy.rekap.berikutnya}</span>
              <IconLanjut size={16} />
            </Button>
          </div>
        ) : null}
        <div className="g-live-actions">
          <ExportButton
            busy={exporter.busy}
            onClick={() => void exporter.start()}
            disabled={page.data?.total === 0}
          />
        </div>
      </PageBody>
    </>
  );
}
