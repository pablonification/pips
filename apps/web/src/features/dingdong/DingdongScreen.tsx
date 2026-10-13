import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Course } from '~/api/generated';
import { currentCoursesQuery } from '~/api/queries';
import {
  Button,
  EmptyState,
  LinkButton,
  RowButton,
  RuledList,
  Skeleton,
  SkeletonRow,
  Tile,
} from '~/components/garis';
import { IconFolder } from '~/components/icons/folder';
import { DeskHead, PageBody } from '~/components/shell/page';
import { dingdong as copy } from '~/copy/dingdong';
import { serviceById } from '~/lib/services';
import { ExtMark, Loaded } from '~/features/layanan-svc/parts';
import { noFolderToast } from './no-folder';

function CourseRow({ course }: { course: Course }) {
  const inner = (
    <span className="g-svc-row">
      <Tile>
        <IconFolder size={20} />
      </Tile>
      <span className="min-w-0 flex-1">
        <span className="block t-label strong code">{course.code}</span>
        <span className="block t-sm">{course.name}</span>
      </span>
      {course.dingdongUrl ? (
        <ExtMark />
      ) : (
        <span className="t-cap text-fg-3">{copy.belumAdaFolder}</span>
      )}
    </span>
  );
  return (
    <li>
      {course.dingdongUrl ? (
        <RowButton asChild>
          <a
            href={course.dingdongUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {inner}
          </a>
        </RowButton>
      ) : (
        // Stays in the list, so the member sees the course is set; says why there is nothing to open.
        <RowButton
          aria-disabled="true"
          onClick={() => noFolderToast(course.code)}
        >
          {inner}
        </RowButton>
      )}
    </li>
  );
}

/**
 * Ding Dong (garis/screens-more.js `scrDingdong`): the course folders of this semester's courses, in code order,
 * then Atur mata kuliah. Reads P0-B's current-courses query, which Mata kuliahku refreshes and the device keeps,
 * so the list also opens offline.
 */
export function DingdongScreen() {
  const courses = useQuery(currentCoursesQuery());
  return (
    <>
      <DeskHead title={serviceById('dingdong').label} />
      <PageBody className="gap-3.5">
        <p className="t-sm text-fg-2">{copy.deskripsi}</p>
        <Loaded
          query={courses}
          failed={copy.gagal}
          offlineText={copy.periksaKoneksi}
          skeleton={
            <Skeleton label={copy.memuat}>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonRow key={i} lines={['20%', '64%']} />
              ))}
            </Skeleton>
          }
        >
          {(taken) => {
            const list = taken
              .flatMap((uc) => (uc.course ? [uc.course] : []))
              .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
            if (!list.length)
              return (
                <EmptyState
                  title={copy.kosong}
                  action={
                    <Button variant="gold" size="sm" asChild className="mt-2.5">
                      <Link to="/profil/matkul">{copy.aturMataKuliah}</Link>
                    </Button>
                  }
                />
              );
            return (
              <>
                <RuledList>
                  {list.map((c) => (
                    <CourseRow key={c.id} course={c} />
                  ))}
                </RuledList>
                <p>
                  <LinkButton asChild>
                    <Link to="/profil/matkul">{copy.aturMataKuliah}</Link>
                  </LinkButton>
                </p>
              </>
            );
          }}
        </Loaded>
      </PageBody>
    </>
  );
}
