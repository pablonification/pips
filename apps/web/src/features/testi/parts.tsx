/**
 * Testi Matkul's rows and states (P2-B), from garis/screens-more.js `testiRow`, `testiCourseRow` and `scrRoom`'s
 * not-found pattern.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Course } from '~/api/generated';
import {
  Button,
  EmptyState,
  RowButton,
  Skeleton,
  SkeletonBar,
  SkeletonRow,
  Tile,
} from '~/components/garis';
import { IconFolder } from '~/components/icons/folder';
import { IconTesti } from '~/components/icons/testi';
import { testi as copy } from '~/copy/testi';
import { Chev } from '~/features/layanan-svc/parts';
import { testimoniQuery } from './queries';
import { countLine, courseParams } from './rules';

/** A programme, a semester or Mata Kuliah Pilihan: the folder tile, the name and a chevron (inside a link). */
export function FolderRowContent({ title }: { title: string }) {
  return (
    <span className="g-svc-row">
      <Tile>
        <IconFolder size={20} />
      </Tile>
      <span className="min-w-0 flex-1 t-sub">{title}</span>
      <Chev />
    </span>
  );
}

/**
 * A course: the star tile, "IF2110 Algoritma dan Pemrograman II", then "3 testimoni" or "Belum ada testimoni" from
 * the course's own testimonials request (no endpoint counts them). `count` off: the line waits (a skeleton) until
 * the row is asked to count; a failed count leaves the line out rather than say there are none.
 */
export function CourseRow({
  course,
  count = true,
  rowRef,
}: {
  course: Course;
  count?: boolean;
  /** For the start search, which counts only rows on screen. */
  rowRef?: (el: HTMLLIElement | null) => void;
}) {
  const list = useQuery({ ...testimoniQuery(course.id), enabled: count });
  return (
    <li ref={rowRef}>
      <RowButton asChild>
        <Link
          to="/layanan/testi/$type/$semester/$courseId"
          params={courseParams(course)}
        >
          <span className="g-svc-row">
            <Tile>
              <IconTesti size={20} />
            </Tile>
            <span className="min-w-0 flex-1">
              <span className="block t-sub">
                <span className="code">{course.code}</span> {course.name}
              </span>
              {list.data ? (
                <span className="block t-cap text-fg-2">
                  {countLine(list.data.length)}
                </span>
              ) : list.isError ? null : (
                // Decoration while the count loads; the row's name is already complete without it.
                <span className="block pt-1.5 pb-0.5" aria-hidden="true">
                  <SkeletonBar width="34%" />
                </span>
              )}
            </span>
            <Chev />
          </span>
        </Link>
      </RowButton>
    </li>
  );
}

/** Course rows loading: tile and two lines, as the real rows. */
export function CourseSkeleton() {
  return (
    <Skeleton label={copy.memuatMatkul}>
      {[0, 1, 2, 3].map((i) => (
        <SkeletonRow key={i} lines={['72%', '30%']} />
      ))}
    </Skeleton>
  );
}

/** An unknown programme, list or course (an old or mistyped link), with the way back to Testi Matkul. */
export function NotFound() {
  return (
    <EmptyState
      title={copy.tidakDitemukan}
      text={copy.tidakDitemukanIsi}
      action={
        <Button variant="paper" size="sm" asChild className="mt-2.5">
          <Link to="/layanan/testi">{copy.kembali}</Link>
        </Button>
      }
    />
  );
}
