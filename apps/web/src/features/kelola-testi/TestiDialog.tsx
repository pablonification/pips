/**
 * Tambah testimoni (a proposal; SPEC story 112), for `akademik`, on a Testi Matkul course page. Built only from the
 * prototype's pieces: `addEventForm`'s layout in P0-A's Modal (a sheet on phones), opening with the course on a
 * `composeForm`-style byline row, then the author, the programme's sections and the lecturer. Loaded on demand.
 */
import { useMutation } from '@tanstack/react-query';
import { useId, useRef, useState, type FormEvent } from 'react';
import { api } from '~/api/client';
import type { Course, Testimoni } from '~/api/generated';
import { Button, Input, Modal, Textarea } from '~/components/garis';
import { IconPeringatan } from '~/components/icons/peringatan';
import { kelolaTesti as t } from '~/copy/kelola-testi';
import '~/features/kelola-tulis/kelola-tulis.css';
import {
  newTestiDraft,
  testiBody,
  testiSections,
  validateTesti,
  type TestiDraft,
} from './rules';

export interface TestiDialogProps {
  course: Course;
  onOpenChange: (open: boolean) => void;
  onSaved: (saved: Testimoni) => void;
  onFailed: (error: unknown) => void;
  onCloseAutoFocus?: (e: Event) => void;
}

export default function TestiDialog({
  course,
  onOpenChange,
  onSaved,
  onFailed,
  onCloseAutoFocus,
}: TestiDialogProps) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<TestiDraft>(newTestiDraft);
  const [error, setError] = useState<string | null>(null);
  const fields = testiSections(course.major);
  const save = useMutation({
    mutationFn: (d: TestiDraft) =>
      api.testimoni.createTestimoni({
        requestBody: testiBody(course.id, course.major, d),
      }),
  });
  const fid = (k: string) => `${id}-${k}`;
  const errId = fid('sections-err');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (save.isPending) return;
    const found = validateTesti(course.major, draft);
    setError(found);
    if (found) {
      requestAnimationFrame(() =>
        document.getElementById(fid(fields[0].key))?.focus(),
      );
      return;
    }
    save.mutate(draft, { onSuccess: onSaved, onError: onFailed });
  };

  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title={t.tambah}
      onOpenAutoFocus={(e) => {
        const first =
          form.current?.querySelector<HTMLElement>('input, textarea');
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
        aria-label={t.tambah}
      >
        <div className="g-byline">
          <p className="t-label strong num">
            {course.code} {course.name}
          </p>
        </div>
        <div className="g-fld">
          <label className="t-label" htmlFor={fid('name')}>
            {t.nama} <span className="font-normal text-fg-3">{t.opsional}</span>
          </label>
          <Input
            id={fid('name')}
            name="userName"
            autoComplete="off"
            value={draft.userName}
            aria-describedby={fid('name-note')}
            onChange={(e) =>
              setDraft((d) => ({ ...d, userName: e.target.value }))
            }
          />
          <p className="t-cap text-fg-3" id={fid('name-note')}>
            {t.namaCatatan}
          </p>
        </div>
        {fields.map(({ key, title }, i) => (
          <div className="g-fld" key={key}>
            <label className="t-label" htmlFor={fid(key)}>
              {title}
            </label>
            <Textarea
              id={fid(key)}
              name={key}
              rows={3}
              value={draft.sections[key] ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  sections: { ...d.sections, [key]: e.target.value },
                }))
              }
              {...(error
                ? { 'aria-invalid': true, 'aria-describedby': errId }
                : {})}
            />
            {error && i === 0 ? (
              <p className="g-err t-cap" id={errId}>
                <IconPeringatan size={16} />
                {error}
              </p>
            ) : null}
          </div>
        ))}
        <div className="g-fld">
          <label className="t-label" htmlFor={fid('lecturer')}>
            {t.dosen}{' '}
            <span className="font-normal text-fg-3">{t.opsional}</span>
          </label>
          <Input
            id={fid('lecturer')}
            name="lecturer"
            autoComplete="off"
            value={draft.lecturer}
            onChange={(e) =>
              setDraft((d) => ({ ...d, lecturer: e.target.value }))
            }
          />
        </div>
        <div className="g-ov-foot">
          <Button variant="paper" onClick={() => onOpenChange(false)}>
            {t.batal}
          </Button>
          <Button
            variant="gold"
            type="submit"
            aria-disabled={save.isPending || undefined}
          >
            {t.tambahkan}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
