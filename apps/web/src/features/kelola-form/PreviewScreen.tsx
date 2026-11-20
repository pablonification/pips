import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import type { ManageForm, MyDetails, ProfileField } from '~/api/generated';
import {
  Button,
  ErrorState,
  Halftone,
  Skeleton,
  SkeletonBlock,
  toast,
} from '~/components/garis';
import { IconCentang } from '~/components/icons/centang';
import { IconKirim } from '~/components/icons/kirim';
import { IconLanjut } from '~/components/icons/lanjut';
import { IconMata } from '~/components/icons/mata';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconTenggat } from '~/components/icons/tenggat';
import { PageBody, PageTitle, usePageTitle } from '~/components/shell/page';
import { fill } from '~/copy/fill';
import { kelolaForm as copy } from '~/copy/kelola-form';
import { dLong, wib } from '~/lib/dates';
import { manageFormQuery, myDetailsQuery } from './queries';
import {
  fieldLabel,
  inFieldOrder,
  isChoice,
  questionsOf,
  toItems,
  whenShort,
  type QuestionItem,
} from './rules';
import '~/styles/garis/form-builder.css';

type Answers = Record<string, string | string[]>;

/** Whether a question shows, given the answers so far: its deciding question shows and was answered with its value. */
function shown(q: QuestionItem, all: QuestionItem[], a: Answers): boolean {
  if (!q.dependsOn) return true;
  const src = all.find((x) => x.id === q.dependsOn!.questionId);
  if (!src || !shown(src, all, a)) return false;
  const v = a[src.id];
  return Array.isArray(v)
    ? v.includes(q.dependsOn.value)
    : v === q.dependsOn.value;
}

/**
 * Pratinjau: the member's form as its maker built it, with the gold cover, the questions and their rules, and the
 * agreement step filled from the maker's own profile. Nothing is sent.
 */
export function PreviewScreen({ formId }: { formId: string }) {
  const form = useQuery(manageFormQuery(formId));
  usePageTitle(copy.pratinjau.judul);
  if (form.isPending)
    return (
      <PageBody>
        <Skeleton label={copy.memuat}>
          <SkeletonBlock height={160} />
        </Skeleton>
      </PageBody>
    );
  if (form.isError)
    return (
      <PageBody>
        <ErrorState
          title={copy.gagal}
          onRetry={() => void form.refetch()}
          retrying={form.isFetching}
        />
      </PageBody>
    );
  return <Preview form={form.data} />;
}

function Preview({ form }: { form: ManageForm }) {
  const navigate = useNavigate();
  const qs = questionsOf(toItems(form.sections));
  const [answers, setAnswers] = useState<Answers>({});
  const [bad, setBad] = useState<string[]>([]);
  const [step, setStep] = useState<'q' | 'agree'>('q');
  const fields = inFieldOrder(form.requestedFields);
  const details = useQuery({ ...myDetailsQuery(), enabled: fields.length > 0 });
  const visible = qs.filter((q) => shown(q, qs, answers));
  const answered = (q: QuestionItem) => {
    const v = answers[q.id];
    return Array.isArray(v) ? v.length > 0 : !!v?.trim();
  };
  const set = (id: string, v: string | string[]) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    setBad((b) => b.filter((x) => x !== id));
  };
  const close = () =>
    void navigate({ to: '/kelola/form/$formId', params: { formId: form.id } });
  const next = () => {
    const missing = visible
      .filter((q) => q.required && !answered(q))
      .map((q) => q.id);
    setBad(missing);
    if (missing.length) {
      document
        .querySelector<HTMLElement>(
          `[data-pq="${missing[0]}"] :is(input, textarea, select)`,
        )
        ?.focus();
      return;
    }
    if (!fields.length) toast.success(copy.pratinjau.tidakDikirim);
    else setStep('agree');
  };

  return (
    <div className="fb">
      <div className="fb-pv-bar">
        <IconMata size={16} />
        <span className="flex-1">{copy.pratinjau.bar}</span>
        <Button variant="gold" size="sm" onClick={close}>
          {copy.pratinjau.tutupPratinjau}
        </Button>
      </div>
      <div className="fb-cover">
        <span className="absolute inset-y-0 right-0 w-54">
          <Halftone className="h-full" />
        </span>
        <PageTitle>{form.title.trim() || copy.daftar.tanpaJudul}</PageTitle>
        {step === 'q' && form.description ? (
          <p className="sub">{form.description}</p>
        ) : null}
        {step === 'q' && form.closesAt ? (
          <p className="facts inline-flex items-center gap-1.5">
            <IconTenggat size={16} />
            {fill(copy.pratinjau.tutup, { waktu: whenShort(form.closesAt) })}
          </p>
        ) : null}
      </div>
      <div className="fb-pv">
        {step === 'q' ? (
          <>
            {visible.map((q, i) => (
              <PreviewQuestion
                key={q.id}
                q={q}
                n={i + 1}
                value={answers[q.id]}
                bad={bad.includes(q.id)}
                onChange={(v) => set(q.id, v)}
              />
            ))}
            <div className="fb-end">
              <Button variant="gold" onClick={next}>
                {fields.length ? (
                  <>
                    {copy.pratinjau.lanjut}
                    <IconLanjut size={16} />
                  </>
                ) : (
                  <>
                    <IconKirim size={16} />
                    {copy.pratinjau.kirim}
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <Agreement
            form={form}
            fields={fields}
            details={details.data}
            onBack={() => setStep('q')}
          />
        )}
      </div>
    </div>
  );
}

function PreviewQuestion({
  q,
  n,
  value,
  bad,
  onChange,
}: {
  q: QuestionItem;
  n: number;
  value: string | string[] | undefined;
  bad: boolean;
  onChange: (v: string | string[]) => void;
}) {
  const id = `fb-pq-${q.id}`;
  const hint = [
    q.description,
    q.type === 'checkbox' ? copy.pratinjau.bolehLebih : '',
    q.type === 'file' ? copy.pratinjau.tipeFile : '',
  ]
    .filter(Boolean)
    .join(' ');
  const described =
    [hint ? `${id}-h` : '', bad ? `${id}-err` : ''].filter(Boolean).join(' ') ||
    undefined;
  const text = typeof value === 'string' ? value : '';
  const list = Array.isArray(value) ? value : [];
  let control;
  if (isChoice(q.type) && q.type !== 'dropdown') {
    const multi = q.type === 'checkbox';
    const opts = [
      ...q.options.map((o) => o.value).filter((o) => o.trim()),
      ...(q.other ? ['__other'] : []),
    ];
    control = (
      <div
        role={multi ? 'group' : 'radiogroup'}
        aria-labelledby={`${id}-t`}
        aria-describedby={described}
        className="-mx-1.5 grid gap-0.5"
      >
        {opts.map((o) => (
          <label key={o} className="fb-tick">
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={id}
              checked={multi ? list.includes(o) : text === o}
              onChange={(e) =>
                onChange(
                  multi
                    ? e.target.checked
                      ? [...list, o]
                      : list.filter((x) => x !== o)
                    : o,
                )
              }
            />
            <span className="fb-key" aria-hidden="true">
              <i className={multi ? undefined : 'rounded-full'} />
              <IconCentang size={16} />
            </span>
            <span className="l">
              {o === '__other' ? copy.pratinjau.lainnya : o}
            </span>
          </label>
        ))}
      </div>
    );
  } else if (q.type === 'dropdown')
    control = (
      <span className="fb-sel max-w-95">
        <select
          id={id}
          className="fb-lf"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={described}
        >
          <option value="">{copy.pratinjau.pilih}</option>
          {q.options
            .filter((o) => o.value.trim())
            .map((o) => (
              <option key={o.value}>{o.value}</option>
            ))}
        </select>
      </span>
    );
  else if (q.type === 'rating') {
    const ns = Array.from({ length: q.scale.max - q.scale.min + 1 }, (_, i) =>
      String(q.scale.min + i),
    );
    control = (
      <>
        <div
          className="fb-scale-keys"
          role="radiogroup"
          aria-labelledby={`${id}-t`}
          aria-describedby={described}
        >
          {ns.map((v) => (
            <label key={v}>
              <input
                type="radio"
                name={id}
                checked={text === v}
                onChange={() => onChange(v)}
              />
              {v}
            </label>
          ))}
        </div>
        {q.scale.minLabel || q.scale.maxLabel ? (
          <div className="fb-scale-ends" aria-hidden="true">
            <span>{q.scale.minLabel}</span>
            <span>{q.scale.maxLabel}</span>
          </div>
        ) : null}
      </>
    );
  } else if (q.type === 'textarea')
    control = (
      <textarea
        id={id}
        className="fb-lf"
        rows={1}
        value={text}
        placeholder={copy.pratinjau.jawabanmu}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={described}
      />
    );
  else if (q.type === 'file')
    control = (
      <Button
        variant="paper"
        onClick={() => toast.success(copy.pratinjau.tidakDikirim)}
        aria-describedby={described}
      >
        {copy.pratinjau.pilihFile}
      </Button>
    );
  else
    control = (
      <input
        id={id}
        className="fb-lf"
        type={q.type === 'date' ? 'date' : 'text'}
        inputMode={q.type === 'time' ? 'numeric' : undefined}
        placeholder={q.type === 'time' ? '19.30' : copy.pratinjau.jawabanmu}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={described}
        autoComplete="off"
        style={
          q.type === 'time' || q.type === 'date' ? { maxWidth: 220 } : undefined
        }
      />
    );
  const labelled =
    q.type !== 'radio' &&
    q.type !== 'checkbox' &&
    q.type !== 'rating' &&
    q.type !== 'file';
  return (
    <div className={bad ? 'fb-pq bad' : 'fb-pq'} data-pq={q.id}>
      <span className="fb-n" aria-hidden="true">
        {n}
      </span>
      <h2 className="fb-pq-t" id={`${id}-t`}>
        {labelled ? <label htmlFor={id}>{q.label}</label> : q.label}
        {q.required ? null : <span className="opt">{copy.susun.opsional}</span>}
      </h2>
      {hint ? (
        <p className="fb-pq-h" id={`${id}-h`}>
          {hint}
        </p>
      ) : null}
      {control}
      {bad ? (
        <p className="err" id={`${id}-err`}>
          <IconPeringatan size={16} />
          {copy.pratinjau.wajib}
        </p>
      ) : null}
    </div>
  );
}

function detailText(f: ProfileField, d: MyDetails | undefined): string {
  if (!d) return '';
  if (f in d.account) return d.account[f as keyof MyDetails['account']];
  const v = d.saved[f as keyof MyDetails['saved']];
  if (!v) return '';
  if (typeof v === 'object')
    return `${v.name} (${v.relation.toLowerCase()}) · ${v.phone}`;
  if (f === 'birthDate')
    return `${dLong(`${v}T12:00:00+07:00`)} ${wib(`${v}T12:00:00+07:00`).year}`;
  if (f === 'studentCardPhoto' || f === 'photo')
    return decodeURIComponent(v.split('/').pop() ?? v);
  return v;
}

function Agreement({
  form,
  fields,
  details,
  onBack,
}: {
  form: ManageForm;
  fields: ProfileField[];
  details: MyDetails | undefined;
  onBack: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-1.5">
        <h2 className="t-title">{copy.pratinjau.ikutTerkirim}</h2>
        <p className="t-sm text-fg-2">
          {fill(copy.pratinjau.penerima, { nama: form.owner?.fullName ?? '' })}
        </p>
      </div>
      <div className="fb-slip">
        <dl className="fb-dl">
          {fields.map((f) => {
            const v = detailText(f, details);
            return (
              <div key={f}>
                <dt>{fieldLabel(f)}</dt>
                <dd className={v ? undefined : 'none'}>
                  {v || copy.pratinjau.belumAda}
                </dd>
              </div>
            );
          })}
        </dl>
        <label className="fb-tick my-2">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span className="fb-key" aria-hidden="true">
            <i />
            <IconCentang size={16} />
          </span>
          <span className="l">{copy.pratinjau.setuju}</span>
        </label>
      </div>
      <div className="fb-end">
        <Button variant="paper" onClick={onBack}>
          {copy.pratinjau.kembali}
        </Button>
        <Button
          variant="gold"
          onClick={() => toast.success(copy.pratinjau.tidakDikirim)}
        >
          <IconKirim size={16} />
          {copy.pratinjau.kirim}
        </Button>
      </div>
    </div>
  );
}
