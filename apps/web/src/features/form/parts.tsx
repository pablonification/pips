import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type {
  FormAnswer,
  FormDetail,
  FormResponse,
  FormSection,
} from '~/api/generated';
import {
  Button,
  Disclosure,
  Halftone,
  Plaque,
  PixelReaction,
  Skeleton,
  SkeletonBar,
  SkeletonBlock,
  Tile,
  DESKTOP_QUERY,
  useMediaQuery,
} from '~/components/garis';
import { IconPensil } from '~/components/icons/pensil';
import { IconTenggat } from '~/components/icons/tenggat';
import { PageBody, PageTitle } from '~/components/shell/page';
import { fill } from '~/copy/fill';
import { isi } from '~/copy/isi';
import { cn } from '~/lib/utils';
import {
  answerText,
  fieldInfo,
  questionsOf,
  sentFieldText,
  shownIds,
  whenShort,
  type ProfileField,
} from './rules';

/**
 * The gold cover on every form, in every layout: the title (the page's heading), the description and when it closes.
 * On desktop it is a band from the sidebar to the window's edge, under the breadcrumbs (form.css).
 */
export function Cover({
  title,
  description,
  closesAt,
}: {
  title: string;
  description?: string | null;
  closesAt?: string | null;
}) {
  const desk = useMediaQuery(DESKTOP_QUERY);
  return (
    <div className="f-cover g-fx">
      <Halftone length={desk ? 360 : 216} />
      <PageTitle display={false} className="f-title">
        {title}
      </PageTitle>
      {description ? <p className="desc">{description}</p> : null}
      {closesAt ? (
        <div className="metas">
          <p>
            <IconTenggat size={16} />
            {fill(isi.sampul.tutup, { waktu: whenShort(closesAt) })}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** The column under the cover; on desktop the side column sits beside it. */
export function Body({
  aside,
  children,
}: {
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageBody className="f-body g-fx">
      <div className="f-desk">{children}</div>
      {aside}
    </PageBody>
  );
}

export function Loading() {
  return (
    <Skeleton label={isi.keadaan.memuat}>
      <div className="grid gap-2.5">
        <SkeletonBar width="90%" />
        <SkeletonBar width="60%" />
        <SkeletonBlock height={44} />
        <SkeletonBlock height={44} />
        <SkeletonBlock height={44} />
      </div>
    </Skeleton>
  );
}

/** One of the states a form or its link can be in: an icon, what it is, and what to do. */
export function FormState({
  icon,
  title,
  text,
  children,
}: {
  icon: ReactNode;
  /** Absent when the page's own title already says it ("Form tidak ditemukan"). */
  title?: string;
  text: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="f-state">
      <Tile>{icon}</Tile>
      {title ? <h2 className="t-title">{title}</h2> : null}
      <p className="t-sm text-fg-2 num">{text}</p>
      <div className="f-sent-wrap" style={{ marginTop: 8 }}>
        {children}
      </div>
    </div>
  );
}

export function ToList({ label = isi.keadaan.kembali }: { label?: string }) {
  return (
    <Button variant="paper" asChild>
      <Link to="/layanan/form">{label}</Link>
    </Button>
  );
}

/* ================= The pips ================= */

export interface PipState {
  sections: readonly FormSection[];
  shown: Set<string>;
  done: Set<string>;
  bad: Set<string>;
  active: string | null;
  /** The questions page, or the agreement step (every pip then reads as done). */
  step: 'q' | 'agree';
  /** A last, wide pip for the agreement step, when the form requests anything. */
  end: boolean;
}

const pipClass = (p: PipState, id: string) =>
  p.bad.has(id)
    ? 'bad'
    : p.active === id && p.step === 'q'
      ? 'now'
      : p.done.has(id) || p.step !== 'q'
        ? 'done'
        : undefined;

function PipGroup({ p, ids }: { p: PipState; ids: string[] }) {
  return (
    <span className="grp">
      {ids
        .filter((id) => p.shown.has(id))
        .map((id) => (
          <i key={id} className={pipClass(p, id)} />
        ))}
    </span>
  );
}

/** How far the member is, for screen readers. */
export function progressProps(p: PipState) {
  const n = [...p.shown].length;
  const done = [...p.shown].filter((id) => p.done.has(id)).length;
  return {
    role: 'progressbar' as const,
    'aria-label': isi.samping.kemajuan,
    'aria-valuemin': 0,
    'aria-valuemax': n,
    'aria-valuenow': done,
    'aria-valuetext': fill(isi.samping.terjawab, { jumlah: done, semua: n }),
  };
}

/** One square per question, grouped by section; the wide last one is the agreement step. */
export function Pips({ p }: { p: PipState }) {
  return (
    <span className="f-pips g-fx" {...progressProps(p)}>
      {p.sections.map((s) => (
        <PipGroup key={s.id} p={p} ids={s.questions.map((q) => q.id)} />
      ))}
      {p.end ? (
        <span className="grp">
          <i className={cn('end', p.step === 'agree' && 'now')} />
        </span>
      ) : null}
    </span>
  );
}

/** The side column on desktop: each section with its pips (a way to it), Draf tersimpan, and the keys. */
export function Aside({
  p,
  saved,
  onSection,
}: {
  p: PipState;
  saved: ReactNode;
  onSection: (sectionId: string) => void;
}) {
  const s = isi.samping;
  const many = p.sections.length > 1;
  const activeSection = p.sections.find((x) =>
    x.questions.some((q) => q.id === p.active),
  );
  return (
    <aside className="f-aside" aria-label={s.label}>
      {many ? (
        <div className="f-toc">
          {p.sections.map((sec, i) => (
            <button
              key={sec.id}
              type="button"
              className={cn(activeSection === sec && 'now')}
              onClick={() => onSection(sec.id)}
            >
              <span className="clamp1">
                {sec.title || fill(s.bagian, { nomor: i + 1 })}
              </span>
              <span className="f-pips" aria-hidden="true">
                <PipGroup p={p} ids={sec.questions.map((q) => q.id)} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <span className="f-pips" aria-hidden="true">
          <PipGroup p={p} ids={questionsOf(p.sections).map((q) => q.id)} />
        </span>
      )}
      <span className="sr-only" {...progressProps(p)} />
      {saved}
      <div className="f-keys" aria-hidden="true">
        <span>
          <kbd className="g-kbd">A</kbd>
          <kbd className="g-kbd">B</kbd>
          <kbd className="g-kbd">C</kbd> {s.pilihJawaban}
        </span>
        <span>
          <kbd className="g-kbd">{isi.tanya.enter}</kbd> {s.berikutnya}
        </span>
      </div>
    </aside>
  );
}

/* ================= Sent ================= */

const CONFETTI = [
  'var(--ink)',
  'var(--px-cream)',
  'var(--px-white)',
  'var(--px-bronze)',
];

/** What was sent: each question shown with its answer, then what went along from the profile. */
export function SentList({
  sections,
  response,
}: {
  sections: readonly FormSection[];
  response: FormResponse;
}) {
  const t = isi.terkirim;
  const byId = new Map<string, FormAnswer>(
    response.answers.map((a) => [a.questionId, a]),
  );
  const a: Record<string, string | string[]> = {};
  for (const x of response.answers) a[x.questionId] = x.answer;
  const shown = shownIds(sections, a);
  const profile = Object.entries(response.profile ?? {}).filter(
    (e): e is [ProfileField, string] => typeof e[1] === 'string',
  );
  return (
    <div>
      <dl className="sent-list">
        {questionsOf(sections)
          .filter((q) => shown.has(q.id))
          .map((q) => {
            const text = answerText(q, byId.get(q.id));
            return (
              <div key={q.id}>
                <dt>{q.label}</dt>
                <dd className={text ? undefined : 'none'}>
                  {text || t.tidakDiisi}
                </dd>
              </div>
            );
          })}
      </dl>
      {profile.length ? (
        <>
          <div
            className="slip-tear"
            style={{ marginInline: -14 }}
            aria-hidden="true"
          />
          <dl style={{ margin: 0 }}>
            {profile.map(([k, v]) => (
              <div key={k} className="slip-row">
                <dt>{isi.bidang[k]}</dt>
                <dd>
                  <span>{fieldInfo(k) ? sentFieldText(k, v) : v}</span>
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
    </div>
  );
}

/** The thank-you: the plaque (with a little celebration right after sending), what was sent, and Ubah jawaban. */
export function Sent({
  form,
  response,
  fresh,
  onChange,
}: {
  form: FormDetail;
  response: FormResponse;
  fresh: boolean;
  onChange: () => void;
}) {
  const t = isi.terkirim;
  const at = response.updatedAt ?? response.submittedAt;
  return (
    <div className="f-step" data-f-step="sent">
      <Plaque className={cn('f-sent', fresh && 'in')}>
        {fresh ? (
          <span className="f-conf" aria-hidden="true">
            {Array.from({ length: 16 }, (_, i) => (
              <i
                key={i}
                style={
                  {
                    '--x': `${6 + i * 6}%`,
                    '--s': `${[6, 8, 5, 10][i % 4]}px`,
                    '--c': CONFETTI[i % 4],
                    '--d': `${900 + (i % 5) * 160}ms`,
                    '--w': `${120 + (i % 7) * 60}ms`,
                    '--dx': `${(i % 2 ? 1 : -1) * (8 + (i % 4) * 6)}px`,
                  } as React.CSSProperties
                }
              />
            ))}
          </span>
        ) : null}
        <span className="g-px">
          <PixelReaction reaction="party" size={40} />
        </span>
        <h2 className="t-title" data-sent-title="" tabIndex={-1}>
          {form.thanks || t.terimaKasih}
        </h2>
        <p className="sub">
          {fill(response.updatedAt ? t.diperbarui : t.terkirim, {
            waktu: whenShort(at),
          })}
        </p>
      </Plaque>
      {form.sections ? (
        <Disclosure label={t.yangDikirim}>
          <SentList sections={form.sections} response={response} />
        </Disclosure>
      ) : null}
      <div className="f-sent-wrap">
        {form.canChange ? (
          <Button variant="paper" onClick={onChange}>
            <IconPensil size={16} /> {t.ubahJawaban}
          </Button>
        ) : null}
        <Button variant={form.canChange ? 'ghost' : 'paper'} asChild>
          <Link to="/">{t.keBeranda}</Link>
        </Button>
      </div>
      {form.canChange ? (
        <p className="t-cap text-fg-3 num">
          {form.closesAt
            ? fill(t.bisaDiubah, { waktu: whenShort(form.closesAt) })
            : t.bisaDiubahTanpaWaktu}
        </p>
      ) : null}
    </div>
  );
}
