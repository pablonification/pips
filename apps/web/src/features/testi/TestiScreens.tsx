/**
 * Testi Matkul (garis/screens-more.js `scrTesti` and its helpers): read-only testimonials, by programme → semester →
 * course, or by searching every course by code or name from the start. Programme, list and course are path params
 * (P0-B, today's values, which P1-A links to); the searches are `q`. Since Garis v5 a course page shows every
 * testimonial at once, read by scrolling; today's `page` is still accepted so old links open, and changes nothing.
 */
import { useQuery } from '@tanstack/react-query';
import { getRouteApi, Link, Navigate } from '@tanstack/react-router';
import { useId, useState, type ReactNode } from 'react';
import { useInView } from 'react-intersection-observer';
import { ApiError, type Course, type Testimoni } from '~/api/generated';
import {
  Avatar,
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
import { DESKTOP_QUERY, useMediaQuery } from '~/components/garis/useMediaQuery';
import { DeskHead, PageBody, usePageTitle } from '~/components/shell/page';
import { useTambahTestimoni } from '~/features/kelola-testi/Manage';
import { fill } from '~/copy/fill';
import { testi as copy } from '~/copy/testi';
import { DEBOUNCE_TIME } from '~/lib/constants';
import { serviceById } from '~/lib/services';
import { cn } from '~/lib/utils';
import { noFolderToast } from '~/features/dingdong/no-folder';
import { httpHref } from '~/lib/file-link';
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
  creditsLine,
  columnsFor,
  isLong,
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
  wide = false,
  actions,
  children,
}: {
  title: string;
  gap?: string;
  /** Desktop's 1,180 px column (a course page's testimonials, Garis v5's `testi-wide`). */
  wide?: boolean;
  /** Desktop's header actions (P3-B's Tambah testimoni). */
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <DeskHead title={title} actions={actions} />
      <PageBody wide={wide} className={gap}>
        {children}
      </PageBody>
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

/** **Buka Ding Dong IF2110**, in the course's header (Garis v5): the folder in a new tab, or the toast when it has none. */
function DingdongLink({ course }: { course: Course }) {
  const label = fill(copy.bukaDingdong, { kode: course.code });
  const href = httpHref(course.dingdongUrl);
  return href ? (
    <LinkButton asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
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
  );
}

/** Text as written, line breaks kept (on the parent), its links opening in a new tab. */
function Kept({ text }: { text: string }) {
  return linkSegments(text).map((s, i) =>
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
  );
}

/**
 * One testimonial (Garis v5's `testiCard`): the author, then the programme's sections and Dosen. A section over 280
 * characters folds to six lines behind **Baca selengkapnya**, which becomes **Ringkas lagi** once open.
 */
function TestiCard({ major, t }: { major: Course['major']; t: Testimoni }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const by = authorOf(t.userName);
  const secs = sections(major, t);
  const long = secs.some((s) => isLong(s.text));
  return (
    <li className="g-card g-testi-card">
      <div className="g-byline">
        <Avatar initials={by.initials} />
        <h3 className="t-label strong">{by.name}</h3>
      </div>
      <dl className="g-testi-secs" id={id}>
        {secs.map((s) => (
          <div key={s.key}>
            <dt className="t-label strong text-accent">{s.title}</dt>
            <dd
              className={cn(
                'g-pre-line t-sm',
                long && !open && isLong(s.text) && 'fold',
              )}
            >
              <Kept text={s.text} />
            </dd>
          </div>
        ))}
      </dl>
      {long ? (
        <LinkButton
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? copy.ringkasLagi : copy.bacaSelengkapnya}
        </LinkButton>
      ) : null}
    </li>
  );
}

/**
 * Every testimonial at once, in the API's order (Garis v5): one stack on phones, columns of at least 300 px wider up
 * (two on tablets and 1024 px desktops, three at 1440). Columns read top to bottom, as the keyboard does.
 */
function Testimonials({ course }: { course: Course }) {
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
      {(all) =>
        all.length ? (
          <ul className="g-testi-grid" data-n={columnsFor(all.length)}>
            {all.map((t) => (
              <TestiCard key={t.id} major={course.major} t={t} />
            ))}
          </ul>
        ) : (
          <EmptyState title={copy.belumAdaTestimoni} text={copy.kosongIsi} />
        )
      }
    </Loaded>
  );
}

/** A course's page (`scrTesti` with a code): code and credits, the name and Buka Ding Dong, then every testimonial. */
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
      gap="g-testi-page"
      wide
      actions={desk ? tambah.button : undefined}
    >
      <div className="g-testi-head">
        <div className="flex min-w-0 flex-auto items-start gap-3">
          <div className="min-w-0 flex-1">
            {creditsLine(course) ? (
              <p className="t-cap text-fg-2 num">{creditsLine(course)}</p>
            ) : null}
            <h2 className="mt-0.5 t-title">{course.name}</h2>
          </div>
          {/* P3-B: phones and tablets put Tambah testimoni at the end of the course's header row. */}
          {desk ? null : tambah.button}
        </div>
        <DingdongLink course={course} />
      </div>
      <Testimonials course={course} />
      {tambah.dialog}
    </Page>
  );
}
