import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { ApiError, type FormDetail } from '~/api/generated';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Plaque,
  Saved,
  Segbar,
  Skeleton,
  SkeletonBar,
  SkeletonBlock,
  toast,
} from '~/components/garis';
import { IconPeringatan } from '~/components/icons/peringatan';
import { DeskHead, PageBody, usePageTitle } from '~/components/shell/page';
import useSession from '~/hooks/auth/useSession';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { form as copy } from '~/copy/form';
import { longWhen, remaining } from '~/lib/form/format';
import { openingStep } from '~/lib/form/poll';
import {
  answersToSend,
  firstIncompleteSection,
  isEligible,
  isVisible,
  sectionMissing,
  startingAnswers,
  type AnswerValue,
  type Answers,
} from '~/lib/form/rules';
import { CheckList } from './CheckPage';
import { formDetailQuery, myResponseQuery, useSendForm } from './data';
import { QBlock } from './QBlock';
import { useFormDraft } from './useFormDraft';
import '~/styles/garis/form.css';

const ID = 'fill';

/** The page around every state: the form's title in the top bar and the desktop head, one column. */
function Page({
  title,
  gap = 18,
  children,
}: {
  title?: string;
  gap?: number;
  children: React.ReactNode;
}) {
  usePageTitle(title);
  return (
    <>
      {title ? <DeskHead title={title} /> : null}
      <PageBody style={{ gap }}>{children}</PageBody>
    </>
  );
}

function Loading({ title }: { title?: string }) {
  return (
    <Page title={title}>
      <Skeleton label={copy.isi.memuat}>
        <div className="grid gap-2.5">
          <SkeletonBar width="90%" />
          <SkeletonBar width="60%" />
          <SkeletonBlock height={44} />
          <SkeletonBlock height={44} />
          <SkeletonBlock height={44} />
        </div>
      </Skeleton>
    </Page>
  );
}

function BackToList() {
  return (
    <Button variant="paper" asChild>
      <Link to="/layanan/form">{copy.keDaftar}</Link>
    </Button>
  );
}

/** The thank-you (scrFill when done): the plaque, then Kembali ke Beranda. */
function ThankYou({ title, focus }: { title: string; focus: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus({ preventScroll: true });
  }, [focus]);
  return (
    <Page title={title}>
      <div className="g-fill-done">
        <Plaque className="g-thanks">
          <h2 className="t-title" ref={ref} tabIndex={-1}>
            {copy.selesai.judul}
          </h2>
          <p className="sub t-sm">{copy.selesai.isi}</p>
        </Plaque>
        <Button variant="paper" asChild>
          <Link to="/">{copy.selesai.kembali}</Link>
        </Button>
      </div>
    </Page>
  );
}

/** A form that hasn't opened: its time and a countdown; at zero the server is asked until it sends the questions. */
function NotOpenYet({
  form,
  refetch,
}: {
  form: FormDetail;
  refetch: () => Promise<unknown>;
}) {
  const opensAt = Date.parse(form.opensAt);
  const [now, setNow] = useState(() => Date.now());
  const [gaveUp, setGaveUp] = useState(false);
  const since = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (gaveUp) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let live = true;
    const tick = () => {
      const step = openingStep({
        opensAt,
        pollingSince: since.current,
        now: Date.now(),
        hasSections: false,
        random: Math.random(),
      });
      if (step.kind === 'wait') {
        // setTimeout can't wait more than about 24 days in one go.
        timer = setTimeout(tick, Math.min(step.at - Date.now(), 2 ** 31 - 1));
        return;
      }
      if (step.kind === 'give-up') {
        setGaveUp(true);
        return;
      }
      if (step.kind !== 'poll') return;
      since.current ??= Date.now();
      // When the questions arrive, the screen above swaps this one for the form.
      void refetch().finally(() => {
        if (live) timer = setTimeout(tick, step.delay);
      });
    };
    tick();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [opensAt, refetch, gaveUp]);

  const due = now >= opensAt;
  return (
    <Page title={form.title}>
      {form.description ? (
        <p className="t-sm text-fg-2">{form.description}</p>
      ) : null}
      {gaveUp ? (
        <ErrorState
          title={copy.belumDibuka.gagal}
          text={copy.belumDibuka.gagalIsi}
          onRetry={() => {
            since.current = null;
            setGaveUp(false);
          }}
        />
      ) : (
        <div className="g-fill-when">
          <p className="t-sub">
            {fill(copy.belumDibuka.dibuka, { waktu: longWhen(opensAt) })}
          </p>
          <p className="t-sm text-fg-2 num" role="timer">
            {due
              ? copy.belumDibuka.membuka
              : fill(copy.belumDibuka.sisa, {
                  sisa: remaining(opensAt - now),
                })}
          </p>
        </div>
      )}
    </Page>
  );
}

/** Closed: read-only with its closing time and no Kirim; a draft shows as the check page without Ubah. */
function Closed({ form, draft }: { form: FormDetail; draft: Answers | null }) {
  const text = form.closesAt
    ? fill(copy.ditutup.isi, { waktu: longWhen(form.closesAt) })
    : copy.ditutup.isiTanpaWaktu;
  return (
    <Page title={form.title}>
      <EmptyState
        title={copy.ditutup.judul}
        text={text}
        action={<BackToList />}
      />
      {draft && form.sections ? (
        <CheckList sections={form.sections} answers={draft} idPrefix={ID} />
      ) : null}
    </Page>
  );
}

/**
 * Layanan › Form › a form (garis/screens-more.js `scrFill`), a focused flow: one section at a time with the
 * description on the first, "Bagian n dari N" and the Segbar, the questions, Lanjut checking the section, then the
 * check page and Kirim jawaban behind a confirmation; the thank-you plaque after. Every state the server can put the
 * form in has its own view.
 */
export function FormFill({ formId }: { formId: string }) {
  const me = useSession();
  const detail = useQuery(formDetailQuery(formId));
  const mine = useQuery(myResponseQuery(formId));
  const draft = useFormDraft(formId, me.id);
  const [sentNow, setSentNow] = useState(false);
  // Closed while filling (the server answered 403): the closed view with the answers on screen.
  const [closedWith, setClosedWith] = useState<Answers | null>(null);

  const form = detail.data;
  if (sentNow && form) return <ThankYou title={form.title} focus />;
  if (detail.isError && !form) {
    const err = detail.error;
    if (err instanceof ApiError && err.status === 404)
      return (
        <Page>
          <EmptyState
            title={copy.tidakAda.judul}
            text={copy.tidakAda.isi}
            action={<BackToList />}
          />
        </Page>
      );
    return (
      <Page>
        <ErrorState
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
      </Page>
    );
  }
  if (!form || mine.isPending || draft.restored === undefined)
    return <Loading title={form?.title} />;
  if (!isEligible(form, me))
    return (
      <Page title={form.title}>
        <EmptyState
          title={copy.bukanUntukmu.judul}
          text={copy.bukanUntukmu.isi}
          action={<BackToList />}
        />
      </Page>
    );
  if (form.status === 'already_responded' || mine.data)
    return <ThankYou title={form.title} focus={false} />;
  if (form.status === 'closed' || closedWith)
    return <Closed form={form} draft={closedWith ?? draft.restored} />;
  if (!form.sections)
    return <NotOpenYet form={form} refetch={detail.refetch} />;
  return (
    <Filler
      form={form}
      sections={form.sections}
      start={startingAnswers(form.sections, draft.restored, me)}
      draft={draft}
      onSent={() => setSentNow(true)}
      onClosed={(answers) => {
        setClosedWith(answers);
        void detail.refetch();
      }}
    />
  );
}

type Focus = { kind: 'title' } | { kind: 'question'; id: string } | null;

function Filler({
  form,
  sections,
  start,
  draft,
  onSent,
  onClosed,
}: {
  form: FormDetail;
  sections: NonNullable<FormDetail['sections']>;
  start: Answers;
  draft: ReturnType<typeof useFormDraft>;
  onSent: () => void;
  onClosed: (answers: Answers) => void;
}) {
  const n = sections.length;
  const [answers, setAnswers] = useState<Answers>(start);
  const [sec, setSec] = useState(0);
  const [fromReview, setFromReview] = useState(false);
  const [errs, setErrs] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [focus, setFocus] = useState<Focus>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const sender = useSendForm(form.id);
  const failedToast = useRef<number | null>(null);
  const review = sec >= n;

  useEffect(() => {
    if (!focus) return;
    setFocus(null);
    if (focus.kind === 'title') {
      titleRef.current?.focus();
      return;
    }
    document
      .querySelector<HTMLElement>(
        `[data-qb="${focus.id}"] input, [data-qb="${focus.id}"] textarea`,
      )
      ?.focus();
  }, [focus]);

  const change = (id: string, value: AnswerValue) => {
    const next = { ...answers, [id]: value };
    setAnswers(next);
    setErrs((e) => (e.includes(id) ? e.filter((x) => x !== id) : e));
    draft.save(next);
  };

  const go = (to: number, opts: { fromReview?: boolean } = {}) => {
    setSec(to);
    setFromReview(!!opts.fromReview);
    setErrs([]);
    setFocus({ kind: 'title' });
  };

  const next = () => {
    if (review) {
      setConfirming(true);
      return;
    }
    const missing = sectionMissing(sections[sec], answers);
    if (missing.length) {
      setErrs(missing.map((q) => q.id));
      setFocus({ kind: 'question', id: missing[0].id });
      return;
    }
    go(fromReview ? n : sec + 1);
  };

  const submit = async () => {
    if (sender.pending) return;
    if (failedToast.current !== null) toast.dismiss(failedToast.current);
    failedToast.current = null;
    const outcome = await sender.send(answersToSend(sections, answers));
    setConfirming(false);
    if (outcome === 'sent') {
      await draft.clear();
      toast.success(copy.kirim.berhasil);
      onSent();
    } else if (outcome === 'already') {
      await draft.clear();
      onSent();
    } else if (outcome === 'closed') {
      onClosed(answers);
    } else if (outcome === 'incomplete') {
      const first = firstIncompleteSection(sections, answers);
      if (first >= 0) {
        const missing = sectionMissing(sections[first], answers);
        setSec(first);
        setFromReview(true);
        setErrs(missing.map((q) => q.id));
        setFocus({ kind: 'question', id: missing[0].id });
      }
    } else {
      failedToast.current = toast.error(copy.kirim.gagal, {
        action: {
          label: common.actions.cobaLagi,
          onClick: () => void submit(),
        },
      });
    }
    void sender.refresh();
  };

  const bar = (
    <Segbar
      total={n}
      done={review ? n : sec + 1}
      label={
        review
          ? copy.periksa.judul
          : fill(copy.isi.bagianDari, { nomor: sec + 1, jumlah: n })
      }
    />
  );
  const saved = draft.saved ? (
    <Saved className="text-fg-3" />
  ) : (
    <span className="g-fill-saved" />
  );
  const prev = (
    <Button variant="paper" onClick={() => go(Math.min(sec, n) - 1)}>
      {copy.isi.sebelumnya}
    </Button>
  );

  if (review)
    return (
      <Page title={form.title}>
        <div className="g-fill-head">
          {bar}
          <div className="g-between">
            <h2 className="t-title" ref={titleRef} tabIndex={-1}>
              {copy.periksa.judul}
            </h2>
            {saved}
          </div>
        </div>
        <CheckList
          sections={sections}
          answers={answers}
          idPrefix={ID}
          onEdit={(i) => go(i, { fromReview: true })}
        />
        <div className="g-form-nav">
          {prev}
          <Button variant="gold" onClick={next}>
            {copy.periksa.kirimJawaban}
          </Button>
        </div>
        <ConfirmDialog
          open={confirming}
          onOpenChange={(open) => {
            if (!sender.pending) setConfirming(open);
          }}
          title={copy.kirim.judul}
          cancelLabel={copy.kirim.periksaLagi}
          confirmLabel={sender.pending ? copy.kirim.mengirim : copy.kirim.kirim}
          onConfirm={() => void submit()}
        >
          {copy.kirim.isi}
        </ConfirmDialog>
      </Page>
    );

  const section = sections[sec];
  return (
    <Page title={form.title}>
      <div className="g-fill-head">
        {sec === 0 && form.description ? (
          <p className="g-fill-desc t-sm text-fg-2">{form.description}</p>
        ) : null}
        <div className="g-between">
          <p className="t-cap text-fg-2 num">
            {fill(copy.isi.bagianDari, { nomor: sec + 1, jumlah: n })}
          </p>
          {saved}
        </div>
        {bar}
        <h2 className="t-title" ref={titleRef} tabIndex={-1}>
          {section.title}
        </h2>
      </div>
      {errs.length ? (
        <p className="g-err t-sm" role="alert">
          <IconPeringatan size={16} />
          {copy.isi.masihAda}
        </p>
      ) : null}
      <div className="g-qs">
        {section.questions
          .filter((q) => isVisible(q, answers))
          .map((q) => (
            <QBlock
              key={q.id}
              q={q}
              value={answers[q.id]}
              onChange={change}
              missing={errs.includes(q.id)}
              idPrefix={ID}
            />
          ))}
      </div>
      <div className="g-form-nav">
        {sec > 0 && !fromReview ? prev : <span />}
        <Button variant="gold" onClick={next}>
          {fromReview ? copy.isi.kembaliKeRingkasan : copy.isi.lanjut}
        </Button>
      </div>
    </Page>
  );
}
