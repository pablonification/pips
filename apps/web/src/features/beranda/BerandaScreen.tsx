/**
 * Beranda (the prototype's `scrBeranda`, garis/screens-core.js), inside P0-C's frame (`BerandaHome`: the gold header
 * and greeting on phones and tablets, the greeting as the page head on desktop).
 * - Phones and tablets: the agenda card over the header's edge, the service tiles, Perlu ditindaklanjuti, Pengumuman
 *   belum dibaca and, for admins, Kelola.
 * - Desktop: the agenda card and Pengumuman belum dibaca in the main column; Perlu ditindaklanjuti, Pintasan and Kelola
 *   in the 320 px column.
 * Each section loads and fails on its own; the agenda card never waits for the others.
 */
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  useEffect,
  useId,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { Course, Info } from '~/api/generated';
import {
  Button,
  DESKTOP_QUERY,
  ErrorState,
  LinkButton,
  OfflineBanner,
  RowButton,
  RuledList,
  SectionHead,
  Skeleton,
  SkeletonRow,
  Tile,
  UnreadBar,
  useMediaQuery,
} from '~/components/garis';
import { GLYPHS, ICONS } from '~/components/icons/registry';
import { GlyphLayanan } from '~/components/icons/layanan';
import { IconCurhat } from '~/components/icons/curhat';
import { IconForm } from '~/components/icons/form';
import { IconLanjut } from '~/components/icons/lanjut';
import { IconLonceng } from '~/components/icons/lonceng';
import { IconLuar } from '~/components/icons/luar';
import { IconMatkul } from '~/components/icons/matkul';
import { IconTenggat } from '~/components/icons/tenggat';
import { openPushPrompt, usePushState } from '~/components/push';
import { BerandaHome } from '~/components/shell/BerandaHome';
import { PageBody } from '~/components/shell/page';
import { beranda as t } from '~/copy/beranda';
import { fill } from '~/copy/fill';
import { kalender as k } from '~/copy/kalender';
import { tanggal } from '~/copy/tanggal';
import useSession from '~/hooks/auth/useSession';
import { can } from '~/lib/capabilities';
import { hm } from '~/lib/dates';
import { partsOf, weekdayOf, type DayKey } from '~/lib/days';
import {
  BERANDA_TILES,
  PINNED_SERVICES,
  serviceById,
  type Service,
} from '~/lib/services';
import { cn } from '~/lib/utils';
import {
  useCourses,
  useDelayed,
  useMonthsEvents,
  useNow,
  useOnline,
  type MonthsState,
} from '~/features/kalender/data';
import { EventSheet } from '~/features/kalender/EventSheet';
import { useOpenEvent } from '~/features/kalender/open';
import { DayBars, DayListState, EventRows } from '~/features/kalender/parts';
import {
  capFirst,
  chosenStripDay,
  eventsOn,
  stripDayName,
  stripDays,
  stripMonths,
  whenDay,
  type CalEvent,
} from '~/features/kalender/rules';
import {
  adminFormsQuery,
  responsesCountQuery,
  useChatrooms,
  useCurhatUnread,
  useForms,
  useUnreadInfos,
} from './data';
import {
  attentionItems,
  kelolaForm,
  postTitle,
  unreadTop,
  welfareRooms,
  type AttentionItem,
} from './rules';
import './beranda.css';

export interface BerandaSearch {
  hari?: string;
  acara?: string;
}

/** The bars draw in once per session (rule 8), never under reduced motion (CSS). */
const DRAWN_KEY = 'pips:agenda-drawn';
let drawnThisPage = false;
function takeDraw(): boolean {
  if (drawnThisPage) return false;
  drawnThisPage = true;
  try {
    if (sessionStorage.getItem(DRAWN_KEY)) return false;
    sessionStorage.setItem(DRAWN_KEY, '1');
  } catch {
    // Storage blocked: once per page load instead.
  }
  return true;
}

export function BerandaScreen({ hari, acara }: BerandaSearch) {
  const now = useNow();
  const desk = useMediaQuery(DESKTOP_QUERY);
  const navigate = useNavigate();
  const days = useMemo(() => stripDays(now), [now]);
  const months = useMemo(() => stripMonths(now), [now]);
  const agenda = useMonthsEvents(months);
  const courses = useCourses();
  const push = usePushState();
  const online = useOnline();

  // An event link on desktop opens Kalender's side column (the prototype's `openEvent`).
  useEffect(() => {
    if (desk && acara)
      void navigate({
        to: '/kalender',
        search: { acara, hari: undefined },
        replace: true,
      });
  }, [desk, acara, navigate]);

  const card = (
    <AgendaCard
      days={days}
      chosen={chosenStripDay(days, hari)}
      agenda={agenda}
      courses={courses.byId}
      now={now}
    />
  );
  const offline =
    !online && agenda.ready ? (
      <OfflineBanner updatedAt={hm(agenda.updatedAt)} />
    ) : null;
  const sheet = (
    <EventSheet
      id={desk ? undefined : acara}
      from="/"
      loaded={agenda.events}
      ready={agenda.ready}
      courses={courses.byId}
      now={now}
      pushOn={push.status === 'aktif'}
    />
  );

  if (desk)
    return (
      <BerandaHome>
        <div className="g-d-grid">
          <div className="g-d-stack">
            {offline}
            {card}
            <Unread desk />
          </div>
          <div className="g-d-stack">
            <Attention desk agenda={agenda} courses={courses} now={now} />
            <Pins />
            <KelolaSummary desk now={now} />
          </div>
        </div>
      </BerandaHome>
    );

  return (
    <BerandaHome agenda={card}>
      <PageBody className="g-home-body">
        {offline}
        <Tiles />
        <Attention agenda={agenda} courses={courses} now={now} />
        <Unread />
        <KelolaSummary now={now} />
      </PageBody>
      {sheet}
    </BerandaHome>
  );
}

/* ================= The agenda card (`agendaCard`) ================= */

function AgendaCard({
  days,
  chosen,
  agenda,
  courses,
  now,
}: {
  days: DayKey[];
  chosen: DayKey;
  agenda: MonthsState;
  courses: ReadonlyMap<string, Course>;
  now: number;
}) {
  const navigate = useNavigate();
  const open = useOpenEvent();
  const headingId = useId();
  const draw = useMemo(() => takeDraw(), []);
  const late = useDelayed(!agenda.ready && !agenda.offline && !agenda.failed);
  const events = eventsOn(agenda.events, chosen);
  const state = (
    <DayListState
      state={agenda}
      late={late}
      empty={events.length === 0}
      emptyClassName="g-ag-empty"
    />
  );
  return (
    <section
      className={cn('g-agenda', draw && 'draw')}
      aria-labelledby={headingId}
    >
      <h2 className="sr-only" id={headingId}>
        {k.delapanHari}
      </h2>
      <div className="g-ag-strip" role="group" aria-label={k.pilihHari}>
        {days.map((d, i) => {
          const evs = agenda.ready ? eventsOn(agenda.events, d) : [];
          return (
            <button
              key={d}
              type="button"
              className={cn('g-ag-day', i === 0 && 'today')}
              aria-pressed={d === chosen}
              aria-label={stripDayName(d, i, evs.length)}
              style={{ '--i': i } as CSSProperties}
              onClick={() =>
                void navigate({
                  to: '/',
                  search: (s) => ({ ...s, hari: i === 0 ? undefined : d }),
                  replace: true,
                })
              }
            >
              <span className="wd" aria-hidden="true">
                {tanggal.hariPendek[weekdayOf(d)]}
              </span>
              <span className="dn" aria-hidden="true">
                {partsOf(d).day}
              </span>
              <DayBars events={evs} />
            </button>
          );
        })}
      </div>
      {agenda.ready && events.length ? (
        <EventRows
          className="g-ag-list"
          events={events}
          courses={courses}
          now={now}
          onOpen={open}
        />
      ) : state ? (
        <div className="g-ag-state">{state}</div>
      ) : null}
    </section>
  );
}

/* ================= Service tiles (`homeTiles`) and Pintasan (`pins`) ================= */

function ServiceLink({
  service: s,
  className,
  children,
}: {
  service: Service;
  className: string;
  children: ReactNode;
}) {
  return s.kind === 'external' ? (
    <a
      className={className}
      href={s.destination}
      target="_blank"
      rel="noopener"
    >
      {children}
    </a>
  ) : (
    <Link className={className} to={s.destination}>
      {children}
    </Link>
  );
}

function Tiles() {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h2 className="sr-only" id={headingId}>
        {t.layanan}
      </h2>
      <ul className="g-tiles">
        {BERANDA_TILES.map((id) => {
          const s = serviceById(id);
          const Glyph = GLYPHS[s.icon as keyof typeof GLYPHS];
          const ext = s.kind === 'external';
          return (
            <li key={id}>
              <ServiceLink service={s} className="g-tile-btn">
                <span className="key">
                  <Glyph />
                  {ext ? (
                    <span className="g-ext-mark">
                      <IconLuar size={16} />
                    </span>
                  ) : null}
                </span>
                <span>
                  {s.label}
                  {ext ? <span className="sr-only"> {t.situsLuar}</span> : null}
                </span>
              </ServiceLink>
            </li>
          );
        })}
        <li>
          <Link className="g-tile-btn" to="/layanan">
            <span className="key">
              <GlyphLayanan />
            </span>
            <span>{t.lainnya}</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}

function Pins() {
  return (
    <div>
      <SectionHead title={t.pintasan} action={<AllLink to="/layanan" />} />
      <div className="g-svc-grid two">
        {PINNED_SERVICES.map((id) => {
          const s = serviceById(id);
          const Icon = ICONS[s.icon];
          const ext = s.kind === 'external';
          return (
            <ServiceLink key={id} service={s} className="g-svc">
              <Tile>
                <Icon size={20} />
              </Tile>
              <span>
                {s.label}
                {ext ? (
                  <>
                    {' '}
                    <span className="ext">
                      <IconLuar size={16} />
                    </span>
                    <span className="sr-only"> {t.situsLuar}</span>
                  </>
                ) : null}
              </span>
            </ServiceLink>
          );
        })}
      </div>
    </div>
  );
}

function AllLink({ to }: { to: '/layanan' | '/pengumuman' | '/kelola' }) {
  return (
    <LinkButton asChild>
      <Link to={to}>
        {t.belumDibaca.semua}
        <IconLanjut size={16} />
      </Link>
    </LinkButton>
  );
}

/* ================= Perlu ditindaklanjuti (`attention`) ================= */

function Attention({
  desk = false,
  agenda,
  courses,
  now,
}: {
  desk?: boolean;
  agenda: MonthsState;
  courses: ReturnType<typeof useCourses>;
  now: number;
}) {
  const rooms = useChatrooms();
  const unread = useCurhatUnread();
  const forms = useForms();
  const push = usePushState();
  const sources = [rooms, unread, forms, courses];
  const failed = sources.filter((q) => q.isError && q.data === undefined);
  const waiting =
    sources.some((q) => q.data === undefined && !q.isError) || push.loading;
  const late = useDelayed(waiting && failed.length === 0);

  const items = attentionItems({
    now,
    events: agenda.events,
    welfare: welfareRooms(rooms.data, unread.data),
    forms: forms.data?.forms,
    courses: courses.data,
    pushOff:
      push.status !== null &&
      push.status !== 'aktif' &&
      push.status !== 'tidak-didukung',
  });

  let body: ReactNode;
  if (failed.length)
    body = (
      <ErrorState
        className="g-sec-error"
        text={k.periksaKoneksi}
        onRetry={() => failed.forEach((q) => void q.refetch())}
      />
    );
  else if (waiting)
    body = late ? (
      <Skeleton label={t.perlu.memuat}>
        <SkeletonRow />
        <SkeletonRow />
      </Skeleton>
    ) : null;
  else if (items.length)
    body = (
      <RuledList>
        {items.map((it) => (
          <AttentionRow
            key={
              it.kind === 'deadline'
                ? it.event.id
                : it.kind === 'form'
                  ? it.form.id
                  : it.kind
            }
            item={it}
            courses={courses.byId}
            now={now}
          />
        ))}
      </RuledList>
    );
  else body = <p className="g-empty-line t-sm text-fg-2">{t.perlu.kosong}</p>;

  return (
    <div>
      <SectionHead title={t.perlu.judul} line={!desk} />
      {desk ? body : <div className="g-home-card">{body}</div>}
    </div>
  );
}

function AttentionRow({
  item,
  courses,
  now,
}: {
  item: AttentionItem;
  courses: ReadonlyMap<string, Course>;
  now: number;
}) {
  const id = useId();
  const open = useOpenEvent();
  const row = (
    icon: ReactNode,
    gold: boolean,
    title: ReactNode,
    sub: ReactNode,
    action: ReactNode,
  ) => (
    <li className="g-item center g-att">
      <Tile gold={gold}>{icon}</Tile>
      <span className="grow">
        <span className="block t-sub" id={id}>
          {title}
        </span>
        {sub}
      </span>
      {action}
    </li>
  );
  const sub = (text: string, className = 't-cap text-fg-2') => (
    <span className={cn('block', className)}>{text}</span>
  );

  switch (item.kind) {
    case 'deadline': {
      const e = item.event;
      const course = e.courseId ? courses.get(e.courseId) : undefined;
      return row(
        <IconTenggat size={20} />,
        false,
        <DeadlineTitle event={e} code={course?.code} />,
        sub(
          fill(t.perlu.waktu, {
            hari: capFirst(whenDay(e.start, now)),
            jam: hm(e.start),
          }),
          'g-due urgent',
        ),
        <Button
          variant="paper"
          size="sm"
          aria-describedby={id}
          onClick={() => open(e)}
        >
          {t.perlu.lihat}
        </Button>,
      );
    }
    case 'curhat': {
      const [first] = item.rooms;
      const one = item.rooms.length === 1;
      return row(
        <IconCurhat size={20} />,
        false,
        t.perlu.welfare,
        one
          ? sub(
              fill(t.perlu.waktu, {
                hari: capFirst(whenDay(first.latestReply, now)),
                jam: hm(first.latestReply),
              }),
              't-cap text-fg-2 num',
            )
          : sub(fill(t.perlu.diRuang, { jumlah: item.rooms.length })),
        <Button variant="paper" size="sm" asChild aria-describedby={id}>
          {one ? (
            <Link to="/layanan/curhat/$roomId" params={{ roomId: first.id }}>
              {t.perlu.buka}
            </Link>
          ) : (
            <Link to="/layanan/curhat">{t.perlu.buka}</Link>
          )}
        </Button>,
      );
    }
    case 'form':
      return row(
        <IconForm size={20} />,
        true,
        item.form.title,
        sub(fill(t.perlu.bagian, { jumlah: item.form.sectionCount })),
        <Button variant="gold" size="sm" asChild aria-describedby={id}>
          <Link to="/layanan/form/$formId" params={{ formId: item.form.id }}>
            {t.perlu.isi}
          </Link>
        </Button>,
      );
    case 'courses':
      return row(
        <IconMatkul size={20} />,
        true,
        t.perlu.aturMatkul,
        sub(t.perlu.matkulKosong),
        <Button variant="gold" size="sm" asChild aria-describedby={id}>
          <Link to="/profil/matkul">{t.perlu.atur}</Link>
        </Button>,
      );
    case 'push':
      return row(
        <IconLonceng size={20} />,
        false,
        t.perlu.notifikasiMati,
        null,
        <Button
          variant="paper"
          size="sm"
          aria-describedby={id}
          onClick={() => void openPushPrompt()}
        >
          {t.perlu.nyalakan}
        </Button>,
      );
  }
}

/** "Deadline Tugas Besar 1 · IF2110": the last word, the dot and the code wrap as one, so no line starts "· IF2110". */
function DeadlineTitle({ event, code }: { event: CalEvent; code?: string }) {
  if (!code) return <>{event.title}</>;
  const m = /^(.*\s)?(\S+)$/.exec(event.title);
  const head = m?.[1] ?? '';
  const last = m?.[2] ?? event.title;
  return (
    <>
      {head}
      <span className="whitespace-nowrap">
        {last} · {code}
      </span>
    </>
  );
}

/* ================= Pengumuman belum dibaca (`postCompact(p, m, true)`) ================= */

function Unread({ desk = false }: { desk?: boolean }) {
  const q = useUnreadInfos();
  const late = useDelayed(q.data === undefined && !q.isError);
  const list = unreadTop(q.data);
  let body: ReactNode;
  if (q.data === undefined && q.isError)
    body = (
      <ErrorState
        className="g-sec-error"
        title={t.belumDibaca.gagal}
        text={k.periksaKoneksi}
        onRetry={() => void q.refetch()}
      />
    );
  else if (q.data === undefined)
    body = late ? (
      <Skeleton label={t.belumDibaca.memuat}>
        <SkeletonRow tile={false} lines={['88%', '60%']} />
        <SkeletonRow tile={false} lines={['72%']} />
      </Skeleton>
    ) : null;
  else if (list.length)
    body = (
      <RuledList>
        {list.map((p) => (
          <UnreadRow key={p.id} info={p} />
        ))}
      </RuledList>
    );
  else
    body = (
      <p className="g-empty-line t-sm text-fg-2">{t.belumDibaca.kosong}</p>
    );

  return (
    <div>
      <SectionHead
        title={t.belumDibaca.judul}
        line={!desk}
        action={<AllLink to="/pengumuman" />}
      />
      {desk ? body : <div className="g-home-card">{body}</div>}
    </div>
  );
}

function UnreadRow({ info }: { info: Info }) {
  return (
    <li>
      <RowButton asChild>
        <Link to="/pengumuman/$id" params={{ id: info.id }}>
          <span className="g-item brief">
            <UnreadBar unread />
            <span className="grow">
              <span className="g-clamp2 block t-sub">
                {postTitle(info)}
                <span className="sr-only"> {t.belumDibaca.tandaBelum}</span>
              </span>
            </span>
          </span>
        </Link>
      </RowButton>
    </li>
  );
}

/* ================= Kelola (`kelolaSummary`) ================= */

function KelolaSummary({ desk = false, now }: { desk?: boolean; now: number }) {
  const user = useSession();
  const admin = can(user, 'liveCounting');
  const forms = useQuery({ ...adminFormsQuery(), enabled: admin });
  const form = kelolaForm(forms.data, now);
  const count = useQuery({
    ...responsesCountQuery(form?.id ?? ''),
    enabled: admin && !!form,
  });
  if (!admin || !form) return null;
  return (
    <div>
      <SectionHead
        title={t.kelola.judul}
        line={!desk}
        action={<AllLink to="/kelola" />}
      />
      <RowButton asChild className="g-card g-kelola">
        <Link to="/kelola/live/$formId" params={{ formId: form.id }}>
          <span className="g-between">
            <span>
              <span className="g-live t-cap strong text-accent">
                <i aria-hidden="true" />
                {t.kelola.live}
              </span>
              <span className="g-kelola-title block t-sub">{form.title}</span>
            </span>
            <span className="g-kelola-n">
              <span className="block t-figure">
                {count.data ?? (count.isError ? '–' : '')}
              </span>
              <span className="block t-cap text-fg-3">
                {t.kelola.sudahMengisi}
              </span>
            </span>
          </span>
        </Link>
      </RowButton>
    </div>
  );
}
