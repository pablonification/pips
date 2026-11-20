import { useQuery } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  ApiError,
  type FormDetail,
  type FormResponse,
  type FormSection,
  type MyDetails,
} from '~/api/generated';
import {
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  Saved,
  SectionHead,
  Tag,
  toast,
} from '~/components/garis';
import { FormFill } from '~/components/form/FormFill';
import { useFormDraft } from '~/components/form/useFormDraft';
import { IconCentang } from '~/components/icons/centang';
import { IconJam } from '~/components/icons/jam';
import { IconKirim } from '~/components/icons/kirim';
import { IconKunci } from '~/components/icons/kunci';
import { IconLanjut } from '~/components/icons/lanjut';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconTambah } from '~/components/icons/tambah';
import { useCover } from '~/components/shell/cover';
import { PageBody, TopBarActions, usePageTitle } from '~/components/shell/page';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { form as formCopy } from '~/copy/form';
import { isi } from '~/copy/isi';
import useSession from '~/hooks/auth/useSession';
import { cn } from '~/lib/utils';
import { DetailEditor } from './DetailEditor';
import { Question } from './Question';
import {
  formQuery,
  myDetailsQuery,
  myResponseQuery,
  useSendForm,
  type SendBody,
} from './queries';
import {
  answersToSend,
  detailToSend,
  draftFromSaved,
  draftOf,
  fieldText,
  isAnswered,
  isSaved,
  MOVES_ON,
  questionsOf,
  reasonFor,
  reasonOfProblem,
  requestedInOrder,
  shownIds,
  startingValues,
  todayKey,
  untilText,
  valuesOfDraft,
  whenShort,
  type DetailReason,
  type DraftValue,
  type FieldInfo,
  type SavedField,
} from './rules';
import {
  answersResolver,
  fieldKeys,
  toFields,
  toFill,
  type FieldValues,
} from './schema';
import {
  Aside,
  Body,
  Cover,
  FormState,
  Loading,
  Pips,
  Sent,
  ToList,
  type PipState,
} from './parts';
import './form.css';

const ID = 'isi';
const reduced = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = () =>
  typeof matchMedia === 'function' && matchMedia('(hover: none)').matches;
const paraKey = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    ? isi.tanya.cmdEnter
    : isi.tanya.ctrlEnter;

/**
 * Layanan › Form › a form. A form made before the builder (no owner: the PIXEL form) keeps the screen it has always
 * had; every other form is filled on one page under its gold cover (FormIsi).
 */
export function FormPage({ formId }: { formId: string }) {
  const detail = useQuery(formQuery(formId));
  const form = detail.data;
  if (form && form.owner === null) return <FormFill formId={formId} />;
  if (form) return <FormIsi form={form} refetch={detail.refetch} />;
  if (detail.isError) {
    const notFound =
      detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <PageBody>
        {notFound ? (
          <EmptyState
            title={formCopy.tidakAda.judul}
            text={formCopy.tidakAda.isi}
            action={<ToList label={isi.keadaan.formUntukmu} />}
          />
        ) : (
          <ErrorState
            title={isi.keadaan.gagal}
            onRetry={() => void detail.refetch()}
            retrying={detail.isFetching}
          />
        )}
      </PageBody>
    );
  }
  return (
    <PageBody>
      <Loading />
    </PageBody>
  );
}

type Step = 'q' | 'agree';

function FormIsi({
  form,
  refetch,
}: {
  form: FormDetail;
  refetch: () => Promise<unknown>;
}) {
  const me = useSession();
  const mine = useQuery(myResponseQuery(form.id));
  const draft = useFormDraft(form.id, me.id);
  const [changing, setChanging] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [step, setStep] = useState<Step>('q');
  const sentTitle = useRef(false);
  usePageTitle(form.title);

  const back = useMemo(
    () =>
      step === 'agree'
        ? { label: isi.setuju.kePertanyaanLabel, run: () => setStep('q') }
        : null,
    [step],
  );
  useCover(back);

  // Right after sending, focus goes to the thank-you.
  useEffect(() => {
    if (!fresh || !sentTitle.current) return;
    sentTitle.current = false;
    document
      .querySelector<HTMLElement>('[data-sent-title]')
      ?.focus({ preventScroll: true });
  });

  const response = mine.data ?? null;
  const ready = !mine.isPending && draft.restored !== undefined;
  const closed = form.status === 'closed';
  const notOpen = form.status === 'not_opened' || !form.sections;

  let main;
  let filling = false;
  let cover = { desc: true, closes: false };
  if (!ready) main = <Loading />;
  else if (response && !changing)
    main = (
      <Sent
        form={form}
        response={response}
        fresh={fresh}
        onChange={() => {
          setChanging(true);
          setFresh(false);
          setStep('q');
          document
            .querySelector('[data-scroll-restoration-id="isi"]')
            ?.scrollTo({ top: 0 });
        }}
      />
    );
  else if (closed)
    main = (
      <FormState
        icon={<IconKunci size={24} />}
        title={isi.keadaan.ditutup}
        text={
          form.closesAt
            ? fill(isi.keadaan.ditutupIsi, { waktu: whenShort(form.closesAt) })
            : isi.keadaan.ditutupTanpaWaktu
        }
      >
        <ToList />
      </FormState>
    );
  else if (notOpen) main = <NotOpen form={form} refetch={refetch} />;
  else {
    filling = true;
    cover = { desc: step === 'q', closes: step === 'q' };
    main = (
      <Filler
        key={changing ? 'ubah' : 'isi'}
        form={form}
        sections={form.sections as FormSection[]}
        start={startingValues(
          form.sections as FormSection[],
          changing && response
            ? { answers: response.answers }
            : { draft: draft.restored ? valuesOfDraft(draft.restored) : null },
        )}
        draft={draft}
        changing={changing && !!response}
        step={step}
        setStep={setStep}
        onSent={() => {
          sentTitle.current = true;
          setFresh(true);
          setChanging(false);
          setStep('q');
        }}
        onStop={() => {
          setChanging(false);
          setStep('q');
        }}
      />
    );
  }
  if (response && !changing) cover = { desc: false, closes: false };

  return (
    <div className="g-fx">
      <Cover
        title={form.title}
        description={cover.desc ? form.description : null}
        closesAt={cover.closes ? form.closesAt : null}
      />
      {filling ? main : <Body>{main}</Body>}
    </div>
  );
}

/** Before it opens: when, and how long until; at that time the form is asked for again. */
function NotOpen({
  form,
  refetch,
}: {
  form: FormDetail;
  refetch: () => Promise<unknown>;
}) {
  const at = Date.parse(form.opensAt);
  useEffect(() => {
    const wait = at - Date.now();
    // setTimeout can't wait more than about 24 days in one go.
    if (wait > 2 ** 31 - 1) return;
    const t = setTimeout(() => void refetch(), Math.max(0, wait) + 1000);
    return () => clearTimeout(t);
  }, [at, refetch]);
  return (
    <FormState
      icon={<IconJam size={24} />}
      title={isi.keadaan.belumDibuka}
      text={fill(isi.keadaan.belumDibukaIsi, {
        waktu: whenShort(at),
        sisa: untilText(at, Date.now()),
      })}
    >
      <ToList />
    </FormState>
  );
}

/* ================= Filling ================= */

interface FillerProps {
  form: FormDetail;
  sections: FormSection[];
  start: ReturnType<typeof startingValues>;
  draft: ReturnType<typeof useFormDraft>;
  /** Ubah jawaban: the answers replace the ones sent. */
  changing: boolean;
  step: Step;
  setStep: (s: Step) => void;
  onSent: (r: FormResponse) => void;
  /** The form closed, or was sent elsewhere, while it was being filled. */
  onStop: () => void;
}

function scroller() {
  return document.querySelector<HTMLElement>(
    '[data-scroll-restoration-id="isi"]',
  );
}

/** Scrolls only when the element isn't comfortably in view: then it sits a fifth of the way down. */
function scrollIntoPlace(el: HTMLElement, done?: () => void) {
  const sc = scroller();
  if (!sc) return done?.();
  const r = sc.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  const top = parseFloat(
    getComputedStyle(sc).getPropertyValue('--g-top-h') || '0',
  );
  const pad = Math.max(72, top + 26);
  if (b.top >= r.top + pad - 8 && b.bottom <= r.bottom - 96) return done?.();
  const from = sc.scrollTop;
  const to = Math.max(
    0,
    Math.min(
      sc.scrollHeight - sc.clientHeight,
      from + b.top - (r.top + Math.max(pad, r.height * 0.2)),
    ),
  );
  if (reduced() || Math.abs(to - from) < 2) {
    sc.scrollTop = to;
    return done?.();
  }
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, Math.max(0, (performance.now() - t0) / 460));
    sc.scrollTop = from + (to - from) * (1 - Math.pow(1 - k, 4));
    if (k < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

function Filler({
  form,
  sections,
  start,
  draft,
  changing,
  step,
  setStep,
  onSent,
  onStop,
}: FillerProps) {
  const keys = useMemo(() => fieldKeys(sections), [sections]);
  const resolver = useMemo(() => answersResolver(sections), [sections]);
  const rhf = useForm<FieldValues>({
    defaultValues: toFields(start, keys),
    resolver,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const watched = useWatch({ control: rhf.control }) as FieldValues;
  const values = toFill(watched, keys);
  const shown = shownIds(sections, values.a);
  const all = questionsOf(sections);
  const errorKeys = Object.keys(rhf.formState.errors.a ?? {});
  const bad = new Set(errorKeys.map(keys.id).filter((id) => shown.has(id)));
  const done = new Set(
    all
      .filter((q) => shown.has(q.id) && isAnswered(q, values))
      .map((q) => q.id),
  );
  const [active, setActiveKey] = useState<string | null>(null);
  const activeId = active ? keys.id(active) : null;
  const requested = requestedInOrder(form.requestedFields);
  const qs = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const arrowAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [leaving, setLeaving] = useState(false);
  const [freshStep, setFreshStep] = useState(false);
  const questionsScroll = useRef(0);
  const today = todayKey(Date.now());

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) =>
    timers.current.push(setTimeout(fn, reduced() ? 0 : ms));

  // The draft follows every change; a form changed after sending keeps its own.
  const save = draft.save;
  useEffect(() => {
    const sub = rhf.watch((v) => save(draftOf(toFill(v as FieldValues, keys))));
    return () => sub.unsubscribe();
  }, [rhf, keys, save]);

  // The tick beside the question in focus: its place, kept right while questions open or close.
  const placeMark = useCallback(() => {
    const m = mark.current;
    const el =
      active && qs.current?.querySelector<HTMLElement>(`[data-fq="${active}"]`);
    if (!m) return;
    if (!el) {
      m.classList.add('is-idle');
      return;
    }
    m.classList.remove('is-idle');
    m.style.setProperty('--y', `${el.offsetTop + 22}px`);
  }, [active]);
  useLayoutEffect(placeMark);
  useEffect(() => {
    if (!qs.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(placeMark);
    ro.observe(qs.current);
    return () => ro.disconnect();
  }, [placeMark, step]);

  const focusIn = (key: string) => {
    const el = qs.current?.querySelector<HTMLElement>(`[data-fq="${key}"]`);
    if (!el) return;
    const t =
      el.querySelector<HTMLElement>('input:checked') ??
      el.querySelector<HTMLElement>(
        'input:not([type=file]), textarea, select, button.f-file, button.fd-btn',
      );
    if (!t) return;
    const typing =
      t instanceof HTMLTextAreaElement ||
      t instanceof HTMLSelectElement ||
      (t instanceof HTMLInputElement && t.type === 'text');
    if (!(coarse() && typing)) t.focus({ preventScroll: true });
  };
  const activate = (
    key: string,
    o: { scroll?: boolean; focus?: boolean } = {},
  ) => {
    setActiveKey(key);
    const el = qs.current?.querySelector<HTMLElement>(`[data-fq="${key}"]`);
    if (!el) return;
    const after = () => (o.focus ? focusIn(key) : undefined);
    if (o.scroll) scrollIntoPlace(el, after);
    else after();
  };
  const next = (key: string) => {
    const vals = toFill(rhf.getValues(), keys);
    const visible = all.filter((q) => shownIds(sections, vals.a).has(q.id));
    const i = visible.findIndex((q) => keys.key(q.id) === key);
    const nx = visible[i + 1];
    if (nx) return activate(keys.key(nx.id), { scroll: true, focus: true });
    setActiveKey(null);
    const end = document.querySelector<HTMLElement>('[data-f-continue]');
    if (end)
      scrollIntoPlace(end.parentElement ?? end, () =>
        end.focus({ preventScroll: true }),
      );
  };
  const chosen = (key: string, type: string) => {
    if (performance.now() - arrowAt.current < 400) return;
    if (!MOVES_ON.includes(type as (typeof MOVES_ON)[number])) return;
    later(() => next(key), type === 'date' ? 320 : 300);
  };

  // A click, a tap or keyboard focus inside a question makes it the one in focus; scrolling never does.
  const onAct = (e: { target: EventTarget }) => {
    const fq = (e.target as HTMLElement).closest?.<HTMLElement>('[data-fq]');
    if (fq && fq.dataset.fq !== active) setActiveKey(fq.dataset.fq ?? null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    const fq = t.closest<HTMLElement>('[data-fq]');
    if (!fq) return;
    const key = fq.dataset.fq as string;
    if (e.key.startsWith('Arrow')) {
      arrowAt.current = performance.now();
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    if (
      e.key === 'Enter' &&
      ((t instanceof HTMLInputElement &&
        t.type !== 'radio' &&
        t.type !== 'checkbox') ||
        (t instanceof HTMLTextAreaElement && mod))
    ) {
      e.preventDefault();
      next(key);
      return;
    }
    if (mod || e.altKey || e.key.length !== 1) return;
    const k = e.key.toLowerCase();
    if (
      t instanceof HTMLInputElement &&
      (t.type === 'radio' || t.type === 'checkbox') &&
      t.closest('.fo-list') &&
      k >= 'a' &&
      k <= 'z'
    ) {
      const o = t
        .closest('.fo-list')
        ?.querySelectorAll<HTMLInputElement>('.fo > input')[
        k.charCodeAt(0) - 97
      ];
      if (!o) return;
      e.preventDefault();
      o.focus({ preventScroll: true });
      o.click();
      return;
    }
    if (
      t instanceof HTMLInputElement &&
      t.type === 'radio' &&
      t.closest('.f-scale') &&
      k >= '0' &&
      k <= '9'
    ) {
      const scale = t.closest('.f-scale') as HTMLElement;
      const want =
        k === '0' && !scale.querySelector('input[value="0"]') ? '10' : k;
      const o = scale.querySelector<HTMLInputElement>(`input[value="${want}"]`);
      if (!o) return;
      e.preventDefault();
      o.focus({ preventScroll: true });
      o.click();
    }
  };

  /* ---- The agreement step ---- */
  const details = useQuery({
    ...myDetailsQuery(),
    enabled: requested.length > 0,
  });
  const [edits, setEdits] = useState<Partial<Record<SavedField, DraftValue>>>(
    {},
  );
  const [editing, setEditing] = useState<Partial<Record<SavedField, true>>>({});
  const [bad2, setBad2] = useState<Partial<Record<SavedField, DetailReason>>>(
    {},
  );
  const [consent, setConsent] = useState(false);
  const [consentBad, setConsentBad] = useState(false);
  const sender = useSendForm(form.id);
  const failedToast = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (failedToast.current !== null) toast.dismiss(failedToast.current);
    },
    [],
  );

  /** The saved fields whose editor is open: never given, or being corrected. */
  const openFields = (d: MyDetails | undefined) =>
    requested
      .filter((f) => isSaved(f.key))
      .map((f) => f.key as SavedField)
      .filter((k) => editing[k] || (d ? !fieldText(k, d) : false));

  const goAgree = () => {
    questionsScroll.current = scroller()?.scrollTop ?? 0;
    setActiveKey(null);
    const go = () => {
      setLeaving(false);
      setFreshStep(true);
      setStep('agree');
      requestAnimationFrame(() => {
        scroller()?.scrollTo({ top: 0 });
        document
          .querySelector<HTMLElement>('[data-agree-title]')
          ?.focus({ preventScroll: true });
      });
    };
    if (reduced()) return go();
    setLeaving(true);
    later(go, 170);
  };
  const backToQuestions = () => {
    setStep('q');
    requestAnimationFrame(() => {
      const sc = scroller();
      if (sc) sc.scrollTop = questionsScroll.current;
      document.querySelector<HTMLElement>('[data-f-continue]')?.focus();
    });
  };

  const send = async () => {
    if (sender.pending) return;
    const body: SendBody = {
      answers: answersToSend(sections, toFill(rhf.getValues(), keys)),
    };
    if (requested.length) {
      const d = details.data;
      if (!d) return;
      const problems: Partial<Record<SavedField, DetailReason>> = {};
      const change: Record<string, unknown> = {};
      for (const k of openFields(d)) {
        const r = detailToSend(
          k,
          edits[k] ?? draftFromSaved(k, d.saved),
          today,
        );
        if (r.ok) change[k] = r.value;
        else problems[k] = r.reason;
      }
      setBad2(problems);
      setConsentBad(!consent);
      const first = Object.keys(problems)[0];
      if (first || !consent) {
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLElement>(
              first
                ? `[data-pfrow="${first}"] :is(input, textarea, button)`
                : '[data-consent]',
            )
            ?.focus(),
        );
        return;
      }
      body.agreed = true;
      if (Object.keys(change).length)
        body.details = change as SendBody['details'];
    }
    if (failedToast.current !== null) toast.dismiss(failedToast.current);
    failedToast.current = null;
    const outcome = await sender.send(changing, body);
    if (outcome.kind === 'sent') {
      await draft.clear();
      onSent(outcome.response);
      requestAnimationFrame(() => scroller()?.scrollTo({ top: 0 }));
    } else if (outcome.kind === 'already') {
      await draft.clear();
      onStop();
    } else if (outcome.kind === 'closed') {
      onStop();
    } else if (outcome.kind === 'missing' || outcome.kind === 'problems') {
      const fields =
        outcome.kind === 'missing'
          ? Object.fromEntries(outcome.fields.map((f) => [f, 'missing']))
          : outcome.problems;
      const next2: Partial<Record<SavedField, DetailReason>> = {};
      const open: Partial<Record<SavedField, true>> = {};
      for (const [f, p] of Object.entries(fields)) {
        if (!isSaved(f as SavedField)) continue;
        next2[f as SavedField] = reasonOfProblem(f as SavedField, p);
        open[f as SavedField] = true;
      }
      setEditing((e) => ({ ...e, ...open }));
      setBad2(next2);
      setStep('agree');
    } else if (outcome.kind === 'answers') {
      setStep('q');
      const ok = await rhf.trigger();
      if (ok)
        failedToast.current = toast.error(isi.terkirim.gagal, {
          action: {
            label: common.actions.cobaLagi,
            onClick: () => void send(),
          },
        });
      else focusFirstError();
    } else if (outcome.kind === 'failed') {
      failedToast.current = toast.error(isi.terkirim.gagal, {
        action: { label: common.actions.cobaLagi, onClick: () => void send() },
      });
    }
    if (outcome.kind !== 'failed') void sender.refresh();
  };

  const focusFirstError = () => {
    const errs = rhf.formState.errors.a ?? {};
    const first = all.find((q) => keys.key(q.id) in errs);
    if (first)
      requestAnimationFrame(() =>
        activate(keys.key(first.id), { scroll: true, focus: true }),
      );
  };

  const onContinue = () =>
    void rhf.handleSubmit(
      () => {
        if (requested.length) goAgree();
        else void send();
      },
      (errs) => {
        const first = all.find((q) => keys.key(q.id) in (errs.a ?? {}));
        if (first) activate(keys.key(first.id), { scroll: true, focus: true });
      },
    )();

  const pips: PipState = {
    sections,
    shown,
    done,
    bad,
    active: activeId,
    step,
    end: requested.length > 0,
  };
  const saved = draft.saved ? <Saved className="text-fg-2" /> : null;
  const many = sections.length > 1;
  const level = many || !!sections[0]?.title ? 3 : 2;

  const questions = (
    <div className={cn(leaving && 'f-out')}>
      <div
        className="f-qs"
        ref={qs}
        onClickCapture={onAct}
        onFocus={onAct}
        onKeyDownCapture={onKeyDown}
      >
        <span className="f-mark is-idle" ref={mark} aria-hidden="true" />
        {sections.map((s, i) => (
          <section
            key={s.id}
            className="f-sec"
            aria-labelledby={many || s.title ? `${ID}-s-${s.id}` : undefined}
          >
            {many || s.title ? (
              <SectionHead
                line
                level={2}
                id={`${ID}-s-${s.id}`}
                title={s.title || fill(isi.samping.bagian, { nomor: i + 1 })}
              />
            ) : null}
            {s.description ? <p className="f-sec-d">{s.description}</p> : null}
            {s.questions.map((q) => {
              const k = keys.key(q.id);
              return (
                <Question
                  key={q.id}
                  q={q}
                  k={k}
                  idp={ID}
                  level={level}
                  shown={shown.has(q.id)}
                  done={done.has(q.id)}
                  bad={bad.has(q.id)}
                  active={active === k}
                  form={rhf}
                  onNext={() => next(k)}
                  onChosen={() => chosen(k, q.type)}
                  onOther={() =>
                    later(
                      () =>
                        qs.current
                          ?.querySelector<HTMLInputElement>(
                            `[data-fw="${k}"] [data-other]`,
                          )
                          ?.focus({ preventScroll: true }),
                      120,
                    )
                  }
                  paraKey={paraKey()}
                  todayKey={today}
                />
              );
            })}
          </section>
        ))}
      </div>
      <div className="f-end">
        <span className="grow" role="alert">
          {bad.size ? (
            <>
              <IconPeringatan size={16} />
              {fill(isi.akhir.belumDiisi, { jumlah: bad.size })}
            </>
          ) : null}
        </span>
        <Button variant="gold" data-f-continue="" onClick={onContinue}>
          {requested.length ? (
            <>
              {isi.akhir.lanjut} <IconLanjut size={16} />
            </>
          ) : (
            <>
              <IconKirim size={16} />{' '}
              {sender.pending ? isi.akhir.mengirim : isi.akhir.kirim}
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <TopBarActions>
        <Pips p={pips} />
        <span className="f-bar-saved">{saved}</span>
      </TopBarActions>
      <Body
        aside={
          step === 'q' ? (
            <Aside
              p={pips}
              saved={saved}
              onSection={(sid) => {
                const sec = sections.find((x) => x.id === sid);
                const q = sec?.questions.find((x) => shown.has(x.id));
                if (q) activate(keys.key(q.id), { scroll: true, focus: true });
              }}
            />
          ) : null
        }
      >
        {step === 'q' ? (
          questions
        ) : (
          <Agreement
            form={form}
            rows={requested}
            details={details.data}
            detailsFailed={details.isError}
            retryDetails={() => void details.refetch()}
            edits={edits}
            setEdit={(k, v) => {
              setEdits((e) => ({ ...e, [k]: v }));
              setBad2((b) => ({ ...b, [k]: undefined }));
            }}
            editing={editing}
            setEditing={(k, on) => {
              setEditing((e) => ({ ...e, [k]: on || undefined }));
              if (!on) {
                setEdits((e) => ({ ...e, [k]: undefined }));
                setBad2((b) => ({ ...b, [k]: undefined }));
              }
            }}
            bad={bad2}
            consent={consent}
            setConsent={(v) => {
              setConsent(v);
              setConsentBad(false);
            }}
            consentBad={consentBad}
            fresh={freshStep}
            pending={sender.pending}
            onBack={backToQuestions}
            onSend={() => void send()}
          />
        )}
      </Body>
    </>
  );
}

function Agreement(p: {
  form: FormDetail;
  rows: readonly FieldInfo[];
  details: MyDetails | undefined;
  detailsFailed: boolean;
  retryDetails: () => void;
  edits: Partial<Record<SavedField, DraftValue>>;
  setEdit: (k: SavedField, v: DraftValue) => void;
  editing: Partial<Record<SavedField, true>>;
  setEditing: (k: SavedField, on: boolean) => void;
  bad: Partial<Record<SavedField, DetailReason>>;
  consent: boolean;
  setConsent: (v: boolean) => void;
  consentBad: boolean;
  fresh: boolean;
  pending: boolean;
  onBack: () => void;
  onSend: () => void;
}) {
  const t = isi.setuju;
  const d = p.details;
  const id = `${ID}-pf`;
  if (!d)
    return p.detailsFailed ? (
      <ErrorState onRetry={p.retryDetails} />
    ) : (
      <Loading />
    );
  return (
    <div className={cn('f-step', p.fresh && 'in')} data-f-step="agree">
      <div style={{ display: 'grid', gap: 6 }}>
        <h2 className="t-title" data-agree-title="" tabIndex={-1}>
          {t.judul}
        </h2>
        <p className="t-sm text-fg-2">
          {p.form.owner
            ? fill(t.penerima, { nama: p.form.owner.fullName })
            : t.penerimaTanpaNama}
        </p>
      </div>
      <div className="slip raised">
        <dl style={{ margin: 0 }}>
          {p.rows.map((x, i) => {
            const cur = fieldText(x.key, d);
            const k = x.key as SavedField;
            const saved = isSaved(x.key);
            const open = saved && (!cur || !!p.editing[k]);
            const bad = saved ? p.bad[k] : undefined;
            const rid = `${id}-${x.key}`;
            return (
              <div
                key={x.key}
                className={cn('slip-row', open && 'open')}
                style={{ ['--i' as string]: i }}
              >
                <dt id={`${rid}-l`}>{isi.bidang[x.key]}</dt>
                <dd>
                  <span>
                    {!cur ? (
                      <Tag tone="accent" icon={<IconTambah size={16} />}>
                        {t.belumAda}
                      </Tag>
                    ) : p.editing[k] ? null : (
                      cur
                    )}
                  </span>
                  {saved && cur ? (
                    p.editing[k] ? (
                      <LinkButton onClick={() => p.setEditing(k, false)}>
                        {t.batal}
                      </LinkButton>
                    ) : (
                      <LinkButton
                        aria-label={fill(t.ubahLabel, {
                          label: isi.bidang[x.key],
                        })}
                        onClick={() => {
                          p.setEditing(k, true);
                          requestAnimationFrame(() =>
                            document
                              .querySelector<HTMLElement>(
                                `[data-pfrow="${k}"] :is(input, textarea, button)`,
                              )
                              ?.focus(),
                          );
                        }}
                      >
                        {t.ubah}
                      </LinkButton>
                    )
                  ) : null}
                  {open ? (
                    <div className={cn('fill', bad && 'is-bad')} data-pfrow={k}>
                      <DetailEditor
                        field={k}
                        value={p.edits[k] ?? draftFromSaved(k, d.saved)}
                        onChange={(v) => p.setEdit(k, v)}
                        idp={rid}
                        labelledBy={`${rid}-l`}
                        describedBy={`${rid}-err ${rid}-n`}
                        invalid={!!bad}
                      />
                      <div className="fq-err">
                        <p id={`${rid}-err`}>
                          <IconPeringatan size={16} />
                          <span>
                            {fill(t.supayaTerkirim, {
                              alasan: isi.alasan[bad ?? reasonFor(k)],
                            })}
                          </span>
                        </p>
                      </div>
                      <p className="t-cap text-fg-3" id={`${rid}-n`}>
                        {cur ? t.ikutDiperbarui : t.cukupSekali}
                      </p>
                    </div>
                  ) : null}
                </dd>
              </div>
            );
          })}
        </dl>
        <div
          className="slip-tear"
          style={{ ['--i' as string]: p.rows.length }}
          aria-hidden="true"
        />
        <div
          className={cn('slip-agree', p.consentBad && 'is-bad')}
          style={{ ['--i' as string]: p.rows.length + 1 }}
        >
          <label className="fo multi">
            <input
              type="checkbox"
              data-consent=""
              checked={p.consent}
              aria-describedby={`${ID}-consent-err`}
              aria-invalid={p.consentBad || undefined}
              onChange={(e) => p.setConsent(e.target.checked)}
            />
            <span className="fo-key" aria-hidden="true">
              <i />
              <IconCentang size={16} />
            </span>
            <span className="fo-l">{t.persetujuan}</span>
          </label>
          <div className="fq-err">
            <p id={`${ID}-consent-err`}>
              <IconPeringatan size={16} />
              <span>{t.centangDulu}</span>
            </p>
          </div>
        </div>
      </div>
      <div className="f-nav">
        <Button variant="paper" onClick={p.onBack}>
          {t.kembali}
        </Button>
        <Button variant="gold" data-f-send="" onClick={p.onSend}>
          <IconKirim size={16} />{' '}
          {p.pending ? isi.akhir.mengirim : isi.akhir.kirim}
        </Button>
      </div>
    </div>
  );
}
