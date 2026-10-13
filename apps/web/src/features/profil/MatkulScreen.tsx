import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { flushSync } from 'react-dom';
import { api } from '~/api/client';
import {
  CALENDAR_EVENTS_QUERY_KEY,
  CURRENT_COURSES_QUERY_KEY,
} from '~/api/constants';
import type { UserCourse } from '~/api/generated';
import { currentCoursesQuery, userAcademicQuery } from '~/api/queries';
import {
  Button,
  Disclosure,
  EmptyState,
  ErrorState,
  IconButton,
  OfflineBanner,
  Skeleton,
  SkeletonRow,
  SksMark,
  Tag,
  toast,
} from '~/components/garis';
import { IconHapus } from '~/components/icons/hapus';
import { IconTambah } from '~/components/icons/tambah';
import { DeskHead, PageBody } from '~/components/shell/page';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { profil } from '~/copy/profil';
import { semesterLabel, totalSks } from './rules';
import { jamWib, useOnline } from './useOnline';

const copy = profil.matkul;
const pad = (k: number) => String(k).padStart(2, '0');

/** After a write to this semester's courses: Mata kuliahku, Ding Dong and the calendar's Akademik events. */
export function refreshCourses(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: [CURRENT_COURSES_QUERY_KEY] });
  void qc.invalidateQueries({ queryKey: [CALENDAR_EVENTS_QUERY_KEY] });
}

/**
 * Profil › Mata kuliahku (garis/screens-more.js `scrMatkul`): the semester, "Dipakai untuk apa?" (open by itself
 * with no courses), a row per course with its remove button, Jumlah SKS and Tambah mata kuliah. Removing is at once,
 * with Urungkan in the toast; this replaces today's swipe and Edit/Save mode.
 */
export function MatkulScreen() {
  const qc = useQueryClient();
  const academic = useQuery(userAcademicQuery());
  const courses = useQuery(currentCoursesQuery());
  const online = useOnline();
  const list = courses.data ?? [];

  const focusAfterRemove = (nextId: string | undefined) => {
    const el = nextId
      ? document.querySelector<HTMLElement>(`[data-rm="${nextId}"]`)
      : document.querySelector<HTMLElement>('[data-add-course]');
    el?.focus();
  };

  const remove = (row: UserCourse) => {
    const before = qc.getQueryData<UserCourse[]>([CURRENT_COURSES_QUERY_KEY]);
    const at = list.findIndex((c) => c.courseId === row.courseId);
    const next = list[at + 1] ?? list[at - 1];
    const code = row.course?.code ?? '';
    // The row goes at once; focus moves to the next remove button, or to Tambah mata kuliah.
    flushSync(() =>
      qc.setQueryData<UserCourse[]>([CURRENT_COURSES_QUERY_KEY], (cs) =>
        cs?.filter((c) => c.courseId !== row.courseId),
      ),
    );
    focusAfterRemove(next?.courseId);
    void qc.cancelQueries({ queryKey: [CURRENT_COURSES_QUERY_KEY] });
    api.course
      .deleteUserCourse({ requestBody: { courseIds: [row.courseId] } })
      .then(
        () => {
          refreshCourses(qc);
          toast.success(fill(copy.dihapus, { kode: code }), {
            action: {
              label: common.komponen.urungkan,
              onClick: () => undo(row, at),
            },
          });
        },
        () => {
          qc.setQueryData([CURRENT_COURSES_QUERY_KEY], before);
          toast.error(fill(copy.hapusGagal, { kode: code }));
        },
      );
  };

  const undo = (row: UserCourse, at: number) => {
    qc.setQueryData<UserCourse[]>([CURRENT_COURSES_QUERY_KEY], (cs) => {
      if (!cs || cs.some((c) => c.courseId === row.courseId)) return cs;
      const copyOf = [...cs];
      copyOf.splice(Math.min(at, copyOf.length), 0, row);
      return copyOf;
    });
    api.course
      .createOrUpdateBatchUserCourse({
        requestBody: [{ courseId: row.courseId, class: row.class }],
      })
      .then(
        () => refreshCourses(qc),
        () => {
          refreshCourses(qc);
          toast.error(fill(copy.urungGagal, { kode: row.course?.code ?? '' }));
        },
      );
  };

  return (
    <>
      <DeskHead title={common.shell.mataKuliahku} />
      <PageBody className="gap-3.5">
        {!online && courses.data ? (
          <OfflineBanner updatedAt={jamWib(courses.dataUpdatedAt)} />
        ) : null}
        {academic.data ? (
          <p className="t-cap text-fg-2">
            {academic.data.semester
              ? fill(copy.semester, {
                  semester: academic.data.semester,
                  label: semesterLabel(academic.data),
                })
              : semesterLabel(academic.data)}
          </p>
        ) : null}
        {courses.isError && !courses.data ? (
          <ErrorState
            title={copy.gagalMuat}
            onRetry={() => void courses.refetch()}
            retrying={courses.isFetching}
          />
        ) : !courses.data ? (
          <Skeleton>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonRow key={i} lines={['20%', '70%']} />
            ))}
          </Skeleton>
        ) : (
          <>
            {/* Remounted when the list empties, so it opens by itself then. */}
            <Disclosure
              key={list.length ? 'some' : 'none'}
              label={copy.dipakai}
              open={!list.length}
            >
              <p className="t-sm text-fg-2">{copy.dipakaiIsi}</p>
            </Disclosure>
            {list.length ? (
              <>
                <ul className="g-ruled-list">
                  {list.map((c) => (
                    <li key={c.courseId} className="g-course">
                      <SksMark sks={c.course?.credits ?? 0} />
                      <span className="min-w-0 flex-1">
                        <span className="block t-label strong code">
                          {c.course?.code}
                        </span>
                        <span className="block t-sm">{c.course?.name}</span>
                      </span>
                      <Tag tone="outlined">
                        {fill(copy.kelas, { kelas: pad(c.class) })}
                      </Tag>
                      <IconButton
                        size="sm"
                        data-rm={c.courseId}
                        label={fill(copy.hapus, {
                          kode: c.course?.code ?? '',
                          nama: c.course?.name ?? '',
                        })}
                        onClick={() => remove(c)}
                      >
                        <IconHapus size={20} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
                <div className="g-sum-row">
                  <span className="t-label">{copy.jumlahSks}</span>
                  <span className="t-sub num">{totalSks(list)}</span>
                </div>
              </>
            ) : (
              <EmptyState title={copy.kosong} />
            )}
          </>
        )}
        <Button variant="gold" asChild>
          <Link to="/profil/matkul/tambah" data-add-course="">
            <IconTambah size={16} />
            {copy.tambah}
          </Link>
        </Button>
      </PageBody>
    </>
  );
}
