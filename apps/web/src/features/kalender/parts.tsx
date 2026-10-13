/**
 * Kalender's pieces, shared with Beranda's agenda card: a day's bars, one event row, a day's list, the legend and
 * the event detail (the prototype's `phoneMonth` bars, `agendaRow`, `dayList`, `legend` and `evInfo` in
 * garis/screens-core.js). Styles: kalender.css.
 */
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { Course } from '~/api/generated';
import {
  Button,
  ErrorState,
  LinkButton,
  RowButton,
  RuledList,
  Skeleton,
  SkeletonRow,
  Tag,
  Tile,
} from '~/components/garis';
import { IconFolder } from '~/components/icons/folder';
import { IconJam } from '~/components/icons/jam';
import { IconKredit } from '~/components/icons/kredit';
import { IconLonceng } from '~/components/icons/lonceng';
import { IconLuar } from '~/components/icons/luar';
import { IconTesti } from '~/components/icons/testi';
import { kalender as t } from '~/copy/kalender';
import { hm } from '~/lib/dates';
import { cn } from '~/lib/utils';
import {
  courseLine,
  dateLine,
  isEnded,
  isHimpunan,
  isPoint,
  reminderLine,
  testiParams,
  timeLine,
  type CalEvent,
} from './rules';
import './kalender.css';

/** Up to three bars for a day's events: solid Akademik, hatched Himpunan, short for a deadline. Decorative. */
export function DayBars({ events }: { events: readonly CalEvent[] }) {
  return (
    <span className="g-mbars" aria-hidden="true">
      {events.slice(0, 3).map((e) => (
        <i
          key={e.id}
          className={cn(
            isHimpunan(e) ? 'himpunan' : 'akademik',
            isPoint(e) && 'point',
          )}
        />
      ))}
    </span>
  );
}

/** One event row: start and end (or "Batas"), the category bar, the title and its course (`agendaRow`). */
export function AgendaRow({
  event: e,
  course,
  now,
  current = false,
  onOpen,
}: {
  event: CalEvent;
  course: Course | undefined;
  now: number;
  current?: boolean;
  onOpen: (e: CalEvent) => void;
}) {
  const ended = isEnded(e, now);
  const point = isPoint(e);
  const line = courseLine(e, course);
  return (
    <li>
      <RowButton current={current} onClick={() => onOpen(e)} data-event={e.id}>
        <span className="g-agenda-item">
          <span className="time">
            <span className="block t-label strong num">{hm(e.start)}</span>
            {point ? (
              <span className="block t-micro text-fg-3">{t.batas}</span>
            ) : (
              <span className="block t-cap text-fg-3 num">{hm(e.end)}</span>
            )}
          </span>
          <span
            className={cn(
              'g-kbar',
              isHimpunan(e) && 'himpunan',
              point && 'point',
              ended && 'past',
            )}
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className={cn('block t-sub', ended && 'g-ended')}>
              {e.title}
              {ended ? <span className="sr-only"> {t.selesai}</span> : null}
            </span>
            {line ? (
              <span className="block t-cap text-fg-2">{line}</span>
            ) : null}
          </span>
        </span>
      </RowButton>
    </li>
  );
}

/** What a list of events shows while it has none to show: loading, failed, offline and not kept, or empty. */
export interface ListState {
  loading: boolean;
  failed: boolean;
  offline: boolean;
  retry: () => void;
}

/** The skeleton, error or empty line in place of a day's events. Null when the events are there. */
export function DayListState({
  state,
  late,
  empty,
  emptyClassName,
}: {
  state: ListState & { ready: boolean };
  /** The load has taken over 300 ms: show the skeleton. */
  late: boolean;
  empty: boolean;
  emptyClassName?: string;
}): ReactNode {
  if (state.offline && !state.ready)
    return (
      <ErrorState
        className="g-day-error"
        title={t.belumTersimpan}
        text={t.sambungkan}
        onRetry={state.retry}
      />
    );
  if (state.failed && !state.ready)
    return (
      <ErrorState
        className="g-day-error"
        title={t.gagal}
        text={t.periksaKoneksi}
        onRetry={state.retry}
      />
    );
  if (!state.ready)
    return late ? (
      <Skeleton label={t.memuatAcara} className="g-day-skel">
        <SkeletonRow lines={['18%', '64%', '42%']} tile={false} />
        <SkeletonRow lines={['18%', '52%', '36%']} tile={false} />
      </Skeleton>
    ) : null;
  if (empty) return <p className={emptyClassName}>{t.tidakAdaAcara}</p>;
  return null;
}

/** A day's events as rows. */
export function EventRows({
  events,
  courses,
  now,
  currentId,
  onOpen,
  className,
}: {
  events: readonly CalEvent[];
  courses: ReadonlyMap<string, Course>;
  now: number;
  currentId?: string | null;
  onOpen: (e: CalEvent) => void;
  className?: string;
}) {
  return (
    <RuledList className={className}>
      {events.map((e) => (
        <AgendaRow
          key={e.id}
          event={e}
          course={e.courseId ? courses.get(e.courseId) : undefined}
          now={now}
          current={currentId === e.id}
          onOpen={onOpen}
        />
      ))}
    </RuledList>
  );
}

/** Akademik, Himpunan and Batas waktu, with Atur mata kuliah at the end (`legend`). */
export function Legend() {
  return (
    <div className="g-legend">
      <span>
        <i />
        {t.legenda.akademik}
      </span>
      <span>
        <i className="h" />
        {t.legenda.himpunan}
      </span>
      <span>
        <i className="d" />
        {t.legenda.batasWaktu}
      </span>
      <LinkButton asChild className="ml-auto">
        <Link to="/profil/matkul">{t.legenda.aturMataKuliah}</Link>
      </LinkButton>
    </div>
  );
}

/**
 * The event detail (`evInfo`): its category (and "Sudah lewat" once ended), course and title, when, the description,
 * Pengingat H-1, then Google Calendar and, for an Akademik event, Ding Dong and Testi Matkul.
 */
export function EventInfo({
  event: e,
  course,
  now,
  pushOn,
  titleAs: Title = 'h3',
}: {
  event: CalEvent;
  course: Course | undefined;
  now: number;
  pushOn: boolean;
  titleAs?: 'h2' | 'h3';
}) {
  const himpunan = isHimpunan(e);
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <Tag tone={himpunan ? 'accent' : 'default'}>
          {himpunan ? t.detail.himpunan : t.detail.akademik}
        </Tag>
        {isEnded(e, now) ? <Tag>{t.detail.sudahLewat}</Tag> : null}
      </div>
      <div>
        {course ? (
          <p className="t-cap text-fg-2">
            {course.code} · {course.name}
          </p>
        ) : null}
        <Title className="g-ev-title t-title">{e.title}</Title>
      </div>
      <RuledList>
        <li className="g-item center">
          <Tile size="sm">
            <IconJam size={16} />
          </Tile>
          <div>
            <p className="t-label num">{timeLine(e)}</p>
            <p className="t-cap text-fg-3">{dateLine(e)}</p>
          </div>
        </li>
        {e.description ? (
          <li className="g-item">
            <Tile size="sm">
              <IconKredit size={16} />
            </Tile>
            <p className="g-ev-desc t-sm">{e.description}</p>
          </li>
        ) : null}
        <li className="g-item center">
          <Tile size="sm">
            <IconLonceng size={16} />
          </Tile>
          <div>
            <p className="t-label">{t.detail.pengingat}</p>
            <p className="t-cap text-fg-3">{reminderLine(e, now, pushOn)}</p>
          </div>
        </li>
      </RuledList>
      <div className="flex flex-wrap gap-2">
        <Button variant="paper" size="sm" asChild>
          <a href={e.googleCalendarUrl} target="_blank" rel="noopener">
            <IconLuar size={16} />
            {t.detail.googleCalendar}
            <span className="sr-only"> {t.detail.tabBaru}</span>
          </a>
        </Button>
        {course ? (
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/layanan/dingdong">
                <IconFolder size={16} />
                {t.detail.dingDong}
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link
                to="/layanan/testi/$type/$semester/$courseId"
                params={testiParams(course)}
              >
                <IconTesti size={16} />
                {t.detail.testiMatkul}
              </Link>
            </Button>
          </>
        ) : null}
      </div>
    </>
  );
}
