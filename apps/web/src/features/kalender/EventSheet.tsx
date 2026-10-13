/**
 * "Detail acara" on phones and tablets (the prototype's `OV.event`): a bottom sheet on phones, a centred panel from
 * 640 px (P0-A's Sheet). It opens for the URL's `acara`; Escape, Tutup and Back close it, and focus returns to the
 * row that opened it. An id the API doesn't know opens nothing, and the param is dropped.
 */
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import type { Course } from '~/api/generated';
import { Sheet } from '~/components/garis';
import { kalender as t } from '~/copy/kalender';
import { useEvent } from './data';
import { useCloseEvent } from './open';
import { EventInfo } from './parts';
import type { CalEvent } from './rules';

export function EventSheet({
  id,
  from,
  loaded,
  ready,
  courses,
  now,
  pushOn,
}: {
  id: string | undefined;
  /** The page it lies over. */
  from: '/' | '/kalender';
  /** Events already on the page; anything else is fetched by id. */
  loaded: readonly CalEvent[];
  /** The page's months have arrived: only then is an event missing from them asked for by id. */
  ready: boolean;
  courses: ReadonlyMap<string, Course>;
  now: number;
  pushOn: boolean;
}) {
  const { event, missing } = useEvent(id, loaded, ready);
  const close = useCloseEvent();
  const navigate = useNavigate();
  useEffect(() => {
    if (missing)
      void navigate({
        to: from,
        search: (s) => ({ ...s, acara: undefined }),
        replace: true,
      });
  }, [missing, from, navigate]);
  const course =
    event?.courseId !== undefined && event.courseId !== null
      ? courses.get(event.courseId)
      : undefined;
  return (
    <Sheet
      open={!!id && !!event}
      onOpenChange={(open) => {
        if (!open && id) close(id);
      }}
      title={t.detail.judul}
    >
      {event ? (
        <div className="g-ev-info">
          <EventInfo event={event} course={course} now={now} pushOn={pushOn} />
        </div>
      ) : null}
    </Sheet>
  );
}
