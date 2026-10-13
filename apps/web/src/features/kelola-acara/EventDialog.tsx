/**
 * Tambah acara Akademik (the prototype's `addEventForm` in `OV.addev`, locked) and its proposals: Tambah acara
 * Himpunan for `ring1`, the Seg for members with both roles, and Ubah acara. P0-A's Modal: a sheet on phones, a
 * centred panel on tablets, a dialog on desktop, focus on the first field, trapped, Esc closes and focus returns.
 * Loaded on demand (members never download it). The screen that opens it decides what happens after a save.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { api } from '~/api/client';
import type { CalendarEvent, Course } from '~/api/generated';
import { currentCoursesQuery } from '~/api/queries';
import {
  Button,
  ErrorState,
  Input,
  Modal,
  Seg,
  Select,
  Skeleton,
  SkeletonRow,
  Textarea,
} from '~/components/garis';
import { IconPeringatan } from '~/components/icons/peringatan';
import { kelolaAcara as t } from '~/copy/kelola-acara';
import { catalogueQuery } from '~/features/testi/queries';
import type { EventCategory } from '~/lib/capabilities';
import type { DayKey } from '~/lib/days';
import '~/features/kelola-tulis/kelola-tulis.css';
import {
  courseOptions,
  createBody,
  draftOf,
  firstError,
  newDraft,
  updateBody,
  validateEvent,
  type EventDraft,
  type EventErrors,
  type EventField,
} from './rules';

export type EventDialogMode =
  | { kind: 'add'; categories: EventCategory[]; day: DayKey }
  | { kind: 'edit'; event: CalendarEvent };

export interface EventDialogProps {
  mode: EventDialogMode;
  onOpenChange: (open: boolean) => void;
  /** After the API saved it: the screen closes the dialog, refreshes Kalender, toasts and moves focus. */
  onSaved: (saved: CalendarEvent, draft: EventDraft, course?: Course) => void;
  /** After a failed request: the dialog stays open with everything typed. */
  onFailed: (error: unknown) => void;
  /** Where focus goes when it closes; by default back to the control that opened it. */
  onCloseAutoFocus?: (e: Event) => void;
}

export default function EventDialog({
  mode,
  onOpenChange,
  onSaved,
  onFailed,
  onCloseAutoFocus,
}: EventDialogProps) {
  const id = useId();
  const [draft, setDraft] = useState<EventDraft>(() =>
    mode.kind === 'edit'
      ? draftOf(mode.event)
      : newDraft(mode.categories[0], mode.day),
  );
  // As the prototype's submit branch: errors are set on submit and stay until the next one.
  const [errors, setErrors] = useState<EventErrors>({});
  const form = useRef<HTMLFormElement>(null);
  const akademik = draft.category === 'akademik';
  const adding = mode.kind === 'add';

  const catalogue = useQuery({ ...catalogueQuery(), enabled: akademik });
  const mine = useQuery({ ...currentCoursesQuery(), enabled: akademik });
  const myIds = useMemo(
    () => new Set((mine.data ?? []).map((c) => c.courseId)),
    [mine.data],
  );
  const options = useMemo(
    () => courseOptions(catalogue.data ?? [], myIds),
    [catalogue.data, myIds],
  );
  const courseId = draft.courseId || options[0]?.id || '';
  const course =
    options.find((c) => c.id === courseId) ??
    mine.data?.find((c) => c.courseId === courseId)?.course;

  const catalogueMissing =
    akademik && adding && (!catalogue.data || !mine.data);
  const catalogueFailed =
    catalogueMissing && (catalogue.isError || mine.isError);

  const save = useMutation({
    mutationFn: (d: EventDraft) =>
      mode.kind === 'edit'
        ? api.calendar.updateCalendarEvent({
            eventId: mode.event.id,
            requestBody: updateBody(d),
          })
        : api.calendar.postCalendarEvent({ requestBody: createBody(d) }),
  });

  const patch = (p: Partial<EventDraft>) => setDraft((d) => ({ ...d, ...p }));
  const fieldId = (k: string) => `${id}-${k}`;
  const focusField = (k: EventField) =>
    requestAnimationFrame(() => document.getElementById(fieldId(k))?.focus());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (save.isPending || catalogueMissing) return;
    const full = { ...draft, courseId };
    const found = validateEvent(full);
    setErrors(found);
    const first = firstError(found);
    if (first) {
      focusField(first);
      return;
    }
    save.mutate(full, {
      onSuccess: (saved) => onSaved(saved, full, course),
      onError: onFailed,
    });
  };

  const err = (k: EventField) =>
    errors[k] ? (
      <p className="g-err t-cap" id={fieldId(`${k}-err`)}>
        <IconPeringatan size={16} />
        {errors[k]}
      </p>
    ) : null;
  const invalid = (k: EventField) =>
    errors[k]
      ? { 'aria-invalid': true, 'aria-describedby': fieldId(`${k}-err`) }
      : {};

  const title =
    mode.kind === 'edit'
      ? t.judul.ubah
      : akademik
        ? t.judul.akademik
        : t.judul.himpunan;

  // The course: a select while adding; plain text while changing (the API can't move an event to another course).
  let courseField = null;
  if (akademik && adding) {
    courseField =
      catalogue.data && mine.data ? (
        <div className="g-fld">
          <label className="t-label" htmlFor={fieldId('course')}>
            {t.mataKuliah}
          </label>
          <Select
            id={fieldId('course')}
            name="course"
            value={courseId}
            aria-describedby={fieldId('course-note')}
            onChange={(e) => patch({ courseId: e.target.value })}
          >
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </Select>
          <p className="t-cap text-fg-3" id={fieldId('course-note')}>
            {t.mataKuliahCatatan}
          </p>
        </div>
      ) : null;
  } else if (akademik && course) {
    courseField = (
      <div className="g-fld">
        <p className="t-label">{t.mataKuliah}</p>
        <p className="t-sm">
          {course.code} {course.name}
        </p>
      </div>
    );
  }
  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title={title}
      onOpenAutoFocus={(e) => {
        // The first field, as the prototype's `focusOv` (not the close button).
        const first = form.current?.querySelector<HTMLElement>(
          'input, select, textarea',
        );
        if (first) {
          e.preventDefault();
          first.focus();
        }
      }}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <form
        ref={form}
        className="g-kelola-form"
        noValidate
        onSubmit={submit}
        aria-label={title}
      >
        {adding && mode.categories.length > 1 ? (
          <div className="g-fld">
            <p className="t-label" aria-hidden="true">
              {t.jenis}
            </p>
            <Seg
              label={t.jenis}
              full
              value={draft.category}
              options={mode.categories.map((c) => ({
                value: c,
                label: c === 'akademik' ? t.akademik : t.himpunan,
              }))}
              onChange={(category) => patch({ category })}
            />
          </div>
        ) : null}

        {catalogueFailed ? (
          <ErrorState
            title={t.katalogGagal}
            text={t.periksaKoneksi}
            retrying={catalogue.isFetching || mine.isFetching}
            onRetry={() => {
              if (catalogue.isError) void catalogue.refetch();
              if (mine.isError) void mine.refetch();
            }}
          />
        ) : catalogueMissing ? (
          <Skeleton label={t.memuatKatalog}>
            <SkeletonRow tile={false} lines={['30%', '100%', '60%']} />
          </Skeleton>
        ) : (
          <>
            {courseField}
            <div className="g-fld">
              <label className="t-label" htmlFor={fieldId('title')}>
                {t.judulField}
              </label>
              <Input
                id={fieldId('title')}
                name="title"
                value={draft.title}
                placeholder={
                  akademik ? t.contohJudul.akademik : t.contohJudul.himpunan
                }
                autoComplete="off"
                onChange={(e) => patch({ title: e.target.value })}
                {...invalid('title')}
              />
              {err('title')}
            </div>
            <div className="g-kit-fields">
              <div className="g-fld">
                <label className="t-label" htmlFor={fieldId('date')}>
                  {t.tanggal}
                </label>
                <Input
                  className="num"
                  type="date"
                  id={fieldId('date')}
                  name="date"
                  value={draft.date}
                  onChange={(e) => patch({ date: e.target.value })}
                  {...invalid('date')}
                />
                {err('date')}
              </div>
              <div className="g-fld">
                <label className="t-label" htmlFor={fieldId('start')}>
                  {t.mulai}
                </label>
                <Input
                  className="num"
                  type="time"
                  id={fieldId('start')}
                  name="start"
                  value={draft.start}
                  onChange={(e) => patch({ start: e.target.value })}
                  {...invalid('start')}
                />
                {err('start')}
              </div>
              <div className="g-fld">
                <label className="t-label" htmlFor={fieldId('end')}>
                  {t.selesai}
                </label>
                <Input
                  className="num"
                  type="time"
                  id={fieldId('end')}
                  name="end"
                  value={draft.end}
                  onChange={(e) => patch({ end: e.target.value })}
                  {...invalid('end')}
                />
                {err('end')}
              </div>
            </div>
            <div className="g-fld">
              <label className="t-label" htmlFor={fieldId('desc')}>
                {t.deskripsi}{' '}
                <span className="font-normal text-fg-3">{t.opsional}</span>
              </label>
              <Textarea
                id={fieldId('desc')}
                name="desc"
                rows={3}
                value={draft.description}
                placeholder={t.contohDeskripsi}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </div>
          </>
        )}
        <div className="g-ov-foot">
          <Button variant="paper" onClick={() => onOpenChange(false)}>
            {t.batal}
          </Button>
          <Button
            variant="gold"
            type="submit"
            aria-disabled={save.isPending || catalogueMissing || undefined}
          >
            {mode.kind === 'edit' ? t.simpan : t.tambahkan}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
