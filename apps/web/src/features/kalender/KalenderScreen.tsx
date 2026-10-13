/**
 * Kalender (the prototype's `scrKalender`, garis/screens-core.js). Phones and tablets: the title with Tambah acara,
 * the month with its buttons, the Monday-first grid, the chosen day's events and the legend; an event opens a sheet.
 * Desktop: the month as the page title, the bordered grid with up to two chips a day, and the 300 px column with the
 * day's events and the chosen event's detail. The chosen day (`hari`) and event (`acara`) live in the URL.
 *
 * The grid takes one Tab stop; arrows move by a day or a week, Home and End to the week's ends, Page Up and Page Down
 * by a month, and Enter or Space chooses (SPEC "Kalender: Keyboard", not in the prototype; the look is unchanged).
 */
import { useNavigate } from '@tanstack/react-router';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { Course } from '~/api/generated';
import {
  Button,
  Card,
  DESKTOP_QUERY,
  IconButton,
  OfflineBanner,
  useMediaQuery,
} from '~/components/garis';
import { IconLanjut } from '~/components/icons/lanjut';
import { usePushState } from '~/components/push';
import { DeskHead, PageBody, PageTitle } from '~/components/shell/page';
import { kalender as t } from '~/copy/kalender';
import { fill } from '~/copy/fill';
import { tanggal } from '~/copy/tanggal';
import { dLong, hm } from '~/lib/dates';
import {
  dayKeyOf,
  dayStart,
  monthCells,
  monthOf,
  sameMonth,
  shiftMonth,
  type DayKey,
  type Month,
} from '~/lib/days';
import { cn } from '~/lib/utils';
import { AddEventButton } from './AddEventButton';
import {
  useCourses,
  useDelayed,
  useEvent,
  useMonthsEvents,
  useNow,
  useOnline,
} from './data';
import { EventSheet } from './EventSheet';
import { useOpenEvent } from './open';
import { DayBars, DayListState, EventInfo, EventRows, Legend } from './parts';
import {
  deskCellName,
  deskDefaultEvent,
  eventsOn,
  evLabel,
  gridMonths,
  isHimpunan,
  isPoint,
  monthChangeDay,
  monthDayName,
  moveFocus,
  type CalEvent,
  type DeskPick,
} from './rules';

// Monday first: Sen … Min.
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0].map((d) => tanggal.hariPendek[d]);
const monthTitle = (m: Month) => `${tanggal.bulan[m.month - 1]} ${m.year}`;
const dayNumber = (k: DayKey) => Number(k.slice(8));

export interface KalenderSearch {
  hari?: string;
  acara?: string;
}

export function KalenderScreen({ hari, acara }: KalenderSearch) {
  const now = useNow();
  const today = dayKeyOf(now);
  const chosen = hari ?? today;
  const desk = useMediaQuery(DESKTOP_QUERY);
  const navigate = useNavigate({ from: '/kalender' });

  // The month on screen follows the chosen day; the keyboard can move it on its own (focus in another month).
  const [view, setView] = useState<Month>(() => monthOf(chosen));
  const [focusDay, setFocusDay] = useState<DayKey>(chosen);
  const [lastChosen, setLastChosen] = useState(chosen);
  if (lastChosen !== chosen) {
    setLastChosen(chosen);
    setView(monthOf(chosen));
    setFocusDay(chosen);
  }
  const [pick, setPick] = useState<DeskPick>('auto');
  const focusNext = useRef<DayKey | null>(null);

  const grid = useMonthsEvents(useMemo(() => gridMonths(view), [view]));
  const day = useMonthsEvents(useMemo(() => [monthOf(chosen)], [chosen]));
  const courses = useCourses();
  const push = usePushState();
  const pushOn = push.status === 'aktif';
  const online = useOnline();
  const open = useOpenEvent();

  const choose = (k: DayKey, how: DeskPick) => {
    setPick(how);
    void navigate({
      search: (s) => ({ ...s, hari: k, acara: undefined }),
      replace: true,
    });
  };
  const changeMonth = (delta: number) =>
    choose(monthChangeDay(shiftMonth(view, delta), now), 'auto');
  const goToday = () => {
    focusNext.current = today;
    choose(today, 'auto');
  };

  // Focus follows the keyboard and Hari ini to the cell they chose.
  useEffect(() => {
    const k = focusNext.current;
    if (!k) return;
    // The cell may not be drawn yet (Hari ini from another month): try again after the next render.
    const cell = document.querySelector<HTMLElement>(
      `[data-day="${k}"][data-grid]`,
    );
    if (!cell) return;
    focusNext.current = null;
    cell.focus();
  });

  const onGridKey = (e: KeyboardEvent) => {
    const next = moveFocus(focusDay, e.key);
    if (!next) return;
    e.preventDefault();
    setFocusDay(next);
    if (!sameMonth(monthOf(next), view)) setView(monthOf(next));
    focusNext.current = next;
  };

  const cells = monthCells(view);
  const isToday = chosen === today && sameMonth(view, monthOf(today));
  const dayEvents = eventsOn(day.events, chosen);
  const late = useDelayed(!day.ready && !day.offline && !day.failed);

  // Desktop's chosen event: the URL's, else the default for how the day was chosen.
  const urlEvent = useEvent(desk ? acara : undefined, day.events, day.ready);
  const deskEventId = desk
    ? (acara ?? deskDefaultEvent(day.events, chosen, now, pick))
    : null;
  const deskEvent =
    (deskEventId && dayEvents.find((e) => e.id === deskEventId)) ||
    (acara && urlEvent.event) ||
    null;
  useEffect(() => {
    if (desk && acara && urlEvent.missing)
      void navigate({
        search: (s) => ({ ...s, acara: undefined }),
        replace: true,
      });
  }, [desk, acara, urlEvent.missing, navigate]);

  const monthNav = (
    <div className="g-month-nav">
      <IconButton
        label={t.bulanSebelumnya}
        className="prev"
        onClick={() => changeMonth(-1)}
      >
        <IconLanjut size={20} />
      </IconButton>
      <IconButton label={t.bulanBerikutnya} onClick={() => changeMonth(1)}>
        <IconLanjut size={20} />
      </IconButton>
      {isToday ? null : (
        <Button variant="paper" size="sm" onClick={goToday}>
          {t.hariIni}
        </Button>
      )}
    </div>
  );

  const offlineBanner =
    !online && day.ready ? (
      <OfflineBanner updatedAt={hm(day.updatedAt)} />
    ) : null;

  const dayHeading = (
    <h2 className="t-heading">
      {dLong(dayStart(chosen))}
      {chosen === today ? (
        <>
          {' · '}
          <span className="text-accent">{t.hariIniKecil}</span>
        </>
      ) : null}
    </h2>
  );
  const listState = (
    <DayListState
      state={day}
      late={late}
      empty={dayEvents.length === 0}
      emptyClassName="g-day-empty"
    />
  );
  const rows =
    day.ready && dayEvents.length ? (
      <EventRows
        events={dayEvents}
        courses={courses.byId}
        now={now}
        currentId={desk ? deskEvent?.id : null}
        onOpen={open}
      />
    ) : null;

  const gridProps = {
    cells,
    view,
    today,
    chosen,
    focusDay,
    events: grid.events,
    courses: courses.byId,
    onChoose: (k: DayKey) => {
      setFocusDay(k);
      choose(k, desk ? 'first' : 'auto');
    },
    onKeyDown: onGridKey,
  };

  if (desk)
    return (
      <div className="g-cal-split">
        <div className="g-cal-main">
          <DeskHead
            title={monthTitle(view)}
            actions={
              <div className="g-cal-actions">
                {monthNav}
                <AddEventButton />
              </div>
            }
          />
          <div className="g-d-pad">
            {offlineBanner}
            <DeskMonth {...gridProps} />
            <Legend />
          </div>
        </div>
        <section className="g-cal-side" aria-label={t.acaraHariTerpilih}>
          {dayHeading}
          {listState}
          {rows}
          {deskEvent ? (
            <Card className="g-ev-card">
              <EventInfo
                event={deskEvent}
                course={courseFor(deskEvent, courses.byId)}
                now={now}
                pushOn={pushOn}
              />
            </Card>
          ) : day.ready ? (
            <p className="t-cap text-fg-3">{t.pilihAcara}</p>
          ) : null}
        </section>
      </div>
    );

  return (
    <PageBody className="g-kal-page">
      <div className="g-kal-head">
        <PageTitle>{t.judul}</PageTitle>
        <AddEventButton />
      </div>
      {offlineBanner}
      <div className="g-cal-head">
        <p className="t-heading">{monthTitle(view)}</p>
        {monthNav}
      </div>
      <PhoneMonth {...gridProps} />
      <div className="g-day-list">
        {dayHeading}
        {listState}
        {rows}
      </div>
      <Legend />
      <EventSheet
        id={acara}
        from="/kalender"
        loaded={day.events}
        ready={day.ready}
        courses={courses.byId}
        now={now}
        pushOn={pushOn}
      />
    </PageBody>
  );
}

const courseFor = (e: CalEvent, courses: ReadonlyMap<string, Course>) =>
  e.courseId ? courses.get(e.courseId) : undefined;

interface GridProps {
  cells: DayKey[];
  view: Month;
  today: DayKey;
  chosen: DayKey;
  focusDay: DayKey;
  events: readonly CalEvent[];
  courses: ReadonlyMap<string, Course>;
  onChoose: (k: DayKey) => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

/** The tab stop: the focused day when it's in the grid, else the chosen day, else the 1st. */
function tabStop({ cells, focusDay, chosen, view }: GridProps): DayKey {
  if (cells.includes(focusDay)) return focusDay;
  if (cells.includes(chosen)) return chosen;
  return `${view.year}-${String(view.month).padStart(2, '0')}-01`;
}

/** Phones and tablets: seven columns of day buttons, up to three bars each (`phoneMonth`). */
function PhoneMonth(p: GridProps) {
  const stop = tabStop(p);
  return (
    <div
      className="g-month"
      role="group"
      aria-label={monthTitle(p.view)}
      onKeyDown={p.onKeyDown}
    >
      {WEEKDAYS.map((w) => (
        <span key={w} className="wd" aria-hidden="true">
          {w}
        </span>
      ))}
      {p.cells.map((k) => {
        const evs = eventsOn(p.events, k);
        return (
          <button
            key={k}
            type="button"
            data-day={k}
            data-grid=""
            tabIndex={k === stop ? 0 : -1}
            className={cn(
              'g-mday',
              !sameMonth(monthOf(k), p.view) && 'out',
              k === p.today && 'today',
            )}
            aria-pressed={k === p.chosen}
            aria-label={monthDayName(k, p.today, evs.length)}
            onClick={() => p.onChoose(k)}
          >
            <span className="dn">{dayNumber(k)}</span>
            <DayBars events={evs} />
          </button>
        );
      })}
    </div>
  );
}

/** Desktop: the bordered grid, at most two chips a day and "+N lagi" (`.dmonth`). */
function DeskMonth(p: GridProps) {
  const stop = tabStop(p);
  return (
    <div
      className="g-dmonth"
      role="group"
      aria-label={monthTitle(p.view)}
      onKeyDown={p.onKeyDown}
    >
      {WEEKDAYS.map((w) => (
        <span key={w} className="wd" aria-hidden="true">
          {w}
        </span>
      ))}
      {p.cells.map((k) => {
        const evs = eventsOn(p.events, k);
        const course = (e: CalEvent) =>
          e.courseId ? p.courses.get(e.courseId) : undefined;
        return (
          <button
            key={k}
            type="button"
            data-day={k}
            data-grid=""
            tabIndex={k === stop ? 0 : -1}
            className={cn(
              'g-dcell',
              !sameMonth(monthOf(k), p.view) && 'out',
              k === p.today && 'today',
            )}
            aria-pressed={k === p.chosen}
            aria-label={deskCellName(
              k,
              p.today,
              evs.map((e) => evLabel(e, course(e))),
            )}
            onClick={() => p.onChoose(k)}
          >
            <span className="dn">
              {dayNumber(k)}
              {k === p.today ? ` · ${t.hariIniKecil}` : ''}
            </span>
            {evs.slice(0, 2).map((e) => (
              <span
                key={e.id}
                className={cn(
                  'g-dchip',
                  isPoint(e) ? 'point' : isHimpunan(e) ? 'himpunan' : null,
                )}
                aria-hidden="true"
              >
                <span className="tm">{course(e)?.code ?? hm(e.start)}</span>
                <span className="ttl">{e.title}</span>
              </span>
            ))}
            {evs.length > 2 ? (
              <span className="g-dmore" aria-hidden="true">
                {fill(t.lagi, { jumlah: evs.length - 2 })}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
