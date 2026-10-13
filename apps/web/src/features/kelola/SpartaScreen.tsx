import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import type { InternshipDivision } from '~/api/generated';
import { spartaDepartmentsQuery } from '~/components/form/sparta-data';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  OfflineBanner,
  RowButton,
  RuledList,
  Searchbox,
  SectionHead,
  Seg,
  Select,
  Skeleton,
  SkeletonBlock,
  SkeletonRow,
} from '~/components/garis';
import { DeskHead, PageBody } from '~/components/shell/page';
import { fill } from '~/copy/fill';
import { kelola as copy } from '~/copy/kelola';
import { useOnline } from '~/features/profil/useOnline';
import { clockWhen } from '~/lib/form/format';
import { serviceById } from '~/lib/services';
import { submissionsCsv } from './csv';
import { useRoleLoss } from './KelolaGate';
import { Bars, ExportButton, SpartaStatusTag, useCsvExport } from './parts';
import { spartaSubmissionsQuery } from './queries';
import {
  divisionsOf,
  filterSubmissions,
  matchesStatus,
  orDash,
  PRIORITIES,
  priorityName,
  spartaStats,
  type Priority,
  type SpartaFilters,
} from './rules';

const s = copy.sparta;

/**
 * Data SPARTA Magang (/kelola/sparta). The prototype has no screen (its row only toasts that the data "bisa dilihat
 * dan diekspor"), so this is today's admin page built from Garis parts, for the owner's review (OPEN-QUESTIONS D8):
 * search and filters kept in the URL, Statistik pilihan as CSS bars, a hairline table from 1024 px and labelled rows
 * below, and Export CSV of exactly the rows shown. Every page of submissions is loaded and filtered on the device.
 */
export function SpartaScreen({ filters }: { filters: SpartaFilters }) {
  const navigate = useNavigate();
  const online = useOnline();
  const departments = useQuery(spartaDepartmentsQuery());
  const submissions = useQuery(spartaSubmissionsQuery());
  useRoleLoss(submissions.error);

  const divisions = useMemo(
    () => divisionsOf(departments.data ?? []),
    [departments.data],
  );
  const divisionById = useMemo(
    () => new Map(divisions.map((d) => [d.id, d])),
    [divisions],
  );
  const shown = useMemo(
    () => filterSubmissions(submissions.data ?? [], filters),
    [submissions.data, filters],
  );

  const setFilters = (next: Partial<SpartaFilters>) =>
    void navigate({
      to: '/kelola/sparta',
      search: (prev) => {
        const merged = { ...prev, ...next };
        return {
          q: merged.q || undefined,
          divisi: merged.divisi || undefined,
          pilihan: merged.pilihan || undefined,
          status: merged.status || undefined,
        };
      },
      replace: true,
    });

  const exporter = useCsvExport(
    async () => {
      const entities = new Map<string, InternshipDivision>(
        (departments.data ?? []).flatMap((d) =>
          (d.divisions ?? []).map((div) => [div.id, div] as const),
        ),
      );
      return {
        file: submissionsCsv(shown, divisions, entities),
        count: shown.length,
      };
    },
    (n) => fill(copy.ekspor.sparta, { jumlah: n }),
  );

  const failed = departments.isError || submissions.isError;
  const loading = departments.isPending || submissions.isPending;

  return (
    <>
      <DeskHead title={serviceById('sparta-data').label} />
      <PageBody wide className="gap-[22px]">
        {!online && submissions.data ? (
          <OfflineBanner updatedAt={clockWhen(submissions.dataUpdatedAt)} />
        ) : null}
        {failed ? (
          <ErrorState
            title={s.gagal}
            onRetry={() => {
              if (departments.isError) void departments.refetch();
              if (submissions.isError) void submissions.refetch();
            }}
            retrying={departments.isFetching || submissions.isFetching}
          />
        ) : loading ? (
          <Skeleton label={s.memuat}>
            <SkeletonBlock height={44} />
            <SkeletonBlock height={120} />
            {[0, 1, 2, 3].map((i) => (
              <SkeletonRow key={i} lines={['50%', '80%']} />
            ))}
          </Skeleton>
        ) : (
          <>
            <Toolbar
              filters={filters}
              setFilters={setFilters}
              divisions={divisions}
              count={shown.length}
              exporter={exporter}
            />
            <Stats
              submissions={submissions.data.filter((x) =>
                matchesStatus(x, filters.status),
              )}
              divisions={divisions}
            />
            {submissions.data.length === 0 ? (
              <EmptyState title={s.kosong} text={s.kosongIsi} />
            ) : shown.length === 0 ? (
              <EmptyState
                title={s.tidakCocok}
                text={s.tidakCocokIsi}
                action={
                  <Button
                    variant="paper"
                    size="sm"
                    onClick={() =>
                      setFilters({
                        q: undefined,
                        divisi: undefined,
                        pilihan: undefined,
                        status: undefined,
                      })
                    }
                  >
                    {s.hapusFilter}
                  </Button>
                }
              />
            ) : (
              <SubmissionsList rows={shown} divisionById={divisionById} />
            )}
          </>
        )}
      </PageBody>
    </>
  );
}

function Toolbar({
  filters,
  setFilters,
  divisions,
  count,
  exporter,
}: {
  filters: SpartaFilters;
  setFilters: (next: Partial<SpartaFilters>) => void;
  divisions: ReturnType<typeof divisionsOf>;
  count: number;
  exporter: ReturnType<typeof useCsvExport>;
}) {
  // The field keeps what is typed; the URL follows it (replace), so reload and Back keep the search.
  const [text, setText] = useState(filters.q ?? '');
  return (
    <div className="g-sparta-tools">
      <Searchbox
        label={copy.rekap.cari}
        placeholder={copy.rekap.cariPlaceholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setFilters({ q: e.target.value.trim() || undefined });
        }}
      />
      <div className="g-sparta-filters">
        <Field label={s.divisi}>
          <Select
            value={filters.divisi ?? ''}
            onChange={(e) =>
              setFilters({ divisi: e.target.value || undefined })
            }
          >
            <option value="">{s.semuaDivisi}</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {fill(s.divisiOpsi, {
                  departemen: d.departmentName,
                  divisi: d.name,
                })}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={s.pilihan}>
          <Select
            value={filters.pilihan ? String(filters.pilihan) : ''}
            onChange={(e) =>
              setFilters({
                pilihan: e.target.value
                  ? (Number(e.target.value) as Priority)
                  : undefined,
              })
            }
          >
            <option value="">{s.semuaPilihan}</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {fill(s.pilihanKe, { nomor: p })}
              </option>
            ))}
          </Select>
        </Field>
        <div className="g-fld">
          <span className="t-label" aria-hidden="true">
            {s.status}
          </span>
          <Seg
            label={s.status}
            full
            value={filters.status ?? 'semua'}
            onChange={(v) =>
              setFilters({ status: v === 'semua' ? undefined : v })
            }
            options={[
              { value: 'semua', label: s.semuaStatus },
              { value: 'terkunci', label: s.terkunci },
              { value: 'draf', label: s.draf },
            ]}
          />
        </div>
      </div>
      <div className="g-sparta-count">
        <p className="t-sm text-fg-2" role="status">
          {fill(s.jumlah, { jumlah: count })}
        </p>
        <ExportButton
          busy={exporter.busy}
          onClick={() => void exporter.start()}
          disabled={count === 0}
        />
      </div>
    </div>
  );
}

/** Statistik pilihan: today's charts as CSS bars, counting what matches the status filter. */
function Stats({
  submissions,
  divisions,
}: {
  submissions: Parameters<typeof spartaStats>[0];
  divisions: ReturnType<typeof divisionsOf>;
}) {
  const [groupBy, setGroupBy] = useState<'departemen' | 'divisi'>('departemen');
  const [metric, setMetric] = useState<'pertama' | 'semua'>('pertama');
  const rows = spartaStats(submissions, divisions, groupBy, metric);
  const max = Math.max(0, ...rows.map((r) => r.count));
  return (
    <div className="grid gap-3">
      <SectionHead title={s.statistik} />
      <div className="g-segs">
        <Seg
          label={s.kelompok}
          value={groupBy}
          onChange={setGroupBy}
          options={[
            { value: 'departemen', label: s.perDepartemen },
            { value: 'divisi', label: s.perDivisi },
          ]}
        />
        <Seg
          label={s.hitung}
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'pertama', label: s.pilihanPertama },
            { value: 'semua', label: s.semuaPilihanStat },
          ]}
        />
      </div>
      {rows.length ? (
        <Bars
          wide
          bars={rows.map((r) => ({
            label: r.label,
            count: r.count,
            ratio: max ? r.count / max : 0,
          }))}
        />
      ) : (
        <EmptyState title={s.statistikKosong} />
      )}
    </div>
  );
}

function SubmissionsList({
  rows,
  divisionById,
}: {
  rows: ReturnType<typeof filterSubmissions>;
  divisionById: ReadonlyMap<string, ReturnType<typeof divisionsOf>[number]>;
}) {
  return (
    <div>
      <table className="g-sparta-table">
        <caption className="sr-only">{s.tabel}</caption>
        <thead>
          <tr>
            <th scope="col">{s.nama}</th>
            <th scope="col">{s.nim}</th>
            <th scope="col">{s.jurusan}</th>
            <th scope="col">{s.kelas}</th>
            <th scope="col">{s.status}</th>
            {PRIORITIES.map((p) => (
              <th scope="col" key={p}>
                {fill(s.pilihanKe, { nomor: p })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link
                  to="/kelola/sparta/$submissionId"
                  params={{ submissionId: r.id }}
                >
                  {r.fullName}
                </Link>
              </td>
              <td className="num">{r.nim}</td>
              <td>{orDash(r.jurusan)}</td>
              <td>{orDash(r.kelas)}</td>
              <td>
                <SpartaStatusTag locked={r.isLocked} />
              </td>
              {PRIORITIES.map((p) => (
                <td key={p}>{priorityName(r, p, divisionById)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <RuledList className="g-sparta-rows">
        {rows.map((r) => (
          <li key={r.id}>
            <RowButton asChild>
              <Link
                to="/kelola/sparta/$submissionId"
                params={{ submissionId: r.id }}
                className="g-sparta-row"
              >
                <span className="top">
                  <span className="t-sub">{r.fullName}</span>
                  <SpartaStatusTag locked={r.isLocked} />
                </span>
                <dl className="g-facts-grid">
                  {(
                    [
                      [s.nim, r.nim],
                      [s.jurusan, orDash(r.jurusan)],
                      [s.kelas, orDash(r.kelas)],
                      ...PRIORITIES.map(
                        (p) =>
                          [
                            fill(s.pilihanKe, { nomor: p }),
                            priorityName(r, p, divisionById),
                          ] as const,
                      ),
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="t-cap text-fg-3">{label}</dt>
                      <dd className="t-sm">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Link>
            </RowButton>
          </li>
        ))}
      </RuledList>
    </div>
  );
}
