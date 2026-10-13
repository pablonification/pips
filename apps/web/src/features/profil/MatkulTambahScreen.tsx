import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { api } from '~/api/client';
import { COURSE_CATALOGUE_QUERY_KEY } from '~/api/constants';
import { currentCoursesQuery, userAcademicQuery } from '~/api/queries';
import {
  Button,
  ChipGroup,
  ErrorState,
  Searchbox,
  Skeleton,
  SkeletonRow,
  SksMark,
  toast,
} from '~/components/garis';
import { IconTambah } from '~/components/icons/tambah';
import { DeskHead, PageBody, TopBarActions } from '~/components/shell/page';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { profil } from '~/copy/profil';
import useSession from '~/hooks/auth/useSession';
import { refreshCourses } from './MatkulScreen';
import { catalogueResults, picksBody, setPick, type Picks } from './rules';

const copy = profil.tambah;
const KELAS = [1, 2, 3] as const;

/** The active catalogue, fetched once per visit: search filters it on the device, at once. */
export const catalogueQuery = () => ({
  queryKey: [COURSE_CATALOGUE_QUERY_KEY, 'semua'],
  queryFn: () => api.course.getlistCourses({}).then((r) => r.courses),
  staleTime: Infinity,
});

function AddButton({
  count,
  pending,
  onPress,
}: {
  count: number;
  pending: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      variant="gold"
      size="sm"
      aria-disabled={count === 0 || pending || undefined}
      onClick={onPress}
    >
      <IconTambah size={16} />
      {pending ? copy.menambahkan : copy.tambahkan}
      {count && !pending ? (
        <span className="num">
          {' '}
          {fill(copy.tambahkanJumlah, { jumlah: count })}
        </span>
      ) : null}
    </Button>
  );
}

/**
 * Profil › Mata kuliahku › Tambah mata kuliah (garis/screens-more.js `scrMatkulAdd`, `caddResults`,
 * `addCoursesBtn`): search the catalogue, pick a class K1–K3 per course, then Tambahkan (the top bar on phones and
 * tablets, the page head on desktop). Search is not a form: Enter never reloads or submits.
 */
export function MatkulTambahScreen({
  fromFirstRun,
}: {
  fromFirstRun: boolean;
}) {
  const me = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const academic = useQuery(userAcademicQuery());
  const mine = useQuery(currentCoursesQuery());
  const catalogue = useQuery(catalogueQuery());
  const [q, setQ] = useState('');
  const [picks, setPicks] = useState<Picks>({});
  const [pending, setPending] = useState(false);
  const count = Object.keys(picks).length;

  const results = useMemo(
    () =>
      catalogueResults(
        catalogue.data ?? [],
        (mine.data ?? []).map((c) => c.courseId),
        q,
        { major: me.major, semester: academic.data?.semester },
      ),
    [catalogue.data, mine.data, q, me.major, academic.data?.semester],
  );

  const add = async () => {
    if (pending) return;
    if (!count) {
      toast.success(copy.pilihDulu);
      return;
    }
    setPending(true);
    try {
      await api.course.createOrUpdateBatchUserCourse({
        requestBody: picksBody(picks),
      });
    } catch {
      setPending(false);
      toast.error(copy.gagal);
      return;
    }
    refreshCourses(qc);
    setPicks({});
    toast.success(fill(copy.ditambahkan, { jumlah: count }));
    await navigate({ to: fromFirstRun ? '/mulai' : '/profil/matkul' });
  };

  const addButton = (
    <AddButton count={count} pending={pending} onPress={() => void add()} />
  );

  return (
    <>
      <DeskHead title={common.shell.tambahMataKuliah} actions={addButton} />
      <TopBarActions>{addButton}</TopBarActions>
      <PageBody className="gap-3.5">
        <Searchbox
          label={copy.cari}
          placeholder={copy.placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            // Regression: today's search sat in a <form>, and Enter reloaded the app.
            if (e.key === 'Enter') e.preventDefault();
          }}
        />
        {catalogue.isError ? (
          <ErrorState
            title={copy.gagalMuat}
            onRetry={() => void catalogue.refetch()}
            retrying={catalogue.isFetching}
          />
        ) : !catalogue.data || !mine.data ? (
          <Skeleton>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonRow key={i} lines={['20%', '70%']} />
            ))}
          </Skeleton>
        ) : (
          <ul className="g-ruled-list">
            {results.length ? (
              results.map((c) => (
                <li key={c.id} className="g-course wrap">
                  <SksMark sks={c.credits ?? 0} />
                  <span className="min-w-0 flex-1">
                    <span className="block t-label strong code">{c.code}</span>
                    <span className="block t-sm">{c.name}</span>
                  </span>
                  <ChipGroup
                    className="g-kpick"
                    label={fill(copy.kelasGrup, { kode: c.code })}
                    deselectable
                    value={picks[c.id] ?? null}
                    options={KELAS.map((k) => ({
                      value: k,
                      label: fill(copy.kelasPilihan, { k }),
                    }))}
                    onChange={(k) => setPicks((p) => setPick(p, c.id, k))}
                  />
                </li>
              ))
            ) : (
              <li className="g-item">
                <span className="t-sm text-fg-2">
                  {fill(copy.tidakAda, { kata: q })}
                </span>
              </li>
            )}
          </ul>
        )}
      </PageBody>
    </>
  );
}
