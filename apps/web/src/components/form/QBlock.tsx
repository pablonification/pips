import type { FormQuestion } from '~/api/generated';
import { Checkbox, Input, Radio, Textarea } from '~/components/garis';
import { IconPeringatan } from '~/components/icons/peringatan';
import { form as copy } from '~/copy/form';
import { cn } from '~/lib/utils';
import { ratingParts, type AnswerValue } from '~/lib/form/rules';

export interface QBlockProps {
  q: FormQuestion;
  value: AnswerValue | undefined;
  onChange: (id: string, value: AnswerValue) => void;
  /** "Pertanyaan ini wajib diisi" under it, linked to the control. */
  missing?: boolean;
  /** Ids stay unique when two copies of a question are on the page. */
  idPrefix: string;
}

/** The error under a question (garis/screens-more.js `qBlock` `err`). */
function Missing({ id }: { id: string }) {
  return (
    <p className="g-err t-cap" id={id}>
      <IconPeringatan size={16} />
      {copy.isi.wajib}
    </p>
  );
}

/**
 * One question as the prototype's `qBlock` draws it: text and long text with a label; radio and checkbox as option
 * rows in a fieldset (checkbox adds "Boleh pilih lebih dari satu."); rating as five 48 px keycaps under a legend.
 * "(opsional)" follows an optional label; a prefilled question says it came from the account while it holds a value.
 */
export function QBlock({
  q,
  value,
  onChange,
  missing = false,
  idPrefix,
}: QBlockProps) {
  const id = `${idPrefix}-${q.id}`;
  const errId = `${id}-err`;
  const optional = q.optional ? (
    <>
      {' '}
      <span className="g-opt-note">{copy.isi.opsional}</span>
    </>
  ) : null;
  const text = typeof value === 'string' ? value : '';
  const invalid = missing
    ? { 'aria-invalid': true as const, 'aria-describedby': errId }
    : {};

  if (q.type === 'text' || q.type === 'textarea') {
    const prefilled = !!q.prefill && text !== '';
    return (
      <div className="g-qblock" data-qb={q.id}>
        <label className="t-label" htmlFor={id}>
          {q.label}
          {optional}
        </label>
        {q.type === 'text' ? (
          <Input
            id={id}
            className={cn(q.prefill === 'nim' && 'num')}
            value={text}
            autoComplete="off"
            inputMode={q.prefill === 'nim' ? 'numeric' : undefined}
            onChange={(e) => onChange(q.id, e.target.value)}
            {...invalid}
          />
        ) : (
          <Textarea
            id={id}
            rows={3}
            value={text}
            onChange={(e) => onChange(q.id, e.target.value)}
            {...invalid}
          />
        )}
        {prefilled ? (
          <p className="t-cap text-fg-3">{copy.isi.dariAkun}</p>
        ) : null}
        {missing ? <Missing id={errId} /> : null}
      </div>
    );
  }

  if (q.type === 'rating') {
    const { label, hint } = ratingParts(q.label, copy.isi.skala);
    const hintId = `${id}-hint`;
    return (
      <fieldset
        className="g-qblock"
        data-qb={q.id}
        aria-describedby={missing ? `${hintId} ${errId}` : hintId}
      >
        <legend className="t-label">
          {label}
          {optional}
        </legend>
        <p className="t-cap text-fg-3" id={hintId}>
          {hint}
        </p>
        <div className="g-rating">
          {['1', '2', '3', '4', '5'].map((n) => (
            <label key={n}>
              <input
                type="radio"
                name={id}
                value={n}
                checked={text === n}
                onChange={() => onChange(q.id, n)}
                aria-invalid={missing || undefined}
              />
              {n}
            </label>
          ))}
        </div>
        {missing ? <Missing id={errId} /> : null}
      </fieldset>
    );
  }

  const multi = q.type === 'checkbox';
  const list = Array.isArray(value) ? value : [];
  return (
    <fieldset
      className="g-qblock"
      data-qb={q.id}
      aria-describedby={missing ? errId : undefined}
    >
      <legend className="t-label">
        {q.label}
        {optional}
      </legend>
      {multi ? <p className="t-cap text-fg-3">{copy.isi.bolehLebih}</p> : null}
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
                  q.id,
                  // Kept in the options' order, whatever order they were ticked in.
                  (q.options ?? []).filter((x) =>
                    x === o ? e.target.checked : list.includes(x),
                  ),
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
              checked={text === o}
              aria-invalid={missing || undefined}
              onChange={() => onChange(q.id, o)}
            >
              {o}
            </Radio>
          ),
        )}
      </div>
      {missing ? <Missing id={errId} /> : null}
    </fieldset>
  );
}
