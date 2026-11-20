import { useRef, useState, type ReactNode } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import type { FormQuestion } from '~/api/generated';
import { Button, IconButton, Kbd, Tile } from '~/components/garis';
import { IconBawah } from '~/components/icons/bawah';
import { IconCentang } from '~/components/icons/centang';
import { IconFoto } from '~/components/icons/foto';
import { IconHapus } from '~/components/icons/hapus';
import { IconKalender } from '~/components/icons/kalender';
import { IconLanjut } from '~/components/icons/lanjut';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconUnggah } from '~/components/icons/unggah';
import { fill } from '~/copy/fill';
import { isi } from '~/copy/isi';
import { tanggal } from '~/copy/tanggal';
import {
  monthCells,
  monthOf,
  sameMonth,
  shiftMonth,
  type Month,
} from '~/lib/days';
import { cn } from '~/lib/utils';
import { uploadAnswerFile } from './queries';
import {
  ANSWER_FILE_TYPES,
  dateAnswerText,
  fileFits,
  fileName,
  OTHER,
  tidyTime,
} from './rules';
import type { FieldValues } from './schema';
import '~/features/kalender/kalender.css';

export interface QuestionProps {
  q: FormQuestion;
  /** The question's field key (`schema.ts`). */
  k: string;
  /** Ids inside the page start with this. */
  idp: string;
  level: 2 | 3;
  shown: boolean;
  done: boolean;
  bad: boolean;
  active: boolean;
  form: UseFormReturn<FieldValues>;
  /** "Oke": on to the next question. */
  onNext: () => void;
  /** A choice that moves on by itself was made (not with the arrow keys). */
  onChosen: () => void;
  /** "Lainnya" was chosen: its line takes focus. */
  onOther: () => void;
  /** The paragraph's shortcut on this device: "⌘ Enter" or "Ctrl Enter". */
  paraKey: string;
  todayKey: string;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function Question(p: QuestionProps) {
  const { q, k, idp } = p;
  const id = `${idp}-${k}`;
  const t = isi.tanya;
  const hintText = [
    q.description,
    q.type === 'checkbox' ? t.bolehLebih : '',
    q.type === 'file' ? t.fileHint : '',
  ]
    .filter(Boolean)
    .join(' ');
  const describedBy = `${hintText ? `${id}-h ` : ''}${id}-err`;
  const aria = {
    'aria-labelledby': `${id}-t`,
    'aria-describedby': describedBy,
    'aria-invalid': p.bad || undefined,
  };
  const req = q.optional ? {} : { 'aria-required': true as const };
  const single = ['text', 'textarea', 'time', 'dropdown'].includes(q.type);
  const name = `a.${k}` as const;
  const { register, control } = p.form;
  const H = `h${p.level}` as const;

  let control_: ReactNode;
  if (q.type === 'text')
    control_ = (
      <input
        className="g-lf"
        type="text"
        id={id}
        placeholder={t.jawabanmu}
        autoComplete="off"
        {...aria}
        {...req}
        {...register(name)}
      />
    );
  else if (q.type === 'textarea')
    control_ = (
      <textarea
        className="g-lf"
        rows={1}
        id={id}
        placeholder={t.jawabanmu}
        {...aria}
        {...req}
        {...register(name)}
      />
    );
  else if (q.type === 'time')
    control_ = (
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <input
            className="g-lf num"
            type="text"
            inputMode="numeric"
            maxLength={5}
            id={id}
            placeholder={t.contohJam}
            autoComplete="off"
            style={{ maxWidth: 120 }}
            {...aria}
            {...req}
            ref={field.ref}
            name={field.name}
            value={(field.value as string) ?? ''}
            onBlur={field.onBlur}
            onChange={(e) => field.onChange(tidyTime(e.target.value))}
          />
        )}
      />
    );
  else if (q.type === 'dropdown')
    control_ = (
      <span className="g-lf-sel">
        <select
          className="g-lf"
          id={id}
          {...aria}
          {...req}
          {...register(name, {
            onChange: (e: { target: { value: string } }) => {
              if (e.target.value) p.onChosen();
            },
          })}
        >
          <option value="">{t.pilih}</option>
          {(q.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <IconBawah size={20} />
      </span>
    );
  else if (q.type === 'rating') {
    const { min, max, minLabel, maxLabel } = q.scale ?? { min: 1, max: 5 };
    const ns: number[] = [];
    for (let n = min; n <= max; n++) ns.push(n);
    control_ = (
      <>
        <div
          className="f-scale"
          style={{ ['--n' as string]: ns.length }}
          role="radiogroup"
          {...aria}
          {...req}
        >
          {ns.map((n) => {
            const end =
              n === min && minLabel
                ? minLabel
                : n === max && maxLabel
                  ? maxLabel
                  : '';
            return (
              <label key={n}>
                <input
                  type="radio"
                  value={String(n)}
                  aria-label={
                    end
                      ? fill(t.skalaAkhir, { angka: n, arti: end })
                      : String(n)
                  }
                  {...register(name, { onChange: p.onChosen })}
                />
                {n}
              </label>
            );
          })}
        </div>
        {minLabel || maxLabel ? (
          <div className="f-scale-ends" aria-hidden="true">
            <span>{minLabel ?? ''}</span>
            <span>{maxLabel ?? ''}</span>
          </div>
        ) : null}
      </>
    );
  } else if (q.type === 'date')
    control_ = (
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <DateAnswer
            id={id}
            value={(field.value as string) ?? ''}
            describedBy={describedBy}
            onPick={(v) => {
              field.onChange(v);
              p.onChosen();
            }}
            buttonRef={field.ref}
            today={p.todayKey}
          />
        )}
      />
    );
  else if (q.type === 'file')
    control_ = (
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <FileAnswer
            label={q.label}
            value={(field.value as string) ?? ''}
            describedBy={describedBy}
            onChange={field.onChange}
            buttonRef={field.ref}
          />
        )}
      />
    );
  else {
    const multi = q.type === 'checkbox';
    const opts = [...(q.options ?? [])];
    control_ = (
      <div
        className="fo-list"
        role={multi ? 'group' : 'radiogroup'}
        {...aria}
        {...(multi ? {} : req)}
      >
        {opts.map((o, i) => (
          <Option key={o} multi={multi} letter={LETTERS[i] ?? ''} label={o}>
            <input
              type={multi ? 'checkbox' : 'radio'}
              value={o}
              {...register(name, { onChange: multi ? undefined : p.onChosen })}
            />
          </Option>
        ))}
        {q.other ? (
          <>
            <Option
              multi={multi}
              letter={LETTERS[opts.length] ?? ''}
              label={t.lainnya}
            >
              <input
                type={multi ? 'checkbox' : 'radio'}
                value={OTHER}
                {...register(name, {
                  onChange: (e: { target: HTMLInputElement }) => {
                    if (e.target.checked) p.onOther();
                  },
                })}
              />
            </Option>
            <div className="fo-more">
              <div>
                <input
                  className="g-lf"
                  type="text"
                  data-other=""
                  placeholder={t.tulisDiSini}
                  aria-label={t.lainnyaLabel}
                  autoComplete="off"
                  {...register(`o.${k}`)}
                />
              </div>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  const moves = ['radio', 'rating', 'dropdown'].includes(q.type);
  return (
    <div
      className={cn('fq-wrap', !p.shown && 'is-off')}
      data-fw={k}
      inert={!p.shown}
    >
      <div className="fq-clip">
        <div
          className={cn(
            'fq',
            p.done && 'is-done',
            p.bad && 'is-bad',
            p.active && 'is-active',
          )}
          data-fq={k}
          data-type={q.type}
        >
          <span className="fq-n" aria-hidden="true">
            <IconCentang size={16} />
          </span>
          <H className="fq-t" id={`${id}-t`}>
            {single ? <label htmlFor={id}>{q.label}</label> : q.label}
            {q.optional ? <span className="fq-opt">{t.opsional}</span> : null}
          </H>
          {hintText ? (
            <p className="fq-h" id={`${id}-h`}>
              {hintText}
            </p>
          ) : null}
          {control_}
          <div className="fq-err">
            <p id={`${id}-err`}>
              <IconPeringatan size={16} />
              <span>{t.wajib}</span>
            </p>
          </div>
          {moves ? null : (
            <div className="fq-ok">
              <Kbd aria-hidden="true">
                {q.type === 'textarea' ? p.paraKey : t.enter}
              </Kbd>
              <Button variant="paper" size="sm" onClick={p.onNext}>
                {t.oke}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Option({
  multi,
  letter,
  label,
  children,
}: {
  multi: boolean;
  letter: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <label className={cn('fo', multi && 'multi')}>
      {children}
      <span className="fo-key" aria-hidden="true">
        <b>{letter}</b>
        <i />
        <IconCentang size={16} />
      </span>
      <span className="fo-l">{label}</span>
      <span className="fo-ck" aria-hidden="true">
        <IconCentang size={20} />
      </span>
    </label>
  );
}

/* ================= A date: the Kalender's own month, opened in place ================= */

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const monthTitle = (m: Month) => `${tanggal.bulan[m.month - 1]} ${m.year}`;

function DateAnswer({
  id,
  value,
  describedBy,
  onPick,
  buttonRef,
  today,
}: {
  id: string;
  value: string;
  describedBy: string;
  onPick: (v: string) => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
  today: string;
}) {
  const t = isi.tanya;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Month>(() => monthOf(value || today));
  const year = value ? value.slice(0, 4) : '';
  return (
    <>
      <button
        type="button"
        className="g-lf fd-btn num"
        ref={buttonRef}
        aria-expanded={open}
        aria-labelledby={`${id}-t ${id}-v`}
        aria-describedby={describedBy}
        onClick={() => {
          if (!open) setView(monthOf(value || today));
          setOpen(!open);
        }}
      >
        <span id={`${id}-v`} className={value ? undefined : 'c3'}>
          {value ? `${dateAnswerText(value)} ${year}` : t.pilihTanggal}
        </span>
        <IconKalender size={20} />
      </button>
      <div className={cn('fd-cal', open && 'open')} inert={!open}>
        <div>
          <div className="g-cal-head">
            <p className="t-sub" aria-live="polite">
              {monthTitle(view)}
            </p>
            <div className="g-month-nav">
              <IconButton
                label={t.bulanSebelumnya}
                className="prev"
                onClick={() => setView(shiftMonth(view, -1))}
              >
                <IconLanjut size={20} />
              </IconButton>
              <IconButton
                label={t.bulanBerikutnya}
                onClick={() => setView(shiftMonth(view, 1))}
              >
                <IconLanjut size={20} />
              </IconButton>
            </div>
          </div>
          <div className="g-month" role="group" aria-label={monthTitle(view)}>
            {WEEKDAYS.map((w) => (
              <span key={w} className="wd" aria-hidden="true">
                {w}
              </span>
            ))}
            {monthCells(view).map((d) => (
              <button
                key={d}
                type="button"
                className={cn(
                  'g-mday',
                  !sameMonth(monthOf(d), view) && 'out',
                  d === today && 'today',
                )}
                aria-pressed={value === d}
                aria-label={dateAnswerText(d)}
                onClick={() => {
                  setOpen(false);
                  onPick(d);
                }}
              >
                <span className="dn">{Number(d.slice(8))}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ================= A file: uploaded into the app's storage as soon as it is picked ================= */

function FileAnswer({
  label,
  value,
  describedBy,
  onChange,
  buttonRef,
}: {
  label: string;
  value: string;
  describedBy: string;
  onChange: (v: string) => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}) {
  const t = isi.tanya;
  const input = useRef<HTMLInputElement>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const pick = async (file: File) => {
    setProblem(null);
    if (!fileFits(file, ANSWER_FILE_TYPES)) {
      setProblem(t.fileDitolak);
      return;
    }
    setPercent(0);
    try {
      onChange(await uploadAnswerFile(file, 'file', setPercent));
    } catch {
      setProblem(t.fileGagal);
    } finally {
      setPercent(null);
    }
  };

  if (value)
    return (
      <div className="f-file has">
        <Tile>
          <IconFoto size={20} />
        </Tile>
        <span className="grow t-sub">{fileName(value)}</span>
        <IconButton
          label={fill(t.hapusFile, { nama: fileName(value) })}
          onClick={() => onChange('')}
        >
          <IconHapus size={20} />
        </IconButton>
      </div>
    );
  return (
    <>
      <input
        ref={input}
        className="f-file-in"
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void pick(file);
        }}
      />
      <button
        type="button"
        className="f-file"
        ref={buttonRef}
        aria-label={fill(t.pilihFileUntuk, { pertanyaan: label })}
        aria-describedby={describedBy}
        disabled={percent !== null}
        onClick={() => input.current?.click()}
      >
        <Tile>
          <IconUnggah size={20} />
        </Tile>
        <span className="t-sub">
          {percent !== null
            ? fill(t.mengunggah, { persen: percent })
            : t.pilihFile}
        </span>
      </button>
      {problem ? (
        <p className="g-err t-sm" role="alert">
          <IconPeringatan size={16} />
          {problem}
        </p>
      ) : null}
    </>
  );
}
