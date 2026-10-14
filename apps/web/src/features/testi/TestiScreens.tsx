/**
 * Testi Matkul (garis/screens-more.js `scrTesti` and its helpers): read-only testimonials, by programme → semester →
 * course, or by searching every course by code or name from the start. Programme, list and course are path params
 * (P0-B, today's values, which P1-A links to); the searches are `q` and the testimonial is `page` (1-based).
 */
import { useQuery } from '@tanstack/react-query';
import { getRouteApi, Link, Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useInView } from 'react-intersection-observer';
import { ApiError, type Course } from '~/api/generated';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  RowButton,
  RuledList,
  Searchbox,
  Skeleton,
  SkeletonBlock,
} from '~/components/garis';
import { IconFolder } from '~/components/icons/folder';
import { IconLanjut } from '~/components/icons/lanjut';
import { DESKTOP_QUERY, useMediaQuery } from '~/components/garis/useMediaQuery';
import { DeskHead, PageBody, usePageTitle } from '~/components/shell/page';
import { useTambahTestimoni } from '~/features/kelola-testi/Manage';
import { fill } from '~/copy/fill';
import { testi as copy } from '~/copy/testi';
import { DEBOUNCE_TIME } from '~/lib/constants';
import { serviceById } from '~/lib/services';
import { noFolderToast } from '~/features/dingdong/no-folder';
import {
  Loaded,
  NewTab,
  useDebounced,
  useOnline,
  useUrlText,
} from '~/features/layanan-svc/parts';
import { catalogueQuery, courseQuery, testimoniQuery } from './queries';
import { CourseRow, CourseSkeleton, FolderRowContent, NotFound } from './parts';
import {
  authorOf,
  clampIndex,
  codeLine,
  linkSegments,
  listCourses,
  listOfSlug,
  listSlug,
  majorOfSlug,
  MAJORS,
  MAJOR_SLUG,
  searchCourses,
  sections,
  SEMESTERS,
  testiTitle,
  type ListKey,
  type Major,
} from './rules';

const startRoute = getRouteApi('/_app/_left-navbar/layanan/testi/');
const programmeRoute = getRouteApi('/_app/_left-navbar/layanan/testi/$type/');
const listRoute = getRouteApi(
  '/_app/_left-navbar/layanan/testi/$type/$semester/',
);
const courseRoute = getRouteApi(
  '/_app/_left-navbar/layanan/testi_/$type/$semester/$courseId/',
);

const SERVICE = () => serviceById('testi').label;

/** The desktop head and the page's column, with the page's title. */
function Page({
  title,
  gap = 'gap-4',
  actions,
  children,
}: {
  title: string;
  gap?: string;
  /** Desktop's header actions (P3-B's Tambah testimoni). */
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <DeskHead title={title} actions={actions} />
      <PageBody className={gap}>{children}</PageBody>
    </>
  );
}

/** One row on the start screen: the programme, or Mata Kuliah Umum straight to its course list. */
function ProgrammeLink({ major }: { major: Major }) {
  const inner = <FolderRowContent title={copy.program[major]} />;
  return (
    <li>
      <RowButton asChild>
        {major === 'OTHER' ? (
          <Link
            to="/layanan/testi/$type/$semester"
            params={{ type: MAJOR_SLUG.OTHER, semester: listSlug('pilihan') }}
          >
            {inner}
          </Link>
        ) : (
          <Link to="/layanan/testi/$type" params={{ type: MAJOR_SLUG[major] }}>
            {inner}
          </Link>
        )}
      </RowButton>
    </li>
  );
}

/**
 * A search result on the start screen. The search spans the whole catalogue, so a row counts its testimonials only
 * once it is on screen and typing has paused: never one request per match.
 */
function StartResult({
  course,
  settled,
}: {
  course: Course;
  settled: boolean;
}) {
  const { ref, inView } = useInView();
  return <CourseRow course={course} count={settled && inView} rowRef={ref} />;
}

/** The start (`testiStart`): search every course, or browse IF, STI and Mata Kuliah Umum. */
export function TestiStartScreen() {
  const { q: urlQ } = startRoute.useSearch();
  const navigate = startRoute.useNavigate();
  const [q, setQ] = useUrlText(urlQ, (next) => {
    void navigate({ search: (prev) => ({ ...prev, q: next }), replace: true });
  });
  const settled = useDebounced(q, DEBOUNCE_TIME) === q;
  const catalogue = useQuery(catalogueQuery());
  const found = catalogue.data ? searchCourses(catalogue.data, q) : null;
  const searching = !!q.trim();

  return (
    <Page title={SERVICE()}>
      <Searchbox
        label={copy.cariLabel}
        placeholder={copy.cariSemua}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <p className="sr-only" role="status">
        {found ? fill(copy.jumlahMatkul, { jumlah: found.length }) : ''}
      </p>
      {!searching ? (
        <RuledList>
          {MAJORS.map((m) => (
            <ProgrammeLink key={m} major={m} />
          ))}
        </RuledList>
      ) : (
        <Loaded
          query={catalogue}
          failed={copy.gagalMatkul}
          offlineText={copy.periksaKoneksi}
          skeleton={<CourseSkeleton />}
        >
          {() =>
            found?.length ? (
              <RuledList>
                {found.map((c) => (
                  <StartResult key={c.id} course={c} settled={settled} />
                ))}
              </RuledList>
            ) : (
              <EmptyState
                title={copy.tidakAdaMatkul}
                text={copy.cobaKodeLain}
              />
            )
          }
        </Loaded>
      )}
    </Page>
  );
}

/** A programme's semesters, then Mata Kuliah Pilihan. Mata Kuliah Umum has no semester step. */
export function TestiProgrammeScreen() {
  const { type } = programmeRoute.useParams();
  const major = majorOfSlug(type);
  if (major === 'OTHER')
    return (
      <Navigate
        to="/layanan/testi/$type/$semester"
        params={{ type, semester: listSlug('pilihan') }}
        replace
      />
    );
  if (!major)
    return (
      <Page title={SERVICE()}>
        <NotFound />
      </Page>
    );
  const keys: ListKey[] = [...SEMESTERS, 'pilihan'];
  return (
    <Page title={testiTitle({ major }) ?? SERVICE()}>
      <RuledList>
        {keys.map((k) => (
          <li key={k}>
            <RowButton asChild>
              <Link
                to="/layanan/testi/$type/$semester"
                params={{ type, semester: listSlug(k) }}
              >
                <FolderRowContent
                  title={
                    k === 'pilihan'
                      ? copy.pilihan
                      : fill(copy.semester, { semester: k })
                  }
                />
              </Link>
            </RowButton>
          </li>
        ))}
      </RuledList>
    </Page>
  );
}

/** A semester's courses or the electives, with their own search (from the first character). */
export function TestiListScreen() {
  const { type, semester } = listRoute.useParams();
  const { q: urlQ } = listRoute.useSearch();
  const navigate = listRoute.useNavigate();
  const [q, setQ] = useUrlText(urlQ, (next) => {
    void navigate({ search: (prev) => ({ ...prev, q: next }), replace: true });
  });
  const major = majorOfSlug(type);
  const key = listOfSlug(semester);
  const catalogue = useQuery(catalogueQuery());
  if (!major || key == null)
    return (
      <Page title={SERVICE()}>
        <NotFound />
      </Page>
    );
  return (
    <Page title={testiTitle({ major, list: key }) ?? SERVICE()}>
      <Searchbox
        label={copy.cariLabel}
        placeholder={copy.cariDaftar}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <Loaded
        query={catalogue}
        failed={copy.gagalMatkul}
        offlineText={copy.periksaKoneksi}
        skeleton={<CourseSkeleton />}
      >
        {(all) => {
          const list = listCourses(all, major, key, q);
          return list.length ? (
            <RuledList>
              {list.map((c) => (
                <CourseRow key={c.id} course={c} />
              ))}
            </RuledList>
          ) : (
            <EmptyState title={copy.tidakAdaMatkul} text={copy.cobaKataLain} />
          );
        }}
      </Loaded>
    </Page>
  );
}

/** **Buka Ding Dong IF2110**: the course's folder in a new tab, or the toast when it has none. */
function DingdongLink({ course }: { course: Course }) {
  const label = fill(copy.bukaDingdong, { kode: course.code });
  return (
    <p>
      {course.dingdongUrl ? (
        <LinkButton asChild>
          <a
            href={course.dingdongUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconFolder size={16} />
            {label}
            <NewTab />
          </a>
        </LinkButton>
      ) : (
        <LinkButton onClick={() => noFolderToast(course.code)}>
          <IconFolder size={16} />
          {label}
        </LinkButton>
      )}
    </p>
  );
}

/** Text as written, line breaks kept, its links opening in a new tab. */
function Kept({ text }: { text: string }) {
  return (
    <p className="g-pre-line mt-0.5 t-sm">
      {linkSegments(text).map((s, i) =>
        s.href ? (
          <a
            key={i}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2"
          >
            {s.text}
            <NewTab />
          </a>
        ) : (
          s.text
        ),
      )}
    </p>
  );
}

function Pager({ index, count }: { index: number; count: number }) {
  const navigate = courseRoute.useNavigate();
  const go = (to: number) => {
    if (to < 0 || to >= count) return;
    void navigate({
      search: (prev) => ({ ...prev, page: to + 1 }),
      replace: true,
    });
  };
  const first = index === 0;
  const last = index >= count - 1;
  return (
    <div className="g-pager">
      <Button
        variant="paper"
        size="sm"
        aria-label={copy.sebelumnyaLabel}
        aria-disabled={first || undefined}
        onClick={() => go(index - 1)}
      >
        <IconLanjut size={16} className="rotate-180" />
        <span className="lbl">{copy.sebelumnya}</span>
      </Button>
      <span className="t-cap text-fg-2 num">
        {fill(copy.posisi, { ke: index + 1, jumlah: count })}
      </span>
      <Button
        variant="paper"
        size="sm"
        aria-label={copy.berikutnyaLabel}
        aria-disabled={last || undefined}
        onClick={() => go(index + 1)}
      >
        <span className="lbl">{copy.berikutnya}</span>
        <IconLanjut size={16} />
      </Button>
    </div>
  );
}

function Testimonials({ course }: { course: Course }) {
  const { page } = courseRoute.useSearch();
  const list = useQuery(testimoniQuery(course.id));
  return (
    <Loaded
      query={list}
      failed={copy.gagalTestimoni}
      offlineText={copy.periksaKoneksi}
      skeleton={
        <Skeleton label={copy.memuatTestimoni}>
          <SkeletonBlock height={260} />
        </Skeleton>
      }
    >
      {(all) => {
        if (!all.length)
          return (
            <EmptyState title={copy.belumAdaTestimoni} text={copy.kosongIsi} />
          );
        const i = clampIndex(page, all.length);
        const t = all[i];
        const by = authorOf(t.userName);
        return (
          <>
            <Card
              className="g-testi-card"
              role="article"
              aria-label={fill(copy.testimoniKe, {
                ke: i + 1,
                jumlah: all.length,
              })}
            >
              <div className="g-byline">
                <Avatar initials={by.initials} />
                <p className="t-label strong">{by.name}</p>
              </div>
              {sections(course.major, t).map((s) => (
                <div key={s.key}>
                  <h3 className="t-label strong text-accent">{s.title}</h3>
                  <Kept text={s.text} />
                </div>
              ))}
            </Card>
            <Pager index={i} count={all.length} />
          </>
        );
      }}
    </Loaded>
  );
}

/** A course's page (`scrTesti` with a code): code and credits, the name, one testimonial and the pager. */
export function TestiCourseScreen() {
  const { courseId } = courseRoute.useParams();
  const catalogue = useQuery(catalogueQuery());
  const listed = catalogue.data?.find((c) => c.id === courseId);
  // Only for a course the catalogue doesn't have (an inactive one, from an old link).
  const single = useQuery({
    ...courseQuery(courseId),
    enabled: !!catalogue.data && !listed,
  });
  const course = listed ?? single.data;
  const online = useOnline();
  usePageTitle(course?.code);
  const desk = useMediaQuery(DESKTOP_QUERY);
  const tambah = useTambahTestimoni(course);

  if (!course) {
    const missing = !!catalogue.data && single.isError;
    const notFound =
      missing &&
      single.error instanceof ApiError &&
      single.error.status === 404;
    const failed =
      missing || (!catalogue.data && (catalogue.isError || !online));
    return (
      <Page title={SERVICE()}>
        {notFound ? (
          <NotFound />
        ) : failed ? (
          <ErrorState
            title={copy.gagalMatkul}
            text={online ? undefined : copy.periksaKoneksi}
            onRetry={() =>
              void (catalogue.data ? single.refetch() : catalogue.refetch())
            }
            retrying={online && (catalogue.isFetching || single.isFetching)}
          />
        ) : (
          <Skeleton label={copy.memuatMatkul}>
            <SkeletonBlock height={56} />
          </Skeleton>
        )}
      </Page>
    );
  }

  return (
    <Page
      title={testiTitle({ code: course.code }) ?? SERVICE()}
      actions={desk ? tambah.button : undefined}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="t-cap text-fg-2 num">{codeLine(course)}</p>
          <h2 className="mt-0.5 t-title">{course.name}</h2>
        </div>
        {/* P3-B: phones and tablets put Tambah testimoni at the end of the course's header row. */}
        {desk ? null : tambah.button}
      </div>
      <Testimonials course={course} />
      <DingdongLink course={course} />
      {tambah.dialog}
    </Page>
  );
}
