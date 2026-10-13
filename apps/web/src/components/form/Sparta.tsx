import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  InternshipDepartment,
  InternshipDivision,
  InternshipSubmission,
  InternshipWindow,
} from '~/api/generated';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  Disclosure,
  EmptyState,
  ErrorState,
  Saved,
  Segbar,
  Skeleton,
  SkeletonBar,
  SkeletonBlock,
  Tag,
  toast,
} from '~/components/garis';
import { IconCentang } from '~/components/icons/centang';
import { IconJam } from '~/components/icons/jam';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconTambah } from '~/components/icons/tambah';
import { DeskHead, PageBody } from '~/components/shell/page';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { form as formCopy } from '~/copy/form';
import { sparta as copy } from '~/copy/sparta';
import { deadlineWhen, longWhen } from '~/lib/form/format';
import {
  allDivisions,
  firstIncompleteStep,
  fromSubmission,
  moveChoice,
  SPARTA_CHOICES,
  SPARTA_STEPS,
  spartaView,
  stepMissing,
  toggleChoice,
  toRequest,
  type SpartaDraft,
  type SpartaMissing,
} from '~/lib/form/sparta';
import { serviceById } from '~/lib/services';
import {
  spartaDepartmentsQuery,
  spartaSubmissionQuery,
  saveDraftOnLeave,
  spartaWindowQuery,
  useSpartaWrites,
} from './sparta-data';
import { DivisionQuestion, FieldError, TextField } from './SpartaFields';
import '~/styles/garis/form.css';

const ID = 'sparta';
const N = SPARTA_STEPS.length;
/** How long typing pauses before the draft is saved on the server. */
export const SPARTA_SAVE_DEBOUNCE_MS = 800;

function Page({
  children,
  gap = 18,
}: {
  children: React.ReactNode;
  gap?: number;
}) {
  return (
    <>
      <DeskHead title={serviceById('sparta').label} />
      <PageBody style={{ gap }}>{children}</PageBody>
    </>
  );
}

const BackToLayanan = () => (
  <Button variant="paper" asChild>
    <Link to="/layanan">{copy.kembali}</Link>
  </Button>
);

/** Status, always icon + word + colour: sent, or a draft not sent yet. */
function SubmissionTag({ locked }: { locked: boolean }) {
  return locked ? (
    <Tag tone="success" icon={<IconCentang size={16} />}>
      {copy.statusTerkirim}
    </Tag>
  ) : (
    <Tag icon={<IconJam size={16} />}>{copy.statusDraf}</Tag>
  );
}

function closedLine(win: InternshipWindow) {
  return win.closesAt
    ? fill(copy.ditutup, { waktu: deadlineWhen(win.closesAt) })
    : copy.ditutupTanpaWaktu;
}

/**
 * The check list (the form's `reviewPage`, for SPARTA): Info umum, the four choices in order, and each chosen
 * division's answers. With `onEdit`, each part has Ubah; read-only (closed, sent) it has none.
 */
function SpartaCheck({
  draft,
  departments,
  onEdit,
}: {
  draft: SpartaDraft;
  departments: InternshipDepartment[];
  onEdit?: (step: number) => void;
}) {
  const divisions = allDivisions(departments);
  const byId = new Map(divisions.map((d) => [d.id, d]));
  const row = (label: string, value: string, key: string, file = false) => (
    <div key={key}>
      <dt>{label}</dt>
      <dd className={value.trim() ? undefined : 'none'}>
        {!value.trim() ? (
          formCopy.periksa.tidakDiisi
        ) : file ? (
          // A file answer is its URL: a link to it, not the address.
          <a className="g-link" href={value} target="_blank" rel="noreferrer">
            {copy.pertanyaan.lihatFile}
          </a>
        ) : (
          value.trim()
        )}
      </dd>
    </div>
  );
  const part = (
    title: string,
    step: number,
    rows: React.ReactNode,
    key: string,
  ) => {
    const headId = `${ID}-rv-${key}`;
    return (
      <section key={key} className="g-rv-sec" aria-labelledby={headId}>
        <div className="g-between">
          <h3 className="t-heading" id={headId}>
            {title}
          </h3>
          {onEdit ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={fill(formCopy.periksa.ubahBagian, { bagian: title })}
              onClick={() => onEdit(step)}
            >
              {formCopy.periksa.ubah}
            </Button>
          ) : null}
        </div>
        <dl className="g-rv-list">{rows}</dl>
      </section>
    );
  };
  const kesibukan = draft.kesibukan
    .filter((k) => k.jabatan.trim() || k.organisasi.trim() || k.periode.trim())
    .map((k) => [k.jabatan, k.organisasi, k.periode].filter(Boolean).join(', '))
    .join('\n');
  return (
    <div className="g-review">
      {part(
        copy.langkah[0],
        0,
        <>
          {row(copy.umum.kelas, draft.kelas, 'kelas')}
          {row(copy.umum.idLine, draft.idLine, 'idLine')}
          {row(copy.umum.pengalaman, draft.pengalamanOrganisasi, 'pengalaman')}
          {row(copy.umum.kesibukan, kesibukan, 'kesibukan')}
        </>,
        'umum',
      )}
      {part(
        copy.periksa.pilihan,
        2,
        Array.from({ length: SPARTA_CHOICES }, (_, i) =>
          row(
            fill(copy.periksa.prioritas, { nomor: i + 1 }),
            byId.get(draft.choices[i])?.name ?? '',
            `p${i}`,
          ),
        ),
        'pilih',
      )}
      {draft.choices.map((id, i) => {
        const division = byId.get(id);
        if (!division) return null;
        return part(
          fill(copy.pertanyaan.pilihanKe, {
            nomor: i + 1,
            divisi: division.name,
          }),
          3,
          division.questions.map((q) =>
            row(
              q.label,
              draft.answers[id]?.[q.id] ?? '',
              q.id,
              q.type === 'file',
            ),
          ),
          `q-${id}`,
        );
      })}
    </div>
  );
}

/** Closed, or sent: the closing line (or nothing new), the status and what was saved, read-only. */
function ReadOnly({
  win,
  draft,
  locked,
  hasSubmission,
  departments,
}: {
  win: InternshipWindow;
  draft: SpartaDraft;
  locked: boolean;
  hasSubmission: boolean;
  departments: InternshipDepartment[];
}) {
  return (
    <Page>
      <div className="g-fill-when">
        {win.status === 'closed' ? (
          <p className="t-sub">{closedLine(win)}</p>
        ) : null}
        {hasSubmission ? (
          <div>
            <SubmissionTag locked={locked} />
          </div>
        ) : (
          <p className="t-sm text-fg-2">{copy.tidakAdaKiriman}</p>
        )}
      </div>
      {hasSubmission ? (
        <SpartaCheck draft={draft} departments={departments} />
      ) : null}
    </Page>
  );
}

function Loading() {
  return (
    <Page>
      <Skeleton label={copy.memuat}>
        <div className="grid gap-2.5">
          <SkeletonBar width="80%" />
          <SkeletonBlock height={44} />
          <SkeletonBlock height={44} />
        </div>
      </Skeleton>
    </Page>
  );
}

/**
 * Layanan › Magang SPARTA (no locked design: composed from the form's template, OPEN-QUESTIONS D4). It answers deep
 * links and the old /home/internship; no list shows it while closed. The win and eligibility come from the server;
 * a member it isn't for never asks for the submission.
 */
export function Sparta() {
  const win = useQuery(spartaWindowQuery());
  const eligible = win.data?.eligible === true;
  const departments = useQuery({
    ...spartaDepartmentsQuery(),
    enabled: eligible,
  });
  const submission = useQuery({
    ...spartaSubmissionQuery(),
    enabled: eligible,
  });
  // Closed while filling (a write answered 403): the closed view, with the answers on screen.
  const [closedWith, setClosedWith] = useState<SpartaDraft | null>(null);

  const failed = [win, departments, submission].find((q) => q.isError);
  if (failed)
    return (
      <Page>
        <ErrorState
          title={copy.gagal}
          onRetry={() => void failed.refetch()}
          retrying={failed.isFetching}
        />
      </Page>
    );
  if (!win.data) return <Loading />;
  const view = spartaView(win.data);
  if (view === 'not-eligible')
    return (
      <Page>
        <EmptyState
          title={copy.bukanUntukmu.judul}
          text={copy.bukanUntukmu.isi}
          action={<BackToLayanan />}
        />
      </Page>
    );
  if (!departments.data || submission.data === undefined) return <Loading />;
  const sub = submission.data;
  if (view === 'closed' || closedWith || sub?.isLocked)
    return (
      <ReadOnly
        win={closedWith ? { ...win.data, status: 'closed' } : win.data}
        draft={closedWith ?? fromSubmission(sub)}
        locked={!!sub?.isLocked}
        hasSubmission={!!sub || !!closedWith}
        departments={departments.data}
      />
    );
  if (view === 'not-open')
    return (
      <Page>
        <p className="t-sub">
          {win.data.opensAt
            ? fill(copy.belumDibuka, { waktu: longWhen(win.data.opensAt) })
            : copy.belumDibukaTanpaWaktu}
        </p>
      </Page>
    );
  return (
    <Steps
      win={win.data}
      submission={sub}
      departments={departments.data}
      onClosed={(d) => {
        setClosedWith(d);
        void win.refetch();
      }}
    />
  );
}

type Focus = { kind: 'title' } | { kind: 'missing'; sk: string } | null;

const skOf = (m: SpartaMissing) =>
  m.step === 'pertanyaan'
    ? `q-${m.divisionId}-${m.questionId}`
    : m.field === 'kesibukan'
      ? `kesibukan-${m.index}-${m.part}`
      : m.field;

/** Next season's flow: the deadline and four steps up front, then the steps, the check page and sending. */
function Steps({
  win,
  submission,
  departments,
  onClosed,
}: {
  win: InternshipWindow;
  submission: InternshipSubmission | null;
  departments: InternshipDepartment[];
  onClosed: (draft: SpartaDraft) => void;
}) {
  const divisions = allDivisions(departments);
  const [draft, setDraft] = useState<SpartaDraft>(() =>
    fromSubmission(submission),
  );
  /** -1: the start; 0–3 the steps; 4 the check page. */
  const [step, setStep] = useState(-1);
  const [fromReview, setFromReview] = useState(false);
  const [missing, setMissing] = useState<SpartaMissing[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [focus, setFocus] = useState<Focus>(null);
  const [saveState, setSaveState] = useState<'saved' | 'failed' | 'none'>(
    submission ? 'saved' : 'none',
  );
  const [moved, setMoved] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const writes = useSpartaWrites();
  const latest = useRef(draft);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const sentToast = useRef<number | null>(null);
  // Whether a send is under way: the failed send's toast stays, so its Coba lagi can't lean on a render's state.
  const sending = useRef(false);

  // Saves run one after another, always with the latest answers.
  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    saving.current = saving.current.then(async () => {
      const outcome = await writes.saveDraft(
        toRequest(latest.current, divisions),
      );
      if (outcome === 'ok') setSaveState('saved');
      else if (outcome === 'closed') onClosed(latest.current);
      else setSaveState('failed');
    });
    return saving.current;
  }, [writes, divisions, onClosed]);

  const change = (next: SpartaDraft, opts: { now?: boolean } = {}) => {
    latest.current = next;
    setDraft(next);
    if (missing.length) {
      const still = stepMissing(SPARTA_STEPS[step], next, divisions);
      setMissing((m) =>
        m.filter((x) => still.some((s) => skOf(s) === skOf(x))),
      );
    }
    if (timer.current) clearTimeout(timer.current);
    if (opts.now) void saveNow();
    else
      timer.current = setTimeout(() => void saveNow(), SPARTA_SAVE_DEBOUNCE_MS);
  };

  useEffect(
    () => () => {
      // A failed send's toast doesn't outlive the screen it would send from.
      if (sentToast.current !== null) toast.dismiss(sentToast.current);
      if (timer.current) {
        clearTimeout(timer.current);
        void writes.saveDraft(toRequest(latest.current, divisions));
      }
    },
    // On leaving only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // A save still waiting when the page goes away (the tab closes, a reload) is sent with it, as form drafts are.
  useEffect(() => {
    const leave = () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      timer.current = null;
      saveDraftOnLeave(toRequest(latest.current, divisions));
    };
    window.addEventListener('pagehide', leave);
    return () => window.removeEventListener('pagehide', leave);
  }, [divisions]);

  useEffect(() => {
    if (!focus) return;
    setFocus(null);
    if (focus.kind === 'title') titleRef.current?.focus();
    else
      document
        .querySelector<HTMLElement>(
          `[data-sk="${focus.sk}"] :is(input:not([hidden]), textarea, select, [data-focus])`,
        )
        ?.focus();
  }, [focus]);

  const go = (to: number, opts: { fromReview?: boolean } = {}) => {
    setStep(to);
    setFromReview(!!opts.fromReview);
    setMissing([]);
    setFocus({ kind: 'title' });
    // Saved on every step.
    if (step >= 0) void saveNow();
  };

  const next = () => {
    if (step >= N) {
      setConfirming(true);
      return;
    }
    const m = stepMissing(SPARTA_STEPS[step], draft, divisions);
    if (m.length) {
      setMissing(m);
      setFocus({ kind: 'missing', sk: skOf(m[0]) });
      return;
    }
    go(fromReview ? N : step + 1);
  };

  // Sends the choices as they are now (`latest`), also from the failed send's toast after the member changed them.
  const submit = async () => {
    if (sending.current) return;
    sending.current = true;
    if (sentToast.current !== null) toast.dismiss(sentToast.current);
    sentToast.current = null;
    if (timer.current) clearTimeout(timer.current);
    await saving.current;
    const draft = latest.current;
    const outcome = await writes.submit(toRequest(draft, divisions));
    sending.current = false;
    setConfirming(false);
    // A 400 goes back to the first incomplete step, if the screen's own checks can find one.
    const placed =
      outcome === 'invalid' ? firstIncompleteStep(draft, divisions) : -1;
    if (outcome === 'ok') toast.success(copy.kirim.berhasil);
    else if (outcome === 'closed') onClosed(draft);
    else if (outcome === 'locked') void writes.refresh();
    else if (outcome === 'invalid' && placed >= 0) {
      const first = placed;
      const m = stepMissing(SPARTA_STEPS[first], draft, divisions);
      setStep(first);
      setFromReview(true);
      setMissing(m);
      setFocus({ kind: 'missing', sk: skOf(m[0]) });
    } else
      // Offline, network, 5xx, or a 400 the screen's own checks can't place: keep everything, with Coba lagi.
      sentToast.current = toast.error(copy.kirim.gagal, {
        action: {
          label: common.actions.cobaLagi,
          onClick: () => void submit(),
        },
      });
  };

  const isMissing = (sk: string) => missing.some((m) => skOf(m) === sk);
  const savedMark =
    saveState === 'saved' ? (
      <Saved className="text-fg-3" />
    ) : saveState === 'failed' ? (
      <span className="g-err t-cap" role="alert">
        <IconPeringatan size={16} />
        {copy.draf.gagal}
        <Button variant="ghost" size="sm" onClick={() => void saveNow()}>
          {common.actions.cobaLagi}
        </Button>
      </span>
    ) : (
      <span className="g-fill-saved" />
    );

  // The start: the deadline and the four steps.
  if (step < 0) {
    const started = !!draft.kelas || !!draft.idLine || draft.choices.length > 0;
    return (
      <Page>
        <div className="g-fill-head">
          <p className="g-fill-desc t-sm text-fg-2">
            {serviceById('sparta').description}
          </p>
          {win.closesAt ? (
            <p className="t-sub">
              {fill(copy.tenggat, { waktu: deadlineWhen(win.closesAt) })}
            </p>
          ) : null}
        </div>
        <ol className="g-steps">
          {copy.langkah.map((l) => (
            <li key={l} className="t-sm">
              {l}
            </li>
          ))}
        </ol>
        {savedMark}
        <div className="g-form-nav">
          <span />
          <Button variant="gold" onClick={() => go(0)}>
            {started ? copy.lanjutkan : copy.mulai}
          </Button>
        </div>
      </Page>
    );
  }

  const review = step >= N;
  const bar = (
    <Segbar
      total={N}
      done={review ? N : step + 1}
      label={
        review
          ? copy.periksa.judul
          : fill(copy.langkahDari, {
              nomor: step + 1,
              jumlah: N,
              judul: copy.langkah[step],
            })
      }
    />
  );
  const prev = (
    <Button variant="paper" onClick={() => go(Math.min(step, N) - 1)}>
      {formCopy.isi.sebelumnya}
    </Button>
  );

  if (review)
    return (
      <Page>
        <div className="g-fill-head">
          {bar}
          <div className="g-between">
            <h2 className="t-title" ref={titleRef} tabIndex={-1}>
              {copy.periksa.judul}
            </h2>
            {savedMark}
          </div>
        </div>
        <SpartaCheck
          draft={draft}
          departments={departments}
          onEdit={(s) => go(s, { fromReview: true })}
        />
        <div className="g-form-nav">
          {prev}
          <Button variant="gold" onClick={next}>
            {copy.periksa.kirim}
          </Button>
        </div>
        <ConfirmDialog
          open={confirming}
          onOpenChange={(open) => {
            if (!writes.sending) setConfirming(open);
          }}
          title={copy.kirim.judul}
          cancelLabel={copy.kirim.periksaLagi}
          confirmLabel={writes.sending ? copy.kirim.mengirim : copy.kirim.kirim}
          onConfirm={() => void submit()}
        >
          {copy.kirim.isi}
        </ConfirmDialog>
      </Page>
    );

  // Every change builds on the latest answers, not this render's: a file upload that finishes later must keep what
  // was typed while it ran.
  const set = (
    patch: (cur: SpartaDraft) => Partial<SpartaDraft>,
    now = false,
  ) => change({ ...latest.current, ...patch(latest.current) }, { now });

  let content: React.ReactNode;
  if (SPARTA_STEPS[step] === 'umum') {
    content = (
      <div className="g-qs">
        <TextField
          id={`${ID}-kelas`}
          sk="kelas"
          label={copy.umum.kelas}
          value={draft.kelas}
          onChange={(kelas) => set(() => ({ kelas }))}
          missing={isMissing('kelas')}
        />
        <TextField
          id={`${ID}-idline`}
          sk="idLine"
          label={copy.umum.idLine}
          value={draft.idLine}
          onChange={(idLine) => set(() => ({ idLine }))}
          missing={isMissing('idLine')}
        />
        <TextField
          id={`${ID}-pengalaman`}
          sk="pengalaman"
          label={copy.umum.pengalaman}
          value={draft.pengalamanOrganisasi}
          onChange={(pengalamanOrganisasi) =>
            set(() => ({ pengalamanOrganisasi }))
          }
          optional
          long
        />
        <fieldset className="g-qblock">
          <legend className="g-q-label">
            {copy.umum.kesibukan}{' '}
            <span className="g-opt-note">{formCopy.isi.opsional}</span>
          </legend>
          {draft.kesibukan.map((k, i) => (
            <div key={i} className="g-kesibukan">
              <div className="g-between">
                <p className="t-label">
                  {fill(copy.umum.kesibukanKe, { nomor: i + 1 })}
                </p>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  aria-label={fill(copy.umum.hapusKesibukan, { nomor: i + 1 })}
                  onClick={() =>
                    set(
                      (cur) => ({
                        kesibukan: cur.kesibukan.filter((_, j) => j !== i),
                      }),
                      true,
                    )
                  }
                >
                  {copy.umum.hapus}
                </Button>
              </div>
              {(['jabatan', 'organisasi', 'periode'] as const).map((part) => (
                <TextField
                  key={part}
                  id={`${ID}-kesibukan-${i}-${part}`}
                  sk={`kesibukan-${i}-${part}`}
                  label={copy.umum[part]}
                  value={k[part]}
                  missing={isMissing(`kesibukan-${i}-${part}`)}
                  onChange={(v) =>
                    set((cur) => ({
                      kesibukan: cur.kesibukan.map((x, j) =>
                        j === i ? { ...x, [part]: v } : x,
                      ),
                    }))
                  }
                />
              ))}
            </div>
          ))}
          <div>
            <Button
              variant="paper"
              size="sm"
              onClick={() =>
                set((cur) => ({
                  kesibukan: [
                    ...cur.kesibukan,
                    { jabatan: '', organisasi: '', periode: '' },
                  ],
                }))
              }
            >
              <IconTambah size={16} />
              {copy.umum.tambahKesibukan}
            </Button>
          </div>
        </fieldset>
      </div>
    );
  } else if (SPARTA_STEPS[step] === 'penjelasan') {
    content = (
      <div className="g-review">
        {departments.map((dept) => (
          <section
            key={dept.id}
            className="g-rv-sec"
            aria-labelledby={`${ID}-d-${dept.id}`}
          >
            <h3 className="t-heading" id={`${ID}-d-${dept.id}`}>
              {dept.name}
            </h3>
            <dl className="g-rv-list g-div-list">
              {(dept.divisions ?? []).map((d) => (
                <div key={d.id}>
                  <dt>{d.name}</dt>
                  <dd>{d.description ?? ''}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    );
  } else if (SPARTA_STEPS[step] === 'pilih') {
    content = (
      <ChoicePicker
        departments={departments}
        divisions={divisions}
        choices={draft.choices}
        missing={isMissing('choices')}
        moved={moved}
        onChange={(choices, announce) => {
          setMoved(announce ?? '');
          set(() => ({ choices }), true);
        }}
      />
    );
  } else {
    content = (
      <div className="g-review">
        {draft.choices.map((id, i) => {
          const division = divisions.find((d) => d.id === id);
          if (!division) return null;
          const dept = departments.find((d) => d.id === division.departmentId);
          const headId = `${ID}-q-${id}`;
          return (
            <section key={id} className="g-qs" aria-labelledby={headId}>
              <div>
                <h3 className="t-heading" id={headId}>
                  {fill(copy.pertanyaan.pilihanKe, {
                    nomor: i + 1,
                    divisi: division.name,
                  })}
                </h3>
                {dept ? <p className="t-cap text-fg-2">{dept.name}</p> : null}
              </div>
              {division.questionsRaw ? (
                <Disclosure label={copy.pertanyaan.pertanyaanAsli}>
                  <p className="t-sm whitespace-pre-line text-fg-2">
                    {division.questionsRaw}
                  </p>
                </Disclosure>
              ) : null}
              {division.questions.map((q) => (
                <DivisionQuestion
                  key={q.id}
                  q={q}
                  idPrefix={`${ID}-${id}`}
                  sk={`q-${id}-${q.id}`}
                  value={draft.answers[id]?.[q.id] ?? ''}
                  missing={isMissing(`q-${id}-${q.id}`)}
                  onChange={(v) =>
                    set(
                      (cur) => ({
                        answers: {
                          ...cur.answers,
                          [id]: { ...cur.answers[id], [q.id]: v },
                        },
                      }),
                      q.type === 'file' || q.type === 'select',
                    )
                  }
                />
              ))}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <Page>
      <div className="g-fill-head">
        <div className="g-between">
          <p className="t-cap text-fg-2 num">
            {fill(copy.langkahDari, {
              nomor: step + 1,
              jumlah: N,
              judul: copy.langkah[step],
            })}
          </p>
          {savedMark}
        </div>
        {bar}
        <h2 className="t-title" ref={titleRef} tabIndex={-1}>
          {copy.langkah[step]}
        </h2>
      </div>
      {missing.length ? (
        <p className="g-err t-sm" role="alert">
          <IconPeringatan size={16} />
          {formCopy.isi.masihAda}
        </p>
      ) : null}
      {content}
      <div className="g-form-nav">
        {step > 0 && !fromReview ? prev : <span />}
        <Button variant="gold" onClick={next}>
          {fromReview ? formCopy.isi.kembaliKeRingkasan : formCopy.isi.lanjut}
        </Button>
      </div>
    </Page>
  );
}

/**
 * Pilih divisi: tick exactly four (option rows, by department), then put them in priority order with Naikkan and
 * Turunkan (keyboard and touch; no drag, no new icons). Focus stays with the division that moved.
 */
function ChoicePicker({
  departments,
  divisions,
  choices,
  missing,
  moved,
  onChange,
}: {
  departments: InternshipDepartment[];
  divisions: InternshipDivision[];
  choices: string[];
  missing: boolean;
  moved: string;
  onChange: (choices: string[], announce?: string) => void;
}) {
  const errId = `${ID}-choices-err`;
  const full = choices.length >= SPARTA_CHOICES;
  const listRef = useRef<HTMLOListElement>(null);
  const [follow, setFollow] = useState<{ id: string; dir: -1 | 1 } | null>(
    null,
  );
  const nameOf = (id: string) => divisions.find((d) => d.id === id)?.name ?? id;

  useEffect(() => {
    if (!follow) return;
    setFollow(null);
    const li = listRef.current?.querySelector<HTMLElement>(
      `[data-choice="${follow.id}"]`,
    );
    const buttons = li?.querySelectorAll<HTMLButtonElement>('button');
    if (!buttons) return;
    // The same button, unless the division reached that end: then the other one.
    const same = buttons[follow.dir === -1 ? 0 : 1];
    const other = buttons[follow.dir === -1 ? 1 : 0];
    (same.getAttribute('aria-disabled') === 'true' ? other : same).focus();
  }, [follow]);

  const move = (i: number, dir: -1 | 1) => {
    const next = moveChoice(choices, i, dir);
    if (next === choices) return;
    setFollow({ id: choices[i], dir });
    onChange(
      next,
      fill(copy.pilih.dipindah, {
        divisi: nameOf(choices[i]),
        nomor: i + dir + 1,
      }),
    );
  };

  return (
    <div className="g-qs" data-sk="choices">
      <p className="t-sm text-fg-2">{copy.pilih.petunjuk}</p>
      {departments.map((dept) => (
        <fieldset
          key={dept.id}
          className="g-qblock"
          aria-describedby={missing ? errId : undefined}
        >
          <legend className="g-q-label">{dept.name}</legend>
          <div className="g-opts">
            {(dept.divisions ?? []).map((d) => {
              const on = choices.includes(d.id);
              return (
                <Checkbox
                  key={d.id}
                  checked={on}
                  disabled={!on && full}
                  aria-invalid={missing || undefined}
                  onChange={() => onChange(toggleChoice(choices, d.id))}
                >
                  {d.name}
                </Checkbox>
              );
            })}
          </div>
        </fieldset>
      ))}
      {missing ? <FieldError id={errId}>{copy.pilih.kurang}</FieldError> : null}
      <section className="g-qblock" aria-labelledby={`${ID}-urutan`}>
        <h3 className="g-q-label" id={`${ID}-urutan`}>
          {copy.pilih.urutan}
        </h3>
        {choices.length ? (
          <ol className="g-prio" ref={listRef}>
            {choices.map((id, i) => (
              <li key={id} data-choice={id}>
                <span className="g-prio-n" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="g-prio-name">{nameOf(id)}</span>
                <span className="g-prio-moves">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-disabled={i === 0 || undefined}
                    aria-label={fill(copy.pilih.naikLabel, {
                      divisi: nameOf(id),
                      nomor: Math.max(i, 1),
                    })}
                    onClick={() => move(i, -1)}
                  >
                    {copy.pilih.naik}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-disabled={i === choices.length - 1 || undefined}
                    aria-label={fill(copy.pilih.turunLabel, {
                      divisi: nameOf(id),
                      nomor: Math.min(i + 2, choices.length),
                    })}
                    onClick={() => move(i, 1)}
                  >
                    {copy.pilih.turun}
                  </Button>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="t-sm text-fg-3">{copy.pilih.kosong}</p>
        )}
        <p className="sr-only" role="status">
          {moved}
        </p>
      </section>
    </div>
  );
}
