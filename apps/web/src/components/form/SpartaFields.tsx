import { useState, type ReactNode } from 'react';
import type { InternshipQuestion } from '~/api/generated';
import { Checkbox, Input, Radio, Select, Textarea } from '~/components/garis';
import { IconPeringatan } from '~/components/icons/peringatan';
import { form as formCopy } from '~/copy/form';
import { sparta as copy } from '~/copy/sparta';
import { CHECKBOX_SEPARATOR, checkboxValues } from '~/lib/form/sparta';
import { uploadFile } from './sparta-data';

/** The error under a field, as the form's (`qBlock` `err`). */
export function FieldError({
  id,
  children,
}: {
  id: string;
  children?: ReactNode;
}) {
  return (
    <p className="g-err t-cap" id={id}>
      <IconPeringatan size={16} />
      {children ?? formCopy.isi.wajib}
    </p>
  );
}

const Optional = () => (
  <>
    {' '}
    <span className="g-opt-note">{formCopy.isi.opsional}</span>
  </>
);

/** A labelled text or long-text field in the form's question style (`.qblock`). */
export function TextField({
  id,
  label,
  value,
  onChange,
  optional = false,
  missing = false,
  long = false,
  sk,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
  missing?: boolean;
  long?: boolean;
  /** Where Lanjut's focus goes when this one is missing. */
  sk: string;
}) {
  const errId = `${id}-err`;
  const invalid = missing
    ? { 'aria-invalid': true as const, 'aria-describedby': errId }
    : {};
  return (
    <div className="g-qblock" data-sk={sk}>
      <label className="g-q-label" htmlFor={id}>
        {label}
        {optional ? <Optional /> : null}
      </label>
      {long ? (
        <Textarea
          id={id}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...invalid}
        />
      ) : (
        <Input
          id={id}
          value={value}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          {...invalid}
        />
      )}
      {missing ? <FieldError id={errId} /> : null}
    </div>
  );
}

/** A file answer: upload, then a link to what was uploaded (today's `FileAnswerInput`). */
function FileField({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid: Record<string, unknown>;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');
  return (
    <>
      <input
        id={id}
        type="file"
        className="g-field"
        aria-busy={state === 'busy' || undefined}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setState('busy');
          try {
            onChange(await uploadFile(file));
            setState('idle');
          } catch {
            setState('failed');
          }
        }}
        {...invalid}
      />
      {state === 'busy' ? (
        <p className="t-cap text-fg-2" role="status">
          {copy.pertanyaan.mengunggah}
        </p>
      ) : null}
      {state === 'failed' ? (
        <p className="g-err t-cap" role="alert">
          <IconPeringatan size={16} />
          {copy.pertanyaan.gagalUnggah}
        </p>
      ) : null}
      {value && state !== 'busy' ? (
        <a
          className="g-link t-sm"
          href={value}
          target="_blank"
          rel="noreferrer"
        >
          {copy.pertanyaan.lihatFile}
        </a>
      ) : null}
    </>
  );
}

/** One division question by its type: select, radio, checkbox, file, text or long text. */
export function DivisionQuestion({
  q,
  idPrefix,
  value,
  onChange,
  missing,
  sk,
}: {
  q: InternshipQuestion;
  idPrefix: string;
  value: string;
  onChange: (v: string) => void;
  missing: boolean;
  sk: string;
}) {
  const id = `${idPrefix}-${q.id}`;
  const errId = `${id}-err`;
  const optional = q.required ? null : <Optional />;
  const invalid = missing
    ? { 'aria-invalid': true as const, 'aria-describedby': errId }
    : {};

  if (q.type === 'text' || q.type === 'textarea')
    return (
      <TextField
        id={id}
        label={q.label}
        value={value}
        onChange={onChange}
        optional={!q.required}
        missing={missing}
        long={q.type === 'textarea'}
        sk={sk}
      />
    );

  if (q.type === 'select' || q.type === 'file')
    return (
      <div className="g-qblock" data-sk={sk}>
        <label className="g-q-label" htmlFor={id}>
          {q.label}
          {optional}
        </label>
        {q.type === 'select' ? (
          <Select
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            {...invalid}
          >
            <option value="">{copy.pertanyaan.pilihJawaban}</option>
            {(q.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        ) : (
          <FileField
            id={id}
            value={value}
            onChange={onChange}
            invalid={invalid}
          />
        )}
        {missing ? <FieldError id={errId} /> : null}
      </div>
    );

  const multi = q.type === 'checkbox';
  const list = checkboxValues(value);
  return (
    <fieldset
      className="g-qblock"
      data-sk={sk}
      aria-describedby={missing ? errId : undefined}
    >
      <legend className="g-q-label">
        {q.label}
        {optional}
      </legend>
      {multi ? (
        <p className="t-cap text-fg-3">{formCopy.isi.bolehLebih}</p>
      ) : null}
      <div className="g-opts">
        {(q.options ?? []).map((o) =>
          multi ? (
            <Checkbox
              key={o}
              name={id}
              value={o}
              checked={list.includes(o)}
              aria-invalid={missing || undefined}
              onChange={(e) =>
                onChange(
                  (q.options ?? [])
                    .filter((x) =>
                      x === o ? e.target.checked : list.includes(x),
                    )
                    .join(CHECKBOX_SEPARATOR),
                )
              }
            >
              {o}
            </Checkbox>
          ) : (
            <Radio
              key={o}
              name={id}
              value={o}
              checked={value === o}
              aria-invalid={missing || undefined}
              onChange={() => onChange(o)}
            >
              {o}
            </Radio>
          ),
        )}
      </div>
      {missing ? <FieldError id={errId} /> : null}
    </fieldset>
  );
}
